import React from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/hooks/useAuth';
import { NotificationBell } from './NotificationBell';

export interface HeaderProps {
  onAddExpense?: () => void;
}

const titleMap: Record<string, string> = {
  '/': 'Dashboard Overview',
  '/dashboard': 'Dashboard Overview',
  '/expenses': 'Expenses',
  '/income': 'Income Streams',
  '/budgets': 'Budget & Spending Limits',
  '/categories': 'Categories Taxonomy',
  '/recurring': 'Recurring Expenses',
  '/settings': 'Account Settings',
};

export const Header: React.FC<HeaderProps> = ({ onAddExpense }) => {
  const location = useLocation();
  const { user } = useAuth();
  const currentTitle = titleMap[location.pathname] || 'Spending Book';

  return (
    <header className="h-16 border-b border-slate-100 bg-white/60 backdrop-blur-md sticky top-0 z-10 px-4 sm:px-8 flex items-center justify-between">
      <div>
        <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
          {currentTitle}
        </h1>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Currency Pill */}
        <Badge variant="neutral" className="hidden sm:inline-flex bg-slate-50 border-slate-200">
          <ShieldCheck className="w-3 h-3 text-emerald-600 mr-1" />
          <span>Base: {user?.baseCurrency || 'USD'}</span>
        </Badge>

        {/* Quick Action Button */}
        {onAddExpense && (
          <Button
            variant="primary"
            size="sm"
            onClick={onAddExpense}
            leftIcon={<Plus className="w-4 h-4" />}
            className="rounded-full shadow-sm"
          >
            <span className="hidden sm:inline">Add Expense</span>
            <span className="sm:hidden">Add</span>
          </Button>
        )}

        {/* Notification Bell */}
        <NotificationBell />
      </div>
    </header>
  );
};
