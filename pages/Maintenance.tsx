
import React from 'react';
import { AlertTriangle, Clock, Hammer, Smartphone } from 'lucide-react';

const Maintenance: React.FC = () => {
  const handleSupport = () => {
    window.open(`https://wa.me/224625976411`, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-orange-600 rounded-full blur-[150px] opacity-10"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-red-600 rounded-full blur-[120px] opacity-10"></div>
      </div>

      <div className="w-full max-w-lg bg-slate-800/50 backdrop-blur-xl border border-white/10 rounded-[3.5rem] shadow-2xl p-12 text-center relative z-10 animate-in zoom-in-95 duration-500">
        
        <div className="relative w-28 h-28 mx-auto mb-10">
            <div className="absolute inset-0 bg-orange-500 rounded-full animate-ping opacity-20"></div>
            <div className="relative w-28 h-28 bg-gradient-to-br from-orange-400 to-red-500 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-orange-900/50">
                <Hammer className="w-12 h-12 text-white" />
            </div>
        </div>
        
        <h1 className="text-4xl font-black text-white tracking-tight mb-4 uppercase">
          Maintenance
        </h1>
        
        <div className="w-16 h-1.5 bg-orange-500 rounded-full mx-auto mb-8"></div>

        <p className="text-slate-300 font-medium mb-10 text-lg leading-relaxed px-2">
          Nous effectuons une mise à jour critique de l'infrastructure SaaS pour améliorer vos performances.
        </p>

        <div className="bg-slate-900/50 rounded-3xl p-6 border border-white/5 mb-10">
            <div className="flex items-center gap-4 mb-2">
                <Clock className="w-5 h-5 text-orange-400" />
                <span className="text-sm font-black text-white uppercase tracking-widest">Temps estimé</span>
            </div>
            <p className="text-left text-slate-400 text-sm">Le service sera rétabli dans quelques instants. Merci de votre patience.</p>
        </div>

        <button 
          onClick={() => window.location.reload()}
          className="w-full py-5 bg-white hover:bg-slate-200 text-slate-900 rounded-[2rem] font-black text-xs tracking-[0.2em] uppercase shadow-xl transition-all transform active:scale-95 flex items-center justify-center gap-3 mb-4"
        >
          ACTUALISER LA PAGE
        </button>
        
        <button 
          onClick={handleSupport}
          className="w-full py-4 text-slate-500 hover:text-white font-black text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
        >
          <Smartphone className="w-4 h-4" />
          CONTACTER LE SUPPORT
        </button>
      </div>
    </div>
  );
};

export default Maintenance;
