import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Category } from '@/types/category';
import { IncomeFilters as IIncomeFilters } from '@/types/income';
import { Search, X } from 'lucide-react';

export interface IncomeFiltersProps {
  filters: IIncomeFilters;
  onChange: (newFilters: IIncomeFilters) => void;
  categories: Category[];
}

export const IncomeFilters: React.FC<IncomeFiltersProps> = ({
  filters,
  onChange,
  categories,
}) => {
  const incomeCategories = categories.filter((c) => c.type === 'INCOME');
  const [searchTerm, setSearchTerm] = useState(filters.search || '');

  // Debounced search handling to avoid excessive API requests
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
    !!filters.endDate;

  const clearFilters = () => {
    setSearchTerm('');
    onChange({
      page: 1,
      pageSize: filters.pageSize,
    });
  };

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-card space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Search */}
        <Input
          placeholder="Search source or note..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          startIcon={<Search className="w-4 h-4 text-slate-400" />}
          className="text-xs"
        />

        {/* Category */}
        <Select
          value={filters.categoryId || ''}
          onChange={(e) =>
            onChange({ ...filters, categoryId: e.target.value || undefined, page: 1 })
          }
          options={[
            { label: 'All Categories', value: '' },
            ...incomeCategories.map((c) => ({
              label: `${c.icon || '💰'} ${c.name}`,
              value: c.id,
            })),
          ]}
        />

        {/* Date From & To */}
        <div className="flex items-center gap-2">
          <Input
            type="date"
            placeholder="From"
            value={filters.startDate || ''}
            onChange={(e) =>
              onChange({ ...filters, startDate: e.target.value || undefined, page: 1 })
            }
            className="text-xs"
          />
          <Input
            type="date"
            placeholder="To"
            value={filters.endDate || ''}
            onChange={(e) =>
              onChange({ ...filters, endDate: e.target.value || undefined, page: 1 })
            }
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
