import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { parseApiError } from '@/utils/error';

export interface BudgetEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (id: string, newLimit: string) => Promise<unknown>;
  budgetId: string | null;
  budgetTitle: string;
  initialAmount: string;
  baseCurrency?: string;
  isLoading?: boolean;
}

export const BudgetEditModal: React.FC<BudgetEditModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  budgetId,
  budgetTitle,
  initialAmount,
  baseCurrency = 'USD',
  isLoading = false,
}) => {
  const [limitAmount, setLimitAmount] = useState(initialAmount);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setLimitAmount(initialAmount);
    setErrorMsg(null);
  }, [initialAmount, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!budgetId) return;

    const parsed = parseFloat(limitAmount);
    if (isNaN(parsed) || parsed <= 0) {
      setErrorMsg('Please enter a valid positive amount.');
      return;
    }

    try {
      await onSubmit(budgetId, parsed.toFixed(2));
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
      title={`Edit ${budgetTitle} Budget`}
      description="Update spending threshold"
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-xl">
            {errorMsg}
          </div>
        )}

        <Input
          label={`New Limit Amount (${baseCurrency})`}
          type="number"
          step="0.01"
          min="0.01"
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
            Save Limit
          </Button>
        </div>
      </form>
    </Modal>
  );
};
