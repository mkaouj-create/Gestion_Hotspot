import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LogOut, Zap, Search, Wifi, Clock, CheckCircle2, X, AlertCircle, TrendingUp, Ticket, History, ChevronRight, Printer, Phone, QrCode } from 'lucide-react';
import { createGuichetClient } from '../services/db';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, startOfDay, endOfDay, eachHourOfInterval, isWithinInterval, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function GuichetSales() {
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenant_id');
  const navigate = useNavigate();

  const [profiles, setProfiles] = useState<any[]>([]);
  const [dailyStats, setDailyStats] = useState({ count: 0, revenue: 0 });
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const [selling, setSelling] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSoldTicket, setLastSoldTicket] = useState<any>(null);
  const [guichetInfo, setGuichetInfo] = useState<{tenant_id: string, guichet_id: string, name: string, allowed_profiles?: string[], reseller_id?: string} | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Initialize custom client
  const token = localStorage.getItem('guichet_token');
  const storedTenant = localStorage.getItem('guichet_tenant');

  useEffect(() => {
    const init = async () => {
      // Fallback to localStorage if tenantId is missing from URL
      const effectiveTenantId = tenantId || storedTenant;
      
      if (!token || !effectiveTenantId || (tenantId && storedTenant && storedTenant !== tenantId)) {
        console.log('Redirecting to login: missing or mismatched session');
        navigate(`/guichet?tenant_id=${effectiveTenantId || ''}`);
        return;
      }

      try {
        setPageLoading(true);
        const guichetDb = createGuichetClient(token);
        const { data, error: infoError } = await guichetDb.rpc('get_guichet_info', { p_token: token });
        
        if (infoError) throw infoError;
        
        if (data && data.length > 0) {
          const info = data[0];
          setGuichetInfo(info);
          
          // Parallel fetch for better performance
          await Promise.all([
            fetchDailyStats(info.guichet_id, effectiveTenantId),
            fetchRecentSales(info.guichet_id, effectiveTenantId),
            fetchProfiles(info.allowed_profiles, effectiveTenantId)
          ]);
        } else {
          // No guichet info found, session might be invalid
          localStorage.removeItem('guichet_token');
          localStorage.removeItem('guichet_tenant');
          navigate(`/guichet?tenant_id=${effectiveTenantId}`);
        }
      } catch (err: any) {
        console.error('Error initializing guichet:', err);
        setError(`Erreur de connexion: ${err.message || 'Session expirée'}`);
        // If it's a 401/403 or token error, redirect
        if (err.message?.includes('token') || err.code === 'PGRST301') {
          handleLogout();
        }
      } finally {
        setPageLoading(false);
      }
    };

    init();
  }, [tenantId, token, navigate, storedTenant]);

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    if (!guichetInfo || pageLoading) return;

    const interval = setInterval(() => {
      const effectiveTenantId = tenantId || storedTenant;
      if (effectiveTenantId) {
        fetchDailyStats(guichetInfo.guichet_id, effectiveTenantId);
        fetchRecentSales(guichetInfo.guichet_id, effectiveTenantId);
        fetchProfiles(guichetInfo.allowed_profiles, effectiveTenantId);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [guichetInfo, pageLoading, tenantId, storedTenant]);

  const fetchDailyStats = async (guichetId?: string, tId?: string) => {
    const activeTenantId = tId || tenantId || storedTenant;
    if (!activeTenantId || !token) return;

    try {
      const guichetDb = createGuichetClient(token);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let query = guichetDb
        .from('sales_history')
        .select('amount_paid, metadata')
        .eq('tenant_id', activeTenantId)
        .gte('sold_at', today.toISOString())
        .contains('metadata', { source: 'guichet' });

      const { data, error } = await query;

      if (error) throw error;

      // Filter by guichet_id if available
      const filteredData = guichetId 
        ? data?.filter(sale => sale.metadata?.guichet_id === guichetId)
        : data;

      const count = filteredData?.length || 0;
      const revenue = filteredData?.reduce((sum, sale) => sum + (sale.amount_paid || 0), 0) || 0;

      setDailyStats({ count, revenue });
    } catch (err) {
      console.error('Error fetching daily stats:', err);
    }
  };

  const fetchRecentSales = async (guichetId?: string, tId?: string) => {
    const activeTenantId = tId || tenantId || storedTenant;
    if (!activeTenantId || !token) return;

    try {
      const guichetDb = createGuichetClient(token);
      let query = guichetDb
        .from('sales_history')
        .select(`
          id, amount_paid, sold_at,
          tickets (
            username,
            ticket_profiles (name)
          )
        `)
        .eq('tenant_id', activeTenantId)
        .contains('metadata', { source: 'guichet' });

      if (guichetId) {
        query = query.contains('metadata', { guichet_id: guichetId });
      }

      query = query.order('sold_at', { ascending: false }).limit(20);

      const { data, error } = await query;
      if (error) throw error;
      setRecentSales(data || []);

      // Prepare hourly data for chart
      const today = startOfDay(new Date());
      const hours = eachHourOfInterval({
        start: today,
        end: endOfDay(today)
      });

      const hourlyStats = hours.map(hour => {
        const hourStr = format(hour, 'HH:mm');
        const hourSales = data?.filter(sale => {
          const soldAt = parseISO(sale.sold_at);
          return isWithinInterval(soldAt, {
            start: hour,
            end: new Date(hour.getTime() + 60 * 60 * 1000 - 1)
          });
        }) || [];

        return {
          time: hourStr,
          revenue: hourSales.reduce((sum, s) => sum + (s.amount_paid || 0), 0),
          count: hourSales.length
        };
      });

      setHourlyData(hourlyStats);
    } catch (err) {
      console.error('Error fetching recent sales:', err);
    }
  };

  const fetchProfiles = async (allowedProfiles?: string[], tId?: string) => {
    const activeTenantId = tId || tenantId || storedTenant;
    if (!activeTenantId || !token) return;

    try {
      setLoading(true);
      const guichetDb = createGuichetClient(token);

      let query = guichetDb
        .from('ticket_profiles')
        .select(`
          id, name, price,
          tickets!inner(count)
        `)
        .eq('tenant_id', activeTenantId)
        .in('tickets.status', ['NEUF', 'ASSIGNE'])
        .order('price', { ascending: true });

      // Apply filter if allowedProfiles is set and not empty
      if (allowedProfiles && allowedProfiles.length > 0) {
        query = query.in('id', allowedProfiles);
      }

      const { data: profilesData, error: profilesError } = await query;

      if (profilesError) throw profilesError;

      const formattedProfiles = profilesData?.map(p => {
        let count = 0;
        if (Array.isArray(p.tickets)) {
          count = p.tickets[0]?.count || 0;
        } else if (p.tickets && typeof p.tickets === 'object') {
          count = (p.tickets as any).count || 0;
        }
        return {
          ...p,
          available_count: count
        };
      }).filter(p => p.available_count > 0) || [];

      setProfiles(formattedProfiles);
    } catch (err: any) {
      console.error('Error fetching profiles:', err);
      setError(`Erreur lors du chargement des profils: ${err.message || JSON.stringify(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSellClick = (profile: any) => {
    setSelectedProfile(profile);
    setShowPhoneModal(true);
    setCustomerPhone('');
  };

  const confirmSale = async () => {
    const activeTenantId = tenantId || storedTenant || guichetInfo?.tenant_id;
    if (!selectedProfile || !activeTenantId || !token) return;

    setSelling(true);
    setError('');
    const guichetDb = createGuichetClient(token);

    try {
      // 1. Get one available ticket
      const { data: tickets, error: fetchError } = await guichetDb
        .from('tickets')
        .select('*')
        .eq('tenant_id', activeTenantId)
        .eq('profile_id', selectedProfile.id)
        .in('status', ['NEUF', 'ASSIGNE'])
        .limit(1);

      if (fetchError) throw fetchError;
      if (!tickets || tickets.length === 0) {
        throw new Error("Aucun ticket disponible pour ce profil.");
      }

      const ticket = tickets[0];

      // 2. Update ticket status
      const { error: updateError } = await guichetDb
        .from('tickets')
        .update({
          status: 'VENDU',
          sold_at: new Date().toISOString()
        })
        .eq('id', ticket.id);

      if (updateError) throw updateError;

      // 3. Record sale history
      const { error: historyError } = await guichetDb
        .from('sales_history')
        .insert({
          ticket_id: ticket.id,
          tenant_id: activeTenantId,
          seller_id: guichetInfo?.reseller_id || null,
          amount_paid: selectedProfile.price,
          metadata: {
            customer_phone: customerPhone || null,
            source: 'guichet',
            guichet_id: guichetInfo?.guichet_id || null,
            guichet_name: guichetInfo?.name || null
          }
        });

      if (historyError) {
        console.error('Error recording sale history:', historyError);
        // Continue anyway as ticket is sold
      }

      setLastSoldTicket({ ...ticket, profile: selectedProfile });
      setShowPhoneModal(false);
      setShowSuccessModal(true);
      
      // Refresh profiles and stats
      fetchProfiles(guichetInfo?.allowed_profiles, activeTenantId);
      fetchDailyStats(guichetInfo?.guichet_id, activeTenantId);
      fetchRecentSales(guichetInfo?.guichet_id, activeTenantId);

    } catch (err: any) {
      console.error('Sale error:', err);
      setError(err.message || "Erreur lors de la vente.");
    } finally {
      setSelling(false);
    }
  };

  const handleLogout = () => {
    const activeTenantId = tenantId || storedTenant || guichetInfo?.tenant_id;
    localStorage.removeItem('guichet_token');
    localStorage.removeItem('guichet_tenant');
    navigate(`/guichet?tenant_id=${activeTenantId || ''}`);
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredProfiles = profiles.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.price.toString().includes(searchQuery)
  );

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin mb-6"></div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight">Initialisation du Guichet...</h2>
        <p className="text-slate-500 text-sm mt-2">Veuillez patienter quelques instants.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center shadow-md shadow-brand-500/20">
              <Zap className="w-5 h-5 text-white fill-current" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none">Guichet Vente</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mode Kiosque</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Daily Stats Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center shrink-0">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Recette du jour</p>
              <p className="text-lg sm:text-xl font-black text-slate-900 leading-none">{dailyStats.revenue.toLocaleString()} <span className="text-xs text-slate-500">GNF</span></p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center shrink-0">
              <Ticket className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Tickets vendus</p>
              <p className="text-lg sm:text-xl font-black text-slate-900 leading-none">{dailyStats.count}</p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Dernière vente</p>
              <p className="text-sm font-black text-slate-900 leading-none">
                {recentSales.length > 0 ? format(parseISO(recentSales[0].sold_at), 'HH:mm') : '--:--'}
              </p>
            </div>
          </div>
        </div>

        {/* Charts and Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                Tendance horaire
              </h3>
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={hourlyData}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="time" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}}
                    interval={3}
                  />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                    formatter={(value: any) => [`${value.toLocaleString()} GNF`, 'Recette']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <History className="w-4 h-4 text-blue-500" />
                Ventes récentes
              </h3>
              <button 
                onClick={() => setShowHistory(!showHistory)}
                className="text-[10px] font-black text-brand-600 uppercase tracking-widest hover:underline"
              >
                {showHistory ? 'Masquer' : 'Voir tout'}
              </button>
            </div>
            <div className="space-y-3">
              {recentSales.length > 0 ? (
                recentSales.slice(0, showHistory ? 10 : 3).map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 group hover:bg-white hover:shadow-md transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                        <Ticket className="w-5 h-5 text-slate-400 group-hover:text-brand-500 transition-colors" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900 tracking-tight">{sale.tickets?.username}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {format(parseISO(sale.sold_at), 'HH:mm')} • {sale.tickets?.ticket_profiles?.name}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-slate-900">{sale.amount_paid.toLocaleString()} GNF</p>
                      <span className="text-[8px] font-black text-emerald-600 uppercase bg-emerald-50 px-1.5 py-0.5 rounded-md">Vendu</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 text-center py-4">Aucune vente aujourd'hui</p>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-brand-500 transition-colors" />
          <input
            type="text"
            placeholder="Rechercher un forfait par nom ou prix..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-14 pr-6 py-5 bg-white border-2 border-slate-100 rounded-[2rem] text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-8 focus:ring-brand-500/5 transition-all shadow-sm"
          />
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Profiles Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {loading ? (
            <div className="col-span-full py-12 text-center">
              <div className="w-10 h-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Chargement des forfaits...</p>
            </div>
          ) : filteredProfiles.length > 0 ? (
            filteredProfiles.map(profile => (
              <div key={profile.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-xl hover:shadow-brand-500/5 transition-all">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-10 transition-all scale-150 rotate-12 pointer-events-none">
                  <Zap className="w-32 h-32 text-brand-600 fill-current" />
                </div>
                
                <div className="relative z-10 mb-8">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-tight mb-1">{profile.name}</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Forfait Internet</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest">
                      {profile.available_count} en stock
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                      <Wifi className="w-3.5 h-3.5" />
                      Connexion Rapide
                    </span>
                  </div>
                </div>

                <div className="relative z-10 flex items-center justify-between mt-auto pt-6 border-t border-slate-50">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Prix de vente</p>
                    <p className="text-3xl font-black text-brand-600 tracking-tighter">{profile.price.toLocaleString()} <span className="text-sm">GNF</span></p>
                  </div>
                  <button
                    onClick={() => handleSellClick(profile)}
                    className="h-14 px-8 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-brand-500 hover:shadow-xl hover:shadow-brand-500/30 hover:-translate-y-1 transition-all active:scale-95 flex items-center gap-2"
                  >
                    Vendre <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-16 text-center bg-white rounded-[3rem] border-2 border-slate-100 border-dashed">
              <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-10 h-10 text-slate-300" />
              </div>
              <p className="text-slate-900 font-black text-lg tracking-tight mb-1">Aucun forfait trouvé</p>
              <p className="text-slate-400 text-sm font-medium">Réessayez avec un autre terme de recherche.</p>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {showPhoneModal && selectedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => !selling && setShowPhoneModal(false)} />
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 relative z-10 shadow-2xl">
            <button onClick={() => !selling && setShowPhoneModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-900">
              <X className="w-6 h-6" />
            </button>
            
            <div className="mb-8">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Confirmer la vente</h3>
              <p className="text-slate-500 text-sm">Forfait <strong className="text-slate-900">{selectedProfile.name}</strong> à <strong className="text-brand-600">{selectedProfile.price.toLocaleString()} GNF</strong></p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                  Numéro client (Optionnel)
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Ex: 620 00 00 00"
                  className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all"
                />
              </div>

              <button
                onClick={confirmSale}
                disabled={selling}
                className="w-full h-14 bg-brand-500 text-white rounded-2xl font-black text-sm hover:bg-brand-600 hover:shadow-lg hover:shadow-brand-500/30 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {selling ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Valider {selectedProfile.price.toLocaleString()} GNF</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccessModal && lastSoldTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in print:p-0 print:bg-white print:static print:inset-auto">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl print:hidden" onClick={() => setShowSuccessModal(false)} />
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 relative z-10 text-center shadow-2xl animate-in zoom-in-95 print:shadow-none print:p-0 print:max-w-none">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6 print:hidden">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            
            <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2 print:hidden">Vente Réussie !</h3>
            <p className="text-slate-500 text-sm mb-8 print:hidden">Le ticket a été généré avec succès.</p>

            {/* Ticket Content for Print */}
            <div className="bg-slate-50 rounded-3xl p-6 border-2 border-dashed border-slate-200 mb-8 relative print:border-none print:bg-white print:p-0 print:mb-0">
              <div className="hidden print:block mb-4">
                <h2 className="text-xl font-black text-slate-900">Univers WiFi</h2>
                <p className="text-sm text-slate-500">{guichetInfo?.name || 'Guichet'}</p>
                <p className="text-xs text-slate-400">{new Date().toLocaleString()}</p>
              </div>

              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">CODE VOUCHER</p>
              <p className="text-4xl font-black text-slate-900 tracking-[0.2em]">{lastSoldTicket.username}</p>
              {lastSoldTicket.password && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">MOT DE PASSE</p>
                  <p className="text-xl font-bold text-slate-700">{lastSoldTicket.password}</p>
                </div>
              )}
              <div className="mt-6 pt-6 border-t border-slate-200 flex justify-center">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(lastSoldTicket.username)}`} 
                  alt="Ticket QR" 
                  className="w-32 h-32 rounded-xl shadow-sm print:shadow-none" 
                  referrerPolicy="no-referrer"
                />
              </div>
              
              <div className="hidden print:block mt-6 pt-4 border-t border-slate-200">
                <p className="text-lg font-black text-slate-900">{lastSoldTicket.profile?.name}</p>
                <p className="text-xl font-black text-brand-600">{lastSoldTicket.profile?.price?.toLocaleString()} GNF</p>
              </div>
            </div>

            <div className="flex gap-3 print:hidden">
              <button
                onClick={handlePrint}
                className="flex-1 h-14 bg-slate-100 text-slate-900 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all active:scale-95"
              >
                Imprimer
              </button>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="flex-1 h-14 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-slate-800 transition-all active:scale-95"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
