
import React, { useState, useEffect } from 'react';
import { Search, CloudUpload, Trash2, Loader2, AlertCircle, AlertTriangle, CheckCircle2, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { UserRole, TicketStatus } from '../types';

const Stock: React.FC = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'TOUS' | 'NEUF' | 'VENDU'>('TOUS');
  const [agencyFilter, setAgencyFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [tickets, setTickets] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [ticketToDelete, setTicketToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => { fetchInitialData(); }, []);
  useEffect(() => { fetchStock(); }, [filter, search, agencyFilter, currentUser]);

  const fetchInitialData = async () => {
    try {
      const { data: { user } } = await db.auth.getUser();
      if (user) {
        const { data: userData } = await db.from('users').select('role, tenant_id, id').eq('id', user.id).single();
        if (userData) {
          setCurrentUser(userData);
          if (userData.role === UserRole.ADMIN_GLOBAL) {
            const { data: tData } = await db.from('tenants').select('id, name').order('name');
            setAgencies(tData || []);
          }
        }
      }
    } catch (err) { console.error(err); }
  };

  const fetchStock = async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      let query = db.from('tickets').select(`id, username, password, status, imported_at, tenants(name), ticket_profiles(name, price)`).order('imported_at', { ascending: false });
      
      const isReseller = currentUser.role === UserRole.REVENDEUR;

      // 1. Restriction de base
      if (currentUser.role === UserRole.ADMIN_GLOBAL) { 
        if (agencyFilter !== 'ALL') query = query.eq('tenant_id', agencyFilter); 
      } else { 
        query = query.eq('tenant_id', currentUser.tenant_id); 
      }

      if (isReseller) {
         // Le revendeur ne voit QUE ce qui lui est assigné
         query = query.eq('assigned_to', currentUser.id);
      }

      // 2. Filtres de statut
      if (filter !== 'TOUS') {
          if (isReseller && filter === 'NEUF') {
              // Pour un revendeur, "NEUF" visuellement = "ASSIGNÉ" en BDD
              query = query.eq('status', TicketStatus.ASSIGNE);
          } else {
              query = query.eq('status', filter);
          }
      }

      if (search) query = query.ilike('username', `%${search}%`);
      
      const { data, error: tError } = await query.limit(300);
      if (tError) throw tError;
      setTickets(data || []);
    } catch (err: any) { showToast('error', err.message); } finally { setLoading(false); }
  };

  const showToast = (type: 'success' | 'error', message: string) => { setToast({ type, message }); setTimeout(() => setToast(null), 3000); };
  
  const handleVerifyDelete = (ticket: any) => { 
    if (currentUser?.role === UserRole.REVENDEUR) { showToast('error', "Action refusée."); return; } 
    if (ticket.status !== TicketStatus.NEUF) { showToast('error', "Impossible de supprimer un ticket vendu ou assigné."); return; } 
    setTicketToDelete(ticket); 
  };
  
  const performDelete = async () => { 
    if (!ticketToDelete) return; 
    setIsDeleting(true); 
    try { 
        const { error: dError } = await db.from('tickets').delete().eq('id', ticketToDelete.id); 
        if (dError) throw dError; 
        setTickets(prev => prev.filter(t => t.id !== ticketToDelete.id)); 
        showToast('success', `Ticket supprimé.`); 
        setTicketToDelete(null); 
    } catch (err: any) { 
        showToast('error', err.message); 
    } finally { 
        setIsDeleting(false); 
    } 
  };

  const isReseller = currentUser?.role === UserRole.REVENDEUR;

  return (
    <div className="space-y-8 font-sans pb-20 animate-in fade-in duration-500 relative">
      {toast && (<div className={`fixed top-6 right-6 z-[60] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right-10 border ${toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-red-600 text-white border-red-500'}`}>{toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}<p className="font-bold text-sm">{toast.message}</p></div>)}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4"><div><span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-1 block">{currentUser?.role === UserRole.ADMIN_GLOBAL ? 'SUPERVISION GLOBALE DES STOCKS' : (isReseller ? 'MON STOCK PERSONNEL' : 'INVENTAIRE AGENCE')}</span><h1 className="text-4xl font-black text-[#1e293b] tracking-tight">Gestion Stock</h1></div>{currentUser?.role === UserRole.GESTIONNAIRE_WIFI_ZONE && (<button onClick={() => navigate('/import')} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs tracking-widest uppercase shadow-xl flex items-center gap-3 hover:bg-black transition-all"><CloudUpload className="w-4 h-4" /> IMPORTER CSV</button>)}</div>
      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden"><div className="p-8 space-y-6"><div className="flex flex-col md:flex-row gap-4"><div className="relative group flex-1"><Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" /><input type="text" placeholder="Rechercher par code..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-14 pr-8 py-4 rounded-2xl border border-slate-100 bg-slate-50/30 focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none font-bold text-slate-600 transition-all" /></div>{currentUser?.role === UserRole.ADMIN_GLOBAL && (<div className="relative w-full md:w-64"><Building2 className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" /><select value={agencyFilter} onChange={(e) => setAgencyFilter(e.target.value)} className="w-full pl-12 pr-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 font-bold text-slate-600 appearance-none outline-none focus:ring-4 focus:ring-indigo-50 transition-all"><option value="ALL">Toutes les agences</option>{agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>)}</div><div className="flex gap-3">{(['TOUS', 'NEUF', 'VENDU'] as const).map((f) => (<button key={f} onClick={() => setFilter(f)} className={`px-6 py-2 rounded-xl font-black text-[10px] tracking-widest uppercase transition-all ${filter === f ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white border border-slate-100 text-slate-400 hover:text-slate-600'}`}>{f === 'NEUF' ? 'STOCK DISPO' : f}</button>))}</div></div><div className="overflow-x-auto"><table className="w-full text-left border-collapse"><thead><tr className="border-y border-slate-50 bg-slate-50/30 text-[10px] font-black text-slate-400 uppercase tracking-widest">{!isReseller && <th className="px-8 py-4">CODE</th>}{(currentUser?.role === UserRole.ADMIN_GLOBAL || agencyFilter === 'ALL') && <th className="px-8 py-4">AGENCE</th>}<th className="px-8 py-4">PROFIL</th><th className="px-8 py-4 text-right">PRIX</th><th className="px-8 py-4 text-center">STATUT</th>{currentUser?.role !== UserRole.REVENDEUR && currentUser?.role !== UserRole.ADMIN_GLOBAL && <th className="px-8 py-4 text-right">ACTIONS</th>}</tr></thead><tbody className="divide-y divide-slate-50">{loading ? (<tr><td colSpan={6} className="px-8 py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-200" /></td></tr>) : tickets.length === 0 ? (<tr><td colSpan={6} className="px-8 py-20 text-center text-slate-300 font-bold uppercase text-xs">Aucun ticket</td></tr>) : tickets.map((item) => {
        let statusLabel = 'VENDU';
        let statusColor = 'bg-emerald-50 text-emerald-500';

        if (item.status === TicketStatus.NEUF) {
            statusLabel = 'EN STOCK';
            statusColor = 'bg-indigo-50 text-indigo-500';
        } else if (item.status === TicketStatus.ASSIGNE) {
            if (isReseller) {
                statusLabel = 'EN STOCK';
                statusColor = 'bg-indigo-50 text-indigo-500';
            } else {
                statusLabel = 'ASSIGNÉ';
                statusColor = 'bg-purple-50 text-purple-600';
            }
        }

        return (
          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
            {!isReseller && <td className="px-8 py-6 font-black text-slate-900 tracking-tight">{item.username}</td>}
            {(currentUser?.role === UserRole.ADMIN_GLOBAL || agencyFilter === 'ALL') && (<td className="px-8 py-6"><div className="flex items-center gap-2"><Building2 className="w-3 h-3 text-slate-300" /><span className="text-[10px] font-black text-slate-500 uppercase">{item.tenants?.name}</span></div></td>)}
            <td className="px-8 py-6 font-black text-xs text-indigo-500 uppercase">{item.ticket_profiles?.name}</td>
            <td className="px-8 py-6 font-black text-slate-900 text-right">{Number(item.ticket_profiles?.price).toLocaleString()} GNF</td>
            <td className="px-8 py-6 text-center"><span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${statusColor}`}>{statusLabel}</span></td>
            {currentUser?.role !== UserRole.REVENDEUR && currentUser?.role !== UserRole.ADMIN_GLOBAL && (<td className="px-8 py-6 text-right"><button onClick={() => handleVerifyDelete(item)} disabled={item.status === TicketStatus.VENDU || item.status === TicketStatus.ASSIGNE} className={`p-2 rounded-lg transition-all ${(item.status === TicketStatus.VENDU || item.status === TicketStatus.ASSIGNE) ? 'text-slate-100 opacity-20' : 'text-slate-300 hover:text-red-600 hover:bg-red-50'}`}><Trash2 className="w-4 h-4" /></button></td>)}
          </tr>
        );
      })}</tbody></table></div></div>
      {ticketToDelete && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isDeleting && setTicketToDelete(null)} /><div className="bg-white w-full max-w-sm rounded-[3rem] p-10 text-center relative z-10 animate-in zoom-in-95 shadow-2xl"><div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6"><AlertTriangle className="w-10 h-10" /></div><h3 className="text-2xl font-black text-slate-900 mb-2 uppercase">Supprimer ?</h3><p className="text-slate-500 text-sm mb-8">Action irréversible sur le ticket <strong>{ticketToDelete.username}</strong>.</p><div className="space-y-3"><button onClick={performDelete} disabled={isDeleting} className="w-full py-5 bg-red-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-red-700">{isDeleting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "OUI, SUPPRIMER"}</button><button onClick={() => setTicketToDelete(null)} className="w-full py-5 bg-slate-100 text-slate-400 rounded-2xl font-black text-xs uppercase">ANNULER</button></div></div></div>)}
    </div>
  );
};
export default Stock;
