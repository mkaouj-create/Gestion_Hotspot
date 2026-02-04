
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CloudUpload, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { db } from '../services/db';

const Import: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [importSummary, setImportSummary] = useState({ success: 0, duplicates: 0 });
  const [tenantId, setTenantId] = useState<string>('');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    db.auth.getUser().then(({ data: { user } }) => {
      if (user) db.from('users').select('tenant_id').eq('id', user.id).single().then(({ data }) => setTenantId(data?.tenant_id || ''));
    });
  }, []);

  const handleFile = (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.csv')) { setError("Fichier CSV MikroTik uniquement (.csv)"); return; }
    setFile(selectedFile); setError(null);
  };

  const parseCSV = useCallback(() => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string).replace(/^\uFEFF/, '');
      const lines = text.split('\n').filter(l => l.trim() !== '');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
      const uIdx = headers.indexOf('username');
      if (uIdx === -1) { setError("Format invalide (colonne 'username' manquante)"); return; }
      const pIdx = headers.indexOf('password');
      const prIdx = headers.indexOf('profile');
      const tickets = lines.slice(1).map(l => {
        const c = l.split(',').map(col => col.trim().replace(/"/g, ''));
        return { username: c[uIdx], password: pIdx !== -1 ? c[pIdx] : '', profile: prIdx !== -1 ? (c[prIdx] || 'Standard') : 'Standard' };
      }).filter(t => t.username);
      setParsedData(tickets);
      const uniqueProfiles = Array.from(new Set(tickets.map(t => t.profile)));
      setProfiles(uniqueProfiles.map((p, i) => ({ id: i, name: p, price: '' })));
      setStep(2);
    };
    reader.readAsText(file);
  }, [file]);

  const runImport = async () => {
    if (profiles.some(p => !p.price)) { setError("Veuillez définir tous les prix."); return; }
    setIsSubmitting(true); setProgress(0);
    try {
      const profileMap: Record<string, string> = {};
      for (const p of profiles) {
        const { data: existing } = await db.from('ticket_profiles').select('id').eq('tenant_id', tenantId).eq('name', p.name).maybeSingle();
        if (existing) { profileMap[p.name] = existing.id; await db.from('ticket_profiles').update({ price: Number(p.price) }).eq('id', existing.id); } 
        else { const { data: created } = await db.from('ticket_profiles').insert({ tenant_id: tenantId, name: p.name, price: Number(p.price) }).single(); if (created) profileMap[p.name] = created.id; }
      }
      const payload = parsedData.map(t => ({ tenant_id: tenantId, profile_id: profileMap[t.profile], username: t.username, password: t.password, status: 'NEUF' }));
      const BATCH_SIZE = 100;
      let totalSuccess = 0;
      let totalDupes = 0;
      for (let i = 0; i < payload.length; i += BATCH_SIZE) {
        const batch = payload.slice(i, i + BATCH_SIZE);
        const { data: existing } = await db.from('tickets').select('username').eq('tenant_id', tenantId).in('username', batch.map(b => b.username));
        const existingSet = new Set(existing?.map(e => e.username));
        const unique = batch.filter(b => !existingSet.has(b.username));
        if (unique.length > 0) { const { error: insErr } = await db.from('tickets').insert(unique); if (insErr) throw insErr; totalSuccess += unique.length; }
        totalDupes += (batch.length - unique.length);
        setProgress(Math.round(((i + batch.length) / payload.length) * 100));
      }
      setImportSummary({ success: totalSuccess, duplicates: totalDupes }); setStep(3);
    } catch (err: any) { setError(err.message); } finally { setIsSubmitting(false); }
  };

  return (
    <div className="space-y-8 pb-32 animate-in fade-in duration-500">
      <header className="flex items-center gap-4"><div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg"><CloudUpload /></div><h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Importation</h1></header>
      {error && <div className="p-5 bg-red-50 border border-red-100 rounded-3xl text-red-600 font-bold text-sm flex gap-3"><AlertTriangle /> {error}</div>}
      {step === 1 && (<div className="bg-white p-12 rounded-[3.5rem] border border-slate-100 text-center space-y-8"><div className="border-4 border-dashed border-slate-100 rounded-[3rem] p-20 bg-slate-50/30 hover:bg-slate-50 transition-colors relative cursor-pointer group"><input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} accept=".csv" /><CloudUpload className="w-16 h-16 mx-auto mb-6 text-slate-200 group-hover:text-brand-600 transition-colors" /><p className="font-black text-slate-400 group-hover:text-slate-900">{file ? file.name : "Cliquez ou glissez votre CSV MikroTik ici"}</p></div>{file && <button onClick={parseCSV} className="w-full py-5 bg-brand-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Analyser le fichier</button>}</div>)}
      {step === 2 && (<div className="space-y-6"><div className="bg-white p-10 rounded-[3rem] border border-slate-100 space-y-8"><h3 className="font-black text-xl uppercase tracking-tight">Configuration des prix</h3><div className="space-y-4">{profiles.map(p => (<div key={p.id} className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-100"><span className="font-black text-slate-700">{p.name}</span><input type="number" placeholder="Prix (ex: 2000)" value={p.price} onChange={e => setProfiles(prev => prev.map(x => x.id === p.id ? {...x, price: e.target.value} : x))} className="w-40 p-3 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-brand-50 font-black text-right" /></div>))}</div>{isSubmitting && <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-brand-600 transition-all" style={{width: `${progress}%`}} /></div>}<button onClick={runImport} disabled={isSubmitting} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3">{isSubmitting ? <Loader2 className="animate-spin" /> : "Lancer l'importation"}</button></div></div>)}
      {step === 3 && (<div className="bg-white p-16 rounded-[4rem] border border-slate-100 text-center animate-in zoom-in-95"><CheckCircle2 className="w-24 h-24 text-emerald-500 mx-auto mb-8" /><h2 className="text-4xl font-black text-slate-900 mb-2">Importation Terminée</h2><div className="flex justify-center gap-8 py-10"><div><p className="text-3xl font-black text-emerald-600">{importSummary.success}</p><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Importés</p></div><div><p className="text-3xl font-black text-orange-600">{importSummary.duplicates}</p><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Doublons</p></div></div><button onClick={() => navigate('/stock')} className="bg-brand-600 text-white px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Voir le stock</button></div>)}
    </div>
  );
};
export default Import;
