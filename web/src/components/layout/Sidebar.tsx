import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Receipt,
  ArrowDownLeft,
  PieChart,
  Tags,
  CalendarClock,
  Settings,
  Wallet,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Expenses', path: '/expenses', icon: Receipt },
  { label: 'Income', path: '/income', icon: ArrowDownLeft },
  { label: 'Budgets', path: '/budgets', icon: PieChart },
  { label: 'Categories', path: '/categories', icon: Tags },
  { label: 'Recurring', path: '/recurring', icon: CalendarClock },
  { label: 'Settings', path: '/settings', icon: Settings },
];

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-slate-100 bg-white/70 backdrop-blur-md h-screen sticky top-0 px-4 py-6 z-20">
      {/* Brand Logo & Name */}
      <div className="flex items-center gap-3 px-3 mb-8">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-primary-600 flex items-center justify-center text-white shadow-sm">
          <Wallet className="w-5 h-5" />
        </div>
        <div>
          <span className="text-base font-bold text-slate-900 tracking-tight block">
            Spending Book
          </span>
          <span className="text-[11px] font-medium text-slate-400 block -mt-0.5">
            Financial Tracking
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-primary-50 text-primary-700 shadow-subtle'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                )
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer / User Profile snippet */}
      <div className="pt-4 border-t border-slate-100 px-2">
        <div className="flex items-center gap-3 p-2 rounded-2xl bg-slate-50/80">
          <div className="w-8 h-8 rounded-full bg-pastel-blue text-slate-700 font-bold flex items-center justify-center text-xs shadow-subtle shrink-0">
            {user?.email?.charAt(0).toUpperCase() || user?.phoneNumber?.slice(-2) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold text-slate-800 block truncate" title={user?.phoneNumber || user?.email || undefined}>
              {user?.phoneNumber || user?.email || 'Authenticated User'}
            </span>
            <span className="text-[10px] text-slate-400 block truncate">Base: {user?.baseCurrency || 'USD'}</span>
          </div>
          <button
            onClick={() => logout()}
            className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-xl transition-colors shrink-0"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
