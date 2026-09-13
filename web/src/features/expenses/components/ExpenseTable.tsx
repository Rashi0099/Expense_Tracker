import React from 'react';
import { Expense } from '@/types/expense';
import { formatCurrency } from '@/utils/currency';
import { formatDate } from '@/utils/date';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Edit2, Trash2 } from 'lucide-react';

export interface ExpenseTableProps {
  expenses: Expense[];
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  DEBIT_CARD: 'Debit Card',
  CREDIT_CARD: 'Credit Card',
  BANK_TRANSFER: 'Bank Transfer',
  UPI: 'UPI',
  OTHER: 'Other',
};

export const ExpenseTable: React.FC<ExpenseTableProps> = ({ expenses, onEdit, onDelete }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <th className="py-3 px-4">Date</th>
            <th className="py-3 px-4">Payee & Note</th>
            <th className="py-3 px-4">Category</th>
            <th className="py-3 px-4">Method</th>
            <th className="py-3 px-4 text-right">Amount</th>
            <th className="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100/70 text-xs">
          {expenses.map((expense) => (
            <tr key={expense.id} className="hover:bg-slate-50/70 transition-colors group">
              <td className="py-3.5 px-4 font-medium text-slate-500 whitespace-nowrap">
                {formatDate(expense.transactionDate)}
              </td>
              <td className="py-3.5 px-4 min-w-[180px]">
                <div className="font-semibold text-slate-900">
                  {expense.payee || 'Unspecified Payee'}
                </div>
                {expense.note && (
                  <div className="text-[11px] text-slate-400 truncate max-w-xs">{expense.note}</div>
                )}
              </td>
              <td className="py-3.5 px-4 whitespace-nowrap">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold"
                  style={{
                    backgroundColor: expense.categoryColor ? `${expense.categoryColor}25` : '#F1F5F9',
                    color: '#1E293B',
                  }}
                >
                  <span>{expense.categoryIcon || '🏷️'}</span>
                  <span>{expense.categoryName || 'General'}</span>
                </span>
              </td>
              <td className="py-3.5 px-4 whitespace-nowrap">
                <Badge variant="neutral" size="sm">
                  {PAYMENT_METHOD_LABELS[expense.paymentMethod] || expense.paymentMethod}
                </Badge>
              </td>
              <td className="py-3.5 px-4 text-right whitespace-nowrap font-bold text-slate-900 font-tabular text-sm">
                <span
                  className="inline-flex items-center gap-0.5 text-rose-600 font-semibold"
                  aria-label={`Expense: -${formatCurrency(expense.amount, expense.currency)}`}
                >
                  <span className="text-[10px] opacity-75" aria-hidden="true">▼</span>
                  <span>-{formatCurrency(expense.amount, expense.currency)}</span>
                </span>
              </td>
              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(expense)}
                    className="p-1.5 text-slate-400 hover:text-slate-700"
                    aria-label={`Edit expense ${expense.payee}`}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(expense)}
                    className="p-1.5 text-slate-400 hover:text-rose-600"
                    aria-label={`Delete expense ${expense.payee}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
