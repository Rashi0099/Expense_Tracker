import React, { useState } from 'react';
import { useCategories } from '../hooks/useCategories';
import { CategoryGrid } from '../components/CategoryGrid';
import { CategoryFormModal } from '../components/CategoryFormModal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Category, CategoryCreateInput, CategoryType } from '@/types/category';
import { Plus, Search, Tag } from 'lucide-react';

export const CategoriesPage: React.FC = () => {
  const {
    categories,
    isLoading,
    isError,
    error,
    refetch,
    createCategory,
    isCreating,
    updateCategory,
    isUpdating,
    deleteCategory,
    isDeleting,
  } = useCategories();

  const [activeTab, setActiveTab] = useState<'ALL' | CategoryType>('ALL');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

  const filteredCategories = categories.filter((cat) => {
    if (activeTab !== 'ALL' && cat.type !== activeTab) return false;
    if (search.trim() && !cat.name.toLowerCase().includes(search.toLowerCase().trim())) {
      return false;
    }
    return true;
  });

  const handleCreateOrUpdate = async (data: CategoryCreateInput) => {
    if (editingCategory) {
      await updateCategory({
        id: editingCategory.id,
        payload: {
          name: data.name,
          color: data.color,
          icon: data.icon,
        },
      });
    } else {
      await createCategory(data);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingCategory) return;
    await deleteCategory(deletingCategory.id);
    setDeletingCategory(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Categories</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Organize transactions and manage category limits
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => {
            setEditingCategory(null);
            setIsModalOpen(true);
          }}
        >
          New Category
        </Button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-card">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {(['ALL', 'EXPENSE', 'INCOME'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === tab
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab === 'ALL' ? 'All' : tab === 'EXPENSE' ? 'Expenses' : 'Income'}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64">
          <Input
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            startIcon={<Search className="w-4 h-4 text-slate-400" />}
            className="text-xs"
          />
        </div>
      </div>

      {/* Content States */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="Failed to load categories"
          message={(error as Error)?.message || 'Could not connect to the category service.'}
          onRetry={() => refetch()}
        />
      ) : filteredCategories.length === 0 ? (
        <EmptyState
          icon={<Tag className="w-8 h-8 text-slate-400" />}
          title={search ? 'No matching categories' : 'No categories found'}
          description={
            search
              ? `No categories match "${search}". Try another keyword.`
              : 'Add your first custom category to start organizing transactions.'
          }
          actionLabel="Create Category"
          onAction={() => {
            setEditingCategory(null);
            setIsModalOpen(true);
          }}
        />
      ) : (
        <CategoryGrid
          categories={filteredCategories}
          onEdit={(cat) => {
            setEditingCategory(cat);
            setIsModalOpen(true);
          }}
          onDelete={(cat) => setDeletingCategory(cat)}
        />
      )}

      {/* Add / Edit Category Modal */}
      <CategoryFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCategory(null);
        }}
        onSubmit={handleCreateOrUpdate}
        initialData={editingCategory}
        isLoading={isCreating || isUpdating}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deletingCategory}
        onClose={() => setDeletingCategory(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Category"
        message={`Are you sure you want to archive "${deletingCategory?.name}"? Existing transactions will retain their historical record.`}
        confirmLabel="Archive"
        isLoading={isDeleting}
      />
    </div>
  );
};
