import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Ticket, Menu } from 'lucide-react';

interface BottomNavProps {
  setSidebarOpen: (isOpen: boolean) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ setSidebarOpen }) => {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 flex justify-around items-center py-3 px-2 z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] safe-area-pb">
      <NavLink 
        to="/dashboard" 
        className={({ isActive }) => `flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${isActive ? 'text-brand-600 bg-brand-50' : 'text-slate-400 hover:text-slate-600'}`}
      >
        <LayoutDashboard className="w-6 h-6" />
        <span className="text-[10px] font-bold uppercase tracking-wide">Accueil</span>
      </NavLink>
      
      <NavLink 
        to="/sales" 
        className={({ isActive }) => `flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${isActive ? 'text-brand-600 bg-brand-50' : 'text-slate-400 hover:text-slate-600'}`}
      >
        <ShoppingCart className="w-6 h-6" />
        <span className="text-[10px] font-bold uppercase tracking-wide">Vente</span>
      </NavLink>

      <div className="relative -top-6">
        <NavLink 
            to="/stock"
            className="flex items-center justify-center w-14 h-14 bg-brand-600 rounded-full text-white shadow-lg shadow-brand-200 hover:scale-105 active:scale-95 transition-all border-4 border-[#f8fafc]"
        >
            <Ticket className="w-6 h-6" />
        </NavLink>
      </div>

      <NavLink 
        to="/history" 
        className={({ isActive }) => `flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${isActive ? 'text-brand-600 bg-brand-50' : 'text-slate-400 hover:text-slate-600'}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12"/></svg>
        <span className="text-[10px] font-bold uppercase tracking-wide">Historique</span>
      </NavLink>

      <button 
        onClick={() => setSidebarOpen(true)}
        className="flex flex-col items-center gap-1 p-2 rounded-xl text-slate-400 hover:text-slate-600 active:bg-slate-50 transition-all"
      >
        <Menu className="w-6 h-6" />
        <span className="text-[10px] font-bold uppercase tracking-wide">Menu</span>
      </button>
    </nav>
  );
};

export default BottomNav;
