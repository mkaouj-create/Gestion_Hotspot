
import React, { useEffect, useState } from 'react';
import { MapPin, Plus, Search, Loader2, Map, Activity, Trash2, Pencil, X, Save, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { db } from '../services/db';
import { Zone } from '../types';

const Zones: React.FC = () => {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [zoneToDelete, setZoneToDelete] = useState<Zone | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [formData, setFormData] = useState({ name: '', location: '' });

  useEffect(() => { fetchZones(); }, []);
  const showToast = (type: 'success' | 'error', message: string) => { setToast({ type, message }); setTimeout(() => setToast(null), 3000); };

  const fetchZones = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await db.auth.getUser();
      if (!user) return;
      const { data: profile } = await db.from('users').select('tenant_id').eq('id', user.id).single();
      if (profile?.tenant_id) {
         const { data, error } = await db.from('zones').select('*').eq('tenant_id', profile.tenant_id).order('created_at', { ascending: false });
        if (error) throw error; setZones(data || []);
      }
    } catch (err: any) { showToast('error', err.message); } finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      const { data: { user } } = await db.auth.getUser(); if (!user) return;
      const { data: profile } = await db.from('users').select('tenant_id').eq('id', user.id).single();
      if (editingZone) {
        const { error } = await db.from('zones').update({ name: formData.name, location: formData.location }).eq('id', editingZone.id);
        if (error) throw error; showToast('success', "Zone mise à jour");
      } else {
        const { error } = await db.from('zones').insert({ name: formData.name, location: formData.location, tenant_id: profile?.tenant_id });
        if (error) throw error; showToast('success', "Nouvelle zone créée");
      }
      setIsModalOpen(false); fetchZones();
    } catch (err: any) { showToast('error', err.message); } finally { setIsSubmitting(false); }
  };

  const confirmDelete = async () => {
    if (!zoneToDelete) return; setIsDeleting(true);
    try {
      const { error } = await db.from('zones').delete().eq('id', zoneToDelete.id);
      if (error) throw error; setZones(prev => prev.filter(z => z.id !== zoneToDelete.id)); showToast('success', "Zone supprimée"); setZoneToDelete(null);
    } catch (err: any) { showToast('error', "Erreur : " + err.message); } finally { setIsDeleting(false); }
  };

  const filteredZones = zones.filter(z => z.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500 relative">
      {toast && (<div className={`fixed top-6 right-6 z-[100] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right-10 border ${toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-red-600 text-white border-red-500'}`}>{toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}<p className="font-bold text-sm">{toast.message}</p></div>)}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6"><div><div className="flex items-center gap-2 text-brand-600 mb-1"><Map className="w-4 h-4" /><span className="text-[10px] font-black uppercase tracking-widest">Infrastructures WiFi</span></div><h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-none">Zones WiFi</h1><p className="text-slate-400 font-medium text-sm mt-2">Gérez vos emplacements physiques de couverture.</p></div><button onClick={() => { setEditingZone(null); setFormData({name:'', location:''}); setIsModalOpen(true); }} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold text-sm flex items-center gap-3 shadow-xl hover:bg-black transition-all"><Plus className="w-5 h-5" /> Nouvelle Zone</button></header>
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden"><div className="p-8 border-b border-slate-50"><div className="relative max-w-md group"><Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-brand-600 transition-colors" /><input type="text" placeholder="Chercher une zone..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-14 pr-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-50 outline-none font-bold text-slate-700 transition-all" /></div></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-8">{loading ? (<div className="col-span-full py-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-brand-600/20" /></div>) : filteredZones.length > 0 ? filteredZones.map((zone) => (<div key={zone.id} className="bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-100 hover:border-brand-500 hover:bg-white transition-all group relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10"><MapPin className="w-20 h-20 text-slate-900" /></div><div className="flex justify-between items-start mb-6"><div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${zone.is_active !== false ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}><Activity className="w-6 h-6" /></div><div className="flex gap-2"><button onClick={() => { setEditingZone(zone); setFormData({name:zone.name, location:zone.location}); setIsModalOpen(true); }} className="p-2 text-slate-300 hover:text-slate-900 bg-white rounded-xl shadow-sm"><Pencil className="w-4 h-4" /></button><button onClick={() => setZoneToDelete(zone)} className="p-2 text-slate-300 hover:text-red-600 bg-white rounded-xl shadow-sm"><Trash2 className="w-4 h-4" /></button></div></div><h3 className="text-xl font-black text-slate-900 mb-1">{zone.name}</h3><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{zone.location || 'Localisation non définie'}</p><div className="mt-6 flex items-center gap-2"><div className={`h-2 w-2 rounded-full ${zone.is_active !== false ? 'bg-emerald-500' : 'bg-slate-300'}`}></div><span className="text-[10px] font-black uppercase text-slate-400">{zone.is_active !== false ? 'Zone Active' : 'Inactif'}</span></div></div>)) : (<div className="col-span-full py-20 text-center"><Map className="w-16 h-16 text-slate-200 mx-auto mb-4" /><p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Aucune zone configurée</p></div>)}</div></div>
      {isModalOpen && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isSubmitting && setIsModalOpen(false)} /><form onSubmit={handleSubmit} className="bg-white w-full max-w-sm rounded-[3rem] p-10 relative z-10 animate-in zoom-in-95 shadow-2xl"><button type="button" onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900"><X className="w-6 h-6" /></button><h2 className="text-2xl font-black mb-2 uppercase text-slate-900 tracking-tight">{editingZone ? 'Modifier Zone' : 'Nouvelle Zone'}</h2><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Configuration Infrastructure</p><div className="space-y-6"><div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom de la Zone</label><input type="text" required placeholder="ex: Cafétéria Centrale" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-900 outline-none focus:bg-white transition-all" /></div><div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Localisation / Ville</label><input type="text" placeholder="ex: Conakry" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-900 outline-none focus:bg-white transition-all" /></div></div><button type="submit" disabled={isSubmitting} className="w-full mt-10 py-5 bg-slate-900 hover:bg-black text-white rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 shadow-xl">{isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4" /> ENREGISTRER</>}</button></form></div>)}
      {zoneToDelete && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isDeleting && setZoneToDelete(null)} /><div className="bg-white w-full max-w-sm rounded-[3rem] p-10 text-center relative z-10 animate-in zoom-in-95 shadow-2xl"><div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6"><AlertTriangle className="w-10 h-10" /></div><h3 className="text-xl font-black text-slate-900 mb-2 uppercase">Supprimer la zone ?</h3><p className="text-slate-500 text-sm mb-8">Cette action est irréversible pour <strong>{zoneToDelete.name}</strong>.</p><div className="space-y-3"><button onClick={confirmDelete} disabled={isDeleting} className="w-full py-5 bg-red-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-red-700 transition-all">{isDeleting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "CONFIRMER SUPPRESSION"}</button><button onClick={() => setZoneToDelete(null)} disabled={isDeleting} className="w-full py-5 bg-slate-100 text-slate-400 rounded-2xl font-black text-xs uppercase hover:bg-slate-200 transition-all">ANNULER</button></div></div></div>)}
    </div>
  );
};
export default Zones;
