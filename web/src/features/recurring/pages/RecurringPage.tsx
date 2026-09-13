import React, { useState } from 'react';
import { useRecurring } from '../hooks/useRecurring';
import { useCategories } from '@/features/categories/hooks/useCategories';
import { useAuth } from '@/hooks/useAuth';
import { RecurringTable } from '../components/RecurringTable';
import { RecurringFormModal } from '../components/RecurringFormModal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  RecurringCreateInput,
  RecurringExpense,
} from '@/types/recurring';
import { Plus, RefreshCw } from 'lucide-react';

export const RecurringPage: React.FC = () => {
  const { user } = useAuth();
  const { categories } = useCategories();

  const {
    recurringList,
    isLoading,
    isError,
    error,
    refetch,
    createRecurring,
    isCreating,
    updateRecurring,
    isUpdating,
    deleteRecurring,
    isDeleting,
  } = useRecurring();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringExpense | null>(null);
  const [deletingRecurring, setDeletingRecurring] = useState<RecurringExpense | null>(null);

  const handleCreateOrUpdate = async (data: RecurringCreateInput) => {
    if (editingRecurring) {
      await updateRecurring({ id: editingRecurring.id, payload: data });
    } else {
      await createRecurring(data);
    }
  };

  const handleToggleActive = async (rec: RecurringExpense) => {
    await updateRecurring({
      id: rec.id,
      payload: { isActive: !rec.isActive },
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deletingRecurring) return;
    await deleteRecurring(deletingRecurring.id);
    setDeletingRecurring(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Recurring Expenses
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage recurring subscriptions, bills, and automated schedules
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => {
            setEditingRecurring(null);
            setIsModalOpen(true);
          }}
        >
          Add Subscription
        </Button>
      </div>

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
              title="Failed to load subscriptions"
              message={(error as Error)?.message || 'Unable to fetch recurring schedules.'}
              onRetry={() => refetch()}
            />
          </div>
        ) : recurringList.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<RefreshCw className="w-8 h-8 text-indigo-500" />}
              title="No recurring expenses configured"
              description="Track recurring subscriptions like Netflix, Gym memberships, or Rent to stay ahead of upcoming bills."
              actionLabel="Add First Subscription"
              onAction={() => {
                setEditingRecurring(null);
                setIsModalOpen(true);
              }}
            />
          </div>
        ) : (
          <RecurringTable
            recurringList={recurringList}
            onEdit={(rec) => {
              setEditingRecurring(rec);
              setIsModalOpen(true);
            }}
            onDelete={(rec) => setDeletingRecurring(rec)}
            onToggleActive={handleToggleActive}
          />
        )}
      </Card>

      {/* Add / Edit Form Modal */}
      <RecurringFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingRecurring(null);
        }}
        onSubmit={handleCreateOrUpdate}
        categories={categories}
        initialData={editingRecurring}
        baseCurrency={user?.baseCurrency || 'USD'}
        isLoading={isCreating || isUpdating}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deletingRecurring}
        onClose={() => setDeletingRecurring(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Subscription"
        message={`Are you sure you want to delete the scheduled recurring subscription for "${deletingRecurring?.title}"?`}
        confirmLabel="Delete Subscription"
        isLoading={isDeleting}
      />
    </div>
  );
};
