
import React, { useEffect, useState, useCallback } from 'react';
import { 
  Users as UsersIcon, Ticket, Wallet, ShoppingCart, Loader2, RefreshCcw, 
  TrendingUp, ArrowUpRight, ShieldCheck, Building2, Clock, Activity, 
  Globe, MapPin, X, AlertCircle, Smartphone, CheckCircle2, History, 
  Banknote, ArrowDownRight, Zap, ArrowDownLeft, Landmark, AlertTriangle,
  Store, User
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { UserRole, TicketStatus } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, subDays, startOfDay, endOfDay, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

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
    dailyGrowth: 0,
    pendingPayments: 0,
    margin: 0 // Nouveau : Bénéfice net estimé
  });
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [sourceData, setSourceData] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [lowStockProfiles, setLowStockProfiles] = useState<any[]>([]);
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
      let revQuery = db.from('sales_history').select('amount_paid, tickets(cost_price)');
      let userQuery = db.from('users').select('*', { count: 'exact', head: true });
      let activitySalesQuery = db.from('sales_history').select('*, tickets(username), users!seller_id(full_name)').limit(8).order('sold_at', { ascending: false });
      let activityPaymentsQuery = db.from('payments').select('*, users!reseller_id(full_name)').limit(8).order('created_at', { ascending: false });
      let pendingPayQuery = db.from('payments').select('amount').eq('status', 'PENDING');
      let lowStockQuery = db.from('ticket_profiles').select('name, low_stock_threshold, tickets(count)');

      if (isAdminGlobal) {
        // Stats globales...
      } else if (isReseller) {
        stockQuery = stockQuery.eq('assigned_to', user.id).eq('status', TicketStatus.ASSIGNE);
        soldQuery = soldQuery.eq('sold_by', user.id).eq('status', TicketStatus.VENDU);
        revQuery = revQuery.eq('seller_id', user.id);
        activitySalesQuery = activitySalesQuery.eq('seller_id', user.id);
        activityPaymentsQuery = activityPaymentsQuery.eq('reseller_id', user.id);
        pendingPayQuery = pendingPayQuery.eq('reseller_id', user.id);
      } else {
        stockQuery = stockQuery.eq('tenant_id', tId).eq('status', TicketStatus.NEUF);
        soldQuery = soldQuery.eq('tenant_id', tId).eq('status', TicketStatus.VENDU);
        revQuery = revQuery.eq('tenant_id', tId);
        userQuery = userQuery.eq('tenant_id', tId);
        activitySalesQuery = activitySalesQuery.eq('tenant_id', tId);
        activityPaymentsQuery = activityPaymentsQuery.eq('tenant_id', tId);
        pendingPayQuery = pendingPayQuery.eq('tenant_id', tId);
        lowStockQuery = lowStockQuery.eq('tenant_id', tId);
      }

      const promises = [stockQuery, soldQuery, revQuery, userQuery, activitySalesQuery, pendingPayQuery, lowStockQuery, activityPaymentsQuery];

      if (isAdminGlobal) {
        promises.push(db.from('tenants').select('*', { count: 'exact', head: true }).eq('subscription_status', 'EN_ATTENTE'));
        promises.push(db.from('tenants').select('*', { count: 'exact', head: true }));
      }

      const results = await Promise.all(promises);
      
      const revenueData = results[2].data || [];
      const totalRevenue = revenueData.reduce((acc: number, curr: any) => acc + Number(curr.amount_paid), 0);
      const totalCost = revenueData.reduce((acc: number, curr: any) => acc + Number((curr.tickets as any)?.cost_price || 0), 0);
      const pendingAmt = (results[5].data || []).reduce((acc: number, curr: any) => acc + Number(curr.amount), 0);
      
      // Process Weekly and Source Data
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = subDays(new Date(), i);
        return format(d, 'yyyy-MM-dd');
      }).reverse();

      const weeklyMap: Record<string, number> = {};
      last7Days.forEach(day => weeklyMap[day] = 0);

      let guichetSales = 0;
      let directSales = 0;

      revenueData.forEach((sale: any) => {
        const day = format(new Date(sale.sold_at), 'yyyy-MM-dd');
        if (weeklyMap[day] !== undefined) {
          weeklyMap[day] += Number(sale.amount_paid);
        }
        if (sale.metadata?.source === 'guichet') {
          guichetSales += Number(sale.amount_paid);
        } else {
          directSales += Number(sale.amount_paid);
        }
      });

      setWeeklyData(last7Days.map(date => ({
        date: format(parseISO(date), 'dd MMM', { locale: fr }),
        revenue: weeklyMap[date]
      })));

      setSourceData([
        { name: 'Guichets', value: guichetSales, color: '#6366f1' },
        { name: 'Vendeurs', value: directSales, color: '#10b981' }
      ]);
      
      // Filtrage des stocks bas
      const lowStocks = (results[6].data || []).filter((p: any) => {
          const count = p.tickets?.[0]?.count || 0;
          return count <= (p.low_stock_threshold || 10);
      });
      setLowStockProfiles(lowStocks);

      setStats({
        revenue: totalRevenue,
        sold: results[1].count || 0,
        stock: results[0].count || 0,
        users: results[3].count || 0,
        pendingAgencies: isAdminGlobal ? (results[8]?.count || 0) : 0,
        totalAgencies: isAdminGlobal ? (results[9]?.count || 0) : 0,
        balance: profile.balance || 0,
        dailyGrowth: 0,
        pendingPayments: pendingAmt,
        margin: totalRevenue - totalCost
      });

      const salesActivities = (results[4].data || []).map((s: any) => ({
        id: s.id,
        entry_date: s.sold_at,
        entry_type: 'VENTE' as const,
        amount: s.amount_paid,
        description: `Vente ticket: ${s.tickets?.username || 'ID#' + s.ticket_id}`,
        party_name: s.users?.full_name || s.metadata?.guichet_name || 'Utilisateur supprimé',
      }));

      const paymentActivities = (results[7].data || []).map((p: any) => ({
        id: p.id,
        entry_date: p.created_at,
        entry_type: 'VERSEMENT' as const,
        amount: p.amount,
        description: 'Versement revendeur',
        party_name: p.users?.full_name || 'Utilisateur supprimé',
      }));

      const combinedActivities = [...salesActivities, ...paymentActivities]
        .sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime())
        .slice(0, 8);

      setRecentActivities(combinedActivities);

    } catch (err) { 
      console.error("Dashboard Fetch Error:", err); 
    } finally { 
      setLoading(false); 
    }
  }, []);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  const handleSubmitVersement = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSubmittingDeposit(true);
      try {
          const { error } = await db.from('payments').insert({
              tenant_id: currentUser?.tenant_id,
              reseller_id: currentUser?.id,
              amount: Number(depositAmount),
              payment_method: depositMethod,
              phone_number: depositReference || 'Versement Main à Main',
              status: 'PENDING',
              created_by: currentUser?.id
          });
          if(error) throw error;
          setToast({ type: 'success', message: "Versement déclaré avec succès." });
          setShowDepositModal(false);
          setDepositAmount('');
          setDepositReference('');
          fetchDashboardData();
      } catch(err: any) {
          setToast({ type: 'error', message: err.message });
      } finally {
          setIsSubmittingDeposit(false);
      }
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-brand-600" /></div>;

  const isReseller = currentUser?.role === UserRole.REVENDEUR;

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-700">
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right border ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <p className="font-bold text-sm">{toast.message}</p>
        </div>
      )}

      {/* ALERTES STOCK BAS */}
      {lowStockProfiles.length > 0 && !isReseller && (
          <div className="bg-red-50 border-2 border-red-100 p-6 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-4 animate-pulse">
              <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-red-200">
                      <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                      <h4 className="font-black text-red-900 uppercase text-xs tracking-widest">Alerte de Stock Critique</h4>
                      <p className="text-red-700 text-sm font-medium">Les forfaits <strong>{lowStockProfiles.map(p => p.name).join(', ')}</strong> sont presque épuisés.</p>
                  </div>
              </div>
              <button onClick={() => navigate('/import')} className="bg-red-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all">RECHARGER MAINTENANT</button>
          </div>
      )}

      {/* HEADER */}
      <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[4rem] border border-slate-100 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-500 rounded-full blur-[120px] opacity-[0.03] -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-6">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-900 rounded-[1.5rem] md:rounded-[2rem] flex items-center justify-center text-white shadow-2xl shrink-0">
            {isReseller ? <Wallet className="w-8 h-8 md:w-10 md:h-10" /> : <Building2 className="w-8 h-8 md:w-10 md:h-10" />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">{agencyName}</span>
              {isReseller && <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest">Compte Revendeur</span>}
            </div>
            <h1 className="text-2xl md:text-5xl font-black text-slate-900 tracking-tighter leading-none">Hello, {currentUser?.full_name?.split(' ')[0]}</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-3 relative z-10">
          {!isReseller && !currentUser?.role.includes('ADMIN_GLOBAL') && (
            <div className="bg-emerald-50 px-4 py-3 md:px-6 md:py-4 rounded-2xl md:rounded-3xl border border-emerald-100 hidden md:block">
                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Bénéfice Estimé</p>
                <p className="text-lg md:text-xl font-black text-emerald-900">+{stats.margin.toLocaleString()} <span className="text-[10px]">{currency}</span></p>
            </div>
          )}
          <button onClick={fetchDashboardData} className="p-4 bg-slate-50 text-slate-600 rounded-[1.5rem] hover:bg-slate-100 active:scale-95 transition-all" title="Actualiser">
            <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => navigate('/sales')} className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-4 md:px-8 md:py-5 rounded-[1.5rem] md:rounded-[2rem] font-black text-[10px] md:text-xs uppercase tracking-widest flex items-center justify-center gap-2 md:gap-3 shadow-xl transition-all active:scale-95 group">
            <ShoppingCart className="w-4 h-4 md:w-5 md:h-5 group-hover:-translate-y-1 transition-transform" /> <span className="hidden sm:inline">VENDRE TICKETS</span><span className="sm:hidden">VENDRE</span>
          </button>
        </div>
      </section>

      {/* KPI GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <KpiCard 
          label={isReseller ? "Recettes de Vente" : "Chiffre d'Affaires"}
          value={stats.revenue.toLocaleString()}
          unit={currency}
          icon={<TrendingUp />}
          color="text-indigo-600"
          bg="bg-indigo-50"
        />

        <div className="bg-white p-5 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-slate-100 shadow-sm flex flex-col justify-between group hover:shadow-xl transition-all col-span-2 sm:col-span-1">
          <div className="flex justify-between items-start mb-4 md:mb-6">
            <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center shadow-inner ${stats.balance < 10000 ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'}`}>
              <Wallet className="w-5 h-5 md:w-7 md:h-7" />
            </div>
            {isReseller && (
              <button onClick={() => setShowDepositModal(true)} className="px-3 py-1.5 md:px-4 md:py-2 bg-slate-900 text-white rounded-lg md:rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg">
                VERSER
              </button>
            )}
          </div>
          <div>
            <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isReseller ? "Mon Crédit" : "Trésorerie"}</p>
            <div className="flex items-baseline gap-1 md:gap-1.5">
              <h3 className={`text-2xl md:text-3xl font-black ${stats.balance < 0 ? 'text-red-600' : 'text-slate-900'}`}>{stats.balance.toLocaleString()}</h3>
              <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase">{currency}</span>
            </div>
          </div>
        </div>

        <KpiCard 
          label="Versements à Valider"
          value={stats.pendingPayments.toLocaleString()}
          unit={currency}
          icon={<Clock />}
          color="text-orange-600"
          bg="bg-orange-50"
          onClick={isReseller ? undefined : () => navigate('/resellers')}
        />

        <KpiCard 
          label={isReseller ? "Mes Vouchers" : "Stock Global"}
          value={stats.stock}
          unit="Unités"
          icon={<Ticket />}
          color={lowStockProfiles.length > 0 ? "text-red-600" : "text-slate-600"}
          bg={lowStockProfiles.length > 0 ? "bg-red-50" : "bg-slate-50"}
          onClick={() => navigate('/stock')}
        />
      </div>

      {/* CHARTS SECTION */}
      {!isReseller && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-6 md:p-10 rounded-[3rem] border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-500" />
                Performance 7 Jours
              </h3>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyData}>
                  <defs>
                    <linearGradient id="colorRevDash" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}}
                  />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                    formatter={(value: any) => [`${value.toLocaleString()} GNF`, 'Recette']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorRevDash)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 md:p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 mb-8">
              <Activity className="w-5 h-5 text-emerald-500" />
              Sources de Vente
            </h3>
            <div className="flex-1 flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {sourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</p>
                <p className="text-xl font-black text-slate-900">{stats.revenue.toLocaleString()}</p>
              </div>
            </div>
            <div className="space-y-3 mt-6">
              {sourceData.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-xs font-bold text-slate-600">{item.name}</span>
                  </div>
                  <span className="text-xs font-black text-slate-900">
                    {stats.revenue > 0 ? Math.round((item.value / stats.revenue) * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FOOTER DASHBOARD */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-2 bg-white rounded-[2rem] md:rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden min-h-[300px] md:min-h-[400px]">
          <div className="px-5 py-4 md:px-10 md:py-8 border-b border-slate-50 flex items-center justify-between">
            <h3 className="font-black text-slate-900 text-sm md:text-lg uppercase tracking-tight">Journal d'Activité</h3>
            <button onClick={() => navigate('/history')} className="text-[9px] md:text-[10px] font-black text-brand-600 uppercase tracking-widest">Voir complet</button>
          </div>
          <div className="divide-y divide-slate-50">
            {recentActivities.map((activity, i) => (
              <div key={i} className="px-5 py-4 md:px-10 md:py-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3 md:gap-5">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center ${activity.entry_type === 'VENTE' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    {activity.entry_type === 'VENTE' ? <ShoppingCart className="w-4 h-4 md:w-5 md:h-5" /> : <Banknote className="w-4 h-4 md:w-5 md:h-5" />}
                  </div>
                  <div>
                    <p className="font-black text-slate-900 text-xs md:text-sm line-clamp-1">{activity.description}</p>
                    <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase">{new Date(activity.entry_date).toLocaleDateString()} • {activity.party_name}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-black text-sm md:text-lg ${activity.entry_type === 'VENTE' ? 'text-slate-900' : 'text-emerald-600'}`}>
                    {activity.entry_type === 'VENTE' ? '-' : '+'}{Number(activity.amount).toLocaleString()}
                  </p>
                  <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase">{currency}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
            <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500 rounded-full blur-[60px] opacity-20"></div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Performance Agence</h4>
                <div className="space-y-6 mb-8">
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-400">Taux de marge</span>
                        <span className="text-xs font-black text-emerald-400">{stats.revenue > 0 ? Math.round((stats.margin / stats.revenue) * 100) : 0}%</span>
                    </div>
                    <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${stats.revenue > 0 ? Math.round((stats.margin / stats.revenue) * 100) : 0}%` }}></div>
                    </div>
                </div>
                <button onClick={() => navigate('/accounting')} className="w-full py-4 bg-brand-600 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-brand-900/40 hover:bg-brand-500 transition-all">DÉTAILS COMPTABLES</button>
            </div>
        </div>
      </div>

      {/* VERSEMENT MODAL */}
      {showDepositModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in">
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowDepositModal(false)} />
              <form onSubmit={handleSubmitVersement} className="bg-white w-full max-w-sm rounded-[3rem] p-10 relative z-10 animate-in zoom-in-95 shadow-2xl">
                  <button type="button" onClick={() => setShowDepositModal(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 transition-colors"><X className="w-6 h-6" /></button>
                  <h2 className="text-2xl font-black mb-8 uppercase text-center text-slate-900 tracking-tight">Déclarer Versement</h2>
                  <div className="space-y-6">
                      <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Montant ({currency})</label>
                          <input type="number" required placeholder="ex: 150000" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xl outline-none focus:bg-white focus:ring-4 focus:ring-brand-50 transition-all" />
                      </div>
                      <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Méthode</label>
                          <select value={depositMethod} onChange={e => setDepositMethod(e.target.value)} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black outline-none appearance-none focus:bg-white focus:ring-4 focus:ring-brand-50 transition-all cursor-pointer">
                              <option value="CASH">Espèces</option>
                              <option value="MOMO">Mobile Money</option>
                              <option value="OM">Orange Money</option>
                          </select>
                      </div>
                      <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Preuve / Référence</label>
                          <input type="text" placeholder="Qui a reçu le cash ?" value={depositReference} onChange={e => setDepositReference(e.target.value)} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-black text-lg outline-none focus:bg-white transition-all" />
                      </div>
                  </div>
                  <button type="submit" disabled={isSubmittingDeposit} className="w-full mt-10 py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 shadow-xl hover:bg-emerald-700 transition-all">
                      {isSubmittingDeposit ? <Loader2 className="w-5 h-5 animate-spin" /> : "ENVOYER LA DÉCLARATION"}
                  </button>
              </form>
          </div>
      )}
    </div>
  );
};

const KpiCard = ({ label, value, unit, icon, color, bg, onClick }: any) => (
  <div 
    onClick={onClick} 
    className={`bg-white p-5 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 group ${onClick ? 'cursor-pointer' : ''}`}
  >
    <div className={`w-10 h-10 md:w-14 md:h-14 ${bg} ${color} rounded-xl md:rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform mb-4 md:mb-6`}>
      {React.cloneElement(icon, { className: "w-5 h-5 md:w-7 md:h-7" })}
    </div>
    <div>
      <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">{label}</p>
      <div className="flex items-baseline gap-1 md:gap-1.5 flex-wrap">
        <h3 className={`text-2xl md:text-3xl font-black text-slate-900 tracking-tighter`}>{value}</h3>
        <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase">{unit}</span>
      </div>
    </div>
  </div>
);

export default Dashboard;
