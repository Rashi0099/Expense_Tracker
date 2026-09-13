import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Expense, ExpenseCreateInput, PaymentMethod } from '@/types/expense';
import { Category } from '@/types/category';
import { getTodayDateString } from '@/utils/date';
import { getSuggestedCategory, recordUserCategoryChoice } from '@/utils/categorySuggester';
import { parseApiError } from '@/utils/error';
import { Sparkles } from 'lucide-react';

export interface ExpenseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ExpenseCreateInput) => Promise<unknown>;
  categories: Category[];
  initialData?: Expense | null;
  baseCurrency?: string;
  isLoading?: boolean;
}

const PAYMENT_METHODS: { label: string; value: PaymentMethod }[] = [
  { label: 'Debit Card', value: 'DEBIT_CARD' },
  { label: 'Credit Card', value: 'CREDIT_CARD' },
  { label: 'UPI', value: 'UPI' },
  { label: 'Cash', value: 'CASH' },
  { label: 'Bank Transfer', value: 'BANK_TRANSFER' },
  { label: 'Other', value: 'OTHER' },
];

export const ExpenseFormModal: React.FC<ExpenseFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  categories,
  initialData,
  baseCurrency = 'USD',
  isLoading = false,
}) => {
  const expenseCategories = categories.filter((c) => c.type === 'EXPENSE');

  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [transactionDate, setTransactionDate] = useState(getTodayDateString());
  const [payee, setPayee] = useState('');
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CREDIT_CARD');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Smart suggestion state
  const [suggestedCat, setSuggestedCat] = useState<Category | null>(null);

  useEffect(() => {
    if (initialData) {
      setAmount(initialData.amount);
      setCategoryId(initialData.categoryId);
      setTransactionDate(initialData.transactionDate);
      setPayee(initialData.payee || '');
      setNote(initialData.note || '');
      setPaymentMethod(initialData.paymentMethod || 'CREDIT_CARD');
      setSuggestedCat(null);
    } else {
      setAmount('');
      const firstExpenseCat = categories.find((c) => c.type === 'EXPENSE');
      setCategoryId(firstExpenseCat?.id || '');
      setTransactionDate(getTodayDateString());
      setPayee('');
      setNote('');
      setPaymentMethod('CREDIT_CARD');
      setSuggestedCat(null);
    }
    setFieldErrors({});
    setGeneralError(null);
  }, [initialData, isOpen, categories]);

  // Handle payee typing for smart category suggestion
  const handlePayeeChange = (value: string) => {
    setPayee(value);
    if (!initialData) {
      const suggestion = getSuggestedCategory(value, expenseCategories);
      if (suggestion && suggestion.id !== categoryId) {
        setSuggestedCat(suggestion);
      } else {
        setSuggestedCat(null);
      }
    }
  };

  const applySuggestion = (cat: Category) => {
    setCategoryId(cat.id);
    setSuggestedCat(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setGeneralError(null);

    const errors: Record<string, string> = {};
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      errors.amount = 'Please enter a valid positive amount.';
    }
    if (!categoryId) {
      errors.categoryId = 'Please select a category.';
    }
    if (!transactionDate) {
      errors.transactionDate = 'Transaction date is required.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    try {
      await onSubmit({
        amount: parsedAmount.toFixed(2),
        currency: baseCurrency,
        categoryId,
        transactionDate,
        paymentMethod,
        payee: payee.trim() || undefined,
        note: note.trim() || undefined,
      });
      recordUserCategoryChoice(payee.trim(), categoryId);
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
      title={initialData ? 'Edit Expense' : 'Add Expense'}
      description="Record a new expenditure transaction"
      maxWidth="md"
    >
      <form noValidate onSubmit={handleSubmit} className="space-y-4">
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
            error={fieldErrors.transactionDate}
            required
          />
        </div>

        <div>
          <Input
            label="Payee / Merchant"
            placeholder="e.g. Swiggy, Uber, Whole Foods, Netflix"
            value={payee}
            onChange={(e) => handlePayeeChange(e.target.value)}
            error={fieldErrors.payee}
          />

          {/* Smart Category Suggestion Pill */}
          {suggestedCat && (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Suggestion:
              </span>
              <button
                type="button"
                onClick={() => applySuggestion(suggestedCat)}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-semibold transition-colors"
              >
                <span>{suggestedCat.icon}</span>
                <span>{suggestedCat.name}</span>
                <span className="text-[10px] text-amber-700 underline ml-0.5">Apply</span>
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          <Select
            label="Payment Method"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            options={PAYMENT_METHODS}
            error={fieldErrors.paymentMethod}
          />
        </div>

        <Input
          label="Notes (Optional)"
          placeholder="Add memo or itemized details..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          error={fieldErrors.note}
        />

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isLoading}>
            {initialData ? 'Update Expense' : 'Save Expense'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
