import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExpenseTable } from '@/features/expenses/components/ExpenseTable';
import { ExpenseFormModal } from '@/features/expenses/components/ExpenseFormModal';
import { BudgetConsumptionCard } from '@/features/budgets/components/BudgetConsumptionCard';
import { IncomeTable } from '@/features/income/components/IncomeTable';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Expense } from '@/types/expense';
import { Income } from '@/types/income';
import { Category } from '@/types/category';

describe('Product Feature Components', () => {
  const mockCategories: Category[] = [
    { id: 'cat-gen', name: 'General', type: 'EXPENSE', color: '#CBD5E1', icon: '🏷️', isSystem: true, isArchived: false },
    { id: 'cat-1', name: 'Food & Dining', type: 'EXPENSE', color: '#F4BBA6', icon: '🍔', isSystem: true, isArchived: false },
    { id: 'cat-2', name: 'Salary', type: 'INCOME', color: '#3B82F6', icon: '💰', isSystem: true, isArchived: false },
  ];

  const mockExpenses: Expense[] = [
    {
      id: 'exp-1',
      amount: '45.00',
      currency: 'USD',
      categoryId: 'cat-1',
      categoryName: 'Food & Dining',
      categoryColor: '#F4BBA6',
      categoryIcon: '🍔',
      transactionDate: '2026-09-13',
      paymentMethod: 'CREDIT_CARD',
      payee: 'Swiggy',
      note: 'Dinner',
      version: 1,
      createdAt: '2026-09-13T12:00:00Z',
    },
  ];

  const mockIncome: Income[] = [
    {
      id: 'inc-1',
      amount: '5000.00',
      currency: 'USD',
      categoryId: 'cat-2',
      categoryName: 'Salary',
      transactionDate: '2026-09-01',
      paymentMethod: 'BANK_TRANSFER',
      source: 'Acme Corp',
      note: 'September salary',
      version: 1,
      createdAt: '2026-09-01T09:00:00Z',
    },
  ];

  it('renders expense table with formatted negative amount', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(<ExpenseTable expenses={mockExpenses} onEdit={onEdit} onDelete={onDelete} />);

    expect(screen.getByText('Swiggy')).toBeInTheDocument();
    expect(screen.getByText('Food & Dining')).toBeInTheDocument();
    expect(screen.getByText('-$45.00')).toBeInTheDocument();
  });

  it('renders income table with positive amount', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(<IncomeTable incomeList={mockIncome} onEdit={onEdit} onDelete={onDelete} />);

    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('+$5,000.00')).toBeInTheDocument();
  });

  it('validates expense form and provides smart category suggestion', async () => {
    const onSubmit = vi.fn().mockResolvedValue({});
    const onClose = vi.fn();

    render(
      <ExpenseFormModal
        isOpen={true}
        onClose={onClose}
        onSubmit={onSubmit}
        categories={mockCategories}
      />
    );

    // Enter merchant triggering smart suggestion
    const payeeInput = screen.getByLabelText(/payee/i);
    fireEvent.change(payeeInput, { target: { value: 'Swiggy' } });

    // Verify suggestion chip appears
    expect(await screen.findByText(/Suggestion:/i)).toBeInTheDocument();

    // Click submit without entering amount -> client validation triggers
    const submitBtn = screen.getByRole('button', { name: /save expense/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Please enter a valid positive amount/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('renders budget consumption card with on-track and over-budget states', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    const { rerender } = render(
      <BudgetConsumptionCard
        id="b-1"
        title="Groceries"
        limitAmount="400.00"
        spent="150.00"
        remaining="250.00"
        percentageUsed={37.5}
        currency="USD"
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.getByText('On Track')).toBeInTheDocument();
    expect(screen.getByText('37.5%')).toBeInTheDocument();

    // Rerender as over-budget
    rerender(
      <BudgetConsumptionCard
        id="b-1"
        title="Groceries"
        limitAmount="400.00"
        spent="450.00"
        remaining="-50.00"
        percentageUsed={112.5}
        currency="USD"
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    expect(screen.getByText('Over Budget')).toBeInTheDocument();
    expect(screen.getByText(/Over by \$50.00/i)).toBeInTheDocument();
  });

  it('renders accessible confirm dialog for deletions', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <ConfirmDialog
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        title="Delete Item"
        message="Are you sure you want to delete this item?"
        confirmLabel="Confirm Delete"
      />
    );

    expect(screen.getByText('Delete Item')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete this item?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
