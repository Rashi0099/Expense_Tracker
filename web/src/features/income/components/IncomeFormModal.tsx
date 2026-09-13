import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Income, IncomeCreateInput } from '@/types/income';
import { Category } from '@/types/category';
import { PaymentMethod } from '@/types/expense';
import { getTodayDateString } from '@/utils/date';
import { parseApiError } from '@/utils/error';

export interface IncomeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: IncomeCreateInput) => Promise<unknown>;
  categories: Category[];
  initialData?: Income | null;
  baseCurrency?: string;
  isLoading?: boolean;
}

const PAYMENT_METHODS: { label: string; value: PaymentMethod }[] = [
  { label: 'Bank Transfer', value: 'BANK_TRANSFER' },
  { label: 'UPI', value: 'UPI' },
  { label: 'Cash', value: 'CASH' },
  { label: 'Debit Card', value: 'DEBIT_CARD' },
  { label: 'Other', value: 'OTHER' },
];

export const IncomeFormModal: React.FC<IncomeFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  categories,
  initialData,
  baseCurrency = 'USD',
  isLoading = false,
}) => {
  const incomeCategories = categories.filter((c) => c.type === 'INCOME');

  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [transactionDate, setTransactionDate] = useState(getTodayDateString());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [note, setNote] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setAmount(initialData.amount);
      setSource(initialData.source);
      setCategoryId(initialData.categoryId);
      setTransactionDate(initialData.transactionDate);
      setPaymentMethod(initialData.paymentMethod || 'BANK_TRANSFER');
      setNote(initialData.note || '');
    } else {
      setAmount('');
      setSource('');
      const firstIncomeCat = categories.find((c) => c.type === 'INCOME');
      setCategoryId(firstIncomeCat?.id || '');
      setTransactionDate(getTodayDateString());
      setPaymentMethod('BANK_TRANSFER');
      setNote('');
    }
    setFieldErrors({});
    setGeneralError(null);
  }, [initialData, isOpen, categories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setGeneralError(null);

    const errors: Record<string, string> = {};
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      errors.amount = 'Please enter a valid positive amount.';
    }
    if (!source.trim()) {
      errors.source = 'Income source or employer name is required.';
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
        amount: parsedAmount.toFixed(2),
        currency: baseCurrency,
        source: source.trim(),
        categoryId,
        transactionDate,
        paymentMethod,
        note: note.trim() || undefined,
      });
      onClose();
    } catch (err) {
      const parsed = parseApiError(err);
      if (parsed.fieldErrors && Object.keys(parsed.fieldErrors).length > 0) {
        const mapped: Record<string, string> = {};
        for (const [key, msgs] of Object.entries(parsed.fieldErrors)) {
          mapped[key] = msgs[0] || 'Invalid field';
        }
        setFieldErrors(mapped);
      } else {
        setGeneralError(parsed.message);
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Income' : 'Record Income'}
      description="Track salaries, dividends, freelance, or investments"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {generalError && (
          <div className="p-3 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-xl">
            {generalError}
          </div>
        )}

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
            autoFocus
          />

          <Input
            label="Transaction Date"
            type="date"
            value={transactionDate}
            onChange={(e) => setTransactionDate(e.target.value)}
            required
          />
        </div>

        <Input
          label="Income Source"
          placeholder="e.g. Primary Employer, Upwork, Dividend"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          error={fieldErrors.source}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            options={incomeCategories.map((c) => ({
              label: `${c.icon || '💰'} ${c.name}`,
              value: c.id,
            }))}
            error={fieldErrors.categoryId}
            required
          />

          <Select
            label="Payment Method"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            options={PAYMENT_METHODS}
          />
        </div>

        <Input
          label="Notes (Optional)"
          placeholder="Add bonus details or pay period memo..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isLoading}>
            {initialData ? 'Update Income' : 'Record Income'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
