
import React, { useEffect, useState } from 'react';
import { Tag, Search, Loader2, Pencil, X, Save, AlertCircle, CheckCircle2, DollarSign, Zap, Ticket, AlertTriangle, TrendingUp } from 'lucide-react';
import { db } from '../services/db';

const Profiles: React.FC = () => {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProfile, setEditingProfile] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  
  // Edit Form States
  const [editPrice, setEditPrice] = useState('');
  const [editThreshold, setEditThreshold] = useState('10');
  const [editCost, setEditCost] = useState('0');
  
  const [currency, setCurrency] = useState('GNF');

  useEffect(() => { fetchProfiles(); }, []);
  const showToast = (type: 'success' | 'error', message: string) => { setToast({ type, message }); setTimeout(() => setToast(null), 3000); };

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await db.auth.getUser();
      if (!user) return;
      const { data: profile } = await db.from('users').select('tenant_id, tenants(currency)').eq('id', user.id).single();
      // On récupère aussi cost_price et low_stock_threshold
      const { data, error } = await db.from('ticket_profiles').select('*, tickets(count)').eq('tenant_id', profile?.tenant_id).order('name');
      if (error) throw error;
      setProfiles(data || []);
      setCurrency((profile?.tenants as any)?.currency || 'GNF');
    } catch (err: any) { showToast('error', err.message); } finally { setLoading(false); }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editingProfile) return;
    setIsSubmitting(true);
    try {
      const { error } = await db.from('ticket_profiles').update({ 
        price: Number(editPrice),
        low_stock_threshold: Number(editThreshold),
        cost_price: Number(editCost)
      }).eq('id', editingProfile.id);
      
      if (error) throw error;
      showToast('success', `Forfait ${editingProfile.name} mis à jour`);
      setEditingProfile(null); fetchProfiles();
    } catch (err: any) { showToast('error', err.message); } finally { setIsSubmitting(false); }
  };

  const filteredProfiles = profiles.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      {toast && (<div className={`fixed top-6 right-6 z-[60] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right-10 border ${toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-red-600 text-white border-red-500'}`}>{toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}<p className="font-bold text-sm">{toast.message}</p></div>)}
      
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-brand-600 mb-1"><Zap className="w-4 h-4 fill-current" /><span className="text-[10px] font-black uppercase tracking-widest">Catalogue Offres</span></div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Forfaits & Rentabilité</h1>
          <p className="text-slate-400 font-medium text-sm mt-2">Gérez vos prix, vos seuils d'alerte et suivez vos marges.</p>
        </div>
      </header>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative max-w-md w-full group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-brand-600 transition-colors" />
            <input type="text" placeholder="Chercher un forfait..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-14 pr-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-50 outline-none font-bold text-slate-700 transition-all" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-8">
          {loading ? (
            <div className="col-span-full py-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-brand-600/20" /></div>
          ) : filteredProfiles.length > 0 ? filteredProfiles.map((p) => {
            const stockCount = p.tickets?.[0]?.count || 0;
            const isLowStock = stockCount <= (p.low_stock_threshold || 10);
            const margin = p.price - (p.cost_price || 0);

            return (
              <div key={p.id} className={`bg-white p-8 rounded-[2.5rem] border-2 transition-all group relative overflow-hidden ${isLowStock ? 'border-red-100 bg-red-50/10' : 'border-slate-50 hover:border-brand-500'}`}>
                {isLowStock && (
                  <div className="absolute top-0 right-0 bg-red-500 text-white px-4 py-1 rounded-bl-2xl flex items-center gap-1.5 animate-pulse">
                    <AlertTriangle className="w-3 h-3" />
                    <span className="text-[9px] font-black uppercase">Stock Critique</span>
                  </div>
                )}
                
                <div className="flex justify-between items-start mb-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isLowStock ? 'bg-red-100 text-red-600' : 'bg-brand-50 text-brand-600'}`}><Tag className="w-6 h-6" /></div>
                  <button onClick={() => { 
                    setEditingProfile(p); 
                    setEditPrice(p.price.toString());
                    setEditThreshold((p.low_stock_threshold || 10).toString());
                    setEditCost((p.cost_price || 0).toString());
                  }} className="p-2.5 bg-white text-slate-300 hover:text-slate-900 rounded-xl shadow-sm border border-slate-100 transition-all"><Pencil className="w-4 h-4" /></button>
                </div>

                <h3 className="text-xl font-black text-slate-900 mb-1">{p.name}</h3>
                <div className="flex items-baseline gap-2 mb-4">
                  <p className="text-2xl font-black text-brand-600">{p.price.toLocaleString()}</p>
                  <span className="text-[10px] uppercase font-bold text-slate-400">{currency}</span>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    <span>Marge Estimée</span>
                    <span className="text-emerald-600">+{margin.toLocaleString()} {currency}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">En Stock</span>
                    <span className={`text-sm font-black ${isLowStock ? 'text-red-600' : 'text-slate-900'}`}>{stockCount} pcs</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-1000 ${isLowStock ? 'bg-red-500' : 'bg-brand-500'}`} style={{ width: `${Math.min(100, (stockCount / (p.low_stock_threshold * 5 || 50)) * 100)}%` }} />
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="col-span-full py-20 text-center text-slate-300 font-bold uppercase text-xs">Aucun forfait configuré</div>
          )}
        </div>
      </div>

      {editingProfile && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isSubmitting && setEditingProfile(null)} />
          <form onSubmit={handleUpdateProfile} className="bg-white w-full max-w-md rounded-[3rem] p-10 relative z-10 animate-in zoom-in-95 shadow-2xl">
            <button type="button" onClick={() => setEditingProfile(null)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900"><X className="w-6 h-6" /></button>
            <h2 className="text-2xl font-black mb-2 uppercase text-slate-900 tracking-tight">Configuration Experte</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">{editingProfile.name}</p>
            
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Prix de Vente Client ({currency})</label>
                <div className="relative mt-1">
                  <input type="number" required autoFocus value={editPrice} onChange={e => setEditPrice(e.target.value)} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black text-2xl text-brand-600 outline-none focus:bg-white transition-all" />
                  <DollarSign className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Seuil Alerte Stock</label>
                  <input type="number" value={editThreshold} onChange={e => setEditThreshold(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-lg outline-none focus:bg-white transition-all" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Coût de Revient</label>
                  <input type="number" value={editCost} onChange={e => setEditCost(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-lg outline-none focus:bg-white transition-all" />
                </div>
              </div>
              
              <div className="bg-emerald-50 p-4 rounded-2xl flex items-center gap-4">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-600 shadow-sm"><TrendingUp className="w-5 h-5" /></div>
                <div>
                  <p className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Bénéfice Net par ticket</p>
                  <p className="text-lg font-black text-emerald-900">{(Number(editPrice) - Number(editCost)).toLocaleString()} {currency}</p>
                </div>
              </div>
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full mt-10 py-5 bg-slate-900 hover:bg-black text-white rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 shadow-xl">
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4" /> APPLIQUER LA CONFIG</>}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default Profiles;
