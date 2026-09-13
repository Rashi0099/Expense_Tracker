import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Category } from '@/types/category';
import { ExpenseFilters as IExpenseFilters, PaymentMethod } from '@/types/expense';
import { Search, X } from 'lucide-react';

export interface ExpenseFiltersProps {
  filters: IExpenseFilters;
  onChange: (newFilters: IExpenseFilters) => void;
  categories: Category[];
}

export const ExpenseFilters: React.FC<ExpenseFiltersProps> = ({
  filters,
  onChange,
  categories,
}) => {
  const expenseCategories = categories.filter((c) => c.type === 'EXPENSE');
  const [searchTerm, setSearchTerm] = useState(filters.search || '');

  // Debounced search handling (Section 12: Do not send API request for every keystroke)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== (filters.search || '')) {
        onChange({ ...filters, search: searchTerm, page: 1 });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm, filters, onChange]);

  const hasActiveFilters =
    !!filters.search ||
    !!filters.categoryId ||
    !!filters.startDate ||
    !!filters.endDate ||
    !!filters.paymentMethod;

  const clearFilters = () => {
    setSearchTerm('');
    onChange({
      page: 1,
      pageSize: filters.pageSize,
    });
  };

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-card space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search */}
        <Input
          placeholder="Search payee or note..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          startIcon={<Search className="w-4 h-4 text-slate-400" />}
          className="text-xs"
        />

        {/* Category */}
        <Select
          value={filters.categoryId || ''}
          onChange={(e) => onChange({ ...filters, categoryId: e.target.value || undefined, page: 1 })}
          options={[
            { label: 'All Categories', value: '' },
            ...expenseCategories.map((c) => ({
              label: `${c.icon || '🏷️'} ${c.name}`,
              value: c.id,
            })),
          ]}
        />

        {/* Payment Method */}
        <Select
          value={filters.paymentMethod || ''}
          onChange={(e) =>
            onChange({
              ...filters,
              paymentMethod: (e.target.value as PaymentMethod) || undefined,
              page: 1,
            })
          }
          options={[
            { label: 'All Methods', value: '' },
            { label: 'Credit Card', value: 'CREDIT_CARD' },
            { label: 'Debit Card', value: 'DEBIT_CARD' },
            { label: 'UPI', value: 'UPI' },
            { label: 'Cash', value: 'CASH' },
            { label: 'Bank Transfer', value: 'BANK_TRANSFER' },
          ]}
        />

        {/* Date From & To */}
        <div className="flex items-center gap-2">
          <Input
            type="date"
            placeholder="From"
            value={filters.startDate || ''}
            onChange={(e) => onChange({ ...filters, startDate: e.target.value || undefined, page: 1 })}
            className="text-xs"
          />
          <Input
            type="date"
            placeholder="To"
            value={filters.endDate || ''}
            onChange={(e) => onChange({ ...filters, endDate: e.target.value || undefined, page: 1 })}
            className="text-xs"
          />
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-500 font-medium">Filtered results active</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            leftIcon={<X className="w-3.5 h-3.5" />}
            className="text-rose-600 hover:text-rose-700 py-1"
          >
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  );
};
