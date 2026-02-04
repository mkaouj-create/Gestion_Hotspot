
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ArrowRight, Loader2, AlertCircle, LogOut, Sparkles, CheckCircle2 } from 'lucide-react';
import { db } from '../services/db';

interface Props { onSetupComplete: () => void; }

const CompleteSetup: React.FC<Props> = ({ onSetupComplete }) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState('');
  const [existingAgency, setExistingAgency] = useState<string | null>(null);

  useEffect(() => {
    db.auth.getUser().then(({ data: { user } }) => {
      if (user) db.from('users').select('tenant_id, tenants(name)').eq('id', user.id).maybeSingle().then(({ data }) => {
        if (data?.tenant_id) setExistingAgency((data.tenants as any)?.name || 'Votre Agence');
      });
    });
  }, []);

  const handleFinalize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || !agencyName.trim()) return;
    setIsLoading(true); setError(null);
    try {
      const { error: rpcError } = await db.rpc('create_new_agency', { p_agency_name: agencyName.trim() });
      if (rpcError) throw rpcError;
      onSetupComplete();
    } catch (err: any) { setError(err.message || "Erreur lors de la création."); setIsLoading(false); }
  };

  const handleLogout = async () => { await db.auth.signOut(); navigate('/'); };

  if (existingAgency) return (
    <div className="min-h-screen bg-brand-950 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-white rounded-[3rem] p-10 text-center animate-in zoom-in-95">
        <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle2 className="w-10 h-10" /></div>
        <h2 className="text-2xl font-black text-slate-900 mb-2 uppercase">Agence Détectée</h2><p className="text-slate-500 mb-8">Vous êtes déjà membre de <strong>{existingAgency}</strong>.</p>
        <button onClick={() => onSetupComplete()} className="w-full py-4 bg-brand-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-brand-700 transition-all">Accéder au Dashboard</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-brand-950 flex items-center justify-center p-6 font-sans relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden"><div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-brand-600 rounded-full blur-[150px] opacity-20"></div><div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600 rounded-full blur-[120px] opacity-20"></div></div>
      <div className="w-full max-w-lg bg-white rounded-[3.5rem] shadow-2xl p-10 md:p-14 text-center relative z-10 animate-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-brand-50 text-brand-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner"><Sparkles className="w-10 h-10" /></div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-3 uppercase">Configuration</h1><p className="text-slate-400 font-medium mb-10">Donnez un nom à votre nouvelle agence WiFi.</p>
          {error && (<div className="mb-8 p-5 bg-red-50 border border-red-100 rounded-[2rem] text-left flex items-start gap-3 text-red-600 animate-in fade-in slide-in-from-top-2"><AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /><p className="text-xs font-bold leading-relaxed">{error}</p></div>)}
          <form onSubmit={handleFinalize} className="space-y-6">
            <div className="space-y-2 text-left"><label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nom de l'Agence (Wifi Zone)</label><div className="relative group"><Building2 className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-brand-600 transition-colors" /><input type="text" required autoFocus placeholder="ex: Univers WiFi - Conakry" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} disabled={isLoading} className="w-full pl-16 pr-6 py-5 rounded-[2rem] border-2 border-slate-50 bg-slate-50 focus:bg-white focus:border-brand-100 outline-none font-black text-slate-900 text-lg transition-all placeholder:text-slate-300" /></div></div>
            <button type="submit" disabled={isLoading || !agencyName.trim()} className="w-full py-5 bg-brand-600 hover:bg-brand-700 text-white rounded-[2rem] font-black text-xs tracking-[0.2em] uppercase flex items-center justify-center gap-3 shadow-xl shadow-brand-200 disabled:opacity-70 disabled:cursor-not-allowed transition-all transform active:scale-[0.98]">{isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>CRÉER MON AGENCE <ArrowRight className="w-4 h-4" /></>}</button>
          </form>
          <div className="mt-12 pt-8 border-t border-slate-50"><button onClick={handleLogout} disabled={isLoading} className="flex items-center gap-2 text-slate-400 hover:text-red-500 font-black text-[10px] uppercase tracking-widest transition-colors mx-auto disabled:opacity-50"><LogOut className="w-4 h-4" /> Annuler et déconnexion</button></div>
      </div>
    </div>
  );
};
export default CompleteSetup;
