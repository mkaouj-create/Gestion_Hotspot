
import React, { useState, useEffect, useCallback } from 'react';
import { Banknote, Search, Calendar, Filter, ArrowUpRight, ArrowDownLeft, Loader2, Download, Printer, TrendingUp, Wallet, CheckCircle2, Building2, User } from 'lucide-react';
import { db } from '../services/db';
import { UserRole, LedgerEntry } from '../types';

const Accounting: React.FC = () => {
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalRevenue: 0, totalCollections: 0, balance: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'VENTE' | 'VERSEMENT'>('ALL');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currency, setCurrency] = useState('GNF');

  const fetchLedger = useCallback(async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      let query = db.from('accounting_ledger').select('*');

      if (currentUser.role === UserRole.REVENDEUR) {
        query = query.eq('user_id', currentUser.id);
      } else {
        query = query.eq('tenant_id', currentUser.tenant_id);
      }

      if (searchTerm) query = query.ilike('party_name', `%${searchTerm}%`);
      if (typeFilter !== 'ALL') query = query.eq('entry_type', typeFilter);
      if (dateStart) query = query.gte('entry_date', `${dateStart}T00:00:00`);
      if (dateEnd) query = query.lte('entry_date', `${dateEnd}T23:59:59`);

      const { data, error } = await query.order('entry_date', { ascending: false }).limit(500);
      if (error) throw error;

      const entries = data as LedgerEntry[];
      setLedger(entries);

      // Calcul des statistiques
      const revenue = entries.filter(e => e.type === 'VENTE').reduce((acc, curr) => acc + Number(curr.amount), 0);
      const collections = entries.filter(e => e.type === 'VERSEMENT' && e.status === 'APPROVED').reduce((acc, curr) => acc + Number(curr.amount), 0);
      
      setStats({
        totalRevenue: revenue,
        totalCollections: collections,
        balance: collections - revenue
      });

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentUser, searchTerm, typeFilter, dateStart, dateEnd]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await db.auth.getUser();
      if (user) {
        const { data } = await db.from('users').select('*, tenants(currency)').eq('id', user.id).single();
        setCurrentUser(data);
        setCurrency((data?.tenants as any)?.currency || 'GNF');
      }
    };
    init();
  }, []);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const isReseller = currentUser?.role === UserRole.REVENDEUR;

  return (
    <div className="space-y-8 pb-32 animate-in fade-in duration-500">
      {/* HEADER */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-8 md:p-10 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 rounded-full blur-[100px] opacity-10 -mr-20 -mt-20"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-emerald-600 mb-2">
            <Banknote className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-widest">Journal Comptable</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Comptabilité</h1>
          <p className="text-slate-400 font-medium mt-1">
            {isReseller ? "Suivez vos achats de stock et vos versements." : "Vue d'ensemble des flux financiers de l'agence."}
          </p>
        </div>
        <div className="flex items-center gap-3 relative z-10">
          <button onClick={() => window.print()} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-400 hover:text-slate-900 transition-all shadow-sm">
            <Printer className="w-5 h-5" />
          </button>
          <button className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 shadow-xl hover:bg-black transition-all active:scale-95">
            <Download className="w-4 h-4" /> EXPORTER CSV
          </button>
        </div>
      </header>

      {/* STATS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatTile 
          label={isReseller ? "Total Achats Stock" : "Chiffre d'Affaires"} 
          value={stats.totalRevenue} 
          currency={currency} 
          icon={<TrendingUp />} 
          color="text-indigo-600" 
          bg="bg-indigo-50" 
        />
        <StatTile 
          label={isReseller ? "Total Mes Versements" : "Total Recouvré"} 
          value={stats.totalCollections} 
          currency={currency} 
          icon={<CheckCircle2 />} 
          color="text-emerald-600" 
          bg="bg-emerald-50" 
        />
        <StatTile 
          label={isReseller ? "Mon Solde Net" : "Balance Agence"} 
          value={stats.balance} 
          currency={currency} 
          icon={<Wallet />} 
          color={stats.balance < 0 ? "text-red-600" : "text-slate-900"} 
          bg={stats.balance < 0 ? "bg-red-50" : "bg-slate-50"} 
        />
      </div>

      {/* FILTERS & LIST */}
      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden min-h-[500px]">
        <div className="p-6 md:p-8 space-y-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative group flex-1">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Rechercher par nom..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-14 pr-6 py-4 rounded-2xl bg-slate-50 border border-slate-50 outline-none font-bold text-slate-600 focus:bg-white focus:ring-4 focus:ring-emerald-50 transition-all text-sm" 
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setTypeFilter('ALL')} className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${typeFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400'}`}>Tous</button>
              <button onClick={() => setTypeFilter('VENTE')} className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${typeFilter === 'VENTE' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}>Ventes</button>
              <button onClick={() => setTypeFilter('VERSEMENT')} className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${typeFilter === 'VERSEMENT' ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-400'}`}>Versements</button>
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-4 pt-2">
            <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="bg-transparent text-[10px] font-black uppercase outline-none text-slate-600" />
            </div>
            <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="bg-transparent text-[10px] font-black uppercase outline-none text-slate-600" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-y border-slate-50">
                <th className="px-8 py-6">DATE</th>
                <th className="px-8 py-6">DESCRIPTION</th>
                <th className="px-8 py-6">PARTIE PRENANTE</th>
                <th className="px-8 py-6 text-right">MONTANT</th>
                <th className="px-8 py-6 text-center">TYPE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={5} className="p-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-emerald-200" /></td></tr>
              ) : ledger.length === 0 ? (
                <tr><td colSpan={5} className="p-20 text-center text-slate-300 font-bold uppercase text-xs">Aucune transaction trouvée</td></tr>
              ) : ledger.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-6">
                    <p className="font-black text-slate-900 text-sm">{new Date(entry.entry_date).toLocaleDateString('fr-FR')}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{new Date(entry.entry_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                  </td>
                  <td className="px-8 py-6">
                    <p className="text-sm font-black text-slate-700">{entry.description}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Réf: {entry.reference || entry.id.split('-')[0]}</p>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-black text-[10px]">
                        {entry.party_name?.charAt(0)}
                      </div>
                      <span className="text-sm font-bold text-slate-600">{entry.party_name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <p className={`text-lg font-black ${entry.type === 'VENTE' ? 'text-indigo-600' : 'text-emerald-600'}`}>
                      {entry.type === 'VENTE' ? '-' : '+'}{Number(entry.amount).toLocaleString()}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">{currency}</p>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${entry.type === 'VENTE' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                      {entry.type === 'VENTE' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                      {entry.type}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const StatTile = ({ label, value, currency, icon, color, bg }: any) => (
  <div className={`bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 group`}>
    <div className="flex items-start justify-between mb-6">
      <div className={`w-12 h-12 ${bg} ${color} rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform`}>
        {React.cloneElement(icon, { className: "w-6 h-6" })}
      </div>
    </div>
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">{label}</p>
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <h3 className={`text-3xl font-black tracking-tight ${color}`}>{value.toLocaleString()}</h3>
        <span className="text-[10px] font-bold text-slate-400 uppercase">{currency}</span>
      </div>
    </div>
  </div>
);

export default Accounting;
