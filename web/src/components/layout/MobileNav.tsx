import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Receipt, ArrowDownLeft, PieChart, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

export const MobileNav: React.FC = () => {
  const navItems = [
    { label: 'Home', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Expenses', path: '/expenses', icon: Receipt },
    { label: 'Income', path: '/income', icon: ArrowDownLeft },
    { label: 'Budgets', path: '/budgets', icon: PieChart },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-lg border-t border-slate-100 flex items-center justify-around px-2 z-30 shadow-elevated">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-1 w-14 py-1 rounded-xl text-[10px] font-medium transition-colors',
                isActive ? 'text-primary-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              )
            }
          >
            <Icon className="w-5 h-5" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};
