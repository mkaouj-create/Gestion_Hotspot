
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight, ChevronLeft, Zap, ShieldCheck, Globe, AlertCircle, Loader2, WifiOff, RefreshCcw } from 'lucide-react';
import { db } from '../services/db';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true); setError(null);
    try {
      const { data, error: authError } = await db.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      if (data.user) {
        const { data: profile } = await db.from('users').select('tenant_id').eq('id', data.user.id).maybeSingle();
        navigate((!profile || !profile.tenant_id) ? '/complete-setup' : '/dashboard');
      }
    } catch (err: any) { setError(err.message || "Erreur lors de la connexion."); } finally { setIsLoading(false); }
  };

  const handleResetDemo = () => {
    if (confirm("Cela va effacer toutes les données locales et restaurer les utilisateurs de démo par défaut. Continuer ?")) {
        localStorage.removeItem('hotspot_pro_local_db');
        window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-white flex font-sans text-slate-900">
      <div className="hidden lg:flex w-1/2 bg-brand-600 relative overflow-hidden flex-col justify-between p-16">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none"><div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-white/10 rounded-full blur-3xl animate-pulse"></div><div className="absolute bottom-[-5%] right-[-5%] w-[40%] h-[40%] bg-indigo-300/20 rounded-full blur-3xl"></div></div>
        <div className="relative z-10"><Link to="/" className="flex items-center gap-3 mb-20 group"><div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-brand-600 font-black text-2xl shadow-xl shadow-brand-900/20 transition-transform group-hover:scale-110">G</div><span className="text-2xl font-black text-white tracking-tighter">Gestion_Hotspot</span></Link><h2 className="text-6xl font-black text-white leading-tight tracking-tighter mb-8">Pilotez votre <br /><span className="text-brand-100 italic">succès numérique.</span></h2><p className="text-brand-50 text-xl font-medium max-w-md leading-relaxed opacity-90">La plateforme n°1 en Afrique pour la gestion et la monétisation de réseaux WiFi professionnels.</p></div>
        <div className="relative z-10 grid grid-cols-2 gap-8"><div className="bg-white/10 backdrop-blur-md p-6 rounded-[2rem] border border-white/20"><div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white mb-4"><Zap className="w-5 h-5 fill-current" /></div><p className="text-2xl font-black text-white mb-1">+12k</p><p className="text-[10px] font-black text-brand-100 uppercase tracking-widest">Tickets / Jour</p></div><div className="bg-white/10 backdrop-blur-md p-6 rounded-[2rem] border border-white/20"><div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white mb-4"><Globe className="w-5 h-5" /></div><p className="text-2xl font-black text-white mb-1">24/7</p><p className="text-[10px] font-black text-brand-100 uppercase tracking-widest">Disponibilité Cloud</p></div></div>
      </div>
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 md:p-16">
        <div className="w-full max-w-md">
          <div className="mb-12"><button onClick={() => navigate('/')} className="flex items-center gap-2 text-slate-400 hover:text-slate-900 font-bold text-xs tracking-widest uppercase mb-8 transition-colors group"><ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />Retour à l'accueil</button><h1 className="text-4xl font-black text-slate-900 tracking-tight mb-3">Ravi de vous revoir !</h1><p className="text-slate-400 font-medium">Accédez à votre console d'administration.</p></div>
          {error && (<div className="mb-6 p-5 bg-red-50 border border-red-100 rounded-3xl flex items-start gap-4 text-red-600 animate-in fade-in slide-in-from-top-4">{error.includes("Impossible") ? <WifiOff className="w-6 h-6 shrink-0 mt-0.5" /> : <AlertCircle className="w-6 h-6 shrink-0 mt-0.5" />}<p className="text-sm font-bold leading-relaxed">{error}</p></div>)}
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Adresse Email</label><div className="relative group"><Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-brand-600 transition-colors" /><input type="email" required placeholder="nom@agence.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-14 pr-6 py-5 rounded-2xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-brand-50 outline-none font-bold text-slate-600 placeholder:text-slate-300 transition-all" /></div></div>
            <div className="space-y-2"><div className="flex justify-between items-center px-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Mot de passe</label></div><div className="relative group"><Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-brand-600 transition-colors" /><input type="password" required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-14 pr-6 py-5 rounded-2xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-brand-50 outline-none font-bold text-slate-600 placeholder:text-slate-300 transition-all" /></div></div>
            <div className="pt-4"><button type="submit" disabled={isLoading} className={`w-full py-5 bg-[#1e293b] hover:bg-black text-white rounded-[1.5rem] font-bold text-xs tracking-[0.2em] uppercase transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-3 transform hover:scale-[1.02] active:scale-[0.98] ${isLoading ? 'opacity-80 cursor-wait' : ''}`}>{isLoading ? (<div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />CONNEXION...</div>) : (<>ACCÉDER AU DASHBOARD<ArrowRight className="w-4 h-4" /></>)}</button></div>
          </form>
          <div className="mt-8 flex justify-center">
             <button onClick={handleResetDemo} className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-widest hover:text-red-500 transition-colors p-2"><RefreshCcw className="w-3 h-3" /> Réinitialiser Données Démo</button>
          </div>
          <div className="mt-4 text-center"><p className="text-sm font-medium text-slate-400">Pas encore de compte ? <Link to="/register-agency" className="text-brand-600 font-black uppercase text-[10px] tracking-widest hover:underline ml-1">Créer une agence</Link></p></div>
          <div className="mt-8 pt-8 border-t border-slate-50 flex items-center justify-center gap-6 opacity-40"><ShieldCheck className="w-5 h-5 text-slate-300" /><span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Connexion Sécurisée</span></div>
        </div>
      </div>
    </div>
  );
};
export default Login;
