
import React, { useEffect, useState, useCallback } from 'react';
import { Users as UsersIcon, Ticket, Wallet, ShoppingCart, Loader2, RefreshCcw, TrendingUp, ArrowUpRight, ShieldCheck, Building2, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { UserRole, TicketStatus } from '../types';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ revenue: 0, sold: 0, stock: 0, users: 0, pendingAgencies: 0, balance: 0 });
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await db.auth.getUser();
      if (!user) return;

      const { data: profile } = await db.from('users').select('role, tenant_id, balance').eq('id', user.id).maybeSingle();
      if (!profile) return;

      setCurrentUserRole(profile.role as UserRole);
      const isAdminGlobal = profile.role === UserRole.ADMIN_GLOBAL;
      const isReseller = profile.role === UserRole.REVENDEUR;
      const tId = profile.tenant_id;
      
      // Promesses de base
      let stockQuery = db.from('tickets').select('*', { count: 'exact', head: true });
      let soldQuery = db.from('tickets').select('*', { count: 'exact', head: true });
      let revQuery = db.from('sales_history').select('amount_paid');
      let userQuery = db.from('users').select('*', { count: 'exact', head: true });
      let salesQuery = db.from('sales_history').select('*, tickets(username, ticket_profiles(name))').order('sold_at', { ascending: false }).limit(6);

      // --- FILTRES SELON LE RÔLE ---
      if (isAdminGlobal) {
        // Pas de filtre tenant_id pour l'admin global
      } else if (isReseller) {
        // REVENDEUR : Uniquement ses données
        stockQuery = stockQuery.eq('assigned_to', user.id).eq('status', TicketStatus.ASSIGNE); // Stock dispo pour lui = ASSIGNÉ
        soldQuery = soldQuery.eq('sold_by', user.id).eq('status', TicketStatus.VENDU);
        revQuery = revQuery.eq('seller_id', user.id);
        salesQuery = salesQuery.eq('seller_id', user.id);
        // Le userQuery ne sert pas au revendeur (remplacé par Balance)
      } else {
        // ADMIN AGENCE : Données de toute l'agence
        stockQuery = stockQuery.eq('tenant_id', tId).eq('status', TicketStatus.NEUF);
        soldQuery = soldQuery.eq('tenant_id', tId).eq('status', TicketStatus.VENDU);
        revQuery = revQuery.eq('tenant_id', tId);
        userQuery = userQuery.eq('tenant_id', tId);
        salesQuery = salesQuery.eq('tenant_id', tId);
      }

      const promises = [
        stockQuery,
        soldQuery,
        revQuery,
        userQuery, // index 3
        salesQuery,
      ];

      if (isAdminGlobal) {
        promises.push(db.from('tenants').select('*', { count: 'exact', head: true }).eq('subscription_status', 'EN_ATTENTE'));
      }

      const results = await Promise.all(promises);
      const stockRes = results[0];
      const soldRes = results[1];
      const revRes = results[2];
      const userRes = results[3];
      const salesRes = results[4];
      const pendingRes = isAdminGlobal ? results[5] : { count: 0 };

      setStats({
        revenue: (revRes.data || []).reduce((acc: number, curr: any) => acc + Number(curr.amount_paid), 0) || 0,
        sold: soldRes.count || 0,
        stock: stockRes.count || 0,
        users: userRes.count || 0,
        pendingAgencies: pendingRes.count || 0,
        balance: profile.balance || 0 // Utilisé pour le revendeur
      });
      setRecentSales(salesRes.data || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  if (loading) return <div className="h-[60vh] flex flex-col items-center justify-center"><Loader2 className="w-8 h-8 text-brand-600 animate-spin mb-4" /></div>;

  const isAdminGlobal = currentUserRole === UserRole.ADMIN_GLOBAL;
  const isReseller = currentUserRole === UserRole.REVENDEUR;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            {isAdminGlobal && <span className="bg-brand-50 text-brand-700 border border-brand-100 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 w-fit"><ShieldCheck className="w-3 h-3" /> Supervision</span>}
            {isReseller && <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 w-fit"><Wallet className="w-3 h-3" /> Espace Revendeur</span>}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {isAdminGlobal ? 'Vue d\'ensemble SaaS' : 'Tableau de Bord'}
          </h1>
          <p className="text-slate-500 text-sm">
            {isReseller ? 'Suivez vos ventes et votre stock personnel.' : 'Aperçu de votre activité commerciale en temps réel.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isAdminGlobal && (
            <button onClick={() => navigate('/sales')} className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2 shadow-sm transition-all active:scale-95"><ShoppingCart className="w-4 h-4" /> Nouvelle Vente</button>
          )}
          <button onClick={fetchDashboardData} className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-brand-600 hover:border-brand-200 transition-all shadow-sm"><RefreshCcw className="w-4 h-4" /></button>
        </div>
      </header>

      {/* KPI GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard label={isAdminGlobal ? "Revenu Global" : (isReseller ? "Vos Ventes (Total)" : "Chiffre d'Affaires")} value={`${stats.revenue.toLocaleString()}`} unit="GNF" icon={<Wallet />} color="text-brand-600" bg="bg-brand-50" />
        <StatCard label="Tickets Vendus" value={stats.sold} unit="Ventes" icon={<TrendingUp />} color="text-emerald-600" bg="bg-emerald-50" />
        {isAdminGlobal ? (
          <StatCard 
            label="Validations Requises" 
            value={stats.pendingAgencies} 
            unit="Agences" 
            icon={<Clock />} 
            color={stats.pendingAgencies > 0 ? "text-orange-600" : "text-slate-400"} 
            bg={stats.pendingAgencies > 0 ? "bg-orange-50" : "bg-slate-50"}
            onClick={() => stats.pendingAgencies > 0 && navigate('/agencies')}
            border={stats.pendingAgencies > 0}
          />
        ) : (
          <StatCard label={isReseller ? "Mon Stock (Assigné)" : "Stock Agence"} value={stats.stock} unit="Vouchers" icon={<Ticket />} color="text-indigo-600" bg="bg-indigo-50" />
        )}
        
        {/* Carte conditionnelle : Balance pour revendeur, Users pour Admin */}
        {isReseller ? (
             <StatCard label="Mon Solde (Prépayé)" value={stats.balance.toLocaleString()} unit="GNF" icon={<Wallet />} color={stats.balance < 50000 ? "text-red-600" : "text-emerald-600"} bg={stats.balance < 50000 ? "bg-red-50" : "bg-emerald-50"} border={stats.balance < 50000} />
        ) : (
             <StatCard label={isAdminGlobal ? "Utilisateurs Totaux" : "Utilisateurs"} value={stats.users} unit="Membres" icon={<UsersIcon />} color="text-slate-600" bg="bg-slate-100" />
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Recent Transactions Table */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 text-sm">{isReseller ? 'Vos transactions récentes' : 'Transactions récentes'}</h3>
            <button onClick={() => navigate('/history')} className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline">Voir tout</button>
          </div>
          <div className="divide-y divide-slate-50">
            {recentSales.length > 0 ? recentSales.map((sale, i) => (
              <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center font-mono text-slate-500 text-xs border border-slate-100">
                    <Ticket className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{sale.tickets?.username || 'Ticket Inconnu'}</p>
                    <p className="text-xs text-slate-500">{sale.tickets?.ticket_profiles?.name || 'Standard'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-900 text-sm">{Number(sale.amount_paid).toLocaleString()} GNF</p>
                  <p className="text-[10px] font-medium text-slate-400 uppercase">{new Date(sale.sold_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                </div>
              </div>
            )) : (
              <div className="p-12 text-center text-slate-400 text-sm">Aucune donnée disponible</div>
            )}
          </div>
        </div>

        {/* Quick Performance Card */}
        <div className="bg-slate-900 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500 rounded-full blur-[60px] opacity-20 -mr-10 -mt-10"></div>
          <div className="relative z-10">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-6">Performance Live</h3>
            <div className="space-y-4">
               <div className="bg-white/5 p-4 rounded-lg border border-white/10 flex items-center justify-between">
                 <div>
                   <p className="text-xs text-slate-400 mb-1">Taux d'écoulement</p>
                   <p className="text-xl font-bold">{stats.sold > 0 ? Math.round((stats.sold / (stats.sold + stats.stock)) * 100) : 0}%</p>
                 </div>
                 <div className="h-10 w-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center"><TrendingUp className="w-5 h-5" /></div>
               </div>
               <div className="bg-white/5 p-4 rounded-lg border border-white/10 flex items-center justify-between">
                 <div>
                   <p className="text-xs text-slate-400 mb-1">Stock Restant</p>
                   <p className="text-xl font-bold">{stats.stock}</p>
                 </div>
                 <div className="h-10 w-10 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center"><Ticket className="w-5 h-5" /></div>
               </div>
            </div>
            <button onClick={() => navigate('/history')} className="w-full mt-6 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-bold text-xs uppercase tracking-wide transition-colors flex items-center justify-center gap-2">
              Rapport Détaillé <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, unit, icon, color, bg, onClick, border }: any) => (
  <div 
    onClick={onClick} 
    className={`bg-white p-6 rounded-xl border ${border ? 'border-orange-200' : 'border-slate-200'} shadow-sm hover:shadow-md transition-all duration-200 ${onClick ? 'cursor-pointer' : ''}`}
  >
    <div className="flex items-start justify-between mb-4">
      <div className={`w-10 h-10 ${bg} ${color} rounded-lg flex items-center justify-center`}>
        {React.cloneElement(icon, { className: "w-5 h-5" })}
      </div>
      {onClick && <ArrowUpRight className="w-4 h-4 text-slate-300" />}
    </div>
    <div>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <h3 className="text-2xl font-bold text-slate-900 tracking-tight">{value}</h3>
        <span className="text-[10px] font-bold text-slate-400">{unit}</span>
      </div>
    </div>
  </div>
);

export default Dashboard;
