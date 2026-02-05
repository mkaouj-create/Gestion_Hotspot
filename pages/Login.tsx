
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight, ChevronLeft, Zap, ShieldCheck, AlertCircle, Loader2, WifiOff } from 'lucide-react';
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

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-900">
      <div className="w-full max-w-[1000px] bg-white rounded-2xl shadow-card overflow-hidden flex min-h-[600px]">
        
        {/* Left Side - Brand & Info */}
        <div className="hidden lg:flex w-5/12 bg-slate-900 text-white p-12 flex-col justify-between relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-brand-600 rounded-full blur-[100px] opacity-20 -mr-20 -mt-20"></div>
           
           <div className="relative z-10">
             <Link to="/" className="flex items-center gap-3 mb-10">
               <div className="w-10 h-10 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">G</div>
               <span className="text-lg font-bold tracking-tight">Gestion_Hotspot</span>
             </Link>
             <h2 className="text-3xl font-bold leading-tight mb-4">Gérez votre réseau WiFi <br/>comme un pro.</h2>
             <p className="text-slate-400 text-sm leading-relaxed">Plateforme SaaS optimisée pour la gestion de tickets MikroTik, la vente et le suivi en temps réel.</p>
           </div>

           <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"><Zap className="w-4 h-4" /></div>
                <span>Performances Cloud</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"><ShieldCheck className="w-4 h-4" /></div>
                <span>Sécurité Enterprise</span>
              </div>
           </div>
        </div>

        {/* Right Side - Form */}
        <div className="w-full lg:w-7/12 p-8 md:p-16 flex flex-col justify-center">
          <div className="max-w-sm mx-auto w-full">
            <button onClick={() => navigate('/')} className="flex items-center gap-2 text-slate-400 hover:text-slate-600 font-medium text-xs mb-8 transition-colors">
              <ChevronLeft className="w-4 h-4" /> Retour
            </button>
            
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Connexion</h1>
            <p className="text-slate-500 text-sm mb-8">Entrez vos identifiants pour accéder au dashboard.</p>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3 text-red-600 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Adresse Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-11 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none text-sm font-medium transition-all" placeholder="nom@entreprise.com" />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-700">Mot de passe</label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-11 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none text-sm font-medium transition-all" placeholder="••••••••" />
                </div>
              </div>

              <button type="submit" disabled={isLoading} className="w-full py-2.5 bg-slate-900 hover:bg-black text-white rounded-lg font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-2">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Se connecter <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>

            <div className="mt-8 text-center border-t border-slate-100 pt-6">
              <p className="text-xs text-slate-500">Pas encore de compte ? <Link to="/register-agency" className="text-brand-600 font-bold hover:underline">Créer une agence</Link></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Login;
