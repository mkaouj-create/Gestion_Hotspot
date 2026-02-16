
import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../services/db';
import { History as HistoryIcon, Search, Loader2, Info, X, QrCode, Share2, RefreshCcw, RotateCcw, AlertTriangle, CheckCircle2, Building2, Calendar, AlertCircle, Printer, Filter, User, Tag, CalendarRange, Wallet, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { UserRole, Sale } from '../types';

const History: React.FC = () => {
  const [historyType, setHistoryType] = useState<'SALES' | 'PAYMENTS'>('SALES');
  
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtres de base
  const [searchTerm, setSearchTerm] = useState('');
  const [agencyFilter, setAgencyFilter] = useState<string>('ALL');
  
  // Filtres Avancés
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [sellerFilter, setSellerFilter] = useState('ALL');
  const [profileFilter, setProfileFilter] = useState('ALL');
  const [showFilters, setShowFilters] = useState(false);

  // Listes pour les dropdowns
  const [agencies, setAgencies] = useState<any[]>([]);
  const [sellersList, setSellersList] = useState<any[]>([]);
  const [profilesList, setProfilesList] = useState<any[]>([]);

  const [stats, setStats] = useState({ totalCount: 0, totalRevenue: 0 });
  const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string, role: UserRole, tenant_id?: string, tenantName?: string } | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currency, setCurrency] = useState('GNF');

  const notify = useCallback((type: 'success' | 'error', message: string) => { setToast({ type, message }); setTimeout(() => setToast(null), 4000); }, []);
  
  useEffect(() => { fetchInitialContext(); }, []);
  
  // Rechargement des données quand un filtre change
  useEffect(() => { 
      if (currentUser) {
          if (historyType === 'SALES') fetchSalesHistory();
          else fetchPaymentsHistory();
      }
  }, [agencyFilter, searchTerm, currentUser, dateStart, dateEnd, sellerFilter, profileFilter, historyType]);

  // Rechargement des listes déroulantes (Vendeurs/Forfaits) quand l'agence change (pour Global Admin)
  useEffect(() => {
      if (currentUser) fetchFilterOptions();
  }, [currentUser, agencyFilter]);

  const fetchInitialContext = async () => {
    try {
      const { data: { user } } = await db.auth.getUser();
      if (!user) return;
      const { data: userData } = await db.from('users').select('role, tenant_id, tenants(name, currency)').eq('id', user.id).single();
      const currentRole = userData?.role as UserRole;
      const tenantName = (userData?.tenants as any)?.name;
      const tenantCurrency = (userData?.tenants as any)?.currency || 'GNF';
      
      setCurrentUser({ id: user.id, role: currentRole, tenant_id: userData?.tenant_id, tenantName });
      setCurrency(tenantCurrency);
      
      if (currentRole === UserRole.ADMIN_GLOBAL) { 
          const { data: tData } = await db.from('tenants').select('id, name').order('name'); 
          setAgencies(tData || []); 
      }
    } catch (err) { console.error(err); }
  };

  const fetchFilterOptions = async () => {
      if (!currentUser) return;
      try {
          let targetTenantId = currentUser.tenant_id;
          if (currentUser.role === UserRole.ADMIN_GLOBAL) {
              if (agencyFilter !== 'ALL') targetTenantId = agencyFilter;
              else targetTenantId = undefined;
          }

          if (currentUser.role !== UserRole.REVENDEUR) {
              let userQuery = db.from('users').select('id, full_name').neq('role', 'CLIENT');
              if (targetTenantId) userQuery = userQuery.eq('tenant_id', targetTenantId);
              const { data: usersData } = await userQuery.order('full_name');
              setSellersList(usersData || []);
          }

          let profileQuery = db.from('ticket_profiles').select('id, name');
          if (targetTenantId) profileQuery = profileQuery.eq('tenant_id', targetTenantId);
          const { data: profilesData } = await profileQuery.order('name');
          setProfilesList(profilesData || []);

      } catch (err) { console.error("Erreur chargement filtres", err); }
  };

  const fetchSalesHistory = async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      
      let query = db.from('sales_history')
        .select(`
            id, amount_paid, sold_at, metadata, ticket_id, tenant_id, seller_id, 
            tenants(name), 
            tickets!inner(id, username, password, status, profile_id, ticket_profiles(name)), 
            users(full_name)
        `);

      if (currentUser.role === UserRole.REVENDEUR) {
          query = query.eq('seller_id', currentUser.id);
      } else if (currentUser.role === UserRole.ADMIN_GLOBAL) { 
          if (agencyFilter !== 'ALL') query = query.eq('tenant_id', agencyFilter); 
      } else { 
          query = query.eq('tenant_id', currentUser.tenant_id); 
      }

      if (searchTerm) query = query.ilike('tickets.username', `%${searchTerm}%`);
      if (dateStart) query = query.gte('sold_at', `${dateStart}T00:00:00`);
      if (dateEnd) query = query.lte('sold_at', `${dateEnd}T23:59:59`);
      if (sellerFilter !== 'ALL') query = query.eq('seller_id', sellerFilter);
      if (profileFilter !== 'ALL') query = query.eq('tickets.profile_id', profileFilter);

      const { data, error } = await query.order('sold_at', { ascending: false }).limit(500);
      
      if (error) throw error;
      const results = (data as unknown as Sale[]) || [];
      setSales(results);
      
      setStats({ 
          totalCount: results.length, 
          totalRevenue: results.reduce((acc, curr) => acc + Number(curr.amount_paid), 0) 
      });

    } catch (err: any) { 
        console.error("Sales fetch error:", err); 
        notify('error', "Erreur chargement historique ventes");
    } finally { 
        setLoading(false); 
    }
  };

  const fetchPaymentsHistory = async () => {
      if (!currentUser) return;
      try {
          setLoading(true);
          let query = db.from('payments')
            .select(`
                id, amount, created_at, payment_method, phone_number, status, tenant_id, reseller_id,
                tenants(name),
                users!payments_reseller_id_fkey(full_name)
            `);

          if (currentUser.role === UserRole.REVENDEUR) {
              query = query.eq('reseller_id', currentUser.id);
          } else if (currentUser.role === UserRole.ADMIN_GLOBAL) {
              if (agencyFilter !== 'ALL') query = query.eq('tenant_id', agencyFilter);
          } else {
              query = query.eq('tenant_id', currentUser.tenant_id);
          }

          // Filtre texte sur la référence ou le nom du revendeur
          if (searchTerm) {
              // Note: Supabase ne permet pas facilement le OR sur des tables jointes avec la syntaxe simple
              // On filtre ici principalement sur la référence
              query = query.ilike('phone_number', `%${searchTerm}%`);
          }

          if (dateStart) query = query.gte('created_at', `${dateStart}T00:00:00`);
          if (dateEnd) query = query.lte('created_at', `${dateEnd}T23:59:59`);
          if (sellerFilter !== 'ALL') query = query.eq('reseller_id', sellerFilter);

          const { data, error } = await query.order('created_at', { ascending: false }).limit(500);

          if (error) throw error;
          const results = data || [];
          setPayments(results);

          // Stats pour les paiements (uniquement les approuvés)
          const approvedPayments = results.filter(p => p.status === 'APPROVED');
          setStats({
              totalCount: approvedPayments.length,
              totalRevenue: approvedPayments.reduce((acc, curr) => acc + Number(curr.amount), 0)
          });

      } catch (err: any) {
          console.error("Payments fetch error:", err);
          notify('error', "Erreur chargement historique paiements");
      } finally {
          setLoading(false);
      }
  };

  const resetFilters = () => {
      setSearchTerm('');
      setDateStart('');
      setDateEnd('');
      setSellerFilter('ALL');
      setProfileFilter('ALL');
      if (currentUser?.role === UserRole.ADMIN_GLOBAL) setAgencyFilter('ALL');
  };

  const handlePrint = () => { window.print(); };
  const initiateCancellation = (sale: Sale) => { if (!currentUser) return; const canCancel = currentUser.role === UserRole.ADMIN_GLOBAL || currentUser.role === UserRole.GESTIONNAIRE_WIFI_ZONE || (currentUser.role === UserRole.REVENDEUR && sale.seller_id === currentUser.id); if (!canCancel) { notify('error', "Accès refusé."); return; } setSaleToCancel(sale); };
  const confirmCancellation = async () => { if (!saleToCancel) return; setIsProcessing(true); const targetTicketId = saleToCancel.ticket_id || saleToCancel.tickets?.id; try { const { data: sellerProfile } = await db.from('users').select('role, balance').eq('id', saleToCancel.seller_id).single(); if (sellerProfile?.role === UserRole.REVENDEUR) await db.from('users').update({ balance: Number(sellerProfile.balance || 0) + Number(saleToCancel.amount_paid) }).eq('id', saleToCancel.seller_id); await db.from('tickets').update({ status: 'NEUF', sold_at: null, sold_by: null, assigned_to: null }).eq('id', targetTicketId); await db.from('sales_history').delete().eq('id', saleToCancel.id); notify('success', "Vente annulée."); setSaleToCancel(null); setSelectedSale(null); await fetchSalesHistory(); } catch (err: any) { notify('error', "Échec : " + err.message); } finally { setIsProcessing(false); } };
  const handleWhatsAppShare = () => { if (!selectedSale) return; window.open(`https://wa.me/?text=${encodeURIComponent(`*TICKET WIFI*\n\n🎟️ CODE : *${selectedSale.tickets?.username}*\n📦 FORFAIT : ${selectedSale.tickets?.ticket_profiles?.name}\n💰 PRIX : ${Number(selectedSale.amount_paid).toLocaleString()} ${currency}\n\nMerci !`)}`, '_blank'); };

  return (
    <div className="space-y-6 font-sans pb-24 animate-in fade-in duration-500 relative">
      {toast && (<div className={`fixed top-6 right-6 z-[100] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right border ${toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-red-600 text-white border-red-500'}`}>{toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}<p className="font-bold text-sm tracking-tight">{toast.message}</p></div>)}
      
      {/* HEADER & STATS */}
      <div className="bg-white p-6 md:p-10 rounded-[2.5rem] md:rounded-[3rem] border border-slate-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-8 relative overflow-hidden">
          {currentUser?.role === UserRole.ADMIN_GLOBAL && (<div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-[80px] -mr-20 -mt-20"></div>)}
          <div className="flex items-center gap-5 relative z-10">
              <div className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center shadow-2xl ${historyType === 'SALES' ? 'bg-slate-900 text-white' : 'bg-emerald-600 text-white'}`}>
                  {historyType === 'SALES' ? <HistoryIcon className="w-7 h-7 md:w-8 md:h-8" /> : <Wallet className="w-7 h-7 md:w-8 md:h-8" />}
              </div>
              <div>
                  <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-md ${currentUser?.role === UserRole.ADMIN_GLOBAL ? 'bg-brand-50 text-brand-600' : 'bg-slate-50 text-slate-400'}`}>
                          {currentUser?.role === UserRole.ADMIN_GLOBAL ? 'Supervision SaaS' : (currentUser?.role === UserRole.REVENDEUR ? 'Mon Activité' : 'Journal Agence')}
                      </span>
                  </div>
                  <h1 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight leading-none">
                      {historyType === 'SALES' ? 'Journal des Ventes' : 'Flux de Trésorerie'}
                  </h1>
              </div>
          </div>
          <div className="flex items-center gap-4 relative z-10 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
              <div className="bg-slate-50 border border-slate-100 p-4 md:p-5 px-6 md:px-8 rounded-[2rem] flex-1 md:flex-none min-w-[140px]">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{historyType === 'SALES' ? 'TICKETS' : 'TRANSACTIONS'}</p>
                  <p className="text-xl md:text-2xl font-black text-slate-900">{stats.totalCount}</p>
              </div>
              <div className={`p-4 md:p-5 px-6 md:px-8 rounded-[2rem] border flex-1 md:flex-none min-w-[180px] ${historyType === 'SALES' ? 'bg-slate-100 border-slate-200' : 'bg-emerald-50 border-emerald-100'}`}>
                  <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${historyType === 'SALES' ? 'text-slate-600' : 'text-emerald-600'}`}>{historyType === 'SALES' ? 'TOTAL VENDU' : 'TOTAL ENCAISSÉ'}</p>
                  <p className={`text-xl md:text-2xl font-black ${historyType === 'SALES' ? 'text-slate-700' : 'text-emerald-700'}`}>{stats.totalRevenue.toLocaleString()} <span className="text-[10px] ml-1">{currency}</span></p>
              </div>
          </div>
      </div>

      {/* TABS & FILTERS */}
      <div className="flex flex-col gap-4">
          
          {/* Main Toggle */}
          <div className="bg-white p-1.5 rounded-[2rem] border border-slate-100 shadow-sm flex w-full md:w-fit self-center md:self-start">
              <button 
                  onClick={() => setHistoryType('SALES')} 
                  className={`flex-1 md:flex-none px-8 py-3 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${historyType === 'SALES' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
              >
                  <ArrowUpRight className="w-4 h-4" /> Ventes Tickets
              </button>
              <button 
                  onClick={() => setHistoryType('PAYMENTS')} 
                  className={`flex-1 md:flex-none px-8 py-3 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${historyType === 'PAYMENTS' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
              >
                  <ArrowDownLeft className="w-4 h-4" /> Versements
              </button>
          </div>

          {/* FILTER BAR */}
          <div className="bg-white p-2 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col gap-2">
              <div className="flex flex-col md:flex-row gap-2">
                  <div className="relative group flex-1">
                      <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-brand-600 transition-colors" />
                      <input 
                          type="text" 
                          placeholder={historyType === 'SALES' ? "Rechercher code ticket..." : "Rechercher réf. paiement..."} 
                          value={searchTerm} 
                          onChange={(e) => setSearchTerm(e.target.value)} 
                          className="w-full pl-14 pr-6 py-4 rounded-[2rem] bg-white hover:bg-slate-50 focus:bg-white outline-none font-bold text-slate-600 transition-all text-sm" 
                      />
                  </div>
                  
                  {currentUser?.role === UserRole.ADMIN_GLOBAL && (
                      <div className="relative md:w-64">
                          <Building2 className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                          <select value={agencyFilter} onChange={(e) => setAgencyFilter(e.target.value)} className="w-full pl-12 pr-10 py-4 rounded-[2rem] bg-slate-50 border-none font-bold text-slate-600 appearance-none outline-none focus:ring-2 focus:ring-brand-100 transition-all cursor-pointer text-sm"><option value="ALL">Toutes les Agences</option>{agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
                      </div>
                  )}

                  <button onClick={() => setShowFilters(!showFilters)} className={`p-4 rounded-[2rem] border transition-all flex items-center gap-2 font-bold text-xs uppercase tracking-wider ${showFilters ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-300'}`}>
                      <Filter className="w-4 h-4" /> <span className="hidden md:inline">Filtres</span>
                  </button>
                  
                  {(dateStart || dateEnd || sellerFilter !== 'ALL' || profileFilter !== 'ALL' || searchTerm) && (
                      <button onClick={resetFilters} className="p-4 rounded-[2rem] bg-red-50 text-red-500 hover:bg-red-100 transition-all" title="Réinitialiser">
                          <X className="w-4 h-4" />
                      </button>
                  )}
              </div>

              {/* Collapsible Advanced Filters */}
              {showFilters && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2 p-2 animate-in slide-in-from-top-2 fade-in">
                      <div className="relative">
                          <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                          <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="w-full pl-12 pr-4 py-3 rounded-2xl bg-slate-50 text-slate-600 font-bold text-xs uppercase outline-none focus:ring-2 focus:ring-brand-100 transition-all cursor-pointer" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-300">DEBUT</span>
                      </div>
                      <div className="relative">
                          <CalendarRange className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                          <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="w-full pl-12 pr-4 py-3 rounded-2xl bg-slate-50 text-slate-600 font-bold text-xs uppercase outline-none focus:ring-2 focus:ring-brand-100 transition-all cursor-pointer" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-300">FIN</span>
                      </div>
                      {currentUser?.role !== UserRole.REVENDEUR && (
                          <div className="relative">
                              <User className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                              <select value={sellerFilter} onChange={(e) => setSellerFilter(e.target.value)} className="w-full pl-12 pr-4 py-3 rounded-2xl bg-slate-50 text-slate-600 font-bold text-xs uppercase appearance-none outline-none focus:ring-2 focus:ring-brand-100 transition-all cursor-pointer">
                                  <option value="ALL">Tous les {historyType === 'SALES' ? 'vendeurs' : 'revendeurs'}</option>
                                  {sellersList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                              </select>
                          </div>
                      )}
                      {historyType === 'SALES' && (
                          <div className="relative">
                              <Tag className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                              <select value={profileFilter} onChange={(e) => setProfileFilter(e.target.value)} className="w-full pl-12 pr-4 py-3 rounded-2xl bg-slate-50 text-slate-600 font-bold text-xs uppercase appearance-none outline-none focus:ring-2 focus:ring-brand-100 transition-all cursor-pointer">
                                  <option value="ALL">Tous les forfaits</option>
                                  {profilesList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
                          </div>
                      )}
                  </div>
              )}
          </div>
      </div>

      <div className="bg-white rounded-[2rem] md:rounded-[3.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[500px]">
          {loading ? (
              <div className="flex flex-col items-center justify-center h-[500px] gap-4">
                  <Loader2 className="w-12 h-12 text-brand-600 animate-spin opacity-40" />
                  <p className="text-xs font-black text-slate-300 uppercase tracking-widest">Recherche en cours...</p>
              </div>
          ) : (historyType === 'SALES' ? sales.length === 0 : payments.length === 0) ? (
              <div className="flex flex-col items-center justify-center h-[500px] text-slate-300 gap-4">
                  <HistoryIcon className="w-16 h-16 opacity-10" />
                  <p className="font-bold uppercase text-[10px] tracking-[0.2em]">Aucun résultat pour ces critères</p>
                  <button onClick={resetFilters} className="text-xs text-brand-600 hover:underline">Réinitialiser les filtres</button>
              </div>
          ) : (
              <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[900px]">
                      <thead>
                          <tr className="border-b border-slate-50 bg-slate-50/30 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              <th className="px-6 md:px-10 py-6">DATE</th>
                              {(currentUser?.role === UserRole.ADMIN_GLOBAL || agencyFilter === 'ALL') && <th className="px-6 md:px-10 py-6">AGENCE</th>}
                              <th className="px-6 md:px-10 py-6">{historyType === 'SALES' ? (currentUser?.role === UserRole.REVENDEUR ? 'CLIENT' : 'OPÉRATEUR') : 'REVENDEUR'}</th>
                              <th className="px-6 md:px-10 py-6">{historyType === 'SALES' ? 'CODE TICKET' : 'MÉTHODE / RÉF'}</th>
                              <th className="px-6 md:px-10 py-6 text-right">MONTANT</th>
                              <th className="px-6 md:px-10 py-6 text-center">{historyType === 'SALES' ? '' : 'STATUT'}</th>
                              {historyType === 'SALES' && <th className="px-6 md:px-10 py-6"></th>}
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                          {historyType === 'SALES' ? (
                              sales.map((sale) => (
                                  <tr key={sale.id} onClick={() => setSelectedSale(sale)} className="hover:bg-brand-50/30 transition-all group cursor-pointer">
                                      <td className="px-6 md:px-10 py-6 md:py-8">
                                          <div className="flex items-center gap-3">
                                              <Calendar className="w-4 h-4 text-slate-200" />
                                              <div>
                                                  <p className="text-xs font-black text-slate-900">{new Date(sale.sold_at).toLocaleDateString('fr-FR')}</p>
                                                  <p className="text-[10px] font-bold text-slate-400">{new Date(sale.sold_at).toLocaleTimeString('fr-FR')}</p>
                                              </div>
                                          </div>
                                      </td>
                                      {(currentUser?.role === UserRole.ADMIN_GLOBAL || agencyFilter === 'ALL') && (
                                          <td className="px-6 md:px-10 py-6 md:py-8">
                                              <span className="text-[10px] font-black text-brand-500 uppercase bg-brand-50 px-3 py-1.5 rounded-xl border border-brand-100">{sale.tenants?.name}</span>
                                          </td>
                                      )}
                                      <td className="px-6 md:px-10 py-6 md:py-8">
                                          {currentUser?.role === UserRole.REVENDEUR ? (
                                              <>
                                                  <p className="text-xs font-black text-slate-800">{sale.metadata?.customer_phone || 'Anonyme'}</p>
                                                  <p className="text-[9px] font-bold text-slate-400 uppercase">Info Client</p>
                                              </>
                                          ) : (
                                              <>
                                                  <p className="text-xs font-black text-slate-800">{sale.users?.full_name || 'Inconnu'}</p>
                                                  <p className="text-[9px] font-bold text-slate-400 uppercase">Vendeur</p>
                                              </>
                                          )}
                                      </td>
                                      <td className="px-6 md:px-10 py-6 md:py-8">
                                          <p className="font-black text-slate-900 text-lg tracking-tighter leading-none mb-1 group-hover:text-brand-600 transition-colors">{sale.tickets?.username}</p>
                                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{sale.tickets?.ticket_profiles?.name}</p>
                                      </td>
                                      <td className="px-6 md:px-10 py-6 md:py-8 text-right">
                                          <p className="font-black text-slate-900 text-lg">{Number(sale.amount_paid).toLocaleString()} {currency}</p>
                                          <p className="text-[9px] font-bold text-emerald-600 uppercase">Encaissé</p>
                                      </td>
                                      <td className="px-6 md:px-10 py-6 md:py-8 text-center">
                                          {/* Placeholder for status if needed */}
                                      </td>
                                      <td className="px-6 md:px-10 py-6 md:py-8 text-right">
                                          <div className="flex items-center justify-end gap-2">
                                              <div className="p-3 bg-white text-slate-200 rounded-2xl group-hover:bg-brand-600 group-hover:text-white transition-all shadow-sm border border-slate-100 group-hover:border-brand-600">
                                                  <Info className="w-4 h-4" />
                                              </div>
                                          </div>
                                      </td>
                                  </tr>
                              ))
                          ) : (
                              payments.map((payment) => (
                                  <tr key={payment.id} className="hover:bg-emerald-50/30 transition-all group">
                                      <td className="px-6 md:px-10 py-6 md:py-8">
                                          <div className="flex items-center gap-3">
                                              <Calendar className="w-4 h-4 text-slate-200" />
                                              <div>
                                                  <p className="text-xs font-black text-slate-900">{new Date(payment.created_at).toLocaleDateString('fr-FR')}</p>
                                                  <p className="text-[10px] font-bold text-slate-400">{new Date(payment.created_at).toLocaleTimeString('fr-FR')}</p>
                                              </div>
                                          </div>
                                      </td>
                                      {(currentUser?.role === UserRole.ADMIN_GLOBAL || agencyFilter === 'ALL') && (
                                          <td className="px-6 md:px-10 py-6 md:py-8">
                                              <span className="text-[10px] font-black text-emerald-500 uppercase bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">{payment.tenants?.name}</span>
                                          </td>
                                      )}
                                      <td className="px-6 md:px-10 py-6 md:py-8">
                                          <p className="text-xs font-black text-slate-800">{payment.users?.full_name || 'Inconnu'}</p>
                                      </td>
                                      <td className="px-6 md:px-10 py-6 md:py-8">
                                          <p className="font-black text-slate-900 text-sm tracking-tight mb-1">{payment.payment_method}</p>
                                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[150px]">{payment.phone_number || 'Aucune réf.'}</p>
                                      </td>
                                      <td className="px-6 md:px-10 py-6 md:py-8 text-right">
                                          <p className="font-black text-slate-900 text-lg">{Number(payment.amount).toLocaleString()} {currency}</p>
                                          <p className="text-[9px] font-bold text-slate-400 uppercase">Dépôt</p>
                                      </td>
                                      <td className="px-6 md:px-10 py-6 md:py-8 text-center">
                                          <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${payment.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' : payment.status === 'REJECTED' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-500'}`}>
                                              {payment.status === 'APPROVED' ? 'VALIDÉ' : payment.status === 'REJECTED' ? 'REJETÉ' : 'EN ATTENTE'}
                                          </span>
                                      </td>
                                  </tr>
                              ))
                          )}
                      </tbody>
                  </table>
              </div>
          )}
      </div>

      {selectedSale && !saleToCancel && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4 animate-in fade-in duration-300">
              <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={() => setSelectedSale(null)} />
              <div className="bg-white w-full max-w-[440px] rounded-[3.5rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
                  <div className="bg-slate-900 p-8 md:p-12 text-center text-white relative">
                      <button onClick={() => setSelectedSale(null)} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors p-2"><X className="w-6 h-6" /></button>
                      <div className="w-20 h-20 bg-brand-500/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 border border-brand-500/20"><QrCode className="w-10 h-10 text-brand-400" /></div>
                      <h2 className="text-xl font-black tracking-widest uppercase">Fiche Transaction</h2>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">Référence ID: {selectedSale.id.split('-')[0]}</p>
                  </div>
                  <div className="p-8 md:p-10 space-y-6 md:space-y-8">
                      <div className="bg-slate-50 rounded-[2.5rem] p-8 md:p-10 text-center border-2 border-dashed border-slate-200 relative">
                          <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-1 h-1.5 w-16 bg-brand-500 rounded-full"></div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">CODE VOUCHER</p>
                          <p className="text-4xl md:text-5xl font-black text-slate-900 tracking-[0.2em] mb-8 leading-none break-all">{selectedSale.tickets?.username}</p>
                          <div className="grid grid-cols-2 gap-4 text-left border-t border-slate-100 pt-8">
                              <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Agence Source</p><p className="text-xs font-black text-slate-800">{selectedSale.tenants?.name}</p></div>
                              <div className="text-right"><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Offre</p><p className="text-xs font-black text-brand-600">{selectedSale.tickets?.ticket_profiles?.name}</p></div>
                          </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <button onClick={handleWhatsAppShare} className="py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl transition-all transform active:scale-95"><Share2 className="w-4 h-4" /> WHATSAPP</button>
                          <button onClick={handlePrint} className="py-5 bg-slate-900 hover:bg-black text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl transition-all transform active:scale-95"><Printer className="w-4 h-4" /> IMPRIMER</button>
                          <button onClick={() => initiateCancellation(selectedSale)} className="col-span-2 py-5 bg-white border border-red-100 text-red-500 hover:bg-red-50 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all"><RotateCcw className="w-4 h-4" /> RÉVOQUER / ANNULER</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {saleToCancel && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in"><div className="absolute inset-0 bg-red-950/80 backdrop-blur-md" onClick={() => !isProcessing && setSaleToCancel(null)} /><div className="bg-white w-full max-w-sm rounded-[3rem] p-10 text-center relative z-10 animate-in zoom-in-95 border-t-8 border-red-600 shadow-2xl"><div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner"><AlertTriangle className="w-10 h-10" /></div><h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Annuler la Vente ?</h3><p className="text-slate-500 text-sm mb-10 leading-relaxed font-medium">Le ticket <strong>{saleToCancel.tickets?.username}</strong> redeviendra disponible en stock. {saleToCancel.users?.full_name && ` Le solde du revendeur sera recrédité.`}</p><div className="space-y-3"><button onClick={confirmCancellation} disabled={isProcessing} className="w-full py-5 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-all transform active:scale-95">{isProcessing ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "OUI, ANNULER LA VENTE"}</button><button onClick={() => setSaleToCancel(null)} disabled={isProcessing} className="w-full py-5 bg-slate-100 text-slate-400 hover:text-slate-600 rounded-2xl font-black text-xs uppercase transition-colors">IGNORER</button></div></div></div>)}
    </div>
  );
};
export default History;
