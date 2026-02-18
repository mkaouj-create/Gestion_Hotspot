
import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, Plus, Play, ExternalLink, Trash2, Pencil, X, Save, Loader2, CheckCircle2, AlertCircle, Info, Youtube, HardDrive, Share2 } from 'lucide-react';
import { db } from '../services/db';
import { UserRole } from '../types';

interface Tutorial {
    id: string;
    title: string;
    link: string;
    details: string;
    target_audience: string[];
    created_at: string;
}

const Tutorials: React.FC = () => {
    const [tutorials, setTutorials] = useState<Tutorial[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null);
    
    // Form & Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingTutorial, setEditingTutorial] = useState<Tutorial | null>(null);
    const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    
    const [formData, setFormData] = useState({
        title: '',
        link: '',
        details: '',
        target_admin: true,
        target_reseller: true
    });

    const notify = (type: 'success' | 'error', message: string) => { 
        setToast({ type, message }); 
        setTimeout(() => setToast(null), 5000); 
    };

    const fetchTutorials = useCallback(async () => {
        try {
            setLoading(true);
            const { data: { user } } = await db.auth.getUser();
            if (!user) return;
            
            const { data: profile } = await db.from('users').select('role').eq('id', user.id).single();
            setCurrentUser(profile);

            let query = db.from('tutorials').select('*').order('created_at', { ascending: false });
            
            // Si pas admin global, on filtre par audience
            if (profile?.role !== UserRole.ADMIN_GLOBAL) {
                // Supabase syntax for "contains in array"
                query = query.contains('target_audience', [profile?.role]);
            }

            const { data, error } = await query;
            if (error) throw error;
            setTutorials(data || []);
        } catch (err: any) {
            notify('error', "Échec du chargement : " + err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchTutorials(); }, [fetchTutorials]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const audience = [];
            if (formData.target_admin) audience.push(UserRole.GESTIONNAIRE_WIFI_ZONE);
            if (formData.target_reseller) audience.push(UserRole.REVENDEUR);

            if (audience.length === 0) throw new Error("Veuillez sélectionner au moins un destinataire.");

            const payload = {
                title: formData.title,
                link: formData.link,
                details: formData.details,
                target_audience: audience
            };

            if (editingTutorial) {
                const { error } = await db.from('tutorials').update(payload).eq('id', editingTutorial.id);
                if (error) throw error;
                notify('success', "Tutoriel mis à jour !");
            } else {
                const { error } = await db.from('tutorials').insert({ ...payload, created_by: (await db.auth.getUser()).data.user?.id });
                if (error) throw error;
                notify('success', "Nouveau tutoriel publié !");
            }

            setIsModalOpen(false);
            setEditingTutorial(null);
            setFormData({ title: '', link: '', details: '', target_admin: true, target_reseller: true });
            fetchTutorials();
        } catch (err: any) {
            notify('error', err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Supprimer ce tutoriel définitivement ?")) return;
        try {
            const { error } = await db.from('tutorials').delete().eq('id', id);
            if (error) throw error;
            notify('success', "Tutoriel supprimé.");
            setTutorials(prev => prev.filter(t => t.id !== id));
        } catch (err: any) {
            notify('error', err.message);
        }
    };

    const openEdit = (t: Tutorial) => {
        setEditingTutorial(t);
        setFormData({
            title: t.title,
            link: t.link,
            details: t.details || '',
            target_admin: t.target_audience.includes(UserRole.GESTIONNAIRE_WIFI_ZONE),
            target_reseller: t.target_audience.includes(UserRole.REVENDEUR)
        });
        setIsModalOpen(true);
    };

    // Helper pour identifier le type de lien
    const getLinkIcon = (url: string) => {
        if (url.includes('youtube.com') || url.includes('youtu.be')) return <Youtube className="w-5 h-5 text-red-500" />;
        if (url.includes('drive.google.com')) return <HardDrive className="w-5 h-5 text-blue-500" />;
        return <Share2 className="w-5 h-5 text-indigo-500" />;
    };

    const isGlobalAdmin = currentUser?.role === UserRole.ADMIN_GLOBAL;

    return (
        <div className="space-y-8 pb-32 animate-in fade-in duration-500 relative">
            {toast && (
                <div className={`fixed top-6 right-6 z-[100] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
                    <CheckCircle2 className="w-5 h-5" />
                    <p className="font-bold text-sm">{toast.message}</p>
                </div>
            )}

            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 text-indigo-600 mb-2">
                        <BookOpen className="w-5 h-5" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Centre de Formation</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">Vidéos & Tutoriels</h1>
                    <p className="text-slate-400 font-medium mt-1">Apprenez à maîtriser toutes les fonctionnalités de la plateforme.</p>
                </div>
                {isGlobalAdmin && (
                    <button 
                        onClick={() => { setEditingTutorial(null); setFormData({title:'', link:'', details:'', target_admin:true, target_reseller:true}); setIsModalOpen(true); }}
                        className="bg-slate-900 hover:bg-black text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95"
                    >
                        <Plus className="w-4 h-4" /> AJOUTER UNE VIDÉO
                    </button>
                )}
            </header>

            {loading ? (
                <div className="py-40 text-center"><Loader2 className="w-12 h-12 animate-spin text-indigo-200 mx-auto" /></div>
            ) : tutorials.length === 0 ? (
                <div className="bg-white rounded-[3rem] p-20 text-center border border-slate-100 shadow-sm">
                    <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mx-auto mb-6">
                        <BookOpen className="w-10 h-10" />
                    </div>
                    <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest">Aucun tutoriel disponible</h3>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {tutorials.map((t) => (
                        <div key={t.id} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden group hover:shadow-2xl transition-all duration-500 flex flex-col h-full">
                            {/* Video Placeholder / Header */}
                            <div className="aspect-video bg-slate-900 relative flex items-center justify-center overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10"></div>
                                <div className="z-20 w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/30 group-hover:scale-110 transition-transform cursor-pointer" onClick={() => window.open(t.link, '_blank')}>
                                    <Play className="w-6 h-6 fill-current" />
                                </div>
                                <div className="absolute top-4 left-4 z-20 bg-white/10 backdrop-blur-md px-3 py-1 rounded-lg border border-white/20 text-[8px] font-black text-white uppercase tracking-widest">
                                    {t.link.includes('youtube') ? 'Youtube' : 'Stockage Cloud'}
                                </div>
                            </div>

                            <div className="p-8 flex-1 flex flex-col justify-between">
                                <div>
                                    <div className="flex items-start justify-between gap-4 mb-4">
                                        <h3 className="font-black text-xl text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors">{t.title}</h3>
                                        <div className="shrink-0">{getLinkIcon(t.link)}</div>
                                    </div>
                                    <p className="text-slate-400 text-sm font-medium line-clamp-3 mb-6">{t.details || "Consultez cette ressource pour en savoir plus sur l'utilisation de votre espace Gestion Hotspot."}</p>
                                </div>

                                <div className="space-y-4 pt-6 border-t border-slate-50">
                                    <div className="flex flex-wrap gap-2">
                                        {t.target_audience.map(role => (
                                            <span key={role} className="bg-slate-50 text-slate-400 px-2 py-1 rounded-md text-[8px] font-bold uppercase tracking-tighter">
                                                {role === UserRole.REVENDEUR ? 'REVENDEUR' : 'ADMIN'}
                                            </span>
                                        ))}
                                    </div>
                                    
                                    <div className="flex items-center justify-between">
                                        <a href={t.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-widest hover:translate-x-1 transition-transform">
                                            Regarder <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                        
                                        {isGlobalAdmin && (
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => openEdit(t)} className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><Pencil className="w-4 h-4" /></button>
                                                <button onClick={() => handleDelete(t.id)} className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* MODAL GESTION (POUR ADMIN GLOBAL) */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-in fade-in">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
                    <form onSubmit={handleSave} className="bg-white w-full max-w-lg rounded-[3rem] p-10 relative z-10 animate-in zoom-in-95 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{editingTutorial ? 'Modifier Tutoriel' : 'Publier un Tutoriel'}</h2>
                            <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 text-slate-300 hover:text-slate-900"><X className="w-6 h-6" /></button>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Titre de la ressource</label>
                                <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="ex: Comment recharger un revendeur ?" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:ring-4 focus:ring-indigo-50 transition-all" />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lien Vidéo (YouTube / Drive / OneDrive)</label>
                                <input type="url" required value={formData.link} onChange={e => setFormData({...formData, link: e.target.value})} placeholder="https://..." className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-indigo-600 outline-none focus:ring-4 focus:ring-indigo-50 transition-all" />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Détails / Instructions</label>
                                <textarea rows={4} value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} placeholder="Décrivez brièvement le contenu..." className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:ring-4 focus:ring-indigo-50 transition-all resize-none" />
                            </div>

                            <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Destinateurs (Qui verra cette vidéo ?)</p>
                                <div className="flex flex-col gap-3">
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${formData.target_admin ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-200'}`}>
                                            {formData.target_admin && <CheckCircle2 className="w-4 h-4 text-white" />}
                                        </div>
                                        <input type="checkbox" className="hidden" checked={formData.target_admin} onChange={() => setFormData({...formData, target_admin: !formData.target_admin})} />
                                        <span className="text-sm font-black text-slate-700 uppercase tracking-tight">Administrateurs Agences</span>
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${formData.target_reseller ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-200'}`}>
                                            {formData.target_reseller && <CheckCircle2 className="w-4 h-4 text-white" />}
                                        </div>
                                        <input type="checkbox" className="hidden" checked={formData.target_reseller} onChange={() => setFormData({...formData, target_reseller: !formData.target_reseller})} />
                                        <span className="text-sm font-black text-slate-700 uppercase tracking-tight">Revendeurs</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <button type="submit" disabled={isSubmitting} className="w-full mt-10 py-6 bg-slate-900 hover:bg-black text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-slate-200 transition-all transform active:scale-95 flex items-center justify-center gap-3">
                            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4" /> PUBLIER LA RESSOURCE</>}
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default Tutorials;
