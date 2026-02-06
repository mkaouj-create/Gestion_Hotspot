import React, { useState, useEffect, Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Menu, Loader2 } from 'lucide-react';
import { db } from './services/db';

const Sidebar = lazy(() => import('./components/Sidebar'));
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Sales = lazy(() => import('./pages/Sales'));
const Import = lazy(() => import('./pages/Import'));
const Stock = lazy(() => import('./pages/Stock'));
const History = lazy(() => import('./pages/History'));
const Agencies = lazy(() => import('./pages/Agencies'));
const Users = lazy(() => import('./pages/Users'));
const Resellers = lazy(() => import('./pages/Resellers'));
const Settings = lazy(() => import('./pages/Settings'));
const CompleteSetup = lazy(() => import('./pages/CompleteSetup'));
const RegisterAgency = lazy(() => import('./pages/RegisterAgency'));
const Subscriptions = lazy(() => import('./pages/Subscriptions'));
const Zones = lazy(() => import('./pages/Zones'));
const Profiles = lazy(() => import('./pages/Profiles'));
const PendingApproval = lazy(() => import('./pages/PendingApproval'));
const Maintenance = lazy(() => import('./pages/Maintenance'));

const GlobalLoader = () => (
  <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8fafc]">
    <div className="relative"><div className="w-16 h-16 border-4 border-brand-100 border-t-brand-600 rounded-full animate-spin"></div></div>
    <p className="mt-6 text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Chargement Cloud...</p>
  </div>
);

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden">
        <Suspense fallback={null}><Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} /></Suspense>
        
        <div className="flex-1 flex flex-col h-full overflow-hidden relative w-full">
          {/* Mobile Header */}
          <header className="lg:hidden bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between shrink-0 z-30 sticky top-0">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-black">G</div>
                <span className="font-black text-sm tracking-tight">Gestion_Hotspot</span>
            </div>
            <button onClick={() => setSidebarOpen(true)} className="p-2 bg-slate-50 rounded-xl text-slate-600 hover:bg-slate-100 active:scale-95 transition-all">
                <Menu className="w-6 h-6" />
            </button>
          </header>

          <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-10 custom-scrollbar relative z-10 w-full">
            <div className="max-w-7xl mx-auto h-full pb-24 lg:pb-10">
              <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-slate-200" /></div>}>
                  {children}
              </Suspense>
            </div>
          </main>
        </div>
    </div>
  );
};

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authState, setAuthState] = useState<{ hasTenant: boolean; isPending: boolean; isAdminGlobal: boolean; }>({ hasTenant: false, isPending: false, isAdminGlobal: false });
  const [isMaintenance, setIsMaintenance] = useState(false);

  const syncProfile = async (userId: string) => {
    try {
      // 1. Vérifier le mode maintenance global
      const { data: config } = await db.from('saas_settings').select('is_maintenance_mode').maybeSingle();
      const maintenanceActive = config?.is_maintenance_mode || false;
      setIsMaintenance(maintenanceActive);

      // 2. Récupérer le profil utilisateur
      const { data } = await db.from('users').select('*').eq('id', userId).maybeSingle();
      
      if (data) {
        let subStatus = 'ACTIF';
        if (data.tenant_id) {
            const { data: t } = await db.from('tenants').select('*').eq('id', data.tenant_id).maybeSingle();
            if (t) subStatus = t.subscription_status;
        }
        setAuthState({ hasTenant: !!data.tenant_id, isPending: subStatus === 'EN_ATTENTE', isAdminGlobal: data.role === 'ADMIN_GLOBAL' });
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => {
    // Initial fetch
    db.auth.getUser().then(({ data: { user } }) => {
      setSession(user ? { user } : null);
      if (user) syncProfile(user.id); else setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = db.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            setSession(null);
            setAuthState({ hasTenant: false, isPending: false, isAdminGlobal: false });
            setLoading(false);
        } else if (session?.user) {
            setSession({ user: session.user });
            syncProfile(session.user.id);
        }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <GlobalLoader />;

  // LOGIQUE DE BLOCAGE MAINTENANCE
  // Si maintenance active ET utilisateur connecté ET n'est pas Admin Global => Blocage
  if (session && isMaintenance && !authState.isAdminGlobal) {
    return <Maintenance />;
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={!session ? <Landing /> : <Navigate to="/dashboard" replace />} />
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/dashboard" replace />} />
        <Route path="/register-agency" element={!session ? <RegisterAgency /> : <Navigate to="/dashboard" replace />} />
        {session ? (
          <>
            <Route path="/complete-setup" element={(!authState.hasTenant && !authState.isAdminGlobal) ? <CompleteSetup onSetupComplete={() => session?.user && syncProfile(session.user.id)} /> : <Navigate to="/dashboard" replace />} />
            <Route path="/pending" element={authState.isPending ? <PendingApproval /> : <Navigate to="/dashboard" replace />} />
            <Route path="/*" element={
              (authState.isAdminGlobal || (authState.hasTenant && !authState.isPending)) ? (
                <AppLayout>
                  <Routes>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/sales" element={<Sales />} />
                    <Route path="/import" element={<Import />} />
                    <Route path="/stock" element={<Stock />} />
                    <Route path="/history" element={<History />} />
                    <Route path="/agencies" element={<Agencies />} />
                    <Route path="/users" element={<Users />} />
                    <Route path="/resellers" element={<Resellers />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/subscriptions" element={<Subscriptions />} />
                    <Route path="/zones" element={<Zones />} />
                    <Route path="/profiles" element={<Profiles />} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </AppLayout>
              ) : ( <Navigate to={!authState.hasTenant ? "/complete-setup" : "/pending"} replace /> )
            } />
          </>
        ) : ( <Route path="*" element={<Navigate to="/login" replace />} /> )}
      </Routes>
    </HashRouter>
  );
};
export default App;