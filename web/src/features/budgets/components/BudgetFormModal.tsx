import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Category } from '@/types/category';
import { BudgetCreateInput } from '@/types/budget';
import { parseApiError } from '@/utils/error';

export interface BudgetFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: BudgetCreateInput) => Promise<unknown>;
  categories: Category[];
  monthString: string; // YYYY-MM
  baseCurrency?: string;
  isLoading?: boolean;
}

export const BudgetFormModal: React.FC<BudgetFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  categories,
  monthString,
  baseCurrency = 'USD',
  isLoading = false,
}) => {
  const expenseCategories = categories.filter((c) => c.type === 'EXPENSE');

  const [budgetType, setBudgetType] = useState<'OVERALL' | 'CATEGORY'>('CATEGORY');
  const [categoryId, setCategoryId] = useState('');
  const [limitAmount, setLimitAmount] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setBudgetType('CATEGORY');
      const firstExpenseCat = categories.find((c) => c.type === 'EXPENSE');
      setCategoryId(firstExpenseCat?.id || '');
      setLimitAmount('');
      setErrorMsg(null);
    }
  }, [isOpen, categories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const parsed = parseFloat(limitAmount);
    if (isNaN(parsed) || parsed <= 0) {
      setErrorMsg('Please enter a valid positive budget limit.');
      return;
    }

    if (budgetType === 'CATEGORY' && !categoryId) {
      setErrorMsg('Please select a category for this budget.');
      return;
    }

    try {
      await onSubmit({
        periodStart: `${monthString}-01`,
        limitAmount: parsed.toFixed(2),
        currency: baseCurrency,
        categoryId: budgetType === 'CATEGORY' ? categoryId : null,
      });
      onClose();
    } catch (err) {
      const parsedErr = parseApiError(err);
      setErrorMsg(parsedErr.message);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Budget Limit"
      description={`Set spending allowances for ${monthString}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-xl">
            {errorMsg}
          </div>
        )}

        <Select
          label="Budget Scope"
          value={budgetType}
          onChange={(e) => setBudgetType(e.target.value as 'OVERALL' | 'CATEGORY')}
          options={[
            { label: 'Category Specific Budget', value: 'CATEGORY' },
            { label: 'Total Monthly Overall Budget', value: 'OVERALL' },
          ]}
        />

        {budgetType === 'CATEGORY' && (
          <Select
            label="Expense Category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            options={expenseCategories.map((c) => ({
              label: `${c.icon || '🏷️'} ${c.name}`,
              value: c.id,
            }))}
            required
          />
        )}

        <Input
          label={`Budget Limit (${baseCurrency})`}
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0.00"
          value={limitAmount}
          onChange={(e) => setLimitAmount(e.target.value)}
          required
          autoFocus
        />

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isLoading}>
            Set Budget
          </Button>
        </div>
      </form>
    </Modal>
  );
};
