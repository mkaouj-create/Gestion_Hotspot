
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, User, Mail, Lock, ArrowRight, ChevronLeft, Loader2, AlertCircle, LogIn } from 'lucide-react';
import { db } from '../services/db';

const RegisterAgency: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLoginRedirect, setShowLoginRedirect] = useState(false);
  const [formData, setFormData] = useState({ fullName: '', email: '', password: '' });

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true); setError(null); setShowLoginRedirect(false);

    try {
      const { data: authData, error: authError } = await db.auth.signUp({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        options: { data: { full_name: formData.fullName.trim() } }
      });

      if (authError) {
        if (authError.message.toLowerCase().includes("already registered") || authError.status === 422) {
          setError("Cet email est déjà associé à un compte. Souhaitez-vous vous connecter ?");
          setShowLoginRedirect(true); setIsLoading(false); return;
        }
        throw authError;
      }
      if (!authData.user) throw new Error("Erreur de création du compte.");
      navigate('/complete-setup');
    } catch (err: any) { setError(err.message || "Une erreur technique est survenue."); } finally { setIsLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-slate-900">
      <div className="hidden lg:flex w-5/12 bg-slate-900 relative overflow-hidden flex-col justify-between p-16 text-white">
        <div className="absolute top-0 right-0 w-full h-full opacity-20"><div className="absolute top-[-20%] right-[-10%] w-[80%] h-[80%] bg-brand-500 rounded-full blur-[120px]"></div></div>
        <div className="relative z-10"><Link to="/" className="flex items-center gap-3 mb-20 group"><div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center text-white font-black text-xl">G</div><span className="text-xl font-black tracking-tighter uppercase">Gestion Hotspot</span></Link><h2 className="text-5xl font-black leading-[1.1] tracking-tighter mb-8">Lancez votre agence <br />en <span className="text-brand-400 italic">quelques clics.</span></h2><p className="text-slate-400 font-medium max-w-sm">Rejoignez le réseau leader de gestion WiFi en Afrique.</p></div>
      </div>
      <div className="w-full lg:w-7/12 flex items-center justify-center p-8 md:p-20 overflow-y-auto">
        <div className="w-full max-w-lg">
          <div className="mb-10 text-center lg:text-left"><button onClick={() => navigate('/')} className="flex items-center gap-2 text-slate-400 hover:text-slate-900 font-bold text-xs uppercase mb-8 transition-colors mx-auto lg:mx-0"><ChevronLeft className="w-4 h-4" /> Retour à l'accueil</button><h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2 uppercase">Créer mon compte</h1></div>
          {error && (<div className={`mb-8 p-8 rounded-[2.5rem] animate-in slide-in-from-top-4 flex items-start gap-4 ${showLoginRedirect ? 'bg-indigo-50 border border-indigo-100 text-indigo-700' : 'bg-red-50 border border-red-100 text-red-600'}`}><div className={`p-2 rounded-xl shrink-0 ${showLoginRedirect ? 'bg-white text-indigo-500' : 'bg-white text-red-500'}`}><AlertCircle className="w-6 h-6" /></div><div className="space-y-3"><p className="text-sm font-bold leading-relaxed">{error}</p>{showLoginRedirect && (<div className="pt-2"><Link to="/login" className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"><LogIn className="w-3.5 h-3.5" /> Se connecter maintenant</Link></div>)}</div></div>)}
          <form onSubmit={handleRegister} className="space-y-6">
            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom Complet</label><div className="relative group"><User className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-brand-600 transition-colors" /><input type="text" required placeholder="Amadou Diallo" value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} className="w-full pl-14 pr-6 py-4 rounded-2xl border border-slate-100 bg-white focus:ring-4 focus:ring-brand-50 outline-none font-bold text-slate-700 transition-all" /></div></div>
            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Professionnel</label><div className="relative group"><Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-brand-600 transition-colors" /><input type="email" required placeholder="contact@agence.com" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full pl-14 pr-6 py-4 rounded-2xl border border-slate-100 bg-white focus:ring-4 focus:ring-brand-50 outline-none font-bold text-slate-700 transition-all" /></div></div>
            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mot de passe</label><div className="relative group"><Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-brand-600 transition-colors" /><input type="password" required placeholder="6 caractères minimum" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="w-full pl-14 pr-6 py-4 rounded-2xl border border-slate-100 bg-white focus:ring-4 focus:ring-brand-50 outline-none font-bold text-slate-700 transition-all" /></div></div>
            <div className="pt-4"><button type="submit" disabled={isLoading} className="w-full py-5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-brand-100 transition-all active:scale-[0.98] disabled:opacity-50">{isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>CRÉER MON COMPTE <ArrowRight className="w-4 h-4" /></>}</button></div>
          </form>
          <p className="mt-8 text-center text-sm font-medium text-slate-400">Déjà membre ? <Link to="/login" className="ml-2 text-brand-600 font-black uppercase text-[10px] tracking-widest hover:underline">Se connecter</Link></p>
        </div>
      </div>
    </div>
  );
};
export default RegisterAgency;
