
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { Clock, LogOut, ShieldCheck, CheckCircle2, RefreshCcw, AlertTriangle, Radio, MessageCircle } from 'lucide-react';

const PendingApproval: React.FC = () => {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const handleLogout = async () => { await db.auth.signOut(); navigate('/'); };

  // 1. Récupération initiale et vérification manuelle
  const checkStatus = async (manual = false) => {
    if (manual) setIsChecking(true);
    setToast(null);
    try {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { navigate('/'); return; }

      const { data, error } = await db.from('users').select('tenant_id, tenants(id, subscription_status)').eq('id', user.id).single();
      
      if (error) throw error;
      
      const tId = (data?.tenants as any)?.id;
      const status = (data?.tenants as any)?.subscription_status;

      if (tId) setTenantId(tId);

      if (status === 'ACTIF') {
        setToast({ type: 'success', message: "Compte validé ! Accès au Dashboard..." });
        setTimeout(() => window.location.href = '/#/dashboard', 1500); // Force reload via href pour être sûr
        setTimeout(() => window.location.reload(), 1600);
      } else if (manual) {
        setToast({ type: 'error', message: "Toujours en attente. Merci de patienter." }); 
        setTimeout(() => setIsChecking(false), 500);
      }
    } catch (err) { 
      console.error(err); 
      if (manual) {
        setToast({ type: 'error', message: "Erreur de connexion serveur." }); 
        setIsChecking(false);
      }
    }
  };

  const handleContactSupport = () => {
    // Numéro de l'admin global (support)
    const adminNumber = "224625976411"; 
    const message = encodeURIComponent("Bonjour, mon agence est en attente de validation. Pouvez-vous vérifier ?");
    window.open(`https://wa.me/${adminNumber}?text=${message}`, '_blank');
  };

  useEffect(() => {
    checkStatus();
  }, []);

  // 2. Écoute Temps Réel (Realtime) : Le client est notifié instantanément
  useEffect(() => {
    if (!tenantId) return;

    console.log("Écoute des changements pour le tenant:", tenantId);

    const subscription = db
      .channel(`agency-validation-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tenants',
          filter: `id=eq.${tenantId}`,
        },
        (payload) => {
          console.log('Changement détecté:', payload);
          const newStatus = payload.new.subscription_status;
          if (newStatus === 'ACTIF') {
            setToast({ type: 'success', message: "🎉 VALIDATION REÇUE ! Redirection..." });
            // Petit délai pour laisser l'utilisateur lire le message de succès
            setTimeout(() => {
               window.location.href = '/#/dashboard';
               window.location.reload();
            }, 2000);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [tenantId]);

  return (
    <div className="min-h-screen bg-brand-950 flex items-center justify-center p-6 font-sans relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden"><div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-brand-600 rounded-full blur-[150px] opacity-10"></div><div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600 rounded-full blur-[120px] opacity-10"></div></div>
      {toast && (<div className={`fixed top-6 right-6 z-[100] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right border ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>{toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}<p className="font-bold text-sm">{toast.message}</p></div>)}
      
      <div className="w-full max-w-lg bg-white rounded-[3.5rem] shadow-2xl p-12 text-center relative z-10 animate-in zoom-in-95 duration-500">
        <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 bg-orange-50 rounded-full animate-ping opacity-75"></div>
            <div className="relative w-24 h-24 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center shadow-inner">
                <Clock className="w-10 h-10" />
            </div>
            {tenantId && (
                <div className="absolute -bottom-2 -right-2 bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full flex items-center gap-1 shadow-sm border border-emerald-200 animate-bounce">
                    <Radio className="w-3 h-3" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Live</span>
                </div>
            )}
        </div>
        
        <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-4 uppercase">
          Validation en cours
        </h1>
        
        <p className="text-slate-400 font-medium mb-10 text-sm leading-relaxed px-4">
          Votre demande est en cours d'examen par l'équipe Master. <br/>
          <span className="text-brand-600 font-bold">Gardez cette page ouverte</span>, vous serez redirigé automatiquement dès validation.
        </p>

        <div className="space-y-4">
          <button 
            onClick={() => checkStatus(true)} 
            disabled={isChecking}
            className="w-full py-5 bg-brand-600 hover:bg-brand-700 text-white rounded-[2rem] font-black text-xs tracking-[0.2em] uppercase shadow-xl shadow-brand-200 transition-all transform active:scale-95 flex items-center justify-center gap-3"
          >
            <RefreshCcw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            VÉRIFIER MAINTENANT
          </button>

          <button 
            onClick={handleContactSupport}
            className="w-full py-5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-[2rem] font-black text-xs tracking-[0.2em] uppercase shadow-xl shadow-emerald-200 transition-all transform active:scale-95 flex items-center justify-center gap-3"
          >
            <MessageCircle className="w-4 h-4" />
            CONTACTER L'ADMIN
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
          <span className="text-[10px] font-black uppercase tracking-widest">CONNEXION SÉCURISÉE SSL</span>
        </div>
      </div>
    </div>
  );
};

export default PendingApproval;
