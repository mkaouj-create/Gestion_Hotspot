import React, { useEffect, useState } from 'react';
import { CreditCard, Search, Loader2, ShieldCheck, Building2, MoreHorizontal, PauseCircle, PlayCircle, CalendarPlus, Calendar, AlertTriangle, Zap, CheckCircle2, AlertCircle, ArrowUpRight, Clock, Infinity, RefreshCcw } from 'lucide-react';
import { db } from '../services/db';
import { Tenant, UserRole } from '../types';

const Subscriptions: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIF' | 'SUSPENDU' | 'EXPIRE' | 'EN_ATTENTE'>('ALL');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [stats, setStats] = useState({ total: 0, active: 0, suspended: 0, expiringSoon: 0, pending: 0 });
  const [actionConfig, setActionConfig] = useState<{ tenant: Tenant; type: 'SUSPEND' | 'ACTIVATE' | 'EXTEND' | 'UNLIMITED'; days?: number; label?: string; } | null>(null);

  useEffect(() => { fetchSubscriptions(); }, []);
  const showToast = (type: 'success' | 'error', message: string) => { setToast({ type, message }); setTimeout(() => setToast(null), 4000); };

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await db.auth.getUser();
      if (!user) return;
      const { data: profile } = await db.from('users').select('role').eq('id', user.id).single();
      if (profile?.role !== UserRole.ADMIN_GLOBAL) { showToast('error', "Accès refusé."); setLoading(false); return; }
      
      const { data, error: fetchError } = await db.from('tenants').select('*').order('created_at', { ascending: false });
      if (fetchError) throw fetchError;
      
      const loadedTenants = data || []; 
      setTenants(loadedTenants); 
      calculateStats(loadedTenants);
    } catch (err: any) { console.error(err); showToast('error', err.message); } finally { setLoading(false); }
  };

  const calculateStats = (data: Tenant[]) => {
    const now = new Date(); 
    const weekFromNow = new Date(); weekFromNow.setDate(now.getDate() + 7);
    const s = { total: data.length, active: 0, suspended: 0, expiringSoon: 0, pending: 0 };
    
    data.forEach(t => {
      const end = t.subscription_end_at ? new Date(t.subscription_end_at) : null;
      const isExpired = end && end < now;
      
      if (t.subscription_status === 'EN_ATTENTE') s.pending++;
      else if (t.subscription_status === 'SUSPENDU') s.suspended++; 
      else if (!isExpired) s.active++;
      
      if (end && end > now && end < weekFromNow) s.expiringSoon++;
    });
    setStats(s);
  };

  const executeAction = async () => {
    if (!actionConfig) return;
    const { tenant, type, days } = actionConfig; 
    setProcessingId(tenant.id); 
    setActionConfig(null);
    
    try {
      let updatePayload: any = {}; 
      const now = new Date(); 
      const currentEnd = tenant.subscription_end_at ? new Date(tenant.subscription_end_at) : now;
      
      if (type === 'SUSPEND') {
          updatePayload = { subscription_status: 'SUSPENDU' };
      } else if (type === 'ACTIVATE') {
          updatePayload = { subscription_status: 'ACTIF' };
      } else if (type === 'UNLIMITED') {
          updatePayload = { subscription_end_at: null, subscription_status: 'ACTIF' };
      } else if (type === 'EXTEND') {
        // Si expiré ou null, on repart de maintenant. Sinon on ajoute à la date de fin actuelle.
        const baseDate = (!tenant.subscription_end_at || currentEnd < now) ? now : currentEnd;
        const newDate = new Date(baseDate); 
        newDate.setDate(newDate.getDate() + (days || 0));
        updatePayload = { subscription_end_at: newDate.toISOString(), subscription_status: 'ACTIF' };
      }
      
      const { error } = await db.from('tenants').update(updatePayload).eq('id', tenant.id);
      if (error) throw error;
      
      // Mise à jour locale optimiste, puis refresh complet
      const updatedTenants = tenants.map(t => t.id === tenant.id ? { ...t, ...updatePayload } : t);
      setTenants(updatedTenants); 
      calculateStats(updatedTenants); 
      showToast('success', `Action réussie.`);
      
      // Refresh complet pour être sûr
      fetchSubscriptions();
      
    } catch (err: any) { showToast('error', err.message); } finally { setProcessingId(null); setActiveMenu(null); }
  };

  const now = new Date();
  
  const filteredTenants = tenants.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase())).filter(t => {
    if (statusFilter === 'ALL') return true;
    
    const end = t.subscription_end_at ? new Date(t.subscription_end_at) : null;
    const isExpired = end && end < now;
    const isPending = t.subscription_status === 'EN_ATTENTE';
    
    if (statusFilter === 'EN_ATTENTE') return isPending;
    if (statusFilter === 'ACTIF') return (t.subscription_status === 'ACTIF' && !isExpired && !isPending);
    if (statusFilter === 'SUSPENDU') return t.subscription_status === 'SUSPENDU';
    if (statusFilter === 'EXPIRE') return isExpired && end && !isPending;
    
    return true;
  });

  if (loading) return <div className="h-96 flex flex-col items-center justify-center gap-6 text-slate-300"><Loader2 className="w-16 h-16 animate-spin text-indigo-600" /><p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Synchronisation Billing SaaS...</p></div>;

  return (
    <div className="space-y-8 font-sans pb-40 animate-in fade-in duration-500 relative">
      {toast && (<div className={`fixed top-6 right-6 z-[100] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right-10 border ${toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-red-600 text-white border-red-500'}`}>{toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}<p className="font-bold text-sm tracking-tight">{toast.message}</p></div>)}
      
      <header className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                  <div className="flex items-center gap-2 text-indigo-600 mb-2">
                      <ShieldCheck className="w-4 h-4 fill-current" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Master Billing Console</span>
                  </div>
                  <h1 className="text-4xl font-black text-slate-900 tracking-tight">Gestion des Abonnements</h1>
                  <p className="text-slate-400 font-medium mt-1">Supervisez les cycles de facturation de toutes vos agences.</p>
              </div>
              <button onClick={fetchSubscriptions} className="bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 transition-all shadow-sm">
                  <RefreshCcw className="w-4 h-4" /> Actualiser
              </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard label="Agences Totales" value={stats.total} icon={<Building2 className="w-5 h-5" />} color="bg-slate-900" />
              <StatCard label="Abonnements Actifs" value={stats.active} icon={<PlayCircle className="w-5 h-5" />} color="bg-emerald-600" />
              <StatCard label="En Attente" value={stats.pending} icon={<Clock className="w-5 h-5" />} color="bg-orange-500" />
              <StatCard label="Suspensions" value={stats.suspended} icon={<PauseCircle className="w-5 h-5" />} color="bg-red-600" />
              <StatCard label="Fin de validité < 7j" value={stats.expiringSoon} icon={<AlertTriangle className="w-5 h-5" />} color="bg-amber-500" />
          </div>
      </header>

      <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[500px]">
          <div className="p-8 border-b border-slate-50">
              <div className="flex flex-col md:flex-row gap-4 items-center">
                  <div className="relative group flex-1 w-full">
                      <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                      <input type="text" placeholder="Chercher une agence par nom..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-14 pr-6 py-5 rounded-2xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-8 focus:ring-indigo-50 outline-none font-bold text-slate-600 transition-all" />
                  </div>
                  <div className="flex gap-2 flex-wrap justify-center">
                      {(['ALL', 'ACTIF', 'EN_ATTENTE', 'SUSPENDU', 'EXPIRE'] as const).map(status => (
                          <button key={status} onClick={() => setStatusFilter(status)} className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${statusFilter === status ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                              {status.replace('_', ' ')}
                          </button>
                      ))}
                  </div>
              </div>
          </div>
          
          <div className="overflow-x-auto pb-40">
              <table className="w-full text-left">
                  <thead>
                      <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                          <th className="px-10 py-6">AGENCE</th>
                          <th className="px-10 py-6">VALIDITÉ JUSQU'AU</th>
                          <th className="px-10 py-6">TEMPS RESTANT</th>
                          <th className="px-10 py-6 text-center">STATUT</th>
                          <th className="px-10 py-6 text-right">ACTIONS</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                      {filteredTenants.map((tenant) => { 
                          const end = tenant.subscription_end_at ? new Date(tenant.subscription_end_at) : null; 
                          const isExpired = end && end < now; 
                          const isSuspended = tenant.subscription_status === 'SUSPENDU';
                          const isPending = tenant.subscription_status === 'EN_ATTENTE';
                          // CORRECTIF MAJEUR : Illimité seulement si PAS de date, PAS en attente, et PAS suspendu
                          const isUnlimited = !end && !isPending && !isSuspended; 
                          
                          const diff = end ? Math.ceil((end.getTime() - now.getTime()) / (1000 * 3600 * 24)) : 0; 

                          return (
                              <tr key={tenant.id} className="hover:bg-slate-50/50 transition-all group">
                                  <td className="px-10 py-8">
                                      <div className="flex items-center gap-4">
                                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner transition-all ${isUnlimited ? 'bg-indigo-600 text-white' : isSuspended ? 'bg-red-50 text-red-300' : isPending ? 'bg-orange-50 text-orange-400' : isExpired ? 'bg-red-50 text-red-400' : 'bg-indigo-50 text-indigo-600'}`}>
                                              <Building2 className="w-6 h-6" />
                                          </div>
                                          <div>
                                              <p className="font-black text-slate-900 tracking-tight text-lg flex items-center gap-2">
                                                  {tenant.name}
                                                  {isUnlimited && <Zap className="w-3 h-3 text-amber-500 fill-current" />}
                                              </p>
                                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ID: {tenant.id.split('-')[0]}</p>
                                          </div>
                                      </div>
                                  </td>
                                  <td className="px-10 py-8">
                                      <div className="flex items-center gap-3">
                                          <Calendar className="w-4 h-4 text-slate-300" />
                                          <p className={`text-sm font-black ${isUnlimited ? 'text-indigo-600 italic' : isPending ? 'text-orange-400' : 'text-slate-800'}`}>
                                              {isUnlimited ? 'ABONNEMENT ILLIMITÉ' : isPending ? 'En attente validation' : end ? end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Non défini'}
                                          </p>
                                      </div>
                                  </td>
                                  <td className="px-10 py-8">
                                      {isUnlimited ? (
                                          <div className="flex items-center gap-2"><Infinity className="w-4 h-4 text-indigo-600" /><span className="text-xs font-black uppercase text-indigo-600">Toujours Valide</span></div>
                                      ) : isPending ? (
                                          <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-orange-400" /><span className="text-xs font-black uppercase text-orange-400">Validation Requise</span></div>
                                      ) : end ? (
                                          <div className="flex items-center gap-2">
                                              <div className={`w-2 h-2 rounded-full ${diff <= 0 ? 'bg-red-500' : diff <= 7 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                                              <span className={`text-xs font-black uppercase ${diff <= 0 ? 'text-red-600' : diff <= 7 ? 'text-amber-600' : 'text-slate-500'}`}>
                                                  {diff > 0 ? `${diff} Jours restants` : 'Expiré'}
                                              </span>
                                          </div>
                                      ) : (
                                          <span className="text-xs text-slate-300 font-bold">-</span>
                                      )}
                                  </td>
                                  <td className="px-10 py-8 text-center">
                                      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border shadow-sm ${isUnlimited ? 'bg-indigo-600 text-white border-indigo-700' : isSuspended ? 'bg-red-50 text-red-700 border-red-100' : isExpired ? 'bg-red-50 text-red-700 border-red-100' : isPending ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                                          <span className="text-[9px] font-black uppercase tracking-widest">
                                              {isUnlimited ? 'PREMIUM' : isSuspended ? 'Suspendu' : isPending ? 'En Attente' : isExpired ? 'Expiré' : 'Actif'}
                                          </span>
                                      </div>
                                  </td>
                                  <td className="px-10 py-8 text-right relative">
                                      <button onClick={() => setActiveMenu(activeMenu === tenant.id ? null : tenant.id)} className={`p-3 rounded-2xl transition-all ${activeMenu === tenant.id ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-300 hover:text-slate-900 hover:bg-slate-100'}`}>
                                          {processingId === tenant.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <MoreHorizontal className="w-6 h-6" />}
                                      </button>
                                      
                                      {activeMenu === tenant.id && (
                                          <div className="absolute right-12 top-12 w-72 bg-white rounded-[2rem] shadow-2xl border border-slate-100 p-3 z-[50] animate-in zoom-in-95 origin-top-right">
                                              <button onClick={() => setActionConfig({ tenant, type: 'UNLIMITED', label: 'Passer en Abonnement ILLIMITÉ (Gesta)' })} className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-xs font-black bg-slate-50 text-indigo-600 hover:bg-indigo-50 transition-all mb-2">
                                                  <Zap className="w-5 h-5 fill-current" /> ILLIMITÉ (GOD MODE)
                                              </button>
                                              
                                              <div className="h-px bg-slate-50 my-2 mx-3"></div>
                                              
                                              <button onClick={() => setActionConfig({ tenant, type: isSuspended ? 'ACTIVATE' : 'SUSPEND', label: isSuspended ? 'Réactiver le service' : 'Suspendre le service' })} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-xs font-black transition-all ${isSuspended ? 'hover:bg-emerald-50 text-emerald-600' : 'hover:bg-red-50 text-red-600'}`}>
                                                  {isSuspended ? <PlayCircle className="w-5 h-5" /> : <PauseCircle className="w-5 h-5" />}
                                                  {isSuspended ? 'RÉACTIVER' : 'SUSPENDRE'}
                                              </button>
                                              
                                              <div className="h-px bg-slate-50 my-2 mx-3"></div>
                                              
                                              <div className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Extension</div>
                                              <button onClick={() => setActionConfig({ tenant, type: 'EXTEND', days: 30, label: 'Ajouter 30 jours (1 mois)' })} className="w-full flex items-center gap-3 px-5 py-3 rounded-2xl hover:bg-indigo-50 text-xs font-black text-indigo-600 transition-all">
                                                  <CalendarPlus className="w-5 h-5" /> + 1 MOIS
                                              </button>
                                              <button onClick={() => setActionConfig({ tenant, type: 'EXTEND', days: 365, label: 'Ajouter 365 jours (1 an)' })} className="w-full flex items-center gap-3 px-5 py-3 rounded-2xl hover:bg-indigo-50 text-xs font-black text-indigo-600 transition-all">
                                                  <CalendarPlus className="w-5 h-5" /> + 1 AN
                                              </button>
                                          </div>
                                      )}
                                  </td>
                              </tr>
                          ); 
                      })}
                  </tbody>
              </table>
          </div>
      </div>
      
      {actionConfig && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md animate-in fade-in" onClick={() => setActionConfig(null)} />
              <div className="bg-white w-full max-w-md rounded-[3.5rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 border border-slate-100">
                  <div className="p-12 text-center">
                      <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl ${actionConfig.type === 'UNLIMITED' ? 'bg-indigo-600 text-white' : actionConfig.type === 'SUSPEND' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {actionConfig.type === 'UNLIMITED' ? <Zap className="w-12 h-12 fill-current" /> : actionConfig.type === 'SUSPEND' ? <AlertTriangle className="w-12 h-12" /> : <CreditCard className="w-12 h-12" />}
                      </div>
                      <h3 className="text-3xl font-black text-slate-900 mb-4 uppercase tracking-tight">Appliquer ?</h3>
                      <div className="bg-slate-50 p-6 rounded-[2rem] mb-10 text-left border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">AGENCE</p>
                          <p className="text-lg font-black text-slate-900 mb-4">{actionConfig.tenant.name}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ACTION</p>
                          <p className="text-sm font-bold text-indigo-600">{actionConfig.label}</p>
                      </div>
                      <div className="flex flex-col gap-4">
                          <button onClick={executeAction} className={`w-full py-6 rounded-[1.5rem] font-black text-xs tracking-[0.2em] uppercase shadow-2xl transition-all transform active:scale-95 ${actionConfig.type === 'UNLIMITED' ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200' : 'bg-slate-900 hover:bg-black text-white'}`}>CONFIRMER</button>
                          <button onClick={() => setActionConfig(null)} className="w-full py-6 bg-white text-slate-400 hover:text-slate-900 rounded-[1.5rem] font-black text-xs tracking-[0.2em] uppercase transition-colors">ANNULER</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
const StatCard = ({ label, value, icon, color }: any) => (
    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm group hover:border-indigo-100 transition-all flex items-center gap-4">
        <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform shrink-0`}>
            {icon}
        </div>
        <div>
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
             <h3 className="text-2xl font-black text-slate-900 tracking-tight">{value}</h3>
        </div>
    </div>
);
export default Subscriptions;