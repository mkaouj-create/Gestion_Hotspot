
import React, { useEffect, useState, useCallback } from 'react';
import { 
  Users as UsersIcon, Ticket, Wallet, ShoppingCart, Loader2, RefreshCcw, 
  TrendingUp, ArrowUpRight, ShieldCheck, Building2, Clock, Activity, 
  Globe, MapPin, X, AlertCircle, Smartphone, CheckCircle2, History, 
  Banknote, ArrowDownRight, Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { UserRole, TicketStatus } from '../types';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ 
    revenue: 0, 
    sold: 0, 
    stock: 0, 
    users: 0, 
    pendingAgencies: 0, 
    totalAgencies: 0, 
    balance: 0,
    dailyGrowth: 0 
  });
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [agencyName, setAgencyName] = useState<string>('');
  const [currency, setCurrency] = useState('GNF');
  
  // Modal States
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

      const { data: profile } = await db.from('users').select('*, tenants(name, currency)').eq('id', user.id).maybeSingle();
      if (!profile) return;

      setCurrentUser(profile);
      setAgencyName((profile.tenants as any)?.name || 'Gestion Hotspot');
      setCurrency((profile.tenants as any)?.currency || 'GNF');

      const isAdminGlobal = profile.role === UserRole.ADMIN_GLOBAL;
      const isReseller = profile.role === UserRole.REVENDEUR;
      const tId = profile.tenant_id;
      
      let stockQuery = db.from('tickets').select('*', { count: 'exact', head: true });
      let soldQuery = db.from('tickets').select('*', { count: 'exact', head: true });
      let revQuery = db.from('sales_history').select('amount_paid, sold_at');
      let userQuery = db.from('users').select('*', { count: 'exact', head: true });
      
      let salesQuery = db.from('sales_history')
        .select('*, tenants(name), tickets(username, ticket_profiles(name))')
        .order('sold_at', { ascending: false })
        .limit(8);

      if (isAdminGlobal) {
        // Stats globales
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

      const promises = [stockQuery, soldQuery, revQuery, userQuery, salesQuery];

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
      
      const pendingRes = isAdminGlobal ? results[5] : { count: 0 };
      const totalAgenciesRes = isAdminGlobal ? results[6] : { count: 0 };

      // Calculez la croissance quotidienne (ventes d'aujourd'hui vs hier)
      const today = new Date().toISOString().split('T')[0];
      const todaySales = (revRes.data || []).filter((s: any) => s.sold_at.startsWith(today));
      const todayRev = todaySales.reduce((acc: number, curr: any) => acc + Number(curr.amount_paid), 0);

      setStats({
        revenue: (revRes.data || []).reduce((acc: number, curr: any) => acc + Number(curr.amount_paid), 0) || 0,
        sold: soldRes.count || 0,
        stock: stockRes.count || 0,
        users: userRes.count || 0,
        pendingAgencies: pendingRes.count || 0,
        totalAgencies: totalAgenciesRes.count || 0,
        balance: profile.balance || 0,
        dailyGrowth: todayRev
      });
      setRecentSales(salesRes.data || []);

    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  const handleSubmitDeposit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmittingDeposit(true);
      try {
          const { error } = await db.from('payments').insert({
              tenant_id: currentUser?.tenant_id,
              reseller_id: currentUser?.id,
              amount: Number(depositAmount),
              payment_method: depositMethod,
              phone_number: depositReference,
              status: 'PENDING',
              created_by: currentUser?.id
          });

          if(error) throw error;

          setToast({ type: 'success', message: "Demande de rechargement envoyée." });
          setShowDepositModal(false);
          setDepositAmount('');
          setDepositReference('');
          setTimeout(() => setToast(null), 4000);
          fetchDashboardData();
      } catch(err: any) {
          setToast({ type: 'error', message: err.message });
      } finally {
          setIsSubmittingDeposit(false);
      }
  };

  if (loading) return (
    <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
      <div className="relative">
        <div className="w-12 h-12 border-4 border-slate-100 border-t-brand-600 rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <Zap className="w-4 h-4 text-brand-600 animate-pulse" />
        </div>
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Initialisation de l'espace...</p>
    </div>
  );

  const isAdminGlobal = currentUser?.role === UserRole.ADMIN_GLOBAL;
  const isReseller = currentUser?.role === UserRole.REVENDEUR;

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-700">
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right border ${toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-red-600 text-white border-red-500'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <p className="font-bold text-sm tracking-tight">{toast.message}</p>
        </div>
      )}

      {/* HEADER SECTION */}
      <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-8 md:p-12 rounded-[2.5rem] md:rounded-[4rem] border border-slate-100 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-500 rounded-full blur-[120px] opacity-[0.03] -mr-20 -mt-20 group-hover:opacity-10 transition-opacity"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-6">
          <div className="w-20 h-20 bg-slate-900 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-slate-200">
            {isAdminGlobal ? <Globe className="w-10 h-10" /> : <Building2 className="w-10 h-10" />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
                {isAdminGlobal ? 'Super Admin' : agencyName}
              </span>
              {isReseller && <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest">Revendeur</span>}
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter leading-none">
              Hello, {currentUser?.full_name?.split(' ')[0]}
            </h1>
            <p className="text-slate-400 font-medium mt-2">
              {isAdminGlobal ? "Voici l'état de santé global du réseau SaaS." : "Gérez vos ventes de tickets et suivez vos gains."}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 relative z-10">
          {!isAdminGlobal && (
            <button onClick={() => navigate('/sales')} className="bg-brand-600 hover:bg-brand-700 text-white px-8 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-brand-100 transition-all active:scale-95 group">
              <ShoppingCart className="w-5 h-5 group-hover:-translate-y-1 transition-transform" /> 
              VENDRE TICKETS
            </button>
          )}
          <button onClick={fetchDashboardData} className="p-5 bg-slate-50 border border-slate-100 rounded-[2rem] text-slate-400 hover:text-slate-900 transition-all shadow-sm">
            <RefreshCcw className="w-6 h-6" />
          </button>
        </div>
      </section>

      {/* KPI GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <KpiCard 
          label={isAdminGlobal ? "Chiffre d'Affaires Global" : "Mon Chiffre d'Affaires"}
          value={stats.revenue.toLocaleString()}
          unit={currency}
          icon={<Wallet />}
          color="text-indigo-600"
          bg="bg-indigo-50"
          trend={stats.dailyGrowth}
        />
        <KpiCard 
          label="Tickets Vendus"
          value={stats.sold.toLocaleString()}
          unit="Unités"
          icon={<TrendingUp />}
          color="text-emerald-600"
          bg="bg-emerald-50"
        />
        {isAdminGlobal ? (
          <KpiCard 
            label="Total Agences"
            value={stats.totalAgencies}
            unit="Partenaires"
            icon={<Building2 />}
            color="text-brand-600"
            bg="bg-brand-50"
            onClick={() => navigate('/agencies')}
          />
        ) : (
          <KpiCard 
            label={isReseller ? "Mon Stock Perso" : "Stock en Agence"}
            value={stats.stock}
            unit="Tickets"
            icon={<Ticket />}
            color="text-orange-600"
            bg="bg-orange-50"
            onClick={() => navigate('/stock')}
          />
        )}
        {isReseller ? (
          <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col justify-between group hover:shadow-xl transition-all">
            <div className="flex justify-between items-start mb-6">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform ${stats.balance < 50000 ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'}`}>
                <Wallet className="w-7 h-7" />
              </div>
              <button onClick={() => setShowDepositModal(true)} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-black transition-all active:scale-95 shadow-lg">
                Recharger
              </button>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Mon Solde Prépayé</p>
              <div className="flex items-baseline gap-1.5">
                <h3 className="text-3xl font-black text-slate-900">{stats.balance.toLocaleString()}</h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase">{currency}</span>
              </div>
            </div>
          </div>
        ) : isAdminGlobal ? (
          <KpiCard 
            label="Validations SaaS"
            value={stats.pendingAgencies}
            unit="En attente"
            icon={<Clock />}
            color={stats.pendingAgencies > 0 ? "text-orange-600" : "text-slate-400"}
            bg={stats.pendingAgencies > 0 ? "bg-orange-50" : "bg-slate-50"}
            border={stats.pendingAgencies > 0}
            onClick={() => navigate('/agencies')}
          />
        ) : (
          <KpiCard 
            label="Membres Équipe" 
            value={stats.users} 
            unit="Utilisateurs" 
            icon={<UsersIcon />} 
            color="text-slate-600" 
            bg="bg-slate-100" 
            onClick={() => navigate('/users')}
          />
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-10 items-start">
        {/* RECENT SALES TABLE */}
        <div className="xl:col-span-2 bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden min-h-[500px]">
          <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between">
            <h3 className="font-black text-slate-900 text-lg tracking-tight uppercase">Dernières Activités</h3>
            <button onClick={() => navigate('/history')} className="text-[10px] font-black text-brand-600 hover:underline uppercase tracking-widest">Voir tout le journal</button>
          </div>
          <div className="divide-y divide-slate-50">
            {recentSales.length > 0 ? recentSales.map((sale, i) => (
              <div key={i} className="px-10 py-6 flex items-center justify-between hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => navigate('/history')}>
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-brand-50 group-hover:text-brand-600 transition-all border border-slate-200 group-hover:border-brand-100">
                    <Ticket className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-black text-slate-900 text-sm">{sale.tickets?.username}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {isAdminGlobal ? sale.tenants?.name : sale.tickets?.ticket_profiles?.name}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-slate-900">{Number(sale.amount_paid).toLocaleString()} {currency}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    {new Date(sale.sold_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </p>
                </div>
              </div>
            )) : (
              <div className="p-24 text-center flex flex-col items-center gap-4">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                  <Activity className="w-10 h-10" />
                </div>
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Aucune vente enregistrée</p>
              </div>
            )}
          </div>
        </div>

        {/* SIDE BAR DASHBOARD */}
        <div className="space-y-6 md:space-y-8">
           <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500 rounded-full blur-[100px] opacity-20 -mr-20 -mt-20 group-hover:opacity-30 transition-opacity"></div>
              <div className="relative z-10">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-10">Performance du Forfait</h4>
                <div className="space-y-6">
                   <div className="flex items-center justify-between">
                     <span className="text-xs font-bold text-slate-400">Écoulement Stock</span>
                     <span className="text-xs font-black text-brand-400">{stats.sold > 0 ? Math.round((stats.sold / (stats.sold + stats.stock)) * 100) : 0}%</span>
                   </div>
                   <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                     <div className="h-full bg-brand-500 rounded-full transition-all duration-1000" style={{ width: `${stats.sold > 0 ? (stats.sold / (stats.sold + stats.stock)) * 100 : 0}%` }}></div>
                   </div>
                </div>
                <div className="mt-10 pt-10 border-t border-white/5 space-y-4">
                   <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                      <div className="flex items-center gap-3">
                        <Activity className="w-4 h-4 text-emerald-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Statut Réseau</span>
                      </div>
                      <span className="text-[10px] font-black text-emerald-400 uppercase">Stable</span>
                   </div>
                </div>
              </div>
           </div>

           <div className="bg-white rounded-[3rem] p-8 border border-slate-100 shadow-sm flex items-center justify-between group cursor-pointer hover:border-brand-200 transition-all" onClick={() => navigate('/accounting')}>
              <div className="flex items-center gap-5">
                 <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                   <Banknote className="w-6 h-6" />
                 </div>
                 <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comptabilité</p>
                   <p className="text-sm font-black text-slate-900">Journal Financier</p>
                 </div>
              </div>
              <ArrowUpRight className="w-5 h-5 text-slate-200 group-hover:text-brand-600 transition-colors" />
           </div>

           <div className="bg-white rounded-[3rem] p-8 border border-slate-100 shadow-sm flex items-center justify-between group cursor-pointer hover:border-brand-200 transition-all" onClick={() => navigate('/zones')}>
              <div className="flex items-center gap-5">
                 <div className="w-12 h-12 bg-slate-50 text-slate-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                   <MapPin className="w-6 h-6" />
                 </div>
                 <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Infrastructure</p>
                   <p className="text-sm font-black text-slate-900">Zones WiFi Actives</p>
                 </div>
              </div>
              <ArrowUpRight className="w-5 h-5 text-slate-200 group-hover:text-brand-600 transition-colors" />
           </div>
        </div>
      </div>

      {/* DEPOSIT MODAL */}
      {showDepositModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in">
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowDepositModal(false)} />
              <form onSubmit={handleSubmitDeposit} className="bg-white w-full max-w-sm rounded-[3rem] p-10 relative z-10 animate-in zoom-in-95 shadow-2xl">
                  <button type="button" onClick={() => setShowDepositModal(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 transition-colors"><X className="w-6 h-6" /></button>
                  <h2 className="text-2xl font-black mb-8 uppercase text-center text-slate-900 tracking-tight">Recharger mon compte</h2>
                  <div className="space-y-6">
                      <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Montant à verser ({currency})</label>
                          <input type="number" required placeholder="ex: 200000" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xl outline-none focus:bg-white focus:ring-4 focus:ring-emerald-50 transition-all" />
                      </div>
                      <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Méthode de paiement</label>
                          <select value={depositMethod} onChange={e => setDepositMethod(e.target.value)} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black outline-none appearance-none focus:bg-white focus:ring-4 focus:ring-emerald-50 transition-all cursor-pointer">
                              <option value="CASH">Espèces / Direct</option>
                              <option value="MOMO">Mobile Money</option>
                              <option value="OM">Orange Money</option>
                          </select>
                      </div>
                      <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Référence / Preuve</label>
                          <div className="relative group">
                              <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-emerald-600 transition-colors" />
                              <input type="text" required placeholder="N° de transaction ou Réf" value={depositReference} onChange={e => setDepositReference(e.target.value)} className="w-full pl-14 pr-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl font-black text-lg outline-none focus:bg-white focus:ring-4 focus:ring-emerald-50 transition-all" />
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

const KpiCard = ({ label, value, unit, icon, color, bg, onClick, border, trend }: any) => (
  <div 
    onClick={onClick} 
    className={`bg-white p-8 rounded-[3rem] border ${border ? 'border-brand-200' : 'border-slate-100'} shadow-sm hover:shadow-xl transition-all duration-300 group ${onClick ? 'cursor-pointer hover:border-brand-200 active:scale-95' : ''}`}
  >
    <div className="flex items-start justify-between mb-6">
      <div className={`w-14 h-14 ${bg} ${color} rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform`}>
        {React.cloneElement(icon, { className: "w-7 h-7" })}
      </div>
      {trend > 0 && (
        <div className="flex items-center gap-1 bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-lg">
          <ArrowUpRight className="w-3 h-3" />
          <span className="text-[10px] font-black">+{trend.toLocaleString()}</span>
        </div>
      )}
    </div>
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">{label}</p>
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{value}</h3>
        <span className="text-[10px] font-bold text-slate-400 uppercase">{unit}</span>
      </div>
    </div>
  </div>
);

export default Dashboard;
