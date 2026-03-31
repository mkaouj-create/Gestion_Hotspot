import React, { useState, useEffect } from 'react';
import { Store, Key, Trash2, Plus, Copy, Check, AlertCircle, Loader2, TrendingUp, Ticket } from 'lucide-react';
import { db } from '../services/db';
import { UserRole } from '../types';

export default function Guichets() {
  const [codes, setCodes] = useState<any[]>([]);
  const [detailedStats, setDetailedStats] = useState({
    today: { count: 0, revenue: 0 },
    week: { count: 0, revenue: 0 },
    month: { count: 0, revenue: 0 },
    total: { count: 0, revenue: 0 }
  });
  const [guichetStats, setGuichetStats] = useState<Record<string, { todayCount: number, todayRevenue: number, totalCount: number, totalRevenue: number }>>({});
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [selectedTenant, setSelectedTenant] = useState('');
  const [tenants, setTenants] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await db.auth.getUser();
      if (user) {
        const { data: profile } = await db.from('users').select('*').eq('id', user.id).single();
        setCurrentUser(profile);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (currentUser && currentUser.tenant_id) {
      fetchCodes();
      fetchDetailedStats();
      if (currentUser.role === UserRole.ADMIN_GLOBAL) {
        fetchTenants();
      }
    }
  }, [currentUser]);

  const fetchTenants = async () => {
    try {
      const { data, error } = await db.from('tenants').select('id, name').order('name');
      if (error) throw error;
      setTenants(data || []);
      if (data && data.length > 0) {
        setSelectedTenant(data[0].id);
      }
    } catch (err) {
      console.error('Error fetching tenants:', err);
    }
  };

  const fetchDetailedStats = async () => {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1)); // Lundi
      
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      let query = db
        .from('sales_history')
        .select('amount_paid, sold_at, metadata')
        .contains('metadata', { source: 'guichet' });

      if (currentUser.role !== UserRole.ADMIN_GLOBAL) {
        query = query.eq('tenant_id', currentUser.tenant_id);
      }

      const { data, error } = await query;

      if (error) throw error;

      let stats = {
        today: { count: 0, revenue: 0 },
        week: { count: 0, revenue: 0 },
        month: { count: 0, revenue: 0 },
        total: { count: 0, revenue: 0 }
      };

      let gStats: Record<string, { todayCount: number, todayRevenue: number, totalCount: number, totalRevenue: number }> = {};

      data?.forEach(sale => {
        const amount = sale.amount_paid || 0;
        const soldAt = new Date(sale.sold_at);
        const gId = sale.metadata?.guichet_id;

        // Global stats
        stats.total.count++;
        stats.total.revenue += amount;

        if (soldAt >= today) {
          stats.today.count++;
          stats.today.revenue += amount;
        }
        if (soldAt >= startOfWeek) {
          stats.week.count++;
          stats.week.revenue += amount;
        }
        if (soldAt >= startOfMonth) {
          stats.month.count++;
          stats.month.revenue += amount;
        }

        // Per guichet stats
        if (gId) {
          if (!gStats[gId]) {
            gStats[gId] = { todayCount: 0, todayRevenue: 0, totalCount: 0, totalRevenue: 0 };
          }
          gStats[gId].totalCount++;
          gStats[gId].totalRevenue += amount;
          if (soldAt >= today) {
            gStats[gId].todayCount++;
            gStats[gId].todayRevenue += amount;
          }
        }
      });

      setDetailedStats(stats);
      setGuichetStats(gStats);
    } catch (err) {
      console.error('Error fetching detailed stats:', err);
    }
  };

  const fetchCodes = async () => {
    try {
      setLoading(true);
      let query = db
        .from('sales_access_codes')
        .select('id, name, created_at, tenant_id, tenants(name)')
        .order('created_at', { ascending: false });

      if (currentUser.role !== UserRole.ADMIN_GLOBAL) {
        query = query.eq('tenant_id', currentUser.tenant_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setCodes(data || []);
    } catch (err) {
      console.error('Erreur lors du chargement des guichets', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || newPin.length !== 4) {
      setError("Veuillez fournir un nom et un code PIN à 4 chiffres.");
      return;
    }

    const tenantIdToUse = currentUser.role === UserRole.ADMIN_GLOBAL ? selectedTenant : currentUser.tenant_id;

    if (!tenantIdToUse) {
      setError("Veuillez sélectionner une agence.");
      return;
    }

    setProcessing(true);
    setError('');

    try {
      const { error: rpcError } = await db.rpc('create_guichet_code', {
        p_tenant_id: tenantIdToUse,
        p_name: newName.trim(),
        p_pin: newPin
      });

      if (rpcError) throw rpcError;

      setShowAddModal(false);
      setNewName('');
      setNewPin('');
      fetchCodes();
    } catch (err: any) {
      console.error('Erreur création guichet:', err);
      setError(err.message || "Erreur lors de la création du guichet.");
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (id: string, tenantId: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce guichet ? Les sessions actives seront révoquées.")) return;
    
    try {
      // 1. Supprimer le guichet
      const { error: codeError } = await db.from('sales_access_codes').delete().eq('id', id);
      if (codeError) throw codeError;

      // 2. Révoquer les sessions actives pour ce tenant pour forcer la reconnexion
      const { error: sessionError } = await db.from('guichet_sessions').delete().eq('tenant_id', tenantId);
      if (sessionError) {
        console.error('Erreur lors de la révocation des sessions:', sessionError);
      }

      fetchCodes();
    } catch (err) {
      console.error('Erreur suppression guichet:', err);
      alert("Erreur lors de la suppression.");
    }
  };

  const copyLink = (id: string, tenantId: string) => {
    const url = `${window.location.origin}/guichet?tenant_id=${tenantId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (currentUser?.role !== UserRole.ADMIN_GLOBAL && currentUser?.role !== UserRole.GESTIONNAIRE_WIFI_ZONE) {
    return (
      <div className="p-8 text-center text-slate-500">
        Vous n'avez pas l'autorisation d'accéder à cette page.
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 pb-24 max-w-7xl mx-auto animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center">
            <Store className="w-7 h-7 text-brand-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Guichets (Kiosques)</h1>
            <p className="text-sm font-medium text-slate-500">Gérez les accès simplifiés pour la vente de tickets</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="h-12 px-6 bg-brand-500 text-white rounded-xl font-bold text-sm hover:bg-brand-600 hover:shadow-lg hover:shadow-brand-500/30 transition-all active:scale-95 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nouveau Guichet
        </button>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center shrink-0">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aujourd'hui</p>
              <p className="text-xl font-black text-slate-900">{detailedStats.today.revenue.toLocaleString()} <span className="text-xs text-slate-500">GNF</span></p>
            </div>
          </div>
          <p className="text-xs font-bold text-slate-500">{detailedStats.today.count} tickets vendus</p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center shrink-0">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cette Semaine</p>
              <p className="text-xl font-black text-slate-900">{detailedStats.week.revenue.toLocaleString()} <span className="text-xs text-slate-500">GNF</span></p>
            </div>
          </div>
          <p className="text-xs font-bold text-slate-500">{detailedStats.week.count} tickets vendus</p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center shrink-0">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ce Mois</p>
              <p className="text-xl font-black text-slate-900">{detailedStats.month.revenue.toLocaleString()} <span className="text-xs text-slate-500">GNF</span></p>
            </div>
          </div>
          <p className="text-xs font-bold text-slate-500">{detailedStats.month.count} tickets vendus</p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center shrink-0">
              <Ticket className="w-6 h-6 text-slate-600" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Historique</p>
              <p className="text-xl font-black text-slate-900">{detailedStats.total.revenue.toLocaleString()} <span className="text-xs text-slate-500">GNF</span></p>
            </div>
          </div>
          <p className="text-xs font-bold text-slate-500">{detailedStats.total.count} tickets vendus</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {codes.map((code) => {
          const stats = guichetStats[code.id] || { todayCount: 0, todayRevenue: 0, totalCount: 0, totalRevenue: 0 };
          return (
          <div key={code.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-10 transition-all scale-150 rotate-12 pointer-events-none">
              <Store className="w-24 h-24 text-brand-600 fill-current" />
            </div>
            
            <div className="relative z-10 flex-1">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">{code.name}</h3>
                  {currentUser?.role === UserRole.ADMIN_GLOBAL && code.tenants && (
                    <p className="text-xs font-bold text-brand-600 uppercase tracking-widest mt-1">
                      {code.tenants.name}
                    </p>
                  )}
                </div>
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">
                  <Key className="w-5 h-5 text-slate-400" />
                </div>
              </div>

              <div className="space-y-3 mb-6 bg-slate-50 rounded-2xl p-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500">Aujourd'hui</span>
                  <div className="text-right">
                    <span className="text-sm font-black text-emerald-600">{stats.todayRevenue.toLocaleString()} GNF</span>
                    <span className="text-[10px] text-slate-400 block">{stats.todayCount} tickets</span>
                  </div>
                </div>
                <div className="h-px bg-slate-200"></div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500">Total</span>
                  <div className="text-right">
                    <span className="text-sm font-black text-slate-700">{stats.totalRevenue.toLocaleString()} GNF</span>
                    <span className="text-[10px] text-slate-400 block">{stats.totalCount} tickets</span>
                  </div>
                </div>
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">
                Créé le {new Date(code.created_at).toLocaleDateString('fr-FR')}
              </p>
            </div>

            <div className="relative z-10 flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
              <button
                onClick={() => copyLink(code.id, code.tenant_id)}
                className="flex-1 h-10 bg-slate-50 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
              >
                {copiedId === code.id ? (
                  <><Check className="w-4 h-4 text-emerald-500" /> Lien copié</>
                ) : (
                  <><Copy className="w-4 h-4" /> Copier le lien</>
                )}
              </button>
              <button
                onClick={() => handleDelete(code.id, code.tenant_id)}
                className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-100 transition-colors"
                title="Supprimer ce guichet"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          );
        })}
      </div>

      {codes.length === 0 && (
        <div className="py-12 text-center bg-white rounded-[2rem] border border-slate-100 border-dashed">
          <Store className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Aucun guichet configuré.</p>
          <p className="text-sm text-slate-400 mt-1">Créez un guichet pour permettre la vente simplifiée via code PIN.</p>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => !processing && setShowAddModal(false)} />
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 relative z-10 shadow-2xl">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-6">Nouveau Guichet</h3>
            
            {error && (
              <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleAddCode} className="space-y-6">
              {currentUser?.role === UserRole.ADMIN_GLOBAL && (
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                    Agence (Tenant)
                  </label>
                  <select
                    value={selectedTenant}
                    onChange={(e) => setSelectedTenant(e.target.value)}
                    className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-900 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all"
                    required
                  >
                    <option value="" disabled>Sélectionner une agence</option>
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                  Nom du Guichet
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Guichet Principal"
                  className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                  Code PIN (4 chiffres)
                </label>
                <input
                  type="password"
                  maxLength={4}
                  pattern="\d{4}"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-center text-2xl tracking-[1em] font-black text-slate-900 placeholder:text-slate-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all"
                  required
                />
                <p className="text-xs text-slate-400 mt-2 text-center">Ce code sera demandé au revendeur pour accéder au guichet.</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={processing}
                  className="flex-1 h-12 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={processing || !newName.trim() || newPin.length !== 4}
                  className="flex-1 h-12 bg-brand-500 text-white rounded-xl font-bold text-sm hover:bg-brand-600 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
