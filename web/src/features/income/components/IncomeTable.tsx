import React from 'react';
import { Income } from '@/types/income';
import { formatCurrency } from '@/utils/currency';
import { formatDate } from '@/utils/date';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Edit2, Trash2 } from 'lucide-react';

export interface IncomeTableProps {
  incomeList: Income[];
  onEdit: (income: Income) => void;
  onDelete: (income: Income) => void;
}

export const IncomeTable: React.FC<IncomeTableProps> = ({ incomeList, onEdit, onDelete }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <th className="py-3 px-4">Date</th>
            <th className="py-3 px-4">Source & Note</th>
            <th className="py-3 px-4">Category</th>
            <th className="py-3 px-4">Method</th>
            <th className="py-3 px-4 text-right">Amount</th>
            <th className="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100/70 text-xs">
          {incomeList.map((income) => (
            <tr key={income.id} className="hover:bg-slate-50/70 transition-colors group">
              <td className="py-3.5 px-4 font-medium text-slate-500 whitespace-nowrap">
                {formatDate(income.transactionDate)}
              </td>
              <td className="py-3.5 px-4 min-w-[180px]">
                <div className="font-semibold text-slate-900">{income.source}</div>
                {income.note && (
                  <div className="text-[11px] text-slate-400 truncate max-w-xs">{income.note}</div>
                )}
              </td>
              <td className="py-3.5 px-4 whitespace-nowrap">
                <Badge variant="success" size="sm">
                  {income.categoryName || 'Salary'}
                </Badge>
              </td>
              <td className="py-3.5 px-4 whitespace-nowrap">
                <Badge variant="neutral" size="sm">
                  {income.paymentMethod || 'Bank Transfer'}
                </Badge>
              </td>
              <td className="py-3.5 px-4 text-right whitespace-nowrap font-bold font-tabular text-sm text-emerald-600">
                <span
                  className="inline-flex items-center gap-0.5"
                  aria-label={`Income: +${formatCurrency(income.amount, income.currency)}`}
                >
                  <span className="text-[10px] opacity-75" aria-hidden="true">▲</span>
                  <span>+{formatCurrency(income.amount, income.currency)}</span>
                </span>
              </td>
              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(income)}
                    className="p-1.5 text-slate-400 hover:text-slate-700"
                    aria-label={`Edit income from ${income.source}`}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(income)}
                    className="p-1.5 text-slate-400 hover:text-rose-600"
                    aria-label={`Delete income from ${income.source}`}
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
