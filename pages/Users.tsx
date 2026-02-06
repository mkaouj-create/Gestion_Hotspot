import React, { useEffect, useState, useCallback } from 'react';
import { UserPlus, Mail, Users as UsersIcon, User as UserIcon, Pencil, Loader2, ShieldCheck, Trash2, Search, Crown, CircleDollarSign, MoreHorizontal, Wallet, CheckCircle2, AlertTriangle, Building2, LayoutGrid, List } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { db, supabaseUrl, supabaseKey } from '../services/db';
import { UserRole, User, TicketStatus } from '../types';

const Users: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole.REVENDEUR | UserRole.AGENT | 'ADMIN'>('ALL');
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [confirmDeleteText, setConfirmDeleteText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [formData, setFormData] = useState({ fullName: '', email: '', password: '', role: UserRole.REVENDEUR });
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>('CARDS');

  const notify = useCallback((type: 'success' | 'error', message: string) => { setToast({ type, message }); setTimeout(() => setToast(null), 5000); }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user: authUser } } = await db.auth.getUser();
      if (!authUser) return;
      const { data: profile } = await db.from('users').select('*').eq('id', authUser.id).single();
      if (!profile) throw new Error("Profil introuvable.");
      setCurrentUserProfile(profile);
      
      let query = db.from('users').select('*, tenants(name), sales_history(amount_paid)');
      
      if (profile.role !== UserRole.ADMIN_GLOBAL) query = query.eq('tenant_id', profile.tenant_id);
      
      const { data, error } = await query.eq('is_active', true).order('created_at', { ascending: false });
      if (error) throw error;
      
      setUsers((data || []).map((u: any) => ({ ...u, total_revenue: u.sales_history?.reduce((acc: number, curr: any) => acc + Number(curr.amount_paid), 0) || 0 })));
    } catch (err: any) { notify('error', err.message); } finally { setLoading(false); }
  }, [notify]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleHardDelete = async () => {
    // Sécurité : Un agent ne peut pas supprimer
    if (currentUserProfile?.role === UserRole.AGENT) {
        notify('error', "Action non autorisée pour les agents.");
        return;
    }

    if (!userToDelete || confirmDeleteText !== 'SUPPRIMER') return;
    setIsDeleting(true);
    try {
      await db.from('tickets').update({ status: TicketStatus.NEUF, assigned_to: null }).eq('assigned_to', userToDelete.id).eq('status', TicketStatus.ASSIGNE);
      await db.from('sales_history').delete().eq('seller_id', userToDelete.id);
      await db.from('payments').delete().eq('reseller_id', userToDelete.id);
      await db.from('tickets').update({ sold_by: null }).eq('sold_by', userToDelete.id);
      const { error: rpcError } = await db.rpc('delete_user_fully', { target_user_id: userToDelete.id });
      if (rpcError) throw rpcError;
      
      notify('success', `Membre ${userToDelete.full_name} et toutes ses données supprimés.`); 
      setUsers(prev => prev.filter(u => u.id !== userToDelete.id)); 
      setUserToDelete(null); 
      setConfirmDeleteText('');
    } catch (err: any) { 
        notify('error', "Erreur lors de la suppression : " + err.message); 
    } finally { 
        setIsDeleting(false); 
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Sécurité 1: Un agent ne peut pas créer ou modifier
    if (currentUserProfile?.role === UserRole.AGENT) {
        notify('error', "Action non autorisée pour les agents.");
        return;
    }

    // Sécurité 2: Un Gestionnaire ne peut pas créer d'Admin (Associe)
    if (formData.role === UserRole.ASSOCIE && currentUserProfile?.role !== UserRole.ADMIN_GLOBAL) {
        notify('error', "Seul le Master Admin peut créer des administrateurs.");
        return;
    }

    if (isSubmitting || !currentUserProfile) return;
    setIsSubmitting(true);
    try {
      if (editingUser) {
        const { error } = await db.from('users').update({ full_name: formData.fullName.trim(), role: formData.role }).eq('id', editingUser.id);
        if (error) throw error; notify('success', `Profil mis à jour.`);
      } else {
        const tempClient = createClient(supabaseUrl, supabaseKey);
        const { error: authError } = await tempClient.auth.signUp({ 
            email: formData.email.trim().toLowerCase(), 
            password: formData.password, 
            options: { 
                data: { 
                    full_name: formData.fullName.trim(), 
                    tenant_id: currentUserProfile.tenant_id, 
                    role: formData.role 
                } 
            } 
        });
        if (authError) throw authError; 
        notify('success', "Nouveau membre ajouté.");
      }
      await fetchData(); setShowModal(false); setFormData({ fullName: '', email: '', password: '', role: UserRole.REVENDEUR }); setEditingUser(null);
    } catch (err: any) { notify('error', err.message); } finally { setIsSubmitting(false); }
  };

  const getRoleInfo = (role: string) => { switch(role) { case UserRole.ADMIN_GLOBAL: return { label: 'SaaS Master', color: 'bg-red-50 text-red-700 border-red-100', icon: ShieldCheck }; case UserRole.GESTIONNAIRE_WIFI_ZONE: case UserRole.ADMIN: return { label: 'Administrateur', color: 'bg-slate-900 text-white border-slate-700', icon: Crown }; case UserRole.REVENDEUR: return { label: 'Revendeur', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: CircleDollarSign }; default: return { label: 'Agent', color: 'bg-indigo-50 text-indigo-700 border-indigo-100', icon: UserIcon }; } };
  const filteredUsers = users.filter(u => { const matchesSearch = u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase()); const matchesRole = roleFilter === 'ALL' ? true : roleFilter === 'ADMIN' ? (u.role === UserRole.GESTIONNAIRE_WIFI_ZONE || u.role === UserRole.ADMIN) : u.role === roleFilter; return matchesSearch && matchesRole; });

  return (
    <div className="space-y-8 pb-32 animate-in fade-in duration-500">
      {toast && (<div className={`fixed top-6 right-6 z-[100] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}><CheckCircle2 className="w-5 h-5" /><p className="font-bold text-sm">{toast.message}</p></div>)}
      
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
        <div>
            <div className="flex items-center gap-2 text-indigo-600 mb-2"><UsersIcon className="w-5 h-5" /><span className="text-[10px] font-black uppercase tracking-widest">Gestion d'équipe</span></div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Membres & Accès</h1>
            <p className="text-slate-400 font-medium mt-1">Administrez les rôles et les permissions de votre agence.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-4">
            <div className="flex bg-slate-100 p-1.5 rounded-2xl shrink-0">
                <button onClick={() => setViewMode('CARDS')} className={`p-3 rounded-xl transition-all ${viewMode === 'CARDS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid className="w-5 h-5" /></button>
                <button onClick={() => setViewMode('TABLE')} className={`p-3 rounded-xl transition-all ${viewMode === 'TABLE' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><List className="w-5 h-5" /></button>
            </div>
            
            {/* Masquer le bouton d'ajout pour les Agents */}
            {currentUserProfile?.role !== UserRole.AGENT && (
                <button onClick={() => { setEditingUser(null); setFormData({fullName: '', email: '', password: '', role: UserRole.REVENDEUR}); setShowModal(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 shadow-xl shadow-indigo-200 transition-all active:scale-95">
                    <UserPlus className="w-4 h-4" /> Nouveau Membre
                </button>
            )}
        </div>
      </div>

      <div className="bg-white p-2 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
            <input type="text" placeholder="Rechercher par nom ou email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full h-full pl-14 pr-6 py-4 bg-transparent rounded-[2rem] font-bold text-slate-700 placeholder:text-slate-300 outline-none" />
        </div>
        <div className="flex bg-slate-50 p-1.5 rounded-[2rem] overflow-x-auto">
            {[{ id: 'ALL', label: 'Tous' }, { id: UserRole.REVENDEUR, label: 'Revendeurs' }, { id: UserRole.AGENT, label: 'Agents' }, { id: 'ADMIN', label: 'Admins' }].map((tab) => (<button key={tab.id} onClick={() => setRoleFilter(tab.id as any)} className={`px-6 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${roleFilter === tab.id ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>{tab.label}</button>))}
        </div>
      </div>

      {loading ? (
          <div className="py-40 text-center"><Loader2 className="w-10 h-10 animate-spin text-indigo-200 mx-auto" /></div>
      ) : filteredUsers.length === 0 ? (
          <div className="py-40 text-center text-slate-300 font-bold uppercase text-xs tracking-widest">Aucun membre trouvé</div>
      ) : (
        <>
            {viewMode === 'CARDS' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredUsers.map(user => {
                        const role = getRoleInfo(user.role);
                        const RoleIcon = role.icon;
                        return (
                            <div key={user.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm group hover:shadow-xl hover:border-indigo-100 transition-all duration-300 flex flex-col justify-between relative overflow-hidden">
                                {currentUserProfile?.role === UserRole.ADMIN_GLOBAL && (<div className="absolute top-0 right-0 bg-slate-50 px-5 py-2 rounded-bl-[2rem]"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Building2 className="w-3 h-3" /> {(user.tenants as any)?.name || 'N/A'}</span></div>)}
                                <div>
                                    <div className="flex items-center gap-4 mb-6 mt-2">
                                        <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-600 font-black text-2xl shadow-inner group-hover:scale-110 transition-transform border border-slate-100">
                                            {user.full_name.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="font-black text-lg text-slate-900 leading-tight mb-1">{user.full_name}</h3>
                                            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border bg-white shadow-sm border-slate-100">
                                                <RoleIcon className={`w-3 h-3 ${role.color.split(' ')[1]}`} />
                                                <span className="text-[9px] font-black uppercase tracking-wide text-slate-600">{role.label}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-4 mb-6">
                                        <div className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between border border-slate-100">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Chiffre d'affaires</span>
                                            <span className="text-sm font-black text-slate-900">{user.total_revenue.toLocaleString()} GNF</span>
                                        </div>
                                        {user.role === UserRole.REVENDEUR && (
                                            <div className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between border border-slate-100">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Solde Dispo</span>
                                                <span className={`text-sm font-black ${user.balance < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{user.balance?.toLocaleString() || 0} GNF</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 text-slate-400 px-2">
                                            <Mail className="w-3 h-3" />
                                            <p className="text-xs font-medium truncate">{user.email}</p>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Actions Cards : Masquées pour les Agents */}
                                <div className="grid grid-cols-2 gap-3 mt-auto">
                                    {currentUserProfile?.role !== UserRole.AGENT && (
                                        <>
                                            <button onClick={() => { setEditingUser(user); setFormData({fullName: user.full_name, email: user.email, password:'', role: user.role}); setShowModal(true); }} className="py-3 bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm"><Pencil className="w-3 h-3" /> MODIFIER</button>
                                            {user.id !== currentUserProfile?.id ? (
                                                <button onClick={() => setUserToDelete(user)} className="py-3 bg-white border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm"><Trash2 className="w-3 h-3" /> SUPPRIMER</button>
                                            ) : (
                                                <div className="py-3 bg-slate-50 text-slate-300 rounded-xl font-black text-[10px] uppercase tracking-widest text-center border border-slate-100">VOUS</div>
                                            )}
                                        </>
                                    )}
                                    {currentUserProfile?.role === UserRole.AGENT && (
                                         <div className="col-span-2 py-3 bg-slate-50 text-slate-300 rounded-xl font-black text-[10px] uppercase tracking-widest text-center border border-slate-100">Lecture Seule</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {viewMode === 'TABLE' && (
                <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-50 bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <th className="px-10 py-6">MEMBRE</th>
                                    {currentUserProfile?.role === UserRole.ADMIN_GLOBAL && <th className="px-10 py-6">AGENCE</th>}
                                    <th className="px-10 py-6">RÔLE</th>
                                    <th className="px-10 py-6">PERFORMANCE</th>
                                    <th className="px-10 py-6">SOLDE</th>
                                    {currentUserProfile?.role !== UserRole.AGENT && <th className="px-10 py-6 text-right">ACTIONS</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredUsers.map((user) => { const role = getRoleInfo(user.role); const RoleIcon = role.icon; return (<tr key={user.id} className="group hover:bg-indigo-50/30 transition-colors"><td className="px-10 py-6"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 font-black text-lg shadow-inner group-hover:bg-white group-hover:scale-110 transition-all">{user.full_name.charAt(0)}</div><div><p className="font-black text-slate-900 text-sm">{user.full_name}</p><div className="flex items-center gap-1.5 text-slate-400 mt-0.5"><Mail className="w-3 h-3" /><p className="text-[10px] font-bold truncate max-w-[150px]">{user.email}</p></div></div></div></td>{currentUserProfile?.role === UserRole.ADMIN_GLOBAL && (<td className="px-10 py-6"><div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-slate-300" /><span className="text-xs font-bold text-slate-600 uppercase">{(user.tenants as any)?.name || 'N/A'}</span></div></td>)}<td className="px-10 py-6"><div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border ${role.color}`}><RoleIcon className="w-3.5 h-3.5" /><span className="text-[9px] font-black uppercase tracking-wide">{role.label}</span></div></td><td className="px-10 py-6"><div className="flex flex-col"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chiffre d'affaires</span><span className="text-sm font-black text-slate-900">{user.total_revenue.toLocaleString()} GNF</span></div></td><td className="px-10 py-6">{user.role === UserRole.REVENDEUR ? (<div className="flex items-center gap-2"><Wallet className={`w-4 h-4 ${user.balance < 0 ? 'text-red-500' : 'text-emerald-500'}`} /><span className={`text-sm font-black ${user.balance < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{user.balance?.toLocaleString() || 0} GNF</span></div>) : (<span className="text-slate-300">-</span>)}</td>
                                {currentUserProfile?.role !== UserRole.AGENT && (
                                    <td className="px-10 py-6 text-right"><div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => { setEditingUser(user); setFormData({fullName: user.full_name, email: user.email, password:'', role: user.role}); setShowModal(true); }} className="p-2.5 rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm"><Pencil className="w-4 h-4" /></button>{user.id !== currentUserProfile?.id && (<button onClick={() => setUserToDelete(user)} className="p-2.5 rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-red-600 hover:border-red-100 transition-all shadow-sm"><Trash2 className="w-4 h-4" /></button>)}</div></td>
                                )}
                                </tr>); })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </>
      )}

      {showModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-6"><div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowModal(false)} /><form onSubmit={handleSubmit} className="bg-white w-full max-w-md rounded-[3.5rem] p-12 relative z-10 animate-in zoom-in-95 shadow-2xl border border-slate-100"><h2 className="text-2xl font-black mb-10 uppercase text-slate-900 text-center tracking-tight">{editingUser ? 'Modifier Profil' : 'Nouveau Membre'}</h2><div className="space-y-5"><div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identité</label><input type="text" required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} placeholder="Nom Complet" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:ring-4 focus:ring-indigo-50 transition-all" /></div>{!editingUser && (<><div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Accès</label><input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="Email professionnel" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:ring-4 focus:ring-indigo-50 transition-all" /><input type="password" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Mot de passe provisoire" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:ring-4 focus:ring-indigo-50 transition-all" /></div></>)}<div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rôle Système</label><div className="relative"><select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as UserRole})} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none appearance-none cursor-pointer focus:ring-4 focus:ring-indigo-50 transition-all"><option value={UserRole.REVENDEUR}>REVENDEUR (Prépayé)</option><option value={UserRole.AGENT}>AGENT TERRAIN (Vente Directe)</option>{currentUserProfile?.role === UserRole.ADMIN_GLOBAL && (<option value={UserRole.ASSOCIE}>ADMINISTRATEUR (Gestion)</option>)}</select><MoreHorizontal className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none w-5 h-5" /></div></div></div><button type="submit" disabled={isSubmitting} className="w-full mt-10 py-6 bg-slate-900 hover:bg-black text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl transition-all transform active:scale-95 flex items-center justify-center gap-3">{isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "ENREGISTRER LE MEMBRE"}</button><button type="button" onClick={() => setShowModal(false)} className="w-full mt-3 py-4 text-slate-400 hover:text-slate-600 font-bold text-xs uppercase tracking-widest transition-colors">Annuler</button></form></div>)}
      {userToDelete && (<div className="fixed inset-0 z-[100] flex items-center justify-center p-6"><div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setUserToDelete(null)} /><div className="bg-white w-full max-w-sm rounded-[3rem] p-10 text-center relative z-10 border-t-8 border-red-600 shadow-2xl animate-in zoom-in-95"><div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner"><AlertTriangle className="w-10 h-10" /></div><h3 className="text-xl font-black text-slate-900 mb-2 uppercase">Supprimer le compte ?</h3><p className="text-slate-500 text-sm mb-8 leading-relaxed px-4">Cette action supprimera définitivement l'accès de <strong>{userToDelete.full_name}</strong> ainsi que tout son historique de ventes et paiements.</p><div className="space-y-4"><input type="text" value={confirmDeleteText} onChange={e => setConfirmDeleteText(e.target.value)} placeholder="Taper SUPPRIMER" className="w-full p-4 border-2 border-red-50 bg-red-50/50 rounded-2xl text-center font-black uppercase outline-none focus:border-red-200 focus:bg-white transition-all text-red-900 placeholder:text-red-200" /><button onClick={handleHardDelete} disabled={isDeleting || confirmDeleteText !== 'SUPPRIMER'} className="w-full py-5 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-red-100 transition-all">{isDeleting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "CONFIRMER LA SUPPRESSION"}</button><button onClick={() => setUserToDelete(null)} className="w-full py-4 text-slate-400 hover:text-slate-900 font-bold text-xs uppercase tracking-widest transition-colors">Annuler</button></div></div></div>)}
    </div>
  );
};
export default Users;