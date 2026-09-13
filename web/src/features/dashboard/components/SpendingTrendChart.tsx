import React from 'react';
import { Card } from '@/components/ui/Card';
import { MonthlyTrend } from '@/types/analytics';
import { formatCurrency } from '@/utils/currency';

export interface SpendingTrendChartProps {
  trends: MonthlyTrend[];
  currency?: string;
}

export const SpendingTrendChart: React.FC<SpendingTrendChartProps> = ({
  trends,
  currency = 'USD',
}) => {
  if (!trends || trends.length === 0) return null;

  // Find max value to scale heights
  const maxVal = Math.max(
    ...trends.flatMap((t) => [parseFloat(t.income) || 0, parseFloat(t.expenses) || 0]),
    100
  );

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-6 pb-2 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Income vs Expenses Trend</h3>
          <p className="text-xs text-slate-500 mt-0.5">6-Month historical comparison</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-slate-600 font-medium">Income</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="text-slate-600 font-medium">Expenses</span>
          </div>
        </div>
      </div>

      {/* Bar Comparison Chart */}
      <div className="flex items-end justify-between gap-3 h-48 pt-6 pb-2 px-2">
        {trends.map((item) => {
          const inc = parseFloat(item.income) || 0;
          const exp = parseFloat(item.expenses) || 0;

          const incHeight = Math.max(4, Math.round((inc / maxVal) * 100));
          const expHeight = Math.max(4, Math.round((exp / maxVal) * 100));

          return (
            <div key={item.monthKey} className="flex-1 flex flex-col items-center gap-2 group">
              <div className="w-full flex items-end justify-center gap-1.5 h-36">
                {/* Income Bar */}
                <div
                  className="w-3 sm:w-4 bg-emerald-400 hover:bg-emerald-500 rounded-t-md transition-all relative"
                  style={{ height: `${incHeight}%` }}
                  title={`Income: ${formatCurrency(item.income, currency)}`}
                />
                {/* Expense Bar */}
                <div
                  className="w-3 sm:w-4 bg-rose-400 hover:bg-rose-500 rounded-t-md transition-all relative"
                  style={{ height: `${expHeight}%` }}
                  title={`Expenses: ${formatCurrency(item.expenses, currency)}`}
                />
              </div>

              {/* Month Label */}
              <span className="text-[10px] font-semibold text-slate-500 whitespace-nowrap">
                {item.month.split(' ')[0]}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
