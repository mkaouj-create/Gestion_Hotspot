
import React, { useEffect, useState, useCallback } from 'react';
import { Users as UsersIcon, Ticket, Wallet, ShoppingCart, Loader2, RefreshCcw, TrendingUp, ArrowUpRight, ShieldCheck, Building2, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { UserRole } from '../types';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ revenue: 0, sold: 0, stock: 0, users: 0, pendingAgencies: 0 });
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await db.auth.getUser();
      if (!user) return;

      const { data: profile } = await db.from('users').select('role, tenant_id').eq('id', user.id).maybeSingle();
      if (!profile) return;

      setCurrentUserRole(profile.role as UserRole);
      const isAdmin = profile.role === UserRole.ADMIN_GLOBAL;
      const tId = profile.tenant_id;
      
      // Helper pour appliquer le filtre tenant si nécessaire
      const applyTenantFilter = (query: any) => {
        if (!isAdmin && tId) return query.eq('tenant_id', tId);
        return query;
      };

      // Requêtes parallèles
      const promises = [
        applyTenantFilter(db.from('tickets').select('*', { count: 'exact', head: true })).eq('status', 'NEUF'),
        applyTenantFilter(db.from('tickets').select('*', { count: 'exact', head: true })).eq('status', 'VENDU'),
        applyTenantFilter(db.from('sales_history').select('amount_paid')),
        applyTenantFilter(db.from('users').select('*', { count: 'exact', head: true })),
        applyTenantFilter(db.from('sales_history').select('*, tickets(username, ticket_profiles(name))')).order('sold_at', { ascending: false }).limit(6)
      ];

      // Si Admin Global, on vérifie aussi les agences en attente
      if (isAdmin) {
        promises.push(db.from('tenants').select('*', { count: 'exact', head: true }).eq('subscription_status', 'EN_ATTENTE'));
      }

      const results = await Promise.all(promises);
      const stockRes = results[0];
      const soldRes = results[1];
      const revRes = results[2];
      const userRes = results[3];
      const salesRes = results[4];
      const pendingRes = isAdmin ? results[5] : { count: 0 };

      setStats({
        revenue: (revRes.data || []).reduce((acc: number, curr: any) => acc + Number(curr.amount_paid), 0) || 0,
        sold: soldRes.count || 0,
        stock: stockRes.count || 0,
        users: userRes.count || 0,
        pendingAgencies: pendingRes.count || 0
      });
      setRecentSales(salesRes.data || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  if (loading) return <div className="h-[60vh] flex flex-col items-center justify-center"><Loader2 className="w-12 h-12 text-brand-600 animate-spin mb-4 opacity-20" /><p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Synchronisation Cloud...</p></div>;

  const isAdminGlobal = currentUserRole === UserRole.ADMIN_GLOBAL;

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            {isAdminGlobal && <span className="bg-brand-100 text-brand-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 w-fit"><ShieldCheck className="w-3 h-3" /> Mode Superviseur</span>}
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight italic leading-none mb-3">
            {isAdminGlobal ? 'Supervision SaaS' : 'Tableau de Bord'}
          </h1>
          <p className="text-slate-400 font-medium text-lg">
            {isAdminGlobal ? 'Vue globale de la performance de toutes les agences.' : 'Résumé de l\'activité de votre infrastructure WiFi.'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {!isAdminGlobal && (
            <button onClick={() => navigate('/sales')} className="bg-brand-600 hover:bg-brand-700 text-white px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 shadow-2xl shadow-brand-100 transition-all active:scale-95"><ShoppingCart className="w-5 h-5" /> Nouvelle Vente</button>
          )}
          <button onClick={fetchDashboardData} className="p-5 bg-white border border-slate-100 rounded-2xl text-slate-300 hover:text-brand-600 transition-all shadow-sm active:rotate-180 duration-500"><RefreshCcw className="w-6 h-6" /></button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label={isAdminGlobal ? "Revenu Global" : "Chiffre d'Affaires"} value={`${stats.revenue.toLocaleString()}`} unit="GNF" icon={<Wallet />} color="bg-brand-600" />
        <StatCard label="Tickets Vendus" value={stats.sold} unit="Ventes" icon={<TrendingUp />} color="bg-emerald-600" />
        {isAdminGlobal ? (
          <StatCard 
            label="Validations Requises" 
            value={stats.pendingAgencies} 
            unit="Agences" 
            icon={<Clock />} 
            color={stats.pendingAgencies > 0 ? "bg-orange-500 animate-pulse" : "bg-slate-400"} 
            onClick={() => stats.pendingAgencies > 0 && navigate('/agencies')}
          />
        ) : (
          <StatCard label="Stock Disponible" value={stats.stock} unit="Vouchers" icon={<Ticket />} color="bg-indigo-600" />
        )}
        <StatCard label={isAdminGlobal ? "Utilisateurs Totaux" : "Utilisateurs"} value={stats.users} unit="Membres" icon={<UsersIcon />} color="bg-slate-900" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10 items-start">
        <div className="xl:col-span-2 bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-10 border-b border-slate-50 flex items-center justify-between"><h3 className="font-black text-slate-900 uppercase tracking-tight">Transactions récentes</h3><button onClick={() => navigate('/history')} className="text-[10px] font-black text-brand-600 uppercase tracking-widest hover:underline">Journal complet</button></div>
          <div className="divide-y divide-slate-50">
            {recentSales.length > 0 ? recentSales.map((sale, i) => (
              <div key={i} className="p-8 flex items-center justify-between hover:bg-slate-50 transition-all group">
                <div className="flex items-center gap-6">
                  <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center font-black text-slate-400 text-xs group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">#</div>
                  <div><p className="font-black text-slate-900 text-base tracking-tight leading-none mb-1.5">{sale.tickets?.username || 'Ticket Inconnu'}</p><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{sale.tickets?.ticket_profiles?.name || 'Offre Standard'}</p></div>
                </div>
                <div className="text-right"><p className="font-black text-slate-900 text-base">{Number(sale.amount_paid).toLocaleString()} GNF</p><p className="text-[10px] font-bold text-slate-300 uppercase mt-1">{new Date(sale.sold_at).toLocaleTimeString()}</p></div>
              </div>
            )) : <div className="p-32 text-center text-slate-300 font-bold uppercase text-[10px] tracking-widest">Aucune donnée</div>}
          </div>
        </div>
        <div className="bg-brand-600 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden group">
          <h3 className="text-xl font-black uppercase tracking-tight mb-8 relative z-10">Performance</h3>
          <div className="space-y-6 relative z-10">
             <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/10 flex items-center justify-between"><div><p className="text-[9px] font-black text-brand-200 uppercase tracking-widest mb-1">Stock Global</p><p className="text-2xl font-black">{stats.stock}</p></div><div className="bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-[9px] font-black tracking-widest">ACTIF</div></div>
             <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/10 flex items-center justify-between"><div><p className="text-[9px] font-black text-brand-200 uppercase tracking-widest mb-1">Ventes Totales</p><p className="text-2xl font-black">{stats.sold}</p></div><div className="bg-brand-500/20 text-brand-100 px-3 py-1 rounded-full text-[9px] font-black tracking-widest">STABLE</div></div>
          </div>
          <button onClick={() => navigate('/history')} className="w-full mt-10 py-5 bg-white text-brand-600 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl transition-all hover:scale-105">ANALYSE COMPLÈTE <ArrowUpRight className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, unit, icon, color, onClick }: any) => (
  <div onClick={onClick} className={`bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-brand-100 transition-all hover:shadow-2xl hover:-translate-y-1 duration-500 ${onClick ? 'cursor-pointer hover:bg-slate-50' : ''}`}>
    <div className={`w-14 h-14 ${color} rounded-2xl flex items-center justify-center text-white mb-8 shadow-xl group-hover:scale-110 transition-transform`}>{React.cloneElement(icon, { className: "w-6 h-6" })}</div>
    <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{label}</p><div className="flex items-baseline gap-2"><h3 className="text-3xl font-black text-slate-900 tracking-tighter">{value}</h3><span className="text-[10px] font-black text-slate-300 uppercase">{unit}</span></div></div>
  </div>
);

export default Dashboard;
