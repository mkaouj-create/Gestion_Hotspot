
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, Tag, Gift, ShieldCheck, CheckCircle2, Database, 
  ShoppingCart, BarChart3, Sparkles, ChevronDown, HelpCircle, 
  Plus, Minus, MessageCircle, Search, Ticket, Loader2, AlertCircle
} from 'lucide-react';
import { db } from '../services/db';

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const [lookupCode, setLookupCode] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupCode.trim() || isLookingUp) return;
    
    setIsLookingUp(true);
    setLookupError(null);
    setLookupResult(null);

    try {
      const { data, error } = await db.from('tickets')
        .select('username, status, sold_at, ticket_profiles(name)')
        .eq('username', lookupCode.trim())
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setLookupError("Code introuvable. Vérifiez la saisie.");
      } else {
        setLookupResult(data);
      }
    } catch (err: any) {
      setLookupError("Erreur technique. Réessayez plus tard.");
    } finally {
      setIsLookingUp(false);
    }
  };

  const whatsappMessage = encodeURIComponent("Bonjour, je souhaite avoir plus d'informations sur Gestion_Hotspot.");
  const whatsappUrl = `https://wa.me/224625976411?text=${whatsappMessage}`;

  return (
    <div className="bg-brand-950 min-h-screen font-sans selection:bg-brand-500 selection:text-white overflow-x-hidden relative">
      
      {/* FLOATING WHATSAPP */}
      <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="fixed bottom-6 right-6 z-[100] bg-[#25D366] text-white p-4 md:p-5 rounded-full shadow-2xl transition-transform hover:scale-110 active:scale-95 animate-in slide-in-from-bottom-10 duration-700">
        <MessageCircle className="w-6 h-6 md:w-7 md:h-7 fill-current" />
      </a>

      {/* Navigation */}
      <nav className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between relative z-50">
        <div className="flex items-center gap-4 group cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-11 h-11 bg-brand-500 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-brand-500/20">G</div>
          <span className="text-xl font-black text-white tracking-tighter">Gestion_Hotspot</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/login')} className="hidden sm:block text-[10px] font-black text-white px-8 py-3.5 rounded-2xl border border-white/10 hover:bg-white/5 tracking-widest uppercase transition-all">CONNEXION</button>
          <button onClick={() => navigate('/register-agency')} className="bg-white hover:bg-brand-50 text-brand-950 px-8 py-3.5 rounded-2xl font-black text-[10px] tracking-widest uppercase transition-all shadow-xl">CRÉER AGENCE</button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-40 px-6">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[600px] bg-brand-500/10 blur-[150px] rounded-full pointer-events-none"></div>
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
            <div className="bg-[#122A42] border border-brand-500/30 px-5 py-2.5 rounded-2xl flex items-center gap-2">
              <Tag className="w-4 h-4 text-brand-500" />
              <span className="text-[10px] font-black text-brand-100 uppercase tracking-widest">SaaS Multi-Utilisateurs</span>
            </div>
            <div className="bg-[#0E2E2A] border border-emerald-500/30 px-5 py-2.5 rounded-2xl flex items-center gap-2">
              <Gift className="w-4 h-4 text-emerald-500" />
              <span className="text-[10px] font-black text-emerald-100 uppercase tracking-widest">Essai Gratuit 30 Jours</span>
            </div>
          </div>

          <h1 className="text-5xl md:text-[9.5rem] font-black text-white leading-[0.9] tracking-tighter mb-8 animate-in slide-in-from-bottom-10 duration-1000">
            Digitalisez votre <br/> 
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-indigo-500">Business WiFi.</span>
          </h1>
          
          <p className="max-w-2xl mx-auto text-lg md:text-2xl text-[#8E9EAF] font-medium leading-relaxed mb-16">
            La solution cloud n°1 en Afrique pour gérer vos tickets MikroTik, automatiser vos revendeurs et sécuriser vos revenus.
          </p>

          <div className="flex flex-col md:flex-row items-center justify-center gap-6">
            <button onClick={() => navigate('/register-agency')} className="w-full md:w-auto bg-brand-500 hover:bg-brand-600 text-white px-16 py-7 rounded-[2.5rem] font-black text-sm tracking-widest uppercase transition-all shadow-2xl flex items-center justify-center gap-4 group">
              LANCER MON AGENCE <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </button>
            <div className="w-px h-12 bg-white/10 hidden md:block"></div>
            <a href="#lookup" className="text-white/60 hover:text-white font-black text-xs uppercase tracking-widest transition-colors flex items-center gap-2">
              VÉRIFIER UN TICKET <ChevronDown className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* LOOKUP SECTION (Public Access) */}
      <section id="lookup" className="bg-white py-32 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-slate-50 border border-slate-100 rounded-[4rem] p-10 md:p-20 text-center shadow-inner relative overflow-hidden">
            <div className="absolute top-0 right-0 p-10 opacity-[0.03] rotate-12 pointer-events-none">
              <Ticket className="w-64 h-64 text-slate-900" />
            </div>
            
            <div className="relative z-10 mb-12">
              <span className="text-[10px] font-black text-brand-600 uppercase tracking-[0.3em] mb-4 block">Espace Client Final</span>
              <h2 className="text-3xl md:text-6xl font-black text-slate-900 tracking-tighter uppercase mb-6">Vérifier mon ticket</h2>
              <p className="text-slate-400 font-medium text-sm md:text-lg max-w-lg mx-auto leading-relaxed">
                Entrez le code de votre voucher pour consulter sa validité et les détails de votre forfait.
              </p>
            </div>

            <form onSubmit={handleLookup} className="relative z-10 max-w-md mx-auto mb-10">
              <div className="relative group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-300 group-focus-within:text-brand-600 transition-colors" />
                <input 
                  type="text" 
                  placeholder="EX: MIK-8927-2" 
                  value={lookupCode}
                  onChange={e => setLookupCode(e.target.value.toUpperCase())}
                  className="w-full pl-16 pr-6 py-6 rounded-[2.5rem] border border-slate-100 bg-white shadow-xl focus:ring-8 focus:ring-brand-50 outline-none font-black text-slate-900 text-xl md:text-2xl placeholder:text-slate-200 transition-all text-center"
                />
              </div>
              <button 
                type="submit" 
                disabled={isLookingUp}
                className="w-full mt-6 py-6 bg-slate-900 hover:bg-black text-white rounded-[2.5rem] font-black uppercase text-xs tracking-[0.3em] shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                {isLookingUp ? <Loader2 className="w-6 h-6 animate-spin" /> : "VÉRIFIER LA VALIDITÉ"}
              </button>
            </form>

            {lookupError && (
              <div className="relative z-10 p-5 bg-red-50 border border-red-100 rounded-3xl text-red-600 font-black text-sm flex items-center justify-center gap-3 animate-in zoom-in-95">
                <AlertCircle className="w-5 h-5" /> {lookupError}
              </div>
            )}

            {lookupResult && (
              <div className="relative z-10 bg-white p-10 rounded-[3rem] shadow-2xl border border-emerald-100 animate-in zoom-in-95 text-left">
                <div className="flex items-center gap-4 mb-8">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${lookupResult.status === 'VENDU' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-2xl font-black text-slate-900 tracking-tight">{lookupResult.username}</h4>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lookupResult.ticket_profiles?.name}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6 border-t border-slate-50 pt-8">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Statut</p>
                    <span className={`inline-block px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${lookupResult.status === 'VENDU' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                      {lookupResult.status === 'VENDU' ? 'ACTIF / VALIDE' : 'NON ACTIVÉ'}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Activé le</p>
                    <p className="text-xs font-black text-slate-700">
                      {lookupResult.sold_at ? new Date(lookupResult.sold_at).toLocaleDateString('fr-FR') : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Rest of Landing Section... */}
      <section className="bg-brand-950 py-32 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
          <FeatureCard 
            icon={<Database />} title="GESTION CLOUD" 
            desc="Centralisez tous vos codes vouchers. Importez, suivez et contrôlez votre stock à distance." 
          />
          <FeatureCard 
            icon={<ShoppingCart />} title="VENTE MULTI-AGENTS" 
            desc="Créez des accès pour vos revendeurs. Ils vendent via l'app, vous touchez vos commissions." 
          />
          <FeatureCard 
            icon={<ShieldCheck />} title="SÉCURITÉ SAAS" 
            desc="Isolation multi-tenant. Vos données sont privées, sécurisées et accessibles 24/7." 
          />
        </div>
      </section>

      <footer className="bg-brand-950 py-20 border-t border-white/5 text-center">
        <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em]">© 2025 Gestion_Hotspot - Solution Pro pour ISP & WiFi Zones</p>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title, desc }: any) => (
  <div className="bg-white/5 border border-white/5 p-12 rounded-[3.5rem] hover:bg-white/10 transition-all group">
    <div className="w-16 h-16 bg-brand-500 rounded-2xl flex items-center justify-center text-white mb-8 group-hover:scale-110 transition-transform">
      {React.cloneElement(icon, { className: "w-8 h-8" })}
    </div>
    <h3 className="text-xl font-black text-white mb-4 uppercase tracking-tight">{title}</h3>
    <p className="text-slate-400 font-medium leading-relaxed">{desc}</p>
  </div>
);

export default Landing;
