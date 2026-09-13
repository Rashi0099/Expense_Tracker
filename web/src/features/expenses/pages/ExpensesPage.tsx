import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useExpenses } from '../hooks/useExpenses';
import { useCategories } from '@/features/categories/hooks/useCategories';
import { useAuth } from '@/hooks/useAuth';
import { ExpenseTable } from '../components/ExpenseTable';
import { ExpenseFilters } from '../components/ExpenseFilters';
import { ExpensePagination } from '../components/ExpensePagination';
import { ExpenseFormModal } from '../components/ExpenseFormModal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  Expense,
  ExpenseCreateInput,
  ExpenseFilters as IExpenseFilters,
  PaymentMethod,
} from '@/types/expense';
import { Plus, Receipt } from 'lucide-react';

export const ExpensesPage: React.FC = () => {
  const { user } = useAuth();
  const { categories } = useCategories();
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFiltersState] = useState<IExpenseFilters>(() => {
    const page = parseInt(searchParams.get('page') || '1', 10);
    const search = searchParams.get('search') || undefined;
    const categoryId = searchParams.get('categoryId') || undefined;
    const paymentMethod = (searchParams.get('paymentMethod') as PaymentMethod) || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    return {
      page: isNaN(page) || page < 1 ? 1 : page,
      pageSize: 10,
      search,
      categoryId,
      paymentMethod,
      startDate,
      endDate,
    };
  });

  const setFilters = (
    newFiltersOrFn: IExpenseFilters | ((prev: IExpenseFilters) => IExpenseFilters)
  ) => {
    setFiltersState((prev) => {
      const next = typeof newFiltersOrFn === 'function' ? newFiltersOrFn(prev) : newFiltersOrFn;
      const params = new URLSearchParams();
      if (next.page && next.page > 1) params.set('page', String(next.page));
      if (next.search) params.set('search', next.search);
      if (next.categoryId) params.set('categoryId', next.categoryId);
      if (next.paymentMethod) params.set('paymentMethod', next.paymentMethod);
      if (next.startDate) params.set('startDate', next.startDate);
      if (next.endDate) params.set('endDate', next.endDate);
      setSearchParams(params, { replace: true });
      return next;
    });
  };

  const {
    expenses,
    totalCount,
    hasNextPage,
    hasPreviousPage,
    isLoading,
    isError,
    error,
    refetch,
    createExpense,
    isCreating,
    updateExpense,
    isUpdating,
    deleteExpense,
    isDeleting,
  } = useExpenses(filters);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);

  const handleCreateOrUpdate = async (data: ExpenseCreateInput) => {
    if (editingExpense) {
      await updateExpense({ id: editingExpense.id, payload: data });
    } else {
      await createExpense(data);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingExpense) return;
    await deleteExpense(deletingExpense.id);
    setDeletingExpense(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Expenses</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Track, filter, and manage your daily expenditures
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => {
            setEditingExpense(null);
            setIsModalOpen(true);
          }}
        >
          Add Expense
        </Button>
      </div>

      {/* Filters Bar */}
      <ExpenseFilters filters={filters} onChange={setFilters} categories={categories} />

      {/* Content Table / States */}
      <Card className="p-0 overflow-hidden shadow-card">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : isError ? (
          <div className="p-6">
            <ErrorState
              title="Failed to load expenses"
              message={(error as Error)?.message || 'Unable to fetch expense transactions.'}
              onRetry={() => refetch()}
            />
          </div>
        ) : expenses.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<Receipt className="w-8 h-8 text-slate-400" />}
              title={filters.search ? 'No matching expenses' : 'No expenses recorded yet'}
              description={
                filters.search
                  ? `No transactions match "${filters.search}". Try adjusting your filters.`
                  : 'Start tracking your spending by adding your first transaction.'
              }
              actionLabel="Add First Expense"
              onAction={() => {
                setEditingExpense(null);
                setIsModalOpen(true);
              }}
            />
          </div>
        ) : (
          <>
            <ExpenseTable
              expenses={expenses}
              onEdit={(exp) => {
                setEditingExpense(exp);
                setIsModalOpen(true);
              }}
              onDelete={(exp) => setDeletingExpense(exp)}
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
      <ExpenseFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingExpense(null);
        }}
        onSubmit={handleCreateOrUpdate}
        categories={categories}
        initialData={editingExpense}
        baseCurrency={user?.baseCurrency || 'USD'}
        isLoading={isCreating || isUpdating}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deletingExpense}
        onClose={() => setDeletingExpense(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Expense"
        message={`Are you sure you want to delete this expense of ${deletingExpense?.amount} ${deletingExpense?.currency} (${deletingExpense?.payee || 'Expense'})? This action cannot be undone.`}
        confirmLabel="Delete Transaction"
        isLoading={isDeleting}
      />
    </div>
  );
};
