import React, { useState } from 'react';
import { useBudgets } from '../hooks/useBudgets';
import { useCategories } from '@/features/categories/hooks/useCategories';
import { useAuth } from '@/hooks/useAuth';
import { BudgetConsumptionCard } from '../components/BudgetConsumptionCard';
import { BudgetFormModal } from '../components/BudgetFormModal';
import { BudgetEditModal } from '../components/BudgetEditModal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  getCurrentMonthString,
  getShiftedMonthString,
  formatMonthLabel,
} from '@/utils/date';
import { BudgetCreateInput } from '@/types/budget';
import { Plus, ChevronLeft, ChevronRight, PieChart } from 'lucide-react';

export const BudgetsPage: React.FC = () => {
  const { user } = useAuth();
  const { categories } = useCategories();

  const [currentMonth, setCurrentMonth] = useState<string>(getCurrentMonthString());
  const {
    overallBudget,
    categoryBudgets,
    isLoading,
    isError,
    error,
    refetch,
    createBudget,
    isCreating,
    updateBudget,
    isUpdating,
    deleteBudget,
    isDeleting,
  } = useBudgets(currentMonth);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<{ id: string; title: string; limit: string } | null>(null);
  const [deletingBudget, setDeletingBudget] = useState<{ id: string; title: string } | null>(null);

  const handlePrevMonth = () => setCurrentMonth((prev) => getShiftedMonthString(prev, -1));
  const handleNextMonth = () => setCurrentMonth((prev) => getShiftedMonthString(prev, 1));
  const handleResetMonth = () => setCurrentMonth(getCurrentMonthString());

  const handleCreate = async (data: BudgetCreateInput) => {
    await createBudget(data);
  };

  const handleUpdate = async (id: string, newLimit: string) => {
    await updateBudget({ id, limitAmount: newLimit });
  };

  const handleDeleteConfirm = async () => {
    if (!deletingBudget) return;
    await deleteBudget(deletingBudget.id);
    setDeletingBudget(null);
  };

  const hasBudgets = !!overallBudget || categoryBudgets.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Budgets</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Monitor real-time consumption against monthly financial limits
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setIsCreateOpen(true)}
        >
          Create Budget
        </Button>
      </div>

      {/* Month Navigator Toolbar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-card flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevMonth}
            className="p-1.5"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-bold text-slate-800 min-w-[140px] text-center">
            {formatMonthLabel(currentMonth)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextMonth}
            className="p-1.5"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {currentMonth !== getCurrentMonthString() && (
          <Button variant="ghost" size="sm" onClick={handleResetMonth} className="text-primary-600 text-xs">
            Jump to Current Month
          </Button>
        )}
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
        </div>
      ) : isError ? (
        <ErrorState
          title="Failed to load budgets"
          message={(error as Error)?.message || 'Unable to retrieve budget allocations.'}
          onRetry={() => refetch()}
        />
      ) : !hasBudgets ? (
        <EmptyState
          icon={<PieChart className="w-8 h-8 text-slate-400" />}
          title={`No budgets set for ${formatMonthLabel(currentMonth)}`}
          description="Set an overall monthly limit or allocate category-specific spending caps to prevent overspending."
          actionLabel="Set First Budget"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : (
        <div className="space-y-6">
          {/* Overall Monthly Budget Card */}
          {overallBudget && (
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                Overall Ceiling
              </h3>
              <BudgetConsumptionCard
                id={overallBudget.id}
                title="Overall Monthly Budget"
                limitAmount={overallBudget.limitAmount}
                spent={overallBudget.spent}
                remaining={overallBudget.remaining}
                percentageUsed={overallBudget.percentageUsed}
                currency={overallBudget.currency}
                isOverall
                onEdit={(id, currentLimit, title) =>
                  setEditingBudget({ id, limit: currentLimit, title })
                }
                onDelete={(id, title) => setDeletingBudget({ id, title })}
              />
            </div>
          )}

          {/* Category Budgets Grid */}
          {categoryBudgets.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                Category Allocations
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryBudgets.map((cb) => (
                  <BudgetConsumptionCard
                    key={cb.id}
                    id={cb.id}
                    title={cb.categoryName}
                    limitAmount={cb.limitAmount}
                    spent={cb.spent}
                    remaining={cb.remaining}
                    percentageUsed={cb.percentageUsed}
                    currency={cb.currency}
                    icon={cb.categoryIcon}
                    color={cb.categoryColor}
                    onEdit={(id, currentLimit, title) =>
                      setEditingBudget({ id, limit: currentLimit, title })
                    }
                    onDelete={(id, title) => setDeletingBudget({ id, title })}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      <BudgetFormModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
        categories={categories}
        monthString={currentMonth}
        baseCurrency={user?.baseCurrency || 'USD'}
        isLoading={isCreating}
      />

      {/* Edit Limit Modal */}
      <BudgetEditModal
        isOpen={!!editingBudget}
        onClose={() => setEditingBudget(null)}
        onSubmit={handleUpdate}
        budgetId={editingBudget?.id || null}
        budgetTitle={editingBudget?.title || ''}
        initialAmount={editingBudget?.limit || ''}
        baseCurrency={user?.baseCurrency || 'USD'}
        isLoading={isUpdating}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deletingBudget}
        onClose={() => setDeletingBudget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Budget"
        message={`Are you sure you want to remove the budget allocation for "${deletingBudget?.title}"?`}
        confirmLabel="Remove Budget"
        isLoading={isDeleting}
      />
    </div>
  );
};
