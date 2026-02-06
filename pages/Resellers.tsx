import React, { useState, useEffect } from 'react';
import { Users, Wallet, Plus, Search, Loader2, TrendingUp, TrendingDown, ArrowRight, History, Ticket, DollarSign, X, Building2, CheckCircle2, AlertCircle, Smartphone, Filter, LayoutGrid, List, Calendar, CreditCard, UserCircle, ClipboardList, Tag, BarChart3, PieChart } from 'lucide-react';
import { db } from '../services/db';
import { UserRole, User, TicketStatus } from '../types';

const Resellers: React.FC = () => {
  const [resellers, setResellers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>('CARDS');

  // Modals States
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showStockHistoryModal, setShowStockHistoryModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false); // New Stats Modal
  
  const [selectedReseller, setSelectedReseller] = useState<User | null>(null);
  
  // Payment Form Data
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [paymentPhone, setPaymentPhone] = useState('');
  
  // Assign Form Data
  const [ticketProfiles, setTicketProfiles] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [quantity, setQuantity] = useState('50');
  
  // Data States
  const [processing, setProcessing] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [stockHistory, setStockHistory] = useState<any[]>([]);
  const [statsData, setStatsData] = useState<any>(null); // New Stats Data
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [toast, setToast] = useState<any>(null);

  // Admin Global States
  const [agencies, setAgencies] = useState<any[]>([]);
  const [agencyFilter, setAgencyFilter] = useState<string>('ALL');

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await db.auth.getUser();
      if (user) {
        const { data: profile } = await db.from('users').select('*').eq('id', user.id).single();
        setCurrentUser(profile);
        if (profile.role === UserRole.ADMIN_GLOBAL) {
          const { data: tData } = await db.from('tenants').select('id, name').order('name');
          setAgencies(tData || []);
        }
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (currentUser) fetchResellers();
  }, [currentUser, agencyFilter]);

  const fetchResellers = async () => {
    try {
      setLoading(true);
      const isAdminGlobal = currentUser.role === UserRole.ADMIN_GLOBAL;

      // On récupère aussi sales_history pour calculer le CA total
      let query = db.from('users')
        .select('*, tenants(name), sales_history(amount_paid)') 
        .eq('role', UserRole.REVENDEUR)
        .eq('is_active', true);

      if (isAdminGlobal) {
        if (agencyFilter !== 'ALL') query = query.eq('tenant_id', agencyFilter);
      } else {
        query = query.eq('tenant_id', currentUser.tenant_id);
      }

      const { data: rData, error } = await query;
      if (error) throw error;

      // Calcul du revenu total pour chaque revendeur
      const processedData = (rData || []).map((r: any) => ({
        ...r,
        total_revenue: r.sales_history?.reduce((acc: number, curr: any) => acc + Number(curr.amount_paid), 0) || 0
      }));

      setResellers(processedData);

      if (!isAdminGlobal && currentUser.tenant_id) {
        loadProfiles(currentUser.tenant_id);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const loadProfiles = async (tenantId: string) => {
    const { data: pData } = await db.from('ticket_profiles')
      .select('id, name, price, tickets(count)')
      .eq('tenant_id', tenantId);
    const availableProfiles = (pData || []).filter((p: any) => (p.tickets?.[0]?.count || 0) > 0);
    setTicketProfiles(availableProfiles);
  };

  const fetchPaymentHistoryData = async (resellerId: string) => {
    setLoadingHistory(true);
    try {
      const { data, error } = await db.from('payments')
        .select('*, users!payments_created_by_fkey(full_name)') 
        .eq('reseller_id', resellerId)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setPaymentHistory(data || []);
    } catch (err: any) {
        console.error(err);
        setToast({ type: 'error', message: "Impossible de charger l'historique." });
    } finally {
        setLoadingHistory(false);
    }
  };

  const fetchStockHistoryData = async (resellerId: string) => {
    setLoadingHistory(true);
    try {
        const { data, error } = await db.from('tickets')
            .select('id, username, status, sold_at, imported_at, ticket_profiles(name, price)')
            .or(`assigned_to.eq.${resellerId},sold_by.eq.${resellerId}`)
            .order('sold_at', { ascending: false, nullsFirst: true });

        if (error) throw error;
        setStockHistory(data || []);
    } catch (err: any) {
        console.error(err);
        setToast({ type: 'error', message: "Impossible de charger l'historique des tickets." });
    } finally {
        setLoadingHistory(false);
    }
  };

  // --- STATS CALCULATION ---
  const fetchResellerStats = async (resellerId: string) => {
      setLoadingHistory(true);
      try {
          // Récupérer les ventes des 30 derniers jours
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          
          const { data: sales, error } = await db.from('sales_history')
             .select('amount_paid, sold_at, tickets(ticket_profiles(name))')
             .eq('seller_id', resellerId)
             .gte('sold_at', thirtyDaysAgo.toISOString());

          if(error) throw error;

          // 1. Calculs globaux
          const totalRevenue30d = sales?.reduce((acc, curr) => acc + Number(curr.amount_paid), 0) || 0;
          const totalSalesCount = sales?.length || 0;
          const averageBasket = totalSalesCount > 0 ? Math.round(totalRevenue30d / totalSalesCount) : 0;

          // 2. Répartition par jour (7 derniers jours) pour le graph
          const last7Days = Array.from({length: 7}, (_, i) => {
              const d = new Date();
              d.setDate(d.getDate() - (6 - i));
              return d.toISOString().split('T')[0];
          });
          
          const chartData = last7Days.map(date => {
              const count = sales?.filter(s => s.sold_at.startsWith(date)).length || 0;
              return { date, count };
          });
          
          const maxDailySales = Math.max(...chartData.map(d => d.count), 1); // Pour l'échelle du graph

          // 3. Répartition par profil (Top produits)
          const profileStats: Record<string, number> = {};
          sales?.forEach(s => {
              const pName = (s.tickets as any)?.ticket_profiles?.name || 'Inconnu';
              profileStats[pName] = (profileStats[pName] || 0) + 1;
          });
          
          const topProfiles = Object.entries(profileStats)
              .map(([name, count]) => ({ name, count }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 5); // Top 5

          setStatsData({
              totalRevenue30d,
              totalSalesCount,
              averageBasket,
              chartData,
              maxDailySales,
              topProfiles
          });

      } catch(err: any) {
          console.error(err);
          setToast({ type: 'error', message: "Erreur calcul statistiques." });
      } finally {
          setLoadingHistory(false);
      }
  };

  const openHistory = (reseller: User) => {
      setSelectedReseller(reseller);
      setShowHistoryModal(true);
      fetchPaymentHistoryData(reseller.id);
  };

  const openStockHistory = (reseller: User) => {
      setSelectedReseller(reseller);
      setShowStockHistoryModal(true);
      fetchStockHistoryData(reseller.id);
  };
  
  const openStats = (reseller: User) => {
      setSelectedReseller(reseller);
      setShowStatsModal(true);
      setStatsData(null);
      fetchResellerStats(reseller.id);
  };

  const prepareAssign = async (reseller: User) => {
    setSelectedReseller(reseller);
    if (currentUser.role === UserRole.ADMIN_GLOBAL) {
        if (reseller.tenant_id) {
            await loadProfiles(reseller.tenant_id);
        } else {
            setTicketProfiles([]); 
        }
    }
    setShowAssignModal(true);
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selectedReseller || !amount || processing) return;
    
    if ((method === 'MOMO' || method === 'OM')) {
        const rawDigits = paymentPhone.replace(/\D/g, '');
        if (!/^6\d{8}$/.test(rawDigits)) {
            setToast({ type: 'error', message: "Numéro invalide (9 chiffres commençant par 6)." });
            setTimeout(() => setToast(null), 3000);
            return;
        }
    }

    setProcessing(true);
    try {
      const rawDigits = (method === 'MOMO' || method === 'OM') ? paymentPhone.replace(/\D/g, '') : null;
      const targetTenantId = selectedReseller.tenant_id || currentUser.tenant_id;

      const { error } = await db.from('payments').insert({ 
          tenant_id: targetTenantId, 
          reseller_id: selectedReseller.id, 
          amount: Number(amount), 
          payment_method: method, 
          phone_number: rawDigits,
          created_by: currentUser.id 
      });
      
      if (error) throw error;
      
      const newBalance = (Number(selectedReseller.balance) || 0) + Number(amount);
      await db.from('users').update({ balance: newBalance }).eq('id', selectedReseller.id);

      setToast({ type: 'success', message: `Compte rechargé de ${Number(amount).toLocaleString()} GNF` }); 
      setShowPaymentModal(false); 
      setAmount('');
      setPaymentPhone('');
      setMethod('CASH');
      fetchResellers();
    } catch (err: any) { setToast({ type: 'error', message: err.message }); } finally { setProcessing(false); }
  };

  const handleAssignStock = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selectedReseller || !selectedProfileId || !quantity || processing) return;
    setProcessing(true);
    try {
      const { data: availableTickets } = await db.from('tickets')
        .select('id')
        .eq('tenant_id', selectedReseller.tenant_id)
        .eq('profile_id', selectedProfileId)
        .eq('status', TicketStatus.NEUF)
        .limit(Number(quantity));
        
      if (!availableTickets || availableTickets.length < Number(quantity)) throw new Error("Stock insuffisant dans cette agence.");
      
      const ticketIds = availableTickets.map(t => t.id);
      const { error } = await db.from('tickets').update({ status: TicketStatus.ASSIGNE, assigned_to: selectedReseller.id }).in('id', ticketIds);
      if (error) throw error;
      
      setToast({ type: 'success', message: `${quantity} tickets ont été assignés.` }); setShowAssignModal(false); fetchResellers();
    } catch (err: any) { setToast({ type: 'error', message: err.message }); } finally { setProcessing(false); }
  };

  const filteredResellers = resellers.filter(r => r.full_name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-8 font-sans pb-40 relative animate-in fade-in duration-500">
      {toast && (<div className={`fixed top-6 right-6 z-[100] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right border ${toast.type === 'success' ? 'bg-emerald-600 border-emerald-500' : 'bg-red-600 border-red-500'} text-white`}>{toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}<p className="font-bold text-sm tracking-tight">{toast.message}</p></div>)}
      
      <header className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full blur-[100px] opacity-10 -mr-20 -mt-20"></div>
        <div className="relative z-10">
            <div className="flex items-center gap-2 text-indigo-600 mb-2">
                <Wallet className="w-5 h-5" />
                <span className="text-[10px] font-black uppercase tracking-widest">Finance & Distribution</span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Gestion Revendeurs</h1>
            <p className="text-slate-400 font-medium mt-1">Gérez les soldes, le stock et suivez les performances.</p>
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row gap-4 w-full xl:w-auto">
             {currentUser?.role === UserRole.ADMIN_GLOBAL && (
                 <div className="relative min-w-[200px]">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <select value={agencyFilter} onChange={(e) => setAgencyFilter(e.target.value)} className="w-full pl-10 pr-8 py-4 rounded-2xl border border-slate-100 bg-slate-50 font-bold text-slate-600 appearance-none outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all cursor-pointer text-sm"><option value="ALL">Toutes les Agences</option>{agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                    <Filter className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
                 </div>
             )}
             
             <div className="relative group flex-1 md:w-64">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all font-bold text-slate-700 text-sm" />
             </div>

             <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                <button onClick={() => setViewMode('CARDS')} className={`p-3 rounded-xl transition-all ${viewMode === 'CARDS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid className="w-5 h-5" /></button>
                <button onClick={() => setViewMode('TABLE')} className={`p-3 rounded-xl transition-all ${viewMode === 'TABLE' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><List className="w-5 h-5" /></button>
             </div>
        </div>
      </header>
      
      {loading ? (
         <div className="py-40 flex flex-col items-center justify-center gap-4"><Loader2 className="w-12 h-12 animate-spin text-slate-200" /><p className="text-xs font-black uppercase tracking-widest text-slate-300">Chargement des comptes...</p></div>
      ) : filteredResellers.length === 0 ? (
         <div className="py-40 text-center text-slate-400 font-bold uppercase text-xs tracking-widest flex flex-col items-center gap-4"><UserCircle className="w-16 h-16 opacity-20" />Aucun revendeur trouvé</div>
      ) : (
        <>
        {viewMode === 'CARDS' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredResellers.map(reseller => (
                    <div key={reseller.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm group hover:shadow-2xl transition-all duration-300 relative overflow-hidden flex flex-col justify-between">
                        {currentUser?.role === UserRole.ADMIN_GLOBAL && (<div className="absolute top-0 right-0 bg-slate-50 px-6 py-3 rounded-bl-[2rem] border-b border-l border-slate-100"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Building2 className="w-3 h-3" /> {(reseller as any).tenants?.name || 'Inconnu'}</span></div>)}
                        
                        {/* HEADER CARD */}
                        <div>
                            <div className="flex items-center gap-4 mb-8 mt-2">
                                <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg border-4 border-slate-50">{reseller.full_name.charAt(0)}</div>
                                <div>
                                    <h3 className="font-black text-lg text-slate-900 leading-tight flex items-center gap-2">
                                        {reseller.full_name} 
                                        <button onClick={() => openStats(reseller)} className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                                            <BarChart3 className="w-3.5 h-3.5" />
                                        </button>
                                    </h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[180px] mt-1">{reseller.email}</p>
                                </div>
                            </div>
                            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 mb-6">
                                <div className="flex justify-between items-center mb-4">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Solde Actuel</p>
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${Number(reseller.balance || 0) < 50000 ? 'bg-red-100 text-red-500' : 'bg-emerald-100 text-emerald-500'}`}>{Number(reseller.balance || 0) < 50000 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}</div>
                                </div>
                                <p className={`text-3xl font-black tracking-tight ${Number(reseller.balance || 0) < 0 ? 'text-red-500' : 'text-slate-900'}`}>{Number(reseller.balance || 0).toLocaleString()} <span className="text-[10px] text-slate-400 uppercase align-top mt-1 inline-block">GNF</span></p>
                            </div>
                        </div>
                        
                        {/* ACTIONS */}
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => { setSelectedReseller(reseller); setShowPaymentModal(true); setMethod('CASH'); setPaymentPhone(''); }} className="py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 active:scale-95"><DollarSign className="w-4 h-4" /> RECHARGER</button>
                                <button onClick={() => prepareAssign(reseller)} className="py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 active:scale-95"><Ticket className="w-4 h-4" /> ASSIGNER</button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => openHistory(reseller)} className="w-full py-4 bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"><History className="w-4 h-4" /> PAIEMENTS</button>
                                <button onClick={() => openStockHistory(reseller)} className="w-full py-4 bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"><ClipboardList className="w-4 h-4" /> SUIVI STOCK</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}

        {viewMode === 'TABLE' && (
            <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                                <th className="px-10 py-6">REVENDEUR</th>
                                {currentUser?.role === UserRole.ADMIN_GLOBAL && <th className="px-10 py-6">AGENCE</th>}
                                <th className="px-10 py-6 text-right">SOLDE ACTUEL</th>
                                <th className="px-10 py-6 text-right">CA TOTAL (VENTES)</th>
                                <th className="px-10 py-6 text-right">ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredResellers.map(reseller => (
                                <tr key={reseller.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-10 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 font-black text-sm">{reseller.full_name.charAt(0)}</div>
                                            <div>
                                                <p className="font-black text-slate-900 text-sm">{reseller.full_name}</p>
                                                <p className="text-[10px] font-bold text-slate-400">{reseller.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    {currentUser?.role === UserRole.ADMIN_GLOBAL && (
                                        <td className="px-10 py-6"><span className="text-xs font-bold text-slate-600">{(reseller as any).tenants?.name || '-'}</span></td>
                                    )}
                                    <td className="px-10 py-6 text-right">
                                        <span className={`font-black text-sm px-3 py-1 rounded-lg ${Number(reseller.balance || 0) < 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                            {Number(reseller.balance || 0).toLocaleString()} GNF
                                        </span>
                                    </td>
                                    <td className="px-10 py-6 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="font-black text-slate-900">{Number(reseller.total_revenue || 0).toLocaleString()} GNF</span>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Volume Global</span>
                                        </div>
                                    </td>
                                    <td className="px-10 py-6 text-right">
                                        <div className="flex justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => { setSelectedReseller(reseller); setShowPaymentModal(true); setMethod('CASH'); setPaymentPhone(''); }} title="Recharger" className="p-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl transition-all shadow-sm"><DollarSign className="w-4 h-4" /></button>
                                            <button onClick={() => prepareAssign(reseller)} title="Assigner Stock" className="p-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all shadow-sm"><Ticket className="w-4 h-4" /></button>
                                            <button onClick={() => openStats(reseller)} title="Statistiques" className="p-2.5 bg-purple-50 text-purple-600 hover:bg-purple-600 hover:text-white rounded-xl transition-all shadow-sm"><BarChart3 className="w-4 h-4" /></button>
                                            <button onClick={() => openStockHistory(reseller)} title="Suivi Stock" className="p-2.5 bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white rounded-xl transition-all shadow-sm"><ClipboardList className="w-4 h-4" /></button>
                                            <button onClick={() => openHistory(reseller)} title="Historique Paiements" className="p-2.5 bg-slate-50 text-slate-500 hover:bg-slate-900 hover:text-white rounded-xl transition-all shadow-sm"><History className="w-4 h-4" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
        </>
      )}
      
      {/* --- PAYMENT MODAL --- */}
      {showPaymentModal && selectedReseller && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowPaymentModal(false)} />
          <form onSubmit={handlePayment} className="bg-white w-full max-w-sm rounded-[3rem] p-10 relative z-10 animate-in zoom-in-95 shadow-2xl">
            <button type="button" onClick={() => setShowPaymentModal(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 transition-colors"><X className="w-6 h-6" /></button>
            <h2 className="text-2xl font-black mb-8 uppercase text-center text-slate-900 tracking-tight">Encaisser Paiement</h2>
            <div className="space-y-6">
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Montant Reçu (GNF)</label><input type="number" required placeholder="ex: 50000" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xl outline-none focus:bg-white focus:ring-4 focus:ring-emerald-50 transition-all" /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Méthode</label><div className="relative"><select value={method} onChange={e => setMethod(e.target.value)} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black outline-none appearance-none focus:bg-white focus:ring-4 focus:ring-emerald-50 transition-all cursor-pointer"><option value="CASH">Espèces (Cash)</option><option value="MOMO">MTN Mobile Money</option><option value="OM">Orange Money</option></select></div></div>
              {(method === 'MOMO' || method === 'OM') && (<div className="animate-in slide-in-from-top-2 fade-in"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Numéro de Téléphone</label><div className="relative group"><Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-emerald-600 transition-colors" /><input type="tel" required placeholder="6xx xx xx xx" value={paymentPhone} onChange={e => setPaymentPhone(e.target.value)} className="w-full pl-14 pr-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl font-black text-lg outline-none focus:bg-white focus:ring-4 focus:ring-emerald-50 transition-all" /></div></div>)}
            </div>
            <button type="submit" disabled={processing} className="w-full mt-10 py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95">{processing ? <Loader2 className="w-5 h-5 animate-spin" /> : "CRÉDITER LE SOLDE"}</button>
          </form>
        </div>
      )}

      {/* --- ASSIGN STOCK MODAL --- */}
      {showAssignModal && selectedReseller && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowAssignModal(false)} />
            <form onSubmit={handleAssignStock} className="bg-white w-full max-w-md rounded-[3rem] p-10 relative z-10 animate-in zoom-in-95 shadow-2xl">
                <button type="button" onClick={() => setShowAssignModal(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 transition-colors"><X className="w-6 h-6" /></button>
                <h2 className="text-2xl font-black mb-2 uppercase text-center text-slate-900 tracking-tight">Assigner du Stock</h2>
                <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-10">Transférer du stock agence vers {selectedReseller.full_name}</p>
                <div className="space-y-6">
                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Choisir un forfait</label><select required value={selectedProfileId} onChange={e => setSelectedProfileId(e.target.value)} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black outline-none appearance-none focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all cursor-pointer"><option value="">Sélectionner...</option>{ticketProfiles.map(p => (<option key={p.id} value={p.id}>{p.name} ({p.tickets?.[0]?.count || 0} en stock)</option>))}</select></div>
                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantité à assigner</label><input type="number" required placeholder="ex: 100" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xl outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all" /></div>
                </div>
                <button type="submit" disabled={processing} className="w-full mt-10 py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95">{processing ? <Loader2 className="w-5 h-5 animate-spin" /> : "VALIDER L'ATTRIBUTION"}</button>
            </form>
        </div>
      )}

      {/* --- STATS DETAILED MODAL (NEW) --- */}
      {showStatsModal && selectedReseller && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in">
              <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => setShowStatsModal(false)} />
              <div className="bg-white w-full max-w-3xl max-h-[90vh] rounded-[3.5rem] p-10 relative z-10 animate-in zoom-in-95 shadow-2xl flex flex-col">
                  <div className="flex items-center justify-between mb-8 shrink-0">
                      <div>
                          <div className="flex items-center gap-2 text-indigo-600 mb-1">
                              <BarChart3 className="w-5 h-5" />
                              <span className="text-[10px] font-black uppercase tracking-widest">Analytics</span>
                          </div>
                          <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Performance</h2>
                          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Données 30 Jours : <span className="text-slate-800">{selectedReseller.full_name}</span></p>
                      </div>
                      <button onClick={() => setShowStatsModal(false)} className="p-3 bg-slate-50 text-slate-300 hover:text-slate-900 hover:bg-slate-200 rounded-2xl transition-all"><X className="w-6 h-6" /></button>
                  </div>

                  <div className="overflow-y-auto custom-scrollbar grow -mx-4 px-4 pb-8">
                      {loadingHistory ? (
                          <div className="py-20 flex flex-col items-center gap-4"><Loader2 className="w-12 h-12 animate-spin text-slate-200" /><p className="text-xs font-black uppercase tracking-widest text-slate-300">Analyse des données...</p></div>
                      ) : !statsData ? (
                          <div className="py-20 text-center"><p className="text-slate-300 font-bold uppercase text-xs">Aucune donnée disponible</p></div>
                      ) : (
                          <div className="space-y-8">
                              {/* KPIS */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div className="bg-indigo-50 p-6 rounded-[2.5rem] border border-indigo-100">
                                      <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2">Volume Total</p>
                                      <p className="text-3xl font-black text-indigo-900">{statsData.totalRevenue30d.toLocaleString()}</p>
                                      <span className="text-[10px] font-bold text-indigo-500 uppercase">GNF</span>
                                  </div>
                                  <div className="bg-emerald-50 p-6 rounded-[2.5rem] border border-emerald-100">
                                      <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-2">Tickets Vendus</p>
                                      <p className="text-3xl font-black text-emerald-900">{statsData.totalSalesCount}</p>
                                      <span className="text-[10px] font-bold text-emerald-600 uppercase">Unités</span>
                                  </div>
                                  <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100">
                                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Panier Moyen</p>
                                      <p className="text-3xl font-black text-slate-900">{statsData.averageBasket.toLocaleString()}</p>
                                      <span className="text-[10px] font-bold text-slate-400 uppercase">GNF / Ticket</span>
                                  </div>
                              </div>

                              {/* CHART (CSS ONLY) */}
                              <div className="bg-white border border-slate-100 rounded-[3rem] p-8 shadow-sm">
                                  <div className="flex items-center gap-2 mb-6 text-slate-400">
                                      <TrendingUp className="w-4 h-4" />
                                      <span className="text-[10px] font-black uppercase tracking-widest">Évolution des ventes (7 Jours)</span>
                                  </div>
                                  <div className="flex items-end justify-between h-40 gap-2">
                                      {statsData.chartData.map((d: any, i: number) => {
                                          const heightPerc = Math.max(Math.round((d.count / statsData.maxDailySales) * 100), 5); // Min 5% height
                                          return (
                                              <div key={i} className="flex flex-col items-center flex-1 group">
                                                  <div className="relative w-full flex justify-center">
                                                     <div className="opacity-0 group-hover:opacity-100 absolute -top-8 bg-slate-900 text-white text-[9px] font-bold px-2 py-1 rounded-lg transition-opacity mb-1 z-10">{d.count} Ventes</div>
                                                     <div className="w-full max-w-[20px] bg-indigo-500 rounded-t-lg transition-all duration-500 hover:bg-indigo-600" style={{ height: `${heightPerc}%` }}></div>
                                                  </div>
                                                  <span className="text-[8px] font-bold text-slate-400 mt-2 uppercase">{new Date(d.date).toLocaleDateString('fr-FR', {weekday: 'short'})}</span>
                                              </div>
                                          );
                                      })}
                                  </div>
                              </div>

                              {/* TOP PRODUCTS */}
                              <div>
                                  <div className="flex items-center gap-2 mb-4 text-slate-400 px-2">
                                      <PieChart className="w-4 h-4" />
                                      <span className="text-[10px] font-black uppercase tracking-widest">Top Forfaits</span>
                                  </div>
                                  <div className="space-y-3">
                                      {statsData.topProfiles.length === 0 ? (
                                           <div className="p-8 bg-slate-50 rounded-3xl text-center text-slate-300 font-bold text-xs uppercase">Aucune vente récente</div>
                                      ) : (
                                          statsData.topProfiles.map((p: any, i: number) => (
                                              <div key={i} className="flex items-center gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-50">
                                                  <div className="w-8 h-8 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-500 font-black text-xs shadow-sm">{i + 1}</div>
                                                  <div className="flex-1">
                                                      <div className="flex justify-between items-center mb-1">
                                                          <span className="text-xs font-black text-slate-700">{p.name}</span>
                                                          <span className="text-[10px] font-bold text-slate-400">{p.count} ventes</span>
                                                      </div>
                                                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.round((p.count / statsData.totalSalesCount) * 100)}%` }}></div>
                                                      </div>
                                                  </div>
                                              </div>
                                          ))
                                      )}
                                  </div>
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* --- PAYMENT HISTORY MODAL --- */}
      {showHistoryModal && selectedReseller && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in">
              <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => setShowHistoryModal(false)} />
              <div className="bg-white w-full max-w-2xl max-h-[80vh] rounded-[3rem] p-10 relative z-10 animate-in zoom-in-95 shadow-2xl flex flex-col">
                  <div className="flex items-center justify-between mb-8 shrink-0">
                      <div>
                          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Historique Recharges</h2>
                          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Pour {selectedReseller.full_name}</p>
                      </div>
                      <button onClick={() => setShowHistoryModal(false)} className="p-2 text-slate-300 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"><X className="w-6 h-6" /></button>
                  </div>

                  <div className="overflow-y-auto custom-scrollbar grow -mx-4 px-4">
                      {loadingHistory ? (
                          <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-200" /></div>
                      ) : paymentHistory.length === 0 ? (
                          <div className="py-20 text-center flex flex-col items-center gap-4 text-slate-300">
                              <History className="w-12 h-12 opacity-20" />
                              <p className="font-bold uppercase text-[10px] tracking-widest">Aucun historique disponible</p>
                          </div>
                      ) : (
                          <div className="space-y-3">
                              {paymentHistory.map((payment) => (
                                  <div key={payment.id} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex items-center justify-between hover:bg-slate-100 transition-colors">
                                      <div className="flex items-center gap-4">
                                          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm border border-slate-100">
                                              <CreditCard className="w-5 h-5" />
                                          </div>
                                          <div>
                                              <p className="font-black text-slate-900 text-lg">{Number(payment.amount).toLocaleString()} GNF</p>
                                              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                  <span className="bg-white px-2 py-0.5 rounded border border-slate-200">{payment.payment_method}</span>
                                                  <span>{new Date(payment.created_at).toLocaleDateString()}</span>
                                              </div>
                                          </div>
                                      </div>
                                      <div className="text-right">
                                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Opérateur</p>
                                          <p className="text-xs font-bold text-slate-700">{(payment.users as any)?.full_name || 'Système'}</p>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* --- STOCK ASSIGNMENT HISTORY MODAL --- */}
      {showStockHistoryModal && selectedReseller && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in">
              <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => setShowStockHistoryModal(false)} />
              <div className="bg-white w-full max-w-2xl max-h-[80vh] rounded-[3rem] p-10 relative z-10 animate-in zoom-in-95 shadow-2xl flex flex-col">
                  <div className="flex items-center justify-between mb-8 shrink-0">
                      <div>
                          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Suivi du Stock</h2>
                          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Pour {selectedReseller.full_name}</p>
                      </div>
                      <button onClick={() => setShowStockHistoryModal(false)} className="p-2 text-slate-300 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"><X className="w-6 h-6" /></button>
                  </div>

                  {/* Stats Rapides */}
                  <div className="flex gap-4 mb-6 shrink-0 overflow-x-auto pb-2">
                     <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl min-w-[140px]">
                        <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Stock Actuel</p>
                        <p className="text-2xl font-black text-indigo-900">{stockHistory.filter(t => t.status === TicketStatus.ASSIGNE).length}</p>
                     </div>
                     <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl min-w-[140px]">
                        <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Total Vendus</p>
                        <p className="text-2xl font-black text-emerald-900">{stockHistory.filter(t => t.status === TicketStatus.VENDU).length}</p>
                     </div>
                  </div>

                  <div className="overflow-y-auto custom-scrollbar grow -mx-4 px-4">
                      {loadingHistory ? (
                          <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-200" /></div>
                      ) : stockHistory.length === 0 ? (
                          <div className="py-20 text-center flex flex-col items-center gap-4 text-slate-300">
                              <Ticket className="w-12 h-12 opacity-20" />
                              <p className="font-bold uppercase text-[10px] tracking-widest">Aucun ticket assigné</p>
                          </div>
                      ) : (
                          <div className="space-y-3">
                              {stockHistory.map((ticket) => {
                                  const isSold = ticket.status === TicketStatus.VENDU;
                                  return (
                                    <div key={ticket.id} className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100 flex items-center justify-between hover:bg-slate-100 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 ${isSold ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                                {isSold ? <CheckCircle2 className="w-4 h-4" /> : <Ticket className="w-4 h-4" />}
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-900">{ticket.username}</p>
                                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                    <Tag className="w-3 h-3" />
                                                    <span>{ticket.ticket_profiles?.name}</span>
                                                    <span>•</span>
                                                    <span>{Number(ticket.ticket_profiles?.price).toLocaleString()} GNF</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`inline-block px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest mb-1 ${isSold ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                                {isSold ? 'VENDU' : 'EN STOCK'}
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-medium">
                                                {isSold 
                                                    ? (ticket.sold_at ? new Date(ticket.sold_at).toLocaleDateString() : '-') 
                                                    : 'Non vendu'}
                                            </p>
                                        </div>
                                    </div>
                                  );
                              })}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
export default Resellers;