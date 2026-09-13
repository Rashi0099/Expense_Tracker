import React from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Expense } from '@/types/expense';
import { formatCurrency } from '@/utils/currency';
import { formatDate } from '@/utils/date';
import { Link } from 'react-router-dom';
import { ArrowRight, Receipt } from 'lucide-react';
import { CategoryIcon } from '@/components/common/CategoryIcon';

export interface RecentTransactionsListProps {
  expenses: Expense[];
  currency?: string;
}

export const RecentTransactionsList: React.FC<RecentTransactionsListProps> = ({
  expenses,
  currency = 'USD',
}) => {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Recent Transactions</h3>
          <p className="text-xs text-slate-500 mt-0.5">Latest recorded activity</p>
        </div>
        <Link to="/expenses">
          <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
            View All
          </Button>
        </Link>
      </div>

      {expenses.length === 0 ? (
        <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
          <Receipt className="w-6 h-6 text-slate-300" />
          <span>No recent expenses recorded.</span>
        </div>
      ) : (
        <div className="divide-y divide-slate-100/80">
          {expenses.slice(0, 5).map((expense) => (
            <div key={expense.id} className="py-3 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-sm shadow-2xs shrink-0 overflow-hidden"
                  style={{ backgroundColor: expense.categoryColor ? `${expense.categoryColor}25` : '#EEF2F6' }}
                >
                  <CategoryIcon icon={expense.categoryIcon} color={expense.categoryColor || '#475569'} className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">{expense.payee || 'Expense'}</h4>
                  <p className="text-[11px] text-slate-400">{formatDate(expense.transactionDate)}</p>
                </div>
              </div>

              <div className="text-right">
                <span className="font-bold text-slate-900 font-tabular">
                  -{formatCurrency(expense.amount, expense.currency || currency)}
                </span>
                <p className="text-[10px] text-slate-400 capitalize">{expense.paymentMethod.toLowerCase().replace('_', ' ')}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
