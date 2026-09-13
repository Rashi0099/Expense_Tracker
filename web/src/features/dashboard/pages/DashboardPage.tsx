import React, { useState } from 'react';
import { useDashboard } from '../hooks/useDashboard';
import { useExpenses } from '@/features/expenses/hooks/useExpenses';
import { useAuth } from '@/hooks/useAuth';
import { DateRangeFilter } from '../components/DateRangeFilter';
import { SpendingTrendChart } from '../components/SpendingTrendChart';
import { RecentTransactionsList } from '../components/RecentTransactionsList';
import { Card } from '@/components/ui/Card';
import { CapsuleBar } from '@/components/ui/CapsuleBar';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { DateFilterPreset } from '@/types/analytics';
import { getDateRangeForPreset } from '@/utils/date';
import { formatCurrency } from '@/utils/currency';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  Wallet,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [preset, setPreset] = useState<DateFilterPreset>('THIS_MONTH');
  const dateRange = getDateRangeForPreset(preset);

  const { analytics, budgetsOverview, isLoading, isError, error, refetch } = useDashboard(
    dateRange.startDate,
    dateRange.endDate
  );

  const { expenses: recentExpenses } = useExpenses({ pageSize: 5 });

  const summary = analytics?.summary;
  const currency = summary?.currency || user?.baseCurrency || 'USD';

  // Category Capsules: Map from budget category allocations or spending breakdown
  const categoryBudgets = budgetsOverview?.categoryBudgets || [];
  const categoryBreakdown = analytics?.categoryBreakdown || [];

  // If user has specific category budgets set, display those as capsules; otherwise display the top spending breakdown
  const capsuleBars =
    categoryBudgets.length > 0
      ? categoryBudgets.map((b) => ({
          label: b.categoryName,
          amount: formatCurrency(b.spent, currency),
          percentage: Math.min(100, Math.round(b.percentageUsed)),
          icon: b.categoryIcon || '🏷️',
          color: b.categoryColor || '#B5C0EA',
          limit: formatCurrency(b.limitAmount, currency),
        }))
      : categoryBreakdown.slice(0, 5).map((c) => ({
          label: c.categoryName,
          amount: formatCurrency(c.totalSpent, currency),
          percentage: Math.min(100, Math.round(c.percentage)),
          icon: c.categoryIcon || '🏷️',
          color: c.categoryColor || '#E6DE98',
          limit: 'Spending share',
        }));

  return (
    <div className="space-y-6">
      {/* Top Header & Period Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Financial Overview
            </h2>
            <Badge variant="success" dot size="sm">
              Live Reconciled
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time balance, spending metrics, and category budget health
          </p>
        </div>

        <DateRangeFilter activePreset={preset} onSelectPreset={setPreset} />
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      ) : isError ? (
        <ErrorState
          title="Unable to load dashboard data"
          message={(error as Error)?.message || 'Failed to aggregate financial totals.'}
          onRetry={() => refetch()}
        />
      ) : (
        <>
          {/* 4 Key Performance Indicator (KPI) Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Balance */}
            <Card hoverable className="p-4 sm:p-5">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Net Balance
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 font-tabular">
                  {formatCurrency(summary?.currentBalance || '0.00', currency)}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium mt-2">
                <Wallet className="w-3.5 h-3.5" />
                <span>Period Cashflow</span>
              </div>
            </Card>

            {/* Total Income */}
            <Card hoverable className="p-4 sm:p-5">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Total Income
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 font-tabular text-emerald-600">
                  +{formatCurrency(summary?.totalIncome || '0.00', currency)}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium mt-2">
                <ArrowDownLeft className="w-3.5 h-3.5" />
                <span>Credited</span>
              </div>
            </Card>

            {/* Total Expenses */}
            <Card hoverable className="p-4 sm:p-5">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Total Expenses
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 font-tabular text-rose-600">
                  -{formatCurrency(summary?.totalExpenses || '0.00', currency)}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-rose-500 font-medium mt-2">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Outflows</span>
              </div>
            </Card>

            {/* Remaining Budget / This Month's Spending */}
            <Card hoverable className="p-4 sm:p-5">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                {summary?.remainingBudget ? 'Remaining Budget' : 'This Month Spent'}
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 font-tabular">
                  {summary?.remainingBudget
                    ? formatCurrency(summary.remainingBudget, currency)
                    : formatCurrency(summary?.thisMonthSpending || '0.00', currency)}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-indigo-600 font-medium mt-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{summary?.budgetLimit ? `Ceiling: ${formatCurrency(summary.budgetLimit, currency)}` : 'Monthly metric'}</span>
              </div>
            </Card>
          </div>

          {/* Capsule Budget Progress Section (User's Reference Widget) */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Category Budget Progress</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time expenditure visualizer matching category allocations
                </p>
              </div>
              {budgetsOverview?.overallBudget && (
                <Badge variant="neutral">
                  Ceiling: {formatCurrency(budgetsOverview.overallBudget.limitAmount, currency)}
                </Badge>
              )}
            </div>

            {capsuleBars.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No expense transactions recorded in this period yet.
              </div>
            ) : (
              <div className="flex items-end justify-start sm:justify-around gap-4 sm:gap-6 overflow-x-auto pb-4 pt-2">
                {capsuleBars.map((capsule) => (
                  <CapsuleBar
                    key={capsule.label}
                    label={capsule.label}
                    amount={capsule.amount}
                    percentage={capsule.percentage}
                    icon={capsule.icon}
                    color={capsule.color}
                    limit={capsule.limit}
                  />
                ))}
              </div>
            )}
          </Card>

          {/* Charts & Recent Activity Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SpendingTrendChart trends={analytics?.monthlyTrends || []} currency={currency} />
            <RecentTransactionsList expenses={recentExpenses} currency={currency} />
          </div>
        </>
      )}
    </div>
  );
};
