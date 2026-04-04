import React, { useState, useEffect } from 'react';
import { Store, Key, Trash2, Plus, Copy, Check, AlertCircle, Loader2, TrendingUp, Ticket, QrCode, X, Calendar, ChevronRight, History } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { db } from '../services/db';
import { UserRole } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, startOfDay, endOfDay, isWithinInterval, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function Guichets() {
  const [codes, setCodes] = useState<any[]>([]);
  const [detailedStats, setDetailedStats] = useState({
    today: { count: 0, revenue: 0 },
    week: { count: 0, revenue: 0 },
    month: { count: 0, revenue: 0 },
    total: { count: 0, revenue: 0 }
  });
  const [guichetStats, setGuichetStats] = useState<Record<string, { 
    todayCount: number, 
    todayRevenue: number, 
    totalCount: number, 
    totalRevenue: number, 
    uncollectedRevenue: number,
    weeklyTrend: any[]
  }>>({});
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<any>(null);
  const [showHistoryModal, setShowHistoryModal] = useState<string | null>(null);
  const [collectionHistory, setCollectionHistory] = useState<any[]>([]);
  
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [selectedTenant, setSelectedTenant] = useState('');
  const [selectedReseller, setSelectedReseller] = useState<string>('');
  
  const [tenants, setTenants] = useState<any[]>([]);
  const [resellers, setResellers] = useState<any[]>([]);
  
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState<string | null>(null);

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
      fetchAllData();
      fetchResellers();
      if (currentUser.role === UserRole.ADMIN_GLOBAL) {
        fetchTenants();
      }
    }
  }, [currentUser]);

  const fetchResellers = async () => {
    try {
      let usersQuery = db.from('users').select('id, full_name, email').eq('role', 'REVENDEUR');

      if (currentUser.role !== UserRole.ADMIN_GLOBAL) {
        usersQuery = usersQuery.eq('tenant_id', currentUser.tenant_id);
      }

      const { data: usersData, error: usersError } = await usersQuery;
      
      if (usersData) setResellers(usersData);
    } catch (err) {
      console.error('Error fetching resellers:', err);
    }
  };

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

  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch Guichets
      let codesQuery = db
        .from('sales_access_codes')
        .select('id, name, created_at, last_collection_at, tenant_id, reseller_id, allowed_profiles, tenants(name)')
        .order('created_at', { ascending: false });

      if (currentUser.role !== UserRole.ADMIN_GLOBAL) {
        codesQuery = codesQuery.eq('tenant_id', currentUser.tenant_id);
      }

      const { data: codesData, error: codesError } = await codesQuery;
      if (codesError) throw codesError;
      
      setCodes(codesData || []);

      // 2. Fetch Sales
      let salesQuery = db
        .from('sales_history')
        .select('amount_paid, sold_at, metadata')
        .contains('metadata', { source: 'guichet' });

      if (currentUser.role !== UserRole.ADMIN_GLOBAL) {
        salesQuery = salesQuery.eq('tenant_id', currentUser.tenant_id);
      }

      const { data: salesData, error: salesError } = await salesQuery;
      if (salesError) throw salesError;

      // 3. Compute Stats
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      let stats = {
        today: { count: 0, revenue: 0 },
        week: { count: 0, revenue: 0 },
        month: { count: 0, revenue: 0 },
        total: { count: 0, revenue: 0 }
      };

      let gStats: Record<string, { todayCount: number, todayRevenue: number, totalCount: number, totalRevenue: number, uncollectedRevenue: number, weeklyTrend: any[] }> = {};

      // Initialize gStats with codes and empty trend
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = subDays(new Date(), i);
        return format(d, 'yyyy-MM-dd');
      }).reverse();

      codesData?.forEach(code => {
        gStats[code.id] = { 
          todayCount: 0, 
          todayRevenue: 0, 
          totalCount: 0, 
          totalRevenue: 0, 
          uncollectedRevenue: 0,
          weeklyTrend: last7Days.map(date => ({ date, revenue: 0, count: 0 }))
        };
      });

      salesData?.forEach(sale => {
        const amount = sale.amount_paid || 0;
        const soldAt = new Date(sale.sold_at);
        const soldAtStr = format(soldAt, 'yyyy-MM-dd');
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
        if (gId && gStats[gId]) {
          gStats[gId].totalCount++;
          gStats[gId].totalRevenue += amount;
          
          if (soldAt >= today) {
            gStats[gId].todayCount++;
            gStats[gId].todayRevenue += amount;
          }
          
          // Update trend
          const trendDay = gStats[gId].weeklyTrend.find(t => t.date === soldAtStr);
          if (trendDay) {
            trendDay.revenue += amount;
            trendDay.count++;
          }
          
          // Uncollected revenue
          const code = codesData?.find(c => c.id === gId);
          const lastCollection = code?.last_collection_at ? new Date(code.last_collection_at) : new Date(0);
          if (soldAt > lastCollection) {
            gStats[gId].uncollectedRevenue += amount;
          }
        }
      });

      setDetailedStats(stats);
      setGuichetStats(gStats);
    } catch (err) {
      console.error('Error fetching data:', err);
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
        p_pin: newPin,
        p_reseller_id: selectedReseller || null
      });

      if (rpcError) throw rpcError;

      setShowAddModal(false);
      setNewName('');
      setNewPin('');
      setSelectedReseller('');
      fetchAllData();
    } catch (err: any) {
      console.error('Erreur création guichet:', err);
      setError(err.message || "Erreur lors de la création du guichet.");
    } finally {
      setProcessing(false);
    }
  };

  const handleEditCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setError("Veuillez fournir un nom.");
      return;
    }

    setProcessing(true);
    setError('');

    try {
      const { error: rpcError } = await db.rpc('update_guichet_code', {
        p_guichet_id: showEditModal.id,
        p_name: newName.trim(),
        p_reseller_id: selectedReseller || null
      });

      if (rpcError) throw rpcError;

      setShowEditModal(null);
      setNewName('');
      setSelectedReseller('');
      fetchAllData();
    } catch (err: any) {
      console.error('Erreur modification guichet:', err);
      setError(err.message || "Erreur lors de la modification du guichet.");
    } finally {
      setProcessing(false);
    }
  };

  const fetchHistory = async (guichetId: string) => {
    try {
      setProcessing(true);
      const { data, error } = await db
        .from('guichet_collections')
        .select('*, users(full_name)')
        .eq('guichet_id', guichetId)
        .order('collected_at', { ascending: false });
        
      if (error) throw error;
      setCollectionHistory(data || []);
      setShowHistoryModal(guichetId);
    } catch (err) {
      console.error('Error fetching history:', err);
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

      fetchAllData();
    } catch (err) {
      console.error('Erreur suppression guichet:', err);
      alert("Erreur lors de la suppression.");
    }
  };

  const copyLink = async (id: string, tenantId: string) => {
    const url = `${window.location.origin}/guichet?tenant_id=${tenantId}`;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for non-secure contexts
        const textArea = document.createElement("textarea");
        textArea.value = url;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand('copy');
        } catch (err) {
          console.error('Fallback copy failed', err);
          throw new Error('Fallback copy failed');
        }
        textArea.remove();
      }
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      alert("Impossible de copier le lien automatiquement. Veuillez le copier manuellement : " + url);
    }
  };

  const handleCollectCash = async (guichetId: string, amount: number) => {
    if (amount <= 0) return;
    if (!window.confirm(`Confirmer la collecte de ${amount.toLocaleString()} GNF pour ce guichet ?`)) return;

    try {
      setProcessing(true);
      const { error } = await db.rpc('collect_guichet_cash', {
        p_guichet_id: guichetId,
        p_amount: amount
      });

      if (error) throw error;
      
      alert("Caisse collectée avec succès !");
      fetchAllData();
    } catch (err: any) {
      console.error('Erreur lors de la collecte:', err);
      alert("Erreur lors de la collecte de la caisse.");
    } finally {
      setProcessing(false);
    }
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
          <div key={code.id} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col relative overflow-hidden group hover:shadow-xl transition-all">
            <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-10 transition-all scale-150 rotate-12 pointer-events-none">
              <Store className="w-24 h-24 text-brand-600 fill-current" />
            </div>
            
            <div className="p-6 relative z-10 flex-1">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">{code.name}</h3>
                  {currentUser?.role === UserRole.ADMIN_GLOBAL && code.tenants && (
                    <p className="text-[10px] font-black text-brand-600 uppercase tracking-widest mt-1">
                      {code.tenants.name}
                    </p>
                  )}
                </div>
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center shadow-inner">
                  <Key className="w-6 h-6 text-slate-400" />
                </div>
              </div>

              {/* Mini Trend Chart */}
              <div className="h-24 w-full mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.weeklyTrend}>
                    <defs>
                      <linearGradient id={`colorRev-${code.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill={`url(#colorRev-${code.id})`} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '0.75rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }}
                      labelFormatter={(label) => format(parseISO(label), 'dd MMM', { locale: fr })}
                      formatter={(value: any) => [`${value.toLocaleString()} GNF`, 'Recette']}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-slate-50 rounded-2xl p-3">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Aujourd'hui</p>
                  <p className="text-sm font-black text-slate-900">{stats.todayRevenue.toLocaleString()} <span className="text-[10px] text-slate-500">GNF</span></p>
                </div>
                <div className="bg-emerald-50 rounded-2xl p-3">
                  <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-1">À Collecter</p>
                  <p className="text-sm font-black text-emerald-600">{stats.uncollectedRevenue.toLocaleString()} <span className="text-[10px] text-emerald-500">GNF</span></p>
                </div>
              </div>

              <div className="space-y-2 mb-6">
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <span>Total Ventes</span>
                  <span className="text-slate-900">{stats.totalCount} tickets</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-500 rounded-full" style={{ width: `${Math.min((stats.totalCount / 100) * 100, 100)}%` }}></div>
                </div>
              </div>
            </div>

            <div className="p-6 pt-0 relative z-10 flex flex-col gap-2">
              {stats.uncollectedRevenue > 0 && (
                <button
                  onClick={() => handleCollectCash(code.id, stats.uncollectedRevenue)}
                  disabled={processing}
                  className="w-full h-12 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand-500 hover:shadow-lg hover:shadow-brand-500/30 transition-all flex items-center justify-center gap-2"
                >
                  <TrendingUp className="w-4 h-4" /> Collecter la caisse
                </button>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyLink(code.id, code.tenant_id)}
                  className="flex-1 h-12 bg-slate-50 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
                >
                  {copiedId === code.id ? (
                    <><Check className="w-4 h-4 text-emerald-500" /> Copié</>
                  ) : (
                    <><Copy className="w-4 h-4" /> Lien</>
                  )}
                </button>
                <button
                  onClick={() => setShowQrModal(code.id)}
                  className="w-12 h-12 bg-slate-50 text-slate-600 rounded-2xl flex items-center justify-center hover:bg-slate-100 transition-colors"
                  title="Afficher le QR Code"
                >
                  <QrCode className="w-5 h-5" />
                </button>
                <button
                  onClick={() => fetchHistory(code.id)}
                  className="w-12 h-12 bg-slate-50 text-slate-600 rounded-2xl flex items-center justify-center hover:bg-slate-100 transition-colors"
                  title="Historique des versements"
                >
                  <History className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    setShowEditModal(code);
                    setNewName(code.name);
                    setSelectedReseller(code.reseller_id || '');
                  }}
                  className="w-12 h-12 bg-slate-50 text-slate-600 rounded-2xl flex items-center justify-center hover:bg-slate-100 transition-colors"
                  title="Modifier le guichet"
                >
                  <Key className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleDelete(code.id, code.tenant_id)}
                  className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center hover:bg-red-100 transition-colors"
                  title="Supprimer ce guichet"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
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

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                  Assigner à un Revendeur (Optionnel)
                </label>
                <select
                  value={selectedReseller}
                  onChange={(e) => setSelectedReseller(e.target.value)}
                  className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-900 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all"
                >
                  <option value="">-- Aucun revendeur --</option>
                  {resellers.map(r => (
                    <option key={r.id} value={r.id}>{r.full_name || r.email}</option>
                  ))}
                </select>
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

      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowQrModal(null)} />
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 relative z-10 shadow-2xl text-center">
            <button 
              onClick={() => setShowQrModal(null)}
              className="absolute top-6 right-6 w-8 h-8 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <QrCode className="w-8 h-8 text-brand-600" />
            </div>
            
            <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2">
              {codes.find(c => c.id === showQrModal)?.name}
            </h3>
            <p className="text-sm text-slate-500 mb-8">Scannez ce QR code pour accéder directement au guichet de vente.</p>
            
            <div className="bg-white p-4 rounded-2xl border-2 border-slate-100 inline-block mb-6 shadow-sm">
              <QRCodeSVG 
                value={`${window.location.origin}/guichet?tenant_id=${codes.find(c => c.id === showQrModal)?.tenant_id}`}
                size={200}
                level="H"
                includeMargin={false}
              />
            </div>
            
            <div className="bg-amber-50 rounded-xl p-4 text-left">
              <p className="text-xs font-bold text-amber-800 mb-1">⚠️ Attention</p>
              <p className="text-xs text-amber-700">Le code PIN sera toujours requis pour se connecter après avoir scanné ce QR code.</p>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => !processing && setShowEditModal(null)} />
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 relative z-10 shadow-2xl">
            <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-6">Modifier le Guichet</h3>
            
            {error && (
              <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleEditCode} className="space-y-6">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                  Nom du Guichet
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-900 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                  Assigner à un Revendeur (Optionnel)
                </label>
                <select
                  value={selectedReseller}
                  onChange={(e) => setSelectedReseller(e.target.value)}
                  className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-900 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all"
                >
                  <option value="">-- Aucun revendeur --</option>
                  {resellers.map(r => (
                    <option key={r.id} value={r.id}>{r.full_name || r.email}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(null)}
                  disabled={processing}
                  className="flex-1 h-12 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={processing || !newName.trim()}
                  className="flex-1 h-12 bg-brand-500 text-white rounded-xl font-bold text-sm hover:bg-brand-600 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowHistoryModal(null)} />
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] p-8 relative z-10 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Historique des versements</h3>
              <button 
                onClick={() => setShowHistoryModal(null)}
                className="w-8 h-8 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto min-h-[300px]">
              {collectionHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <TrendingUp className="w-12 h-12 mb-4 opacity-20" />
                  <p>Aucun versement enregistré pour ce guichet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {collectionHistory.map((history) => (
                    <div key={history.id} className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-green-100 text-green-600 rounded-xl flex items-center justify-center">
                          <TrendingUp className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">
                            {new Date(history.collected_at).toLocaleDateString('fr-FR', {
                              day: 'numeric', month: 'long', year: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                          <p className="text-xs text-slate-500">
                            Collecté par : {history.users?.full_name || 'Administrateur'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-lg text-slate-900">
                          {history.amount.toLocaleString()} GNF
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
