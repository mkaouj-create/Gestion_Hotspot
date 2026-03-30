import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LogOut, Zap, Search, Wifi, Clock, CheckCircle2, X, AlertCircle, TrendingUp, Ticket } from 'lucide-react';
import { createGuichetClient } from '../services/db';

export default function GuichetSales() {
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenant_id');
  const navigate = useNavigate();

  const [profiles, setProfiles] = useState<any[]>([]);
  const [dailyStats, setDailyStats] = useState({ count: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const [selling, setSelling] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSoldTicket, setLastSoldTicket] = useState<any>(null);

  // Initialize custom client
  const token = localStorage.getItem('guichet_token');
  const storedTenant = localStorage.getItem('guichet_tenant');

  useEffect(() => {
    if (!token || !tenantId || storedTenant !== tenantId) {
      navigate(`/guichet?tenant_id=${tenantId || ''}`);
      return;
    }

    fetchProfiles();
    fetchDailyStats();
  }, [tenantId, token, navigate]);

  const fetchDailyStats = async () => {
    try {
      const guichetDb = createGuichetClient(token!);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await guichetDb
        .from('sales_history')
        .select('amount_paid')
        .eq('tenant_id', tenantId)
        .gte('sold_at', today.toISOString())
        .contains('metadata', { source: 'guichet' });

      if (error) throw error;

      const count = data?.length || 0;
      const revenue = data?.reduce((sum, sale) => sum + (sale.amount_paid || 0), 0) || 0;

      setDailyStats({ count, revenue });
    } catch (err) {
      console.error('Error fetching daily stats:', err);
    }
  };

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const guichetDb = createGuichetClient(token!);

      // Fetch profiles with available tickets count
      const { data: profilesData, error: profilesError } = await guichetDb
        .from('ticket_profiles')
        .select(`
          id, name, price, duration, volume,
          tickets!inner(count)
        `)
        .eq('tenant_id', tenantId)
        .eq('tickets.status', 'NEUF')
        .order('price', { ascending: true });

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
    if (!selectedProfile || !tenantId || !token) return;

    setSelling(true);
    setError('');
    const guichetDb = createGuichetClient(token);

    try {
      // 1. Get one available ticket
      const { data: tickets, error: fetchError } = await guichetDb
        .from('tickets')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('profile_id', selectedProfile.id)
        .eq('status', 'NEUF')
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
          tenant_id: tenantId,
          amount_paid: selectedProfile.price,
          metadata: {
            customer_phone: customerPhone || null,
            source: 'guichet'
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
      fetchProfiles();
      fetchDailyStats();

    } catch (err: any) {
      console.error('Sale error:', err);
      setError(err.message || "Erreur lors de la vente.");
    } finally {
      setSelling(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('guichet_token');
    localStorage.removeItem('guichet_tenant');
    navigate(`/guichet?tenant_id=${tenantId}`);
  };

  const filteredProfiles = profiles.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.price.toString().includes(searchQuery)
  );

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
        <div className="grid grid-cols-2 gap-4">
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
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher un forfait..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all shadow-sm"
          />
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Profiles Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {loading ? (
            <div className="col-span-full py-12 text-center">
              <div className="w-8 h-8 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Chargement des forfaits...</p>
            </div>
          ) : filteredProfiles.length > 0 ? (
            filteredProfiles.map(profile => (
              <div key={profile.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-10 transition-all scale-150 rotate-12 pointer-events-none">
                  <Zap className="w-32 h-32 text-brand-600 fill-current" />
                </div>
                
                <div className="relative z-10 mb-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">{profile.name}</h3>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-600 text-xs font-black uppercase tracking-widest">
                      {profile.available_count} dispo
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 text-slate-600 text-xs font-bold">
                      <Clock className="w-3.5 h-3.5" />
                      {profile.duration}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 text-slate-600 text-xs font-bold">
                      <Wifi className="w-3.5 h-3.5" />
                      {profile.volume || 'Illimité'}
                    </span>
                  </div>
                </div>

                <div className="relative z-10 flex items-center justify-between mt-auto pt-4 border-t border-slate-100">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Prix de vente</p>
                    <p className="text-2xl font-black text-brand-600">{profile.price.toLocaleString()} <span className="text-sm">GNF</span></p>
                  </div>
                  <button
                    onClick={() => handleSellClick(profile)}
                    className="h-12 px-6 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-brand-500 hover:shadow-lg hover:shadow-brand-500/30 hover:-translate-y-0.5 transition-all active:scale-95 flex items-center gap-2"
                  >
                    Vendre
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-12 text-center bg-white rounded-3xl border border-slate-100 border-dashed">
              <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">Aucun forfait disponible en stock.</p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl" onClick={() => setShowSuccessModal(false)} />
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 relative z-10 text-center shadow-2xl animate-in zoom-in-95">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            
            <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Vente Réussie !</h3>
            <p className="text-slate-500 text-sm mb-8">Le ticket a été généré avec succès.</p>

            <div className="bg-slate-50 rounded-3xl p-6 border-2 border-dashed border-slate-200 mb-8 relative">
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
                  className="w-32 h-32 rounded-xl shadow-sm" 
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-slate-800 transition-all active:scale-95"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
