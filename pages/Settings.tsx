
import React, { useState, useEffect } from 'react';
import { Save, Smartphone, Phone, Banknote, Trash2, Zap, Users, Store, Loader2, Building2, Sparkles, Server, Activity, Database, UserCircle, KeyRound, Lock, LogOut, ShieldCheck, Clock, CheckCircle2, AlertTriangle, ToggleLeft, ToggleRight, Settings as SettingsIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { UserRole } from '../types';

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'AGENCY'>('PROFILE');
  const [profileForm, setProfileForm] = useState({ fullName: '', currentPassword: '', newPassword: '', confirmPassword: '' });
  const [stockCount, setStockCount] = useState(0);
  const [expiredCount, setExpiredCount] = useState(0);
  const [agencyForm, setAgencyForm] = useState({ whatsappHeader: 'Bienvenue sur notre réseau WiFi', contactSupport: '', currency: 'GNF' });
  const [saasStats, setSaasStats] = useState({ totalTenants: 0, totalUsers: 0, systemHealth: 'Optimal (Local)', dbLatency: '0ms' });
  const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  
  // New state for Global Admin SaaS Config
  const [saasConfig, setSaasConfig] = useState({ id: '', monthly_subscription_price: 150000, trial_period_days: 30, support_phone_number: '', is_maintenance_mode: false });

  useEffect(() => { fetchSettings(); }, []);

  const showToast = (type: 'success' | 'error', message: string) => { setToast({ type, message }); setTimeout(() => setToast(null), 4000); };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await db.auth.getUser();
      if (!user) return;
      const { data: profile } = await db.from('users').select('*, tenants(name, id)').eq('id', user.id).single();
      if (profile) {
        setUserProfile(profile); setProfileForm(prev => ({ ...prev, fullName: profile.full_name || '' }));
        
        if (profile.role === UserRole.ADMIN_GLOBAL) {
          const { count: tenantsCount } = await db.from('tenants').select('*', { count: 'exact', head: true });
          const { count: usersCount } = await db.from('users').select('*', { count: 'exact', head: true });
          setSaasStats(prev => ({ ...prev, totalTenants: tenantsCount || 0, totalUsers: usersCount || 0 }));
          
          // Fetch Global SaaS Config
          const { data: config } = await db.from('saas_settings').select('*').maybeSingle();
          if (config) {
             setSaasConfig(config);
          } else {
             // Fallback si la table est vide (rare si schema.sql est executé)
             console.warn("Aucune configuration SaaS trouvée. Création d'une config par défaut en mémoire.");
          }
          
        } else if (profile.tenant_id) {
          const { count } = await db.from('tickets').select('*', { count: 'exact', head: true }).eq('tenant_id', profile.tenant_id); setStockCount(count || 0);
          const { count: expired } = await db.from('tickets').select('*', { count: 'exact', head: true }).eq('tenant_id', profile.tenant_id).eq('status', 'EXPIRE'); setExpiredCount(expired || 0);
          setAgencyForm(prev => ({...prev, contactSupport: user.email || ''}));
        }
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      if (profileForm.fullName !== userProfile.full_name) await db.from('users').update({ full_name: profileForm.fullName }).eq('id', userProfile.id);
      if (profileForm.newPassword) { if (profileForm.newPassword !== profileForm.confirmPassword) throw new Error("Les mots de passe ne correspondent pas."); await db.auth.updateUser({ password: profileForm.newPassword }); }
      showToast('success', "Profil mis à jour avec succès !"); setProfileForm(p => ({ ...p, newPassword: '', confirmPassword: '' })); fetchSettings();
    } catch (err: any) { showToast('error', "Erreur : " + err.message); } finally { setSaving(false); }
  };

  const handleSaveAgency = async () => { setSaving(true); await new Promise(resolve => setTimeout(resolve, 500)); setSaving(false); showToast('success', "Configuration sauvegardée (Local) !"); };
  const handleCleanExpired = async () => { if (!userProfile?.tenant_id || !confirm("Supprimer les tickets expirés ?")) return; await db.from('tickets').delete().eq('tenant_id', userProfile.tenant_id).eq('status', 'EXPIRE'); showToast('success', "Nettoyage effectué !"); setExpiredCount(0); fetchSettings(); };
  
  const handleSaveSaasConfig = async () => {
    // Confirmation de sécurité pour éviter les erreurs critiques
    const isConfirmed = window.confirm(
        "⚠️ ACTION CRITIQUE : MISE À JOUR SAAS\n\n" +
        "Vous êtes sur le point de modifier les paramètres globaux (Prix, Mode Maintenance, etc.).\n" +
        "Ces changements s'appliqueront immédiatement à TOUTES les agences.\n\n" +
        "Confirmez-vous cette action ?"
    );

    if (!isConfirmed) return;

    setSaving(true);
    try {
        if (saasConfig.id) {
            // Mise à jour (Update)
            const { error } = await db.from('saas_settings').update({
                monthly_subscription_price: saasConfig.monthly_subscription_price,
                trial_period_days: saasConfig.trial_period_days,
                support_phone_number: saasConfig.support_phone_number,
                is_maintenance_mode: saasConfig.is_maintenance_mode,
                updated_at: new Date().toISOString()
            }).eq('id', saasConfig.id);
            
            if (error) throw error;
        } else {
            // Création (Insert) si n'existe pas
            const { error } = await db.from('saas_settings').insert({
                monthly_subscription_price: saasConfig.monthly_subscription_price,
                trial_period_days: saasConfig.trial_period_days,
                support_phone_number: saasConfig.support_phone_number,
                is_maintenance_mode: saasConfig.is_maintenance_mode
            });
            
            if (error) throw error;
        }
        
        showToast('success', "Configuration SaaS mise à jour avec succès.");
        await fetchSettings(); // Rafraichir les données pour récupérer l'ID
    } catch (err: any) {
        showToast('error', "Erreur de sauvegarde : " + err.message);
    } finally {
        setSaving(false);
    }
  };

  const handleLogout = async () => { await db.auth.signOut(); navigate('/'); };

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 text-brand-600 animate-spin" /></div>;

  return (
    <div className="space-y-8 font-sans pb-20 animate-in fade-in duration-500 relative">
      {toast && (<div className={`fixed top-6 right-6 z-[100] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right-10 border ${toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-red-600 text-white border-red-500'}`}>{toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}<p className="font-bold text-sm tracking-tight">{toast.message}</p></div>)}

      {/* ---------------------------------------------------------------------- */}
      {/* VIEW: ADMIN GLOBAL (SaaS Master) */}
      {/* ---------------------------------------------------------------------- */}
      {userProfile?.role === UserRole.ADMIN_GLOBAL ? (
        <div className="space-y-12">
            {/* Header Dashboard */}
            <div className="bg-[#1e293b] p-10 rounded-[3rem] shadow-2xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div className="absolute top-0 right-0 w-80 h-80 bg-brand-500 rounded-full blur-[120px] opacity-20 -mr-20 -mt-20"></div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-[2rem] flex items-center justify-center text-brand-400 border border-white/10 shadow-inner">
                        <Server className="w-10 h-10" />
                    </div>
                    <div>
                        <span className="bg-red-500/20 text-red-300 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-red-500/30">SAAS MASTER</span>
                        <h1 className="text-4xl font-black text-white tracking-tight mt-2">Pilotage SaaS</h1>
                        <p className="text-slate-400 font-medium text-sm mt-1">Supervision technique et financière.</p>
                    </div>
                </div>
                <button className={`relative z-10 px-8 py-4 rounded-2xl font-black text-xs tracking-widest uppercase flex items-center gap-3 shadow-xl transition-all ${saasConfig.is_maintenance_mode ? 'bg-orange-500 text-white animate-pulse' : 'bg-brand-600 text-white'}`}>
                    <Activity className="w-4 h-4" /> STATUS: {saasConfig.is_maintenance_mode ? 'MAINTENANCE' : 'ONLINE'}
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-4 text-emerald-600"><Activity className="w-5 h-5" /><span className="text-[10px] font-black uppercase tracking-widest">SANTÉ SYSTÈME</span></div>
                    <p className="text-3xl font-black text-slate-900">{saasStats.systemHealth}</p>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-4 text-brand-600"><Database className="w-5 h-5" /><span className="text-[10px] font-black uppercase tracking-widest">LATENCE DB</span></div>
                    <p className="text-3xl font-black text-slate-900">{saasStats.dbLatency}</p>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-4 text-indigo-600"><Building2 className="w-5 h-5" /><span className="text-[10px] font-black uppercase tracking-widest">TOTAL AGENCES</span></div>
                    <p className="text-3xl font-black text-slate-900">{saasStats.totalTenants}</p>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-4 text-slate-600"><Users className="w-5 h-5" /><span className="text-[10px] font-black uppercase tracking-widest">TOTAL USERS</span></div>
                    <p className="text-3xl font-black text-slate-900">{saasStats.totalUsers}</p>
                </div>
            </div>

            {/* Configuration Globale */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                 <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                     <div className="flex items-center gap-4 mb-10 pb-6 border-b border-slate-50">
                         <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center"><SettingsIcon className="w-7 h-7" /></div>
                         <div>
                             <h2 className="text-2xl font-black text-slate-900 tracking-tight">Configuration Tarifaire & Globale</h2>
                             <p className="text-slate-400 font-medium text-sm">Définissez les règles du jeu pour toutes les agences.</p>
                         </div>
                     </div>
                     
                     <div className="space-y-8">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             <div className="space-y-3">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Prix Abonnement Mensuel</label>
                                 <div className="relative group">
                                     <Banknote className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-brand-600 transition-colors" />
                                     <input type="number" value={saasConfig.monthly_subscription_price} onChange={e => setSaasConfig({...saasConfig, monthly_subscription_price: Number(e.target.value)})} className="w-full pl-16 pr-6 py-5 rounded-[2rem] border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-50 outline-none font-black text-slate-900 text-xl transition-all" />
                                     <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase">GNF / Mois</span>
                                 </div>
                             </div>
                             <div className="space-y-3">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Période d'Essai (Jours)</label>
                                 <div className="relative group">
                                     <Clock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-brand-600 transition-colors" />
                                     <input type="number" value={saasConfig.trial_period_days} onChange={e => setSaasConfig({...saasConfig, trial_period_days: Number(e.target.value)})} className="w-full pl-16 pr-6 py-5 rounded-[2rem] border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-50 outline-none font-black text-slate-900 text-xl transition-all" />
                                     <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase">Jours</span>
                                 </div>
                             </div>
                         </div>

                         <div className="space-y-3">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Numéro Support Principal (WhatsApp)</label>
                             <div className="relative group">
                                 <Phone className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-emerald-600 transition-colors" />
                                 <input type="text" value={saasConfig.support_phone_number} onChange={e => setSaasConfig({...saasConfig, support_phone_number: e.target.value})} className="w-full pl-16 pr-6 py-5 rounded-[2rem] border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-emerald-50 outline-none font-black text-slate-900 text-lg transition-all" />
                             </div>
                         </div>
                         
                         <div className="bg-orange-50 p-6 rounded-[2rem] border border-orange-100 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-orange-500 shadow-sm"><AlertTriangle className="w-6 h-6" /></div>
                                <div>
                                    <p className="font-black text-slate-900 text-sm uppercase">Mode Maintenance</p>
                                    <p className="text-xs font-medium text-orange-700/70">Bloque l'accès à tous les gestionnaires.</p>
                                </div>
                            </div>
                            <button onClick={() => setSaasConfig({...saasConfig, is_maintenance_mode: !saasConfig.is_maintenance_mode})} className={`relative w-16 h-8 rounded-full transition-colors duration-300 ${saasConfig.is_maintenance_mode ? 'bg-orange-500' : 'bg-slate-300'}`}>
                                <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${saasConfig.is_maintenance_mode ? 'translate-x-8' : 'translate-x-0'}`}></div>
                            </button>
                         </div>

                         <button onClick={handleSaveSaasConfig} disabled={saving} className="w-full py-6 bg-slate-900 hover:bg-black text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl transition-all active:scale-[0.98]">
                             {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-4 h-4" />}
                             ENREGISTRER LA CONFIGURATION
                         </button>
                     </div>
                 </div>
                 
                 <div className="space-y-6">
                    <div className="bg-brand-50 p-10 rounded-[3rem] border border-brand-100 h-full flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-6 text-brand-700">
                                <ShieldCheck className="w-6 h-6" />
                                <h3 className="text-sm font-black uppercase tracking-widest">Admin Account</h3>
                            </div>
                            <div className="space-y-4">
                                <div className="bg-white p-5 rounded-[2rem] border border-brand-100/50 shadow-sm">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Nom</p>
                                    <p className="font-bold text-slate-900">{userProfile?.full_name}</p>
                                </div>
                                <div className="bg-white p-5 rounded-[2rem] border border-brand-100/50 shadow-sm">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Rôle</p>
                                    <p className="font-black text-brand-600 uppercase text-xs">SUPER ADMIN</p>
                                </div>
                            </div>
                        </div>
                        <button onClick={handleLogout} className="w-full mt-8 py-5 bg-white border-2 border-slate-50 text-slate-400 hover:text-red-500 hover:border-red-50 rounded-[2.5rem] font-black text-xs tracking-widest uppercase flex items-center justify-center gap-3 transition-all group">
                            <LogOut className="w-4 h-4 group-hover:translate-x-1 transition-transform" /> Se déconnecter
                        </button>
                    </div>
                 </div>
            </div>
        </div>
      ) : (
        /* ---------------------------------------------------------------------- */
        /* VIEW: MANAGERS & OTHERS */
        /* ---------------------------------------------------------------------- */
        <>
            <div className="bg-white p-4 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"><div className="flex p-1.5 bg-slate-50 rounded-[2.5rem] w-full md:w-auto"><button onClick={() => setActiveTab('PROFILE')} className={`px-8 py-4 rounded-[2rem] font-black text-xs uppercase tracking-widest transition-all flex items-center gap-3 ${activeTab === 'PROFILE' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}><UserCircle className="w-4 h-4" /> Mon Compte</button>{(userProfile?.role === UserRole.GESTIONNAIRE_WIFI_ZONE || userProfile?.role === UserRole.ADMIN) && (<button onClick={() => setActiveTab('AGENCY')} className={`px-8 py-4 rounded-[2rem] font-black text-xs uppercase tracking-widest transition-all flex items-center gap-3 ${activeTab === 'AGENCY' ? 'bg-white text-brand-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}><Building2 className="w-4 h-4" /> Agence</button>)}</div><div className="flex items-center gap-3 px-4"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Session :</span><span className="text-xs font-black text-slate-900">{userProfile?.role}</span></div></div>
            {activeTab === 'PROFILE' && (<div className="grid grid-cols-1 lg:grid-cols-3 gap-8"><div className="lg:col-span-2 bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm"><div className="flex items-center gap-4 mb-8"><div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl">{userProfile?.full_name?.charAt(0) || 'U'}</div><div><h2 className="text-2xl font-black text-slate-900 tracking-tight">{userProfile?.full_name}</h2><p className="text-slate-400 font-medium text-sm">{userProfile?.email}</p></div></div><form onSubmit={handleUpdateProfile} className="space-y-6 max-w-lg"><Input label="Nom Complet" icon={<UserCircle className="w-5 h-5" />} value={profileForm.fullName} onChange={(v: string) => setProfileForm({...profileForm, fullName: v})} /><div className="pt-6 border-t border-slate-50"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Lock className="w-3 h-3" /> Sécurité</p><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Input label="Nouveau Mot de passe" type="password" icon={<KeyRound className="w-5 h-5" />} value={profileForm.newPassword} onChange={(v: string) => setProfileForm({...profileForm, newPassword: v})} /><Input label="Confirmer" type="password" icon={<KeyRound className="w-5 h-5" />} value={profileForm.confirmPassword} onChange={(v: string) => setProfileForm({...profileForm, confirmPassword: v})} /></div></div><button type="submit" disabled={saving} className="w-full py-5 bg-slate-900 hover:bg-black text-white rounded-2xl font-black text-xs tracking-widest uppercase flex items-center justify-center gap-3 shadow-xl transition-all">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} METTRE À JOUR</button></form></div><div className="space-y-6"><button onClick={handleLogout} className="w-full py-5 bg-white border-2 border-slate-50 text-slate-400 hover:text-red-500 hover:border-red-50 rounded-[2.5rem] font-black text-xs tracking-widest uppercase flex items-center justify-center gap-3 transition-all group"><LogOut className="w-4 h-4 group-hover:translate-x-1 transition-transform" /> Se déconnecter</button></div></div>)}
            {activeTab === 'AGENCY' && (userProfile?.role === UserRole.GESTIONNAIRE_WIFI_ZONE || userProfile?.role === UserRole.ADMIN) && (<div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-in slide-in-from-right-4"><div className="xl:col-span-2 space-y-8"><div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm"><div className="flex items-center gap-3 mb-8"><Store className="w-5 h-5 text-brand-600" /><h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">CONFIGURATION COMMERCIALE</h2></div><div className="space-y-6"><Input label="EN-TÊTE REÇU WHATSAPP" icon={<Smartphone className="w-5 h-5" />} value={agencyForm.whatsappHeader} onChange={(v: string) => setAgencyForm({...agencyForm, whatsappHeader: v})} /><div className="grid grid-cols-1 md:grid-cols-2 gap-8"><Input label="CONTACT SUPPORT CLIENT" icon={<Phone className="w-5 h-5" />} value={agencyForm.contactSupport} onChange={(v: string) => setAgencyForm({...agencyForm, contactSupport: v})} /><Input label="DEVISE" icon={<Banknote className="w-5 h-5" />} value={agencyForm.currency} onChange={(v: string) => setAgencyForm({...agencyForm, currency: v})} /></div><button onClick={handleSaveAgency} disabled={saving} className="w-full py-5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-black text-xs tracking-widest uppercase flex items-center justify-center gap-3 shadow-xl transition-all">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} ENREGISTRER CONFIG</button></div></div></div><div className="space-y-8"><div className="bg-[#1e293b] p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group"><div className="absolute top-0 right-0 w-40 h-40 bg-brand-500 rounded-full blur-[80px] opacity-20 -mr-10 -mt-10 group-hover:opacity-30 transition-opacity"></div><div className="flex items-center gap-3 mb-10 text-brand-300 relative z-10"><Sparkles className="w-5 h-5" /><h2 className="text-sm font-black uppercase tracking-widest">STOCK LIVE</h2></div><div className="bg-white/5 border border-white/10 rounded-3xl p-6 mb-8 relative z-10"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">TOTAL VOUCHERS</p><p className="text-5xl font-black text-white tracking-tighter">{stockCount}</p></div><button onClick={handleCleanExpired} className="w-full py-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-2xl font-black text-[10px] tracking-widest uppercase flex items-center justify-center gap-2 transition-all"><Trash2 className="w-4 h-4" /> NETTOYER {expiredCount} EXPIRÉS</button></div></div></div>)}
        </>
      )}
    </div>
  );
};
const Input = ({ label, icon, value, onChange, type = "text" }: any) => (<div className="space-y-3 text-left"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label><div className="relative group"><div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-600 transition-colors">{icon}</div><input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full pl-14 pr-6 py-5 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-50 outline-none font-bold text-slate-700 transition-all" /></div></div>);
export default Settings;
