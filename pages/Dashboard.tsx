
import React, { useEffect, useState, useCallback } from 'react';
import { 
  Users as UsersIcon, Ticket, Wallet, ShoppingCart, Loader2, RefreshCcw, 
  TrendingUp, ArrowUpRight, ShieldCheck, Building2, Clock, Activity, 
  Globe, MapPin, X, AlertCircle, Smartphone, CheckCircle2, History, 
  Banknote, ArrowDownRight, Zap, ArrowDownLeft, Landmark, AlertTriangle
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
    dailyGrowth: 0,
    pendingPayments: 0,
    margin: 0 // Nouveau : Bénéfice net estimé
  });
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
      let activityQuery = db.from('accounting_ledger').select('*').limit(8).order('entry_date', { ascending: false });
      let pendingPayQuery = db.from('payments').select('amount').eq('status', 'PENDING');
      let lowStockQuery = db.from('ticket_profiles').select('name, low_stock_threshold, tickets(count)');

      if (isAdminGlobal) {
        // Stats globales...
      } else if (isReseller) {
        stockQuery = stockQuery.eq('assigned_to', user.id).eq('status', TicketStatus.ASSIGNE);
        soldQuery = soldQuery.eq('sold_by', user.id).eq('status', TicketStatus.VENDU);
        revQuery = revQuery.eq('seller_id', user.id);
        activityQuery = activityQuery.eq('user_id', user.id);
        pendingPayQuery = pendingPayQuery.eq('reseller_id', user.id);
      } else {
        stockQuery = stockQuery.eq('tenant_id', tId).eq('status', TicketStatus.NEUF);
        soldQuery = soldQuery.eq('tenant_id', tId).eq('status', TicketStatus.VENDU);
        revQuery = revQuery.eq('tenant_id', tId);
        userQuery = userQuery.eq('tenant_id', tId);
        activityQuery = activityQuery.eq('tenant_id', tId);
        pendingPayQuery = pendingPayQuery.eq('tenant_id', tId);
        lowStockQuery = lowStockQuery.eq('tenant_id', tId);
      }

      const promises = [stockQuery, soldQuery, revQuery, userQuery, activityQuery, pendingPayQuery, lowStockQuery];

      if (isAdminGlobal) {
        promises.push(db.from('tenants').select('*', { count: 'exact', head: true }).eq('subscription_status', 'EN_ATTENTE'));
        promises.push(db.from('tenants').select('*', { count: 'exact', head: true }));
      }

      const results = await Promise.all(promises);
      
      const revenueData = results[2].data || [];
      const totalRevenue = revenueData.reduce((acc: number, curr: any) => acc + Number(curr.amount_paid), 0);
      const totalCost = revenueData.reduce((acc: number, curr: any) => acc + Number((curr.tickets as any)?.cost_price || 0), 0);
      const pendingAmt = (results[5].data || []).reduce((acc: number, curr: any) => acc + Number(curr.amount), 0);
      
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
        pendingAgencies: isAdminGlobal ? (results[7]?.count || 0) : 0,
        totalAgencies: isAdminGlobal ? (results[8]?.count || 0) : 0,
        balance: profile.balance || 0,
        dailyGrowth: 0,
        pendingPayments: pendingAmt,
        margin: totalRevenue - totalCost
      });

      setRecentActivities(results[4].data || []);

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
      <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-8 md:p-12 rounded-[2.5rem] md:rounded-[4rem] border border-slate-100 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-500 rounded-full blur-[120px] opacity-[0.03] -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-6">
          <div className="w-20 h-20 bg-slate-900 rounded-[2rem] flex items-center justify-center text-white shadow-2xl">
            {isReseller ? <Wallet className="w-10 h-10" /> : <Building2 className="w-10 h-10" />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">{agencyName}</span>
              {isReseller && <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest">Compte Revendeur</span>}
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter leading-none">Hello, {currentUser?.full_name?.split(' ')[0]}</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-3 relative z-10">
          {!isReseller && !currentUser?.role.includes('ADMIN_GLOBAL') && (
            <div className="bg-emerald-50 px-6 py-4 rounded-3xl border border-emerald-100 hidden md:block">
                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Bénéfice Estimé</p>
                <p className="text-xl font-black text-emerald-900">+{stats.margin.toLocaleString()} <span className="text-[10px]">{currency}</span></p>
            </div>
          )}
          <button onClick={() => navigate('/sales')} className="bg-brand-600 hover:bg-brand-700 text-white px-8 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95 group">
            <ShoppingCart className="w-5 h-5 group-hover:-translate-y-1 transition-transform" /> VENDRE TICKETS
          </button>
        </div>
      </section>

      {/* KPI GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard 
          label={isReseller ? "Recettes de Vente" : "Chiffre d'Affaires"}
          value={stats.revenue.toLocaleString()}
          unit={currency}
          icon={<TrendingUp />}
          color="text-indigo-600"
          bg="bg-indigo-50"
        />

        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col justify-between group hover:shadow-xl transition-all">
          <div className="flex justify-between items-start mb-6">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${stats.balance < 10000 ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'}`}>
              <Wallet className="w-7 h-7" />
            </div>
            {isReseller && (
              <button onClick={() => setShowDepositModal(true)} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg">
                VERSER CASH
              </button>
            )}
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isReseller ? "Mon Crédit Disponible" : "Solde Trésorerie"}</p>
            <div className="flex items-baseline gap-1.5">
              <h3 className={`text-3xl font-black ${stats.balance < 0 ? 'text-red-600' : 'text-slate-900'}`}>{stats.balance.toLocaleString()}</h3>
              <span className="text-[10px] font-bold text-slate-400 uppercase">{currency}</span>
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

      {/* FOOTER DASHBOARD */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
          <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between">
            <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">Journal d'Activité</h3>
            <button onClick={() => navigate('/history')} className="text-[10px] font-black text-brand-600 uppercase tracking-widest">Voir complet</button>
          </div>
          <div className="divide-y divide-slate-50">
            {recentActivities.map((activity, i) => (
              <div key={i} className="px-10 py-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-5">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${activity.entry_type === 'VENTE' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    {activity.entry_type === 'VENTE' ? <ShoppingCart className="w-5 h-5" /> : <Banknote className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="font-black text-slate-900 text-sm">{activity.description}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{new Date(activity.entry_date).toLocaleDateString()} • {activity.party_name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-black text-lg ${activity.entry_type === 'VENTE' ? 'text-slate-900' : 'text-emerald-600'}`}>
                    {activity.entry_type === 'VENTE' ? '-' : '+'}{Number(activity.amount).toLocaleString()}
                  </p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">{currency}</p>
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
    className={`bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 group ${onClick ? 'cursor-pointer' : ''}`}
  >
    <div className={`w-14 h-14 ${bg} ${color} rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform mb-6`}>
      {React.cloneElement(icon, { className: "w-7 h-7" })}
    </div>
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">{label}</p>
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <h3 className={`text-3xl font-black text-slate-900 tracking-tighter`}>{value}</h3>
        <span className="text-[10px] font-bold text-slate-400 uppercase">{unit}</span>
      </div>
    </div>
  </div>
);

export default Dashboard;
