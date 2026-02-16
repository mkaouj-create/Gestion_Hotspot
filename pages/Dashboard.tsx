
import React, { useEffect, useState, useCallback } from 'react';
import { Users as UsersIcon, Ticket, Wallet, ShoppingCart, Loader2, RefreshCcw, TrendingUp, ArrowUpRight, ShieldCheck, Building2, Clock, Activity, Globe, MapPin, X, AlertCircle, Smartphone, CheckCircle2, History, Banknote } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { UserRole, TicketStatus } from '../types';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ revenue: 0, sold: 0, stock: 0, users: 0, pendingAgencies: 0, totalAgencies: 0, balance: 0 });
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]); // New state for reseller deposits
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [agencyName, setAgencyName] = useState<string>('');
  const [currency, setCurrency] = useState('GNF');
  
  // Deposit Modal States
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositMethod, setDepositMethod] = useState('CASH');
  const [depositReference, setDepositReference] = useState('');
  const [isSubmittingDeposit, setIsSubmittingDeposit] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await db.auth.getUser();
      if (!user) return;

      const { data: profile } = await db.from('users').select('role, tenant_id, balance, tenants(name, currency)').eq('id', user.id).maybeSingle();
      if (!profile) return;

      setCurrentUserRole(profile.role as UserRole);
      setAgencyName((profile.tenants as any)?.name || 'Mon Agence');
      setCurrency((profile.tenants as any)?.currency || 'GNF');

      const isAdminGlobal = profile.role === UserRole.ADMIN_GLOBAL;
      const isReseller = profile.role === UserRole.REVENDEUR;
      const tId = profile.tenant_id;
      
      let stockQuery = db.from('tickets').select('*', { count: 'exact', head: true });
      let soldQuery = db.from('tickets').select('*', { count: 'exact', head: true });
      let revQuery = db.from('sales_history').select('amount_paid');
      let userQuery = db.from('users').select('*', { count: 'exact', head: true });
      
      let salesQuery = db.from('sales_history')
        .select('*, tenants(name), tickets(username, ticket_profiles(name))')
        .order('sold_at', { ascending: false })
        .limit(6);

      // Fetch deposits for reseller
      let depositsPromise = Promise.resolve({ data: [] });
      if (isReseller) {
          depositsPromise = db.from('payments')
            .select('*')
            .eq('reseller_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5);
      }

      if (isAdminGlobal) {
        // No filter for global admin
      } else if (isReseller) {
        stockQuery = stockQuery.eq('assigned_to', user.id).eq('status', TicketStatus.ASSIGNE);
        soldQuery = soldQuery.eq('sold_by', user.id).eq('status', TicketStatus.VENDU);
        revQuery = revQuery.eq('seller_id', user.id);
        salesQuery = salesQuery.eq('seller_id', user.id);
      } else {
        stockQuery = stockQuery.eq('tenant_id', tId).eq('status', TicketStatus.NEUF);
        soldQuery = soldQuery.eq('tenant_id', tId).eq('status', TicketStatus.VENDU);
        revQuery = revQuery.eq('tenant_id', tId);
        userQuery = userQuery.eq('tenant_id', tId);
        salesQuery = salesQuery.eq('tenant_id', tId);
      }

      const promises = [stockQuery, soldQuery, revQuery, userQuery, salesQuery, depositsPromise];

      if (isAdminGlobal) {
        promises.push(db.from('tenants').select('*', { count: 'exact', head: true }).eq('subscription_status', 'EN_ATTENTE'));
        promises.push(db.from('tenants').select('*', { count: 'exact', head: true }));
      }

      const results = await Promise.all(promises);
      const stockRes = results[0];
      const soldRes = results[1];
      const revRes = results[2];
      const userRes = results[3];
      const salesRes = results[4];
      const depositsRes = results[5];
      
      const pendingRes = isAdminGlobal ? results[6] : { count: 0 };
      const totalAgenciesRes = isAdminGlobal ? results[7] : { count: 0 };

      setStats({
        revenue: (revRes.data || []).reduce((acc: number, curr: any) => acc + Number(curr.amount_paid), 0) || 0,
        sold: soldRes.count || 0,
        stock: stockRes.count || 0,
        users: userRes.count || 0,
        pendingAgencies: pendingRes.count || 0,
        totalAgencies: totalAgenciesRes.count || 0,
        balance: profile.balance || 0 
      });
      setRecentSales(salesRes.data || []);
      setDeposits((depositsRes as any).data || []);

    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  const handleSubmitDeposit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmittingDeposit(true);
      try {
          const { data: { user } } = await db.auth.getUser();
          if(!user) throw new Error("Non authentifié");
          
          const { data: profile } = await db.from('users').select('tenant_id').eq('id', user.id).single();

          const { error } = await db.from('payments').insert({
              tenant_id: profile?.tenant_id,
              reseller_id: user.id,
              amount: Number(depositAmount),
              payment_method: depositMethod,
              phone_number: depositReference, // Using this as reference/proof
              status: 'PENDING',
              created_by: user.id
          });

          if(error) throw error;

          setToast({ type: 'success', message: "Demande envoyée à l'administrateur." });
          setShowDepositModal(false);
          setDepositAmount('');
          setDepositReference('');
          setTimeout(() => setToast(null), 4000);
          fetchDashboardData(); // Refresh list
      } catch(err: any) {
          setToast({ type: 'error', message: "Erreur: " + err.message });
      } finally {
          setIsSubmittingDeposit(false);
      }
  };

  if (loading) return <div className="h-[60vh] flex flex-col items-center justify-center"><Loader2 className="w-8 h-8 text-brand-600 animate-spin mb-4" /></div>;

  const isAdminGlobal = currentUserRole === UserRole.ADMIN_GLOBAL;
  const isReseller = currentUserRole === UserRole.REVENDEUR;

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 relative">
      {toast && (<div className={`fixed top-6 right-6 z-[100] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right border ${toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-red-600 text-white border-red-500'}`}>{toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}<p className="font-bold text-sm tracking-tight">{toast.message}</p></div>)}

      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-6 bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full blur-[80px] -mr-16 -mt-16 pointer-events-none"></div>
        
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="bg-slate-900 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 w-fit">
              <Building2 className="w-3 h-3" /> {isAdminGlobal ? 'Super Admin' : agencyName}
            </span>
            {isReseller && <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5"><Wallet className="w-3 h-3" /> Espace Revendeur</span>}
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
            {isAdminGlobal ? 'Vue d\'ensemble SaaS' : 'Tableau de Bord'}
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1 max-w-xl">
            {isAdminGlobal ? 'Métriques globales et performance du réseau.' : (isReseller ? 'Gérez vos ventes et votre stock personnel.' : 'Bienvenue sur votre espace de gestion WiFi.')}
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full lg:w-auto relative z-10">
          {!isAdminGlobal && (
            <button onClick={() => navigate('/sales')} className="flex-1 lg:flex-none bg-brand-600 hover:bg-brand-700 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-brand-200 transition-all active:scale-95"><ShoppingCart className="w-4 h-4" /> Guichet Vente</button>
          )}
          <button onClick={fetchDashboardData} className="p-4 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-brand-600 hover:border-brand-200 transition-all shadow-sm"><RefreshCcw className="w-5 h-5" /></button>
        </div>
      </header>

      {/* KPI GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
        <StatCard 
            label={isAdminGlobal ? "Volume d'Affaires Global" : (isReseller ? "Vos Ventes (Total)" : "Chiffre d'Affaires")} 
            value={`${stats.revenue.toLocaleString()}`} 
            unit={currency} 
            icon={isAdminGlobal ? <Globe /> : <Wallet />} 
            color="text-brand-600" 
            bg="bg-brand-50" 
        />
        
        <StatCard 
            label={isAdminGlobal ? "Total Tickets Vendus" : "Tickets Vendus"} 
            value={stats.sold} 
            unit="Ventes" 
            icon={<TrendingUp />} 
            color="text-emerald-600" 
            bg="bg-emerald-50" 
        />
        
        {isAdminGlobal ? (
          <StatCard 
            label="Parc d'Agences" 
            value={stats.totalAgencies} 
            unit="Agences Inscrites" 
            icon={<Building2 />} 
            color="text-indigo-600" 
            bg="bg-indigo-50"
            onClick={() => navigate('/agencies')}
          />
        ) : (
          <StatCard 
            label={isReseller ? "Mon Stock (Assigné)" : "Stock Agence"} 
            value={stats.stock} 
            unit="Vouchers" 
            icon={<Ticket />} 
            color="text-indigo-600" 
            bg="bg-indigo-50" 
          />
        )}
        
        {isReseller ? (
             <div className={`bg-white p-6 md:p-8 rounded-[2.5rem] border ${stats.balance < 50000 ? 'border-red-200 shadow-red-100' : 'border-slate-100'} shadow-sm hover:shadow-xl transition-all duration-300 group`}>
                <div className="flex items-start justify-between mb-6">
                  <div className={`w-12 h-12 ${stats.balance < 50000 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"} rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform`}>
                    <Wallet className="w-6 h-6" />
                  </div>
                  <button onClick={() => setShowDepositModal(true)} className="text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-black transition-colors active:scale-95 shadow-lg">Recharger</button>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">Mon Solde (Prépayé)</p>
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">{stats.balance.toLocaleString()}</h3>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{currency}</span>
                  </div>
                </div>
             </div>
        ) : isAdminGlobal ? (
             <StatCard 
                label="Validations Requises" 
                value={stats.pendingAgencies} 
                unit="En attente" 
                icon={<Clock />} 
                color={stats.pendingAgencies > 0 ? "text-orange-600" : "text-slate-400"} 
                bg={stats.pendingAgencies > 0 ? "bg-orange-50" : "bg-slate-50"} 
                border={stats.pendingAgencies > 0}
                onClick={() => navigate('/agencies')}
             />
        ) : (
             <StatCard label="Membres Équipe" value={stats.users} unit="Utilisateurs" icon={<UsersIcon />} color="text-slate-600" bg="bg-slate-100" />
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Recent Transactions Table */}
        <div className="xl:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between">
            <h3 className="font-black text-slate-900 text-lg tracking-tight">
                {isAdminGlobal ? 'Flux Global' : (isReseller ? 'Mes dernières ventes' : 'Transactions récentes')}
            </h3>
            <button onClick={() => navigate('/history')} className="text-xs font-black text-brand-600 hover:text-brand-700 hover:underline uppercase tracking-widest">Voir l'historique</button>
          </div>
          <div className="divide-y divide-slate-50">
            {recentSales.length > 0 ? recentSales.map((sale, i) => (
              <div key={i} className="px-6 md:px-8 py-5 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-mono text-xs border shrink-0 ${isAdminGlobal ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                    {isAdminGlobal ? <Building2 className="w-5 h-5" /> : <Ticket className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    {isAdminGlobal ? (
                        <>
                           <p className="font-black text-slate-900 text-xs uppercase tracking-widest mb-0.5 truncate">{sale.tenants?.name || 'Agence Inconnue'}</p>
                           <p className="text-xs text-slate-500 flex items-center gap-1 truncate font-medium">
                             <Ticket className="w-3 h-3" /> {sale.tickets?.username}
                           </p>
                        </>
                    ) : (
                        <>
                            <p className="font-black text-slate-900 text-sm truncate">{sale.tickets?.username || 'Ticket Inconnu'}</p>
                            <p className="text-xs text-slate-400 truncate font-bold uppercase">{sale.tickets?.ticket_profiles?.name || 'Standard'}</p>
                        </>
                    )}
                  </div>
                </div>
                <div className="text-right pl-2">
                  <p className="font-black text-slate-900 text-sm whitespace-nowrap">{Number(sale.amount_paid).toLocaleString()} {currency}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{new Date(sale.sold_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                </div>
              </div>
            )) : (
              <div className="p-12 text-center text-slate-300 font-bold uppercase text-xs tracking-widest flex flex-col items-center gap-3">
                  <Activity className="w-8 h-8 opacity-20" />
                  Aucune activité récente
              </div>
            )}
          </div>
        </div>

        {/* Side Panel: Performance & Deposits */}
        <div className="space-y-6">
            {/* Quick Performance Card */}
            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-xl shadow-slate-200 relative overflow-hidden flex flex-col justify-between min-h-[300px]">
              <div className="absolute top-0 right-0 w-48 h-48 bg-brand-500 rounded-full blur-[80px] opacity-20 -mr-10 -mt-10"></div>
              <div className="relative z-10">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-8">Performance Live</h3>
                <div className="space-y-4">
                   {isAdminGlobal ? (
                     <>
                       <div className="bg-white/5 p-5 rounded-2xl border border-white/10 flex items-center justify-between backdrop-blur-sm">
                         <div>
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Utilisateurs</p>
                           <p className="text-2xl font-black">{stats.users}</p>
                         </div>
                         <div className="h-10 w-10 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center"><UsersIcon className="w-5 h-5" /></div>
                       </div>
                       <div className="bg-white/5 p-5 rounded-2xl border border-white/10 flex items-center justify-between backdrop-blur-sm">
                         <div>
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Activité Réseau</p>
                           <p className="text-2xl font-black text-emerald-400">Stable</p>
                         </div>
                         <div className="h-10 w-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center"><Activity className="w-5 h-5" /></div>
                       </div>
                     </>
                   ) : (
                     <>
                       <div className="bg-white/5 p-5 rounded-2xl border border-white/10 flex items-center justify-between backdrop-blur-sm">
                         <div>
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Taux d'écoulement</p>
                           <p className="text-2xl font-black">{stats.sold > 0 ? Math.round((stats.sold / (stats.sold + stats.stock)) * 100) : 0}%</p>
                         </div>
                         <div className="h-10 w-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center"><TrendingUp className="w-5 h-5" /></div>
                       </div>
                       <div className="bg-white/5 p-5 rounded-2xl border border-white/10 flex items-center justify-between backdrop-blur-sm">
                         <div>
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Stock Restant</p>
                           <p className="text-2xl font-black">{stats.stock}</p>
                         </div>
                         <div className="h-10 w-10 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center"><Ticket className="w-5 h-5" /></div>
                       </div>
                     </>
                   )}
                </div>
              </div>
              <button onClick={() => navigate('/history')} className="relative z-10 w-full mt-6 py-4 bg-brand-600 hover:bg-brand-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-colors flex items-center justify-center gap-2 shadow-lg shadow-brand-900/50">
                 Rapport Détaillé <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>

            {/* Reseller Deposit History */}
            {isReseller && (
                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-black text-slate-900 text-sm uppercase tracking-tight">Mes Versements</h3>
                        <div className="bg-emerald-50 p-2 rounded-xl text-emerald-600"><Banknote className="w-4 h-4" /></div>
                    </div>
                    {deposits.length > 0 ? (
                        <div className="space-y-3">
                            {deposits.map((d: any) => (
                                <div key={d.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <div>
                                        <p className="font-black text-slate-900 text-xs">{Number(d.amount).toLocaleString()} {currency}</p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase">{new Date(d.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${d.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' : d.status === 'REJECTED' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-500'}`}>
                                        {d.status === 'APPROVED' ? 'VALIDÉ' : d.status === 'REJECTED' ? 'REJETÉ' : 'EN ATTENTE'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-slate-300 font-bold uppercase text-[10px]">Aucun historique</div>
                    )}
                </div>
            )}
        </div>
      </div>

      {/* MODAL DE DECLARATION DE VERSEMENT */}
      {showDepositModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in">
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowDepositModal(false)} />
              <form onSubmit={handleSubmitDeposit} className="bg-white w-full max-w-sm rounded-[3rem] p-10 relative z-10 animate-in zoom-in-95 shadow-2xl">
                  <button type="button" onClick={() => setShowDepositModal(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 transition-colors"><X className="w-6 h-6" /></button>
                  <h2 className="text-2xl font-black mb-8 uppercase text-center text-slate-900 tracking-tight">Déclarer un versement</h2>
                  <div className="space-y-6">
                      <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Montant Versé ({currency})</label>
                          <input type="number" required placeholder="ex: 100000" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xl outline-none focus:bg-white focus:ring-4 focus:ring-emerald-50 transition-all" />
                      </div>
                      <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Méthode</label>
                          <div className="relative">
                              <select value={depositMethod} onChange={e => setDepositMethod(e.target.value)} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black outline-none appearance-none focus:bg-white focus:ring-4 focus:ring-emerald-50 transition-all cursor-pointer">
                                  <option value="CASH">Espèces / Main à main</option>
                                  <option value="MOMO">Mobile Money (MTN)</option>
                                  <option value="OM">Orange Money</option>
                                  <option value="VIREMENT">Virement Bancaire</option>
                              </select>
                          </div>
                      </div>
                      <div className="animate-in slide-in-from-top-2 fade-in">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Référence / Numéro</label>
                          <div className="relative group">
                              <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-emerald-600 transition-colors" />
                              <input type="text" required placeholder="Preuve du paiement" value={depositReference} onChange={e => setDepositReference(e.target.value)} className="w-full pl-14 pr-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl font-black text-lg outline-none focus:bg-white focus:ring-4 focus:ring-emerald-50 transition-all" />
                          </div>
                      </div>
                  </div>
                  <button type="submit" disabled={isSubmittingDeposit} className="w-full mt-10 py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95">
                      {isSubmittingDeposit ? <Loader2 className="w-5 h-5 animate-spin" /> : "ENVOYER LA DEMANDE"}
                  </button>
              </form>
          </div>
      )}
    </div>
  );
};

const StatCard = ({ label, value, unit, icon, color, bg, onClick, border }: any) => (
  <div 
    onClick={onClick} 
    className={`bg-white p-6 md:p-8 rounded-[2.5rem] border ${border ? 'border-orange-200 shadow-orange-100' : 'border-slate-100'} shadow-sm hover:shadow-xl transition-all duration-300 group ${onClick ? 'cursor-pointer hover:border-brand-200 active:scale-95' : ''}`}
  >
    <div className="flex items-start justify-between mb-6">
      <div className={`w-12 h-12 ${bg} ${color} rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform`}>
        {React.cloneElement(icon, { className: "w-6 h-6" })}
      </div>
      {onClick && <ArrowUpRight className="w-5 h-5 text-slate-200 group-hover:text-brand-400 transition-colors" />}
    </div>
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">{label}</p>
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <h3 className="text-3xl font-black text-slate-900 tracking-tight">{value}</h3>
        <span className="text-[10px] font-bold text-slate-400 uppercase">{unit}</span>
      </div>
    </div>
  </div>
);

export default Dashboard;
