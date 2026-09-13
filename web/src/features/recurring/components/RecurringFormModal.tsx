import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Category } from '@/types/category';
import {
  RecurringCreateInput,
  RecurringExpense,
  RecurringFrequency,
} from '@/types/recurring';
import { getTodayDateString } from '@/utils/date';
import { parseApiError } from '@/utils/error';

export interface RecurringFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: RecurringCreateInput) => Promise<unknown>;
  categories: Category[];
  initialData?: RecurringExpense | null;
  baseCurrency?: string;
  isLoading?: boolean;
}

const FREQUENCIES: { label: string; value: RecurringFrequency }[] = [
  { label: 'Monthly (e.g. Netflix, Rent, Broadband)', value: 'MONTHLY' },
  { label: 'Weekly (e.g. Grocery subscription)', value: 'WEEKLY' },
  { label: 'Yearly (e.g. Cloud storage, Prime)', value: 'YEARLY' },
  { label: 'Daily (e.g. Daily commuter transit)', value: 'DAILY' },
];

export const RecurringFormModal: React.FC<RecurringFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  categories,
  initialData,
  baseCurrency = 'USD',
  isLoading = false,
}) => {
  const expenseCategories = categories.filter((c) => c.type === 'EXPENSE');

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('MONTHLY');
  const [categoryId, setCategoryId] = useState('');
  const [startDate, setStartDate] = useState(getTodayDateString());
  const [endDate, setEndDate] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setAmount(initialData.amount);
      setFrequency(initialData.frequency);
      setCategoryId(initialData.categoryId);
      setStartDate(initialData.startDate);
      setEndDate(initialData.endDate || '');
    } else {
      setTitle('');
      setAmount('');
      setFrequency('MONTHLY');
      const firstExpenseCat = categories.find((c) => c.type === 'EXPENSE');
      setCategoryId(firstExpenseCat?.id || '');
      setStartDate(getTodayDateString());
      setEndDate('');
    }
    setFieldErrors({});
    setGeneralError(null);
  }, [initialData, isOpen, categories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setGeneralError(null);

    const errors: Record<string, string> = {};
    const parsed = parseFloat(amount);
    if (!title.trim()) {
      errors.title = 'Title / Subscription name is required.';
    }
    if (isNaN(parsed) || parsed <= 0) {
      errors.amount = 'Please enter a valid positive amount.';
    }
    if (!categoryId) {
      errors.categoryId = 'Please select a category.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    try {
      await onSubmit({
        title: title.trim(),
        amount: parsed.toFixed(2),
        currency: baseCurrency,
        frequency,
        categoryId,
        startDate,
        endDate: endDate ? endDate : null,
      });
      onClose();
    } catch (err) {
      const parsedErr = parseApiError(err);
      if (parsedErr.fieldErrors) {
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsedErr.fieldErrors)) {
          mapped[k] = v[0] || 'Invalid value';
        }
        setFieldErrors(mapped);
      } else {
        setGeneralError(parsedErr.message);
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Recurring Bill' : 'New Recurring Expense'}
      description="Define scheduled subscriptions and automated billing templates"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {generalError && (
          <div className="p-3 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-xl">
            {generalError}
          </div>
        )}

        <Input
          label="Subscription / Bill Title"
          placeholder="e.g. Netflix, Rent, Spotify, Internet"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={fieldErrors.title}
          required
          autoFocus
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label={`Amount (${baseCurrency})`}
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={fieldErrors.amount}
            required
          />

          <Select
            label="Category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            options={expenseCategories.map((c) => ({
              label: `${c.icon || '🏷️'} ${c.name}`,
              value: c.id,
            }))}
            error={fieldErrors.categoryId}
            required
          />
        </div>

        <Select
          label="Billing Frequency"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
          options={FREQUENCIES}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="First Billing Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />

          <Input
            label="End Date (Optional)"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="No end date"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isLoading}>
            {initialData ? 'Update Subscription' : 'Create Recurring'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
