import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, CloudUpload, Ticket, History, Users, LogOut, Wallet, Settings, Building2, Zap, ChevronLeft, MapPin, Tag, X } from 'lucide-react';
import { NavItem, UserRole } from '../types.ts';
import { db } from '../services/db.ts';

interface SidebarProps { isOpen: boolean; setIsOpen: (isOpen: boolean) => void; }

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState<{ role: UserRole | null; fullName: string; agencyName: string; }>({ role: null, fullName: '', agencyName: '' });

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await db.auth.getUser();
      if (user) {
        const { data } = await db.from('users').select('role, full_name, tenants(name)').eq('id', user.id).maybeSingle();
        if (data) setUserInfo({ role: data.role as UserRole, fullName: data.full_name || 'Utilisateur', agencyName: (data.tenants as any)?.name || 'Hotspot Cloud' });
      }
    };
    getProfile();
  }, []);

  const handleLogout = async () => { 
      await db.auth.signOut(); 
      navigate('/');
  };

  const navItems: NavItem[] = [
    { label: 'Tableau de bord', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Guichet Vente', path: '/sales', icon: ShoppingCart },
    { label: 'Import CSV', path: '/import', icon: CloudUpload },
    { label: 'Gestion Stock', path: '/stock', icon: Ticket },
    { label: 'Historique', path: '/history', icon: History },
    { label: 'Zones WiFi', path: '/zones', icon: MapPin },
    { label: 'Forfaits', path: '/profiles', icon: Tag },
    { label: 'Revendeurs', path: '/resellers', icon: Wallet },
    { label: 'Utilisateurs', path: '/users', icon: Users },
    { label: 'Agences SaaS', path: '/agencies', icon: Building2 },
    { label: 'Abonnements', path: '/subscriptions', icon: Zap },
    { label: 'Paramètres', path: '/settings', icon: Settings },
  ];

  const filteredItems = navItems.filter(item => {
    if (userInfo.role === UserRole.ADMIN_GLOBAL) return !['/sales', '/profiles', '/import', '/zones'].includes(item.path);
    if (userInfo.role === UserRole.GESTIONNAIRE_WIFI_ZONE || userInfo.role === UserRole.ADMIN) return !['/agencies', '/subscriptions'].includes(item.path);
    if (userInfo.role === UserRole.REVENDEUR) return ['/dashboard', '/sales', '/history', '/stock'].includes(item.path);
    return ['/dashboard', '/sales', '/stock', '/history'].includes(item.path);
  });

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] lg:hidden animate-in fade-in" 
          onClick={() => setIsOpen(false)} 
        />
      )}
      
      {/* Sidebar Container */}
      <aside className={`fixed lg:sticky top-0 left-0 z-[70] h-full lg:h-screen w-[280px] bg-white border-r border-slate-200 transition-transform duration-300 ease-in-out flex flex-col shadow-2xl lg:shadow-none ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        
        {/* Header Branding */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => { navigate('/dashboard'); setIsOpen(false); }}>
                <div className="w-9 h-9 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm shrink-0">
                  {userInfo.agencyName.charAt(0)}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-slate-900 text-sm leading-tight tracking-tight truncate">{userInfo.agencyName}</span>
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Enterprise SaaS</span>
                </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="lg:hidden p-2 text-slate-400 hover:text-slate-700 bg-slate-50 rounded-lg">
              <X className="w-5 h-5" />
            </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1 custom-scrollbar">
          {filteredItems.map((item) => (
            <NavLink 
              key={item.path} 
              to={item.path} 
              onClick={() => setIsOpen(false)} 
              className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${isActive ? 'bg-brand-50 text-brand-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              <item.icon className={`w-5 h-5 ${ ({ isActive }:any) => isActive ? 'text-brand-600' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User Profile Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
           <div className="flex items-center gap-3 px-2">
              <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center text-slate-700 font-bold text-xs border border-slate-200 shadow-sm shrink-0">
                {userInfo.fullName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{userInfo.fullName}</p>
                <p className="text-[10px] text-slate-500 truncate capitalize font-medium">{userInfo.role?.replace(/_/g, ' ').toLowerCase()}</p>
              </div>
              <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Déconnexion">
                <LogOut className="w-5 h-5" />
              </button>
           </div>
        </div>
      </aside>
    </>
  );
};
export default Sidebar;