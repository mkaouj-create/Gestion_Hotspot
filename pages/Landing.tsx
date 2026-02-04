
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  Tag, 
  Gift,
  ShieldCheck,
  CheckCircle2,
  Database,
  ShoppingCart,
  BarChart3,
  Sparkles,
  ChevronDown,
  HelpCircle,
  Plus,
  Minus,
  MessageCircle
} from 'lucide-react';

const Landing: React.FC = () => {
  const navigate = useNavigate();

  // Message pré-rempli pour WhatsApp
  const whatsappMessage = encodeURIComponent("Bonjour, je souhaite avoir plus d'informations sur Gestion_Hotspot.");
  const whatsappUrl = `https://wa.me/224625976411?text=${whatsappMessage}`;

  return (
    <div className="bg-brand-950 min-h-screen font-sans selection:bg-brand-500 selection:text-white overflow-x-hidden relative">
      
      {/* FLOATING WHATSAPP BUTTON - PILL SHAPE WITH TEXT */}
      <a 
        href={whatsappUrl}
        target="_blank" 
        rel="noopener noreferrer"
        className="fixed bottom-8 right-8 z-[100] bg-[#25D366] hover:bg-[#20bd5a] text-white px-6 py-4 rounded-full shadow-2xl flex items-center justify-center gap-3 transition-transform hover:scale-105 group animate-in slide-in-from-bottom-10 duration-700"
      >
        <MessageCircle className="w-6 h-6 fill-current" />
        <span className="text-xs font-black uppercase tracking-widest">SUPPORT WHATSAPP</span>
      </a>

      {/* Navigation */}
      <nav className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between relative z-50">
        <div className="flex items-center gap-4 group cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-11 h-11 bg-brand-500 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-brand-500/20">
            G
          </div>
          <span className="text-xl font-black text-white tracking-tighter">Gestion_Hotspot</span>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/login')}
            className="hidden sm:block text-[10px] font-black text-white px-6 py-3 rounded-xl border border-white/10 hover:bg-white/5 tracking-widest uppercase transition-all"
          >
            CONNEXION
          </button>
          <button 
            onClick={() => navigate('/register-agency')}
            className="bg-brand-500 hover:bg-brand-600 text-white px-8 py-3.5 rounded-2xl font-black text-[10px] tracking-widest uppercase transition-all shadow-xl shadow-brand-500/30"
          >
            DÉMARRER
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-40 px-6 overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-brand-500/10 blur-[120px] rounded-full pointer-events-none"></div>
        
        <div className="max-w-5xl mx-auto text-center relative z-10">
          {/* Badges */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
            <div className="flex items-center gap-2 bg-[#122A42] border border-brand-500/30 px-5 py-2.5 rounded-2xl">
              <Tag className="w-4 h-4 text-brand-500" />
              <span className="text-[10px] font-black text-brand-100 uppercase tracking-widest">TARIFS DISPONIBLES</span>
            </div>
            <div className="flex items-center gap-2 bg-[#0E2E2A] border border-emerald-500/30 px-5 py-2.5 rounded-2xl">
              <Gift className="w-4 h-4 text-emerald-500" />
              <span className="text-[10px] font-black text-emerald-100 uppercase tracking-widest">30 JOURS D'ESSAI</span>
            </div>
          </div>

          {/* Headline Container */}
          <div className="mb-12">
            <div className="inline-block bg-brand-500 text-white px-8 py-2 transform -rotate-1 mb-4">
              <span className="text-4xl md:text-7xl font-black uppercase tracking-tight">Digitalisez votre</span>
            </div>
            <h1 className="text-[5rem] md:text-[9.5rem] font-black text-white leading-[0.85] tracking-tight mb-4">
              Business
            </h1>
            <div className="text-4xl md:text-7xl font-black text-[#5C718A] tracking-tight">
              WiFi Zone<span className="text-brand-500">.</span>
            </div>
          </div>
          
          {/* Subheadline with underline */}
          <div className="max-w-3xl mx-auto mb-20">
            <p className="text-xl md:text-2xl text-[#8E9EAF] font-medium leading-relaxed mb-1">
              La plateforme cloud pour automatiser vos ventes et booster votre chiffre d'affaires. 
            </p>
            <div className="relative inline-block">
              <span className="text-xl md:text-2xl text-white font-black leading-relaxed">
                Gérez votre stock de tickets MikroTik en temps réel.
              </span>
              <div className="absolute -bottom-2 left-0 w-full h-1.5 bg-brand-500 rounded-full opacity-80"></div>
            </div>
          </div>

          {/* Main CTA */}
          <button 
            onClick={() => navigate('/register-agency')}
            className="group bg-white hover:bg-brand-50 text-slate-900 px-16 py-7 rounded-[2.5rem] font-black text-sm tracking-[0.2em] uppercase transition-all shadow-2xl flex items-center gap-4 mx-auto transform hover:scale-[1.03] active:scale-[0.98]"
          >
            LANCER MON AGENCE
            <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white py-32 px-6">
        <div className="max-w-7xl mx-auto text-center mb-24">
          <div className="flex items-center justify-center gap-2 text-brand-500 mb-4">
            <Sparkles className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Excellence opérationnelle</span>
          </div>
          <h2 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tight mb-6">DOMINEZ VOTRE MARCHÉ</h2>
          <p className="text-slate-400 font-medium text-lg max-w-2xl mx-auto">
            Optimisé pour les environnements à faible bande passante, Gestion_Hotspot est l'allié numéro 1 des gérants en Afrique.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-7xl mx-auto">
          <LandingFeatureCard 
            icon={<Database className="w-7 h-7" />}
            title="STOCK CLOUD"
            description="Importez vos fichiers .CSV MikroTik en 2 secondes. Vos vouchers sont sécurisés et accessibles partout."
          />
          <LandingFeatureCard 
            icon={<ShoppingCart className="w-7 h-7" />}
            title="GUICHET RAPIDE"
            description="Vendez des tickets depuis votre mobile. Générez des reçus WhatsApp et QR codes instantanément."
          />
          <LandingFeatureCard 
            icon={<BarChart3 className="w-7 h-7" />}
            title="REPORTING LIVE"
            description="Suivez vos recettes, contrôlez vos vendeurs et analysez vos meilleures zones depuis un seul dashboard."
          />
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-brand-950 py-32 px-6 relative overflow-hidden">
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-brand-500 rounded-full blur-[150px] opacity-10 -mr-48 -mb-48"></div>
        
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full mb-6">
              <HelpCircle className="w-4 h-4 text-brand-500" />
              <span className="text-[10px] font-black text-brand-100 uppercase tracking-widest">Questions Fréquentes</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight mb-6 uppercase">
              Tout ce que vous <br className="hidden md:block" /> devez savoir
            </h2>
            <p className="text-[#8E9EAF] font-medium max-w-xl mx-auto">
              Vous avez des doutes ? Voici les réponses aux questions les plus posées par nos partenaires.
            </p>
          </div>

          <div className="space-y-4">
            <FAQItem 
              question="Est-ce compatible avec tous les routeurs MikroTik ?"
              answer="Oui. Tant que votre routeur peut générer ou exporter une liste de vouchers au format CSV (ou texte), Gestion_Hotspot peut les importer. Nous supportons tous les profils (Heure, Jour, Semaine, Volume)."
            />
            <FAQItem 
              question="Comment fonctionne le système de revendeurs ?"
              answer="C'est un système de solde prépayé. Vous (le gérant) créditez le compte d'un revendeur. À chaque vente effectuée par le revendeur via l'application, le montant du ticket est automatiquement déduit de son solde. C'est simple, transparent et sans risque."
            />
            <FAQItem 
              question="Que se passe-t-il en cas de coupure internet ?"
              answer="Gestion_Hotspot est optimisé pour les zones à faible connectivité. Bien que le cloud nécessite une connexion pour synchroniser les ventes, l'interface est ultra-légère pour fonctionner même avec une connexion 2G instable."
            />
            <FAQItem 
              question="Mes tickets sont-ils sécurisés ?"
              answer="Absolument. Vos tickets sont stockés dans une base de données isolée et cryptée. Seuls vous et les agents autorisés pouvez y accéder. Une fois un ticket vendu, il est marqué comme tel et ne peut plus être revendu."
            />
            <FAQItem 
              question="Y a-t-il des frais mensuels ?"
              answer="Actuellement, vous bénéficiez d'un essai gratuit de 30 jours pour tester toutes les fonctionnalités. Ensuite, un abonnement mensuel abordable sera mis en place pour garantir la maintenance du service cloud."
            />
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="bg-slate-50 py-32 px-6 border-y border-slate-100">
        <div className="max-w-4xl mx-auto bg-brand-950 p-16 rounded-[4rem] text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-32 h-32 bg-brand-500 rounded-full blur-[80px] opacity-20 -ml-16 -mt-16"></div>
          <h3 className="text-3xl md:text-5xl font-black text-white mb-8 tracking-tight uppercase">Prêt à dominer votre WiFi Zone ?</h3>
          <p className="text-slate-400 font-medium mb-12">Rejoignez des centaines de gérants qui ont déjà automatisé leur business.</p>
          <button 
            onClick={() => navigate('/register-agency')}
            className="bg-brand-500 hover:bg-brand-600 text-white px-12 py-5 rounded-2xl font-black text-xs tracking-widest uppercase transition-all shadow-xl shadow-brand-500/20"
          >
            DÉMARRER L'ESSAI GRATUIT
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-brand-950 py-16 px-6 text-center border-t border-white/5">
        <div className="flex flex-col items-center justify-center mb-8">
           <div className="flex items-center gap-3 mb-6 opacity-50">
             <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-white font-black">G</div>
             <span className="text-sm font-black text-white tracking-tighter">Gestion_Hotspot</span>
           </div>
           
           <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 px-6 py-3 rounded-2xl transition-all group">
              <MessageCircle className="w-4 h-4 text-[#25D366]" />
              <span className="text-xs font-black text-slate-300 group-hover:text-white uppercase tracking-widest">Support WhatsApp</span>
           </a>
        </div>

        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
          © 2025 Gestion_Hotspot AI. TOUS DROITS RÉSERVÉS.
        </p>
      </footer>
    </div>
  );
};

// FAQ Item Sub-component
const FAQItem = ({ question, answer }: { question: string, answer: string }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div 
      className={`bg-white/5 border border-white/5 rounded-[2rem] overflow-hidden transition-all duration-300 ${isOpen ? 'border-brand-500/30 bg-white/[0.07]' : 'hover:bg-white/[0.08]'}`}
    >
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-8 py-7 flex items-center justify-between text-left gap-4"
      >
        <span className="text-lg font-black text-white tracking-tight leading-tight">{question}</span>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isOpen ? 'bg-brand-500 text-white rotate-180' : 'bg-white/10 text-white/40'}`}>
          {isOpen ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </div>
      </button>
      
      <div 
        className={`px-8 transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 pb-8 opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <p className="text-[#8E9EAF] font-medium leading-relaxed text-sm">
          {answer}
        </p>
      </div>
    </div>
  );
};

// Feature Card Sub-component
const LandingFeatureCard = ({ icon, title, description }: any) => (
  <div className="bg-slate-50/50 p-12 rounded-[3.5rem] border border-slate-100 hover:border-brand-500/20 hover:bg-white hover:shadow-2xl transition-all group text-left">
    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-brand-500 shadow-sm mb-8 group-hover:scale-110 group-hover:bg-brand-500 group-hover:text-white transition-all">
      {icon}
    </div>
    <h3 className="text-xl font-black text-slate-900 mb-6 tracking-tight uppercase">{title}</h3>
    <p className="text-sm text-slate-400 font-medium leading-relaxed">
      {description}
    </p>
  </div>
);

export default Landing;
