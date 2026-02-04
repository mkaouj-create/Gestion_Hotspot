
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { Clock, LogOut, ShieldCheck, CheckCircle2, RefreshCcw, AlertTriangle } from 'lucide-react';

const PendingApproval: React.FC = () => {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const handleLogout = async () => { await db.auth.signOut(); navigate('/'); };

  const handleCheckStatus = async () => {
    setIsChecking(true); setToast(null);
    try {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { navigate('/'); return; }
      const { data, error } = await db.from('users').select('tenants(subscription_status)').eq('id', user.id).single();
      if (error) throw error;
      const status = (data?.tenants as any)?.subscription_status;
      if (status === 'ACTIF') {
        setToast({ type: 'success', message: "Compte validé ! Accès au Dashboard..." });
        setTimeout(() => window.location.reload(), 1500);
      } else { setToast({ type: 'error', message: "Toujours en attente. Merci de patienter." }); setTimeout(() => setIsChecking(false), 500); }
    } catch (err) { console.error(err); setToast({ type: 'error', message: "Erreur de connexion serveur." }); setIsChecking(false); }
  };

  return (
    <div className="min-h-screen bg-brand-950 flex items-center justify-center p-6 font-sans relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden"><div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-brand-600 rounded-full blur-[150px] opacity-10"></div><div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600 rounded-full blur-[120px] opacity-10"></div></div>
      {toast && (<div className={`fixed top-6 right-6 z-[100] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right border ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>{toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}<p className="font-bold text-sm">{toast.message}</p></div>)}
      
      <div className="w-full max-w-lg bg-white rounded-[3.5rem] shadow-2xl p-12 text-center relative z-10 animate-in zoom-in-95 duration-500">
        <div className="w-24 h-24 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner animate-pulse">
          <Clock className="w-10 h-10" />
        </div>
        
        <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-4 uppercase">
          Validation en cours
        </h1>
        
        <p className="text-slate-400 font-medium mb-10 text-sm leading-relaxed px-4">
          Votre demande de création d'agence est en cours d'examen par l'équipe Master. Vous recevrez une notification dès validation.
        </p>

        <div className="space-y-4">
          <button 
            onClick={handleCheckStatus} 
            disabled={isChecking}
            className="w-full py-5 bg-brand-600 hover:bg-brand-700 text-white rounded-[2rem] font-black text-xs tracking-[0.2em] uppercase shadow-xl shadow-brand-200 transition-all transform active:scale-95 flex items-center justify-center gap-3"
          >
            <RefreshCcw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            VÉRIFIER LE STATUT
          </button>
          
          <button 
            onClick={handleLogout}
            className="w-full py-5 bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-[2rem] font-black text-xs tracking-[0.2em] uppercase transition-colors flex items-center justify-center gap-3"
          >
            <LogOut className="w-4 h-4" />
            DÉCONNEXION
          </button>
        </div>

        <div className="mt-10 pt-10 border-t border-slate-50 flex items-center justify-center gap-2 text-slate-300">
          <ShieldCheck className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-widest">SÉCURITÉ SAAS</span>
        </div>
      </div>
    </div>
  );
};

export default PendingApproval;
