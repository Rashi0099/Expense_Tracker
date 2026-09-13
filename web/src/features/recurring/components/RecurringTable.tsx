import React from 'react';
import { RecurringExpense, RecurringFrequency } from '@/types/recurring';
import { formatCurrency } from '@/utils/currency';
import { formatDate } from '@/utils/date';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Edit2, Trash2 } from 'lucide-react';

export interface RecurringTableProps {
  recurringList: RecurringExpense[];
  onEdit: (rec: RecurringExpense) => void;
  onDelete: (rec: RecurringExpense) => void;
  onToggleActive: (rec: RecurringExpense) => void;
}

const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  DAILY: 'every day',
  WEEKLY: 'every week',
  MONTHLY: 'every month',
  YEARLY: 'every year',
};

export const RecurringTable: React.FC<RecurringTableProps> = ({
  recurringList,
  onEdit,
  onDelete,
  onToggleActive,
}) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <th className="py-3 px-4">Subscription / Bill</th>
            <th className="py-3 px-4">Schedule</th>
            <th className="py-3 px-4">Category</th>
            <th className="py-3 px-4">Next Due</th>
            <th className="py-3 px-4">Status</th>
            <th className="py-3 px-4 text-right">Amount</th>
            <th className="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100/70 text-xs">
          {recurringList.map((rec) => (
            <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors group">
              <td className="py-3.5 px-4 min-w-[160px]">
                <div className="font-semibold text-slate-900">{rec.title}</div>
                <div className="text-[11px] text-slate-400">
                  {formatCurrency(rec.amount, rec.currency)} {FREQUENCY_LABELS[rec.frequency]}
                </div>
              </td>
              <td className="py-3.5 px-4 whitespace-nowrap">
                <Badge variant="neutral" size="sm">
                  {rec.frequency}
                </Badge>
              </td>
              <td className="py-3.5 px-4 whitespace-nowrap">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold"
                  style={{
                    backgroundColor: rec.categoryColor ? `${rec.categoryColor}25` : '#F1F5F9',
                    color: '#1E293B',
                  }}
                >
                  <span>{rec.categoryIcon || '🏷️'}</span>
                  <span>{rec.categoryName || 'General'}</span>
                </span>
              </td>
              <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-600">
                {formatDate(rec.nextDueDate)}
              </td>
              <td className="py-3.5 px-4 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => onToggleActive(rec)}
                  className="cursor-pointer focus:outline-none"
                >
                  <Badge variant={rec.isActive ? 'success' : 'neutral'} dot size="sm">
                    {rec.isActive ? 'Active' : 'Paused'}
                  </Badge>
                </button>
              </td>
              <td className="py-3.5 px-4 text-right whitespace-nowrap font-bold text-slate-900 font-tabular text-sm">
                {formatCurrency(rec.amount, rec.currency)}
              </td>
              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(rec)}
                    className="p-1.5 text-slate-400 hover:text-slate-700"
                    aria-label={`Edit ${rec.title}`}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(rec)}
                    className="p-1.5 text-slate-400 hover:text-rose-600"
                    aria-label={`Delete ${rec.title}`}
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
