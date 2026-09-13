import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bell, AlertTriangle, AlertCircle, Calendar, Check } from 'lucide-react';
import { recurringApi } from '@/services/api/recurringApi';
import { budgetApi } from '@/services/api/budgetApi';
import { getTodayDateString, getCurrentMonthString } from '@/utils/date';

interface WebNotificationAlert {
  id: string;
  type: 'BILL_DUE' | 'BUDGET_WARNING' | 'BUDGET_EXCEEDED';
  title: string;
  message: string;
  link: string;
  severity: 'warning' | 'danger' | 'info';
}

export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const today = getTodayDateString();
  const currentMonth = getCurrentMonthString();

  // 1. Fetch recurring expenses
  const { data: recurringList } = useQuery({
    queryKey: ['recurring'],
    queryFn: () => recurringApi.getRecurring(),
    staleTime: 60000,
  });

  // 2. Fetch budget overview for current month
  const { data: budgetOverview } = useQuery({
    queryKey: ['budgets', currentMonth],
    queryFn: () => budgetApi.getBudgets(currentMonth),
    staleTime: 60000,
  });

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Compute active alerts
  const alerts: WebNotificationAlert[] = [];

  // Check recurring bills due today
  if (recurringList) {
    for (const item of recurringList) {
      if (item.isActive && item.nextDueDate === today) {
        alerts.push({
          id: `rec_${item.id}_${today}`,
          type: 'BILL_DUE',
          title: 'Bill Due Today',
          message: `Scheduled payment for "${item.title}" ($${Number(item.amount).toFixed(2)}) is due today.`,
          link: '/recurring',
          severity: 'info',
        });
      }
    }
  }

  // Check budget limits
  if (budgetOverview?.overallBudget) {
    const { percentageUsed, remaining } = budgetOverview.overallBudget;
    const numericPercent = Number(percentageUsed) || 0;

    if (numericPercent >= 100) {
      alerts.push({
        id: `budget_overall_${currentMonth}_exceeded`,
        type: 'BUDGET_EXCEEDED',
        title: 'Budget Ceiling Exceeded',
        message: `You have exceeded your monthly budget ceiling by ${(numericPercent - 100).toFixed(0)}%.`,
        link: '/budgets',
        severity: 'danger',
      });
    } else if (numericPercent >= 80) {
      alerts.push({
        id: `budget_overall_${currentMonth}_warning`,
        type: 'BUDGET_WARNING',
        title: 'Approaching Budget Ceiling',
        message: `You have used ${numericPercent.toFixed(0)}% of your monthly budget ($${Number(remaining).toFixed(2)} remaining).`,
        link: '/budgets',
        severity: 'warning',
      });
    }
  }

  const activeAlerts = alerts.filter((a) => !dismissedIds.has(a.id));
  const unreadCount = activeAlerts.length;

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedIds((prev) => new Set([...prev, id]));
  };

  const handleNavigate = (link: string) => {
    setIsOpen(false);
    navigate(link);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-9 h-9 rounded-full border border-slate-100 bg-white flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors shadow-subtle relative"
        title="Notifications & Alerts"
        aria-label={`View notifications (${unreadCount} unread)`}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-100 py-3 px-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Notifications & Alerts
            </h2>
            {unreadCount > 0 && (
              <span className="text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                {unreadCount} active
              </span>
            )}
          </div>

          {activeAlerts.length === 0 ? (
            <div className="py-6 text-center text-slate-400">
              <Check className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-60" />
              <p className="text-xs font-semibold text-slate-600">All caught up!</p>
              <p className="text-[11px] text-slate-400">No pending bills or budget warnings.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {activeAlerts.map((alert) => (
                <div
                  key={alert.id}
                  onClick={() => handleNavigate(alert.link)}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all hover:scale-[1.01] ${
                    alert.severity === 'danger'
                      ? 'bg-rose-50/70 border-rose-200 hover:bg-rose-50'
                      : alert.severity === 'warning'
                      ? 'bg-amber-50/70 border-amber-200 hover:bg-amber-50'
                      : 'bg-indigo-50/70 border-indigo-200 hover:bg-indigo-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      {alert.severity === 'danger' ? (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      ) : alert.severity === 'warning' ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      ) : (
                        <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                      )}
                      <span
                        className={
                          alert.severity === 'danger'
                            ? 'text-rose-900'
                            : alert.severity === 'warning'
                            ? 'text-amber-900'
                            : 'text-indigo-900'
                        }
                      >
                        {alert.title}
                      </span>
                    </div>
                    <button
                      onClick={(e) => handleDismiss(alert.id, e)}
                      className="text-[10px] text-slate-400 hover:text-slate-600 p-0.5 rounded"
                      title="Dismiss alert"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                    {alert.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
