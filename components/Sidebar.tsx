
import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, CloudUpload, Ticket, History, Users, LogOut, Wallet, Settings, Building2, Zap, ChevronLeft, MapPin, Tag, ChevronRight } from 'lucide-react';
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

  const handleLogout = async () => { await db.auth.signOut(); window.location.href = '/'; };

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
    if (userInfo.role === UserRole.REVENDEUR) return ['/dashboard', '/sales', '/history', '/stock', '/settings'].includes(item.path);
    return ['/dashboard', '/sales', '/stock', '/history'].includes(item.path);
  });

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] md:hidden animate-in fade-in" onClick={() => setIsOpen(false)} />}
      <aside className={`fixed md:sticky top-0 left-0 z-[70] h-screen w-80 bg-white border-r border-slate-100 transition-all duration-500 ease-in-out flex flex-col shadow-2xl md:shadow-none ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-10 flex items-center justify-between">
            <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('/dashboard')}>
                <div className="w-12 h-12 bg-brand-600 rounded-[1.25rem] flex items-center justify-center text-white font-black text-xl shadow-xl shadow-brand-200">{userInfo.agencyName.charAt(0)}</div>
                <div><h1 className="text-xl font-black text-slate-900 tracking-tighter leading-none">Hotspot<span className="text-brand-600">.</span></h1><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1.5">Pro Cloud</p></div>
            </div>
            <button onClick={() => setIsOpen(false)} className="md:hidden p-3 bg-slate-50 rounded-2xl text-slate-400"><ChevronLeft /></button>
        </div>
        <nav className="flex-1 overflow-y-auto px-6 space-y-1 custom-scrollbar">
          {filteredItems.map((item) => (
            <NavLink key={item.path} to={item.path} onClick={() => setIsOpen(false)} className={({ isActive }) => `flex items-center justify-between px-5 py-4 rounded-[1.5rem] transition-all font-bold text-sm group ${isActive ? 'bg-brand-600 text-white shadow-2xl shadow-brand-100 scale-105' : 'text-slate-500 hover:bg-brand-50 hover:text-brand-600'}`}>
              <div className="flex items-center gap-4"><item.icon className="w-5 h-5 opacity-80 group-hover:scale-110 transition-transform" /><span className="tracking-tight">{item.label}</span></div>
              <ChevronRight className="w-4 h-4 opacity-20" />
            </NavLink>
          ))}
        </nav>
        <div className="p-8 border-t border-slate-50 mt-auto">
           <div className="bg-slate-50 p-5 rounded-[2rem] flex items-center gap-4 border border-slate-100 shadow-inner group">
              <div className="w-11 h-11 bg-white rounded-2xl flex items-center justify-center text-brand-600 font-black shadow-sm group-hover:rotate-12 transition-transform">{userInfo.fullName.charAt(0)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-slate-900 truncate tracking-tight">{userInfo.fullName}</p>
                <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{userInfo.role?.replace(/_/g, ' ')}</p></div>
              </div>
              <button onClick={handleLogout} className="p-3 text-slate-300 hover:text-red-500 hover:bg-white rounded-xl transition-all shadow-sm"><LogOut className="w-4 h-4" /></button>
           </div>
        </div>
      </aside>
    </>
  );
};
export default Sidebar;
