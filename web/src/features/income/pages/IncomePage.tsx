import React, { useState } from 'react';
import { useIncome } from '../hooks/useIncome';
import { useCategories } from '@/features/categories/hooks/useCategories';
import { useAuth } from '@/hooks/useAuth';
import { IncomeTable } from '../components/IncomeTable';
import { IncomeFormModal } from '../components/IncomeFormModal';
import { IncomeFilters as IncomeFiltersBar } from '../components/IncomeFilters';
import { ExpensePagination } from '@/features/expenses/components/ExpensePagination';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Income, IncomeCreateInput, IncomeFilters } from '@/types/income';
import { Plus, TrendingUp } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

export const IncomePage: React.FC = () => {
  const { user } = useAuth();
  const { categories } = useCategories();
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFiltersState] = useState<IncomeFilters>(() => {
    const page = parseInt(searchParams.get('page') || '1', 10);
    const search = searchParams.get('search') || undefined;
    const categoryId = searchParams.get('categoryId') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    return {
      page: isNaN(page) || page < 1 ? 1 : page,
      pageSize: 10,
      search,
      categoryId,
      startDate,
      endDate,
    };
  });

  const setFilters = (newFiltersOrFn: IncomeFilters | ((prev: IncomeFilters) => IncomeFilters)) => {
    setFiltersState((prev) => {
      const next = typeof newFiltersOrFn === 'function' ? newFiltersOrFn(prev) : newFiltersOrFn;
      const params = new URLSearchParams();
      if (next.page && next.page > 1) params.set('page', String(next.page));
      if (next.search) params.set('search', next.search);
      if (next.categoryId) params.set('categoryId', next.categoryId);
      if (next.startDate) params.set('startDate', next.startDate);
      if (next.endDate) params.set('endDate', next.endDate);
      setSearchParams(params, { replace: true });
      return next;
    });
  };

  const {
    incomeList,
    totalCount,
    hasNextPage,
    hasPreviousPage,
    isLoading,
    isError,
    error,
    refetch,
    createIncome,
    isCreating,
    updateIncome,
    isUpdating,
    deleteIncome,
    isDeleting,
  } = useIncome(filters);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [deletingIncome, setDeletingIncome] = useState<Income | null>(null);

  const handleCreateOrUpdate = async (data: IncomeCreateInput) => {
    if (editingIncome) {
      await updateIncome({ id: editingIncome.id, payload: data });
    } else {
      await createIncome(data);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingIncome) return;
    await deleteIncome(deletingIncome.id);
    setDeletingIncome(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Income</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage salaries, investments, and revenue streams
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => {
            setEditingIncome(null);
            setIsModalOpen(true);
          }}
        >
          Record Income
        </Button>
      </div>

      {/* Search and Filters Bar */}
      <IncomeFiltersBar
        filters={filters}
        onChange={setFilters}
        categories={categories}
      />

      {/* Content Table / States */}
      <Card className="p-0 overflow-hidden shadow-card">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="p-6">
            <ErrorState
              title="Failed to load income"
              message={(error as Error)?.message || 'Unable to fetch income records.'}
              onRetry={() => refetch()}
            />
          </div>
        ) : incomeList.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<TrendingUp className="w-8 h-8 text-emerald-500" />}
              title={filters.search ? 'No matching income entries' : 'No income recorded yet'}
              description={
                filters.search
                  ? `No income entries match "${filters.search}". Try adjusting your search.`
                  : 'Start by recording your monthly salary or investment returns.'
              }
              actionLabel="Record First Income"
              onAction={() => {
                setEditingIncome(null);
                setIsModalOpen(true);
              }}
            />
          </div>
        ) : (
          <>
            <IncomeTable
              incomeList={incomeList}
              onEdit={(inc) => {
                setEditingIncome(inc);
                setIsModalOpen(true);
              }}
              onDelete={(inc) => setDeletingIncome(inc)}
            />

            <ExpensePagination
              currentPage={filters.page || 1}
              totalCount={totalCount}
              pageSize={filters.pageSize || 10}
              hasNext={hasNextPage}
              hasPrevious={hasPreviousPage}
              onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
            />
          </>
        )}
      </Card>

      {/* Add / Edit Form Modal */}
      <IncomeFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingIncome(null);
        }}
        onSubmit={handleCreateOrUpdate}
        categories={categories}
        initialData={editingIncome}
        baseCurrency={user?.baseCurrency || 'USD'}
        isLoading={isCreating || isUpdating}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deletingIncome}
        onClose={() => setDeletingIncome(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Income Record"
        message={`Are you sure you want to delete the income record of ${deletingIncome?.amount} ${deletingIncome?.currency} from ${deletingIncome?.source}? This will recalculate your net balance.`}
        confirmLabel="Delete Income"
        isLoading={isDeleting}
      />
    </div>
  );
};
