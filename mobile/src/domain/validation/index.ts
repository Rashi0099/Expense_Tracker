export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export const ExpenseValidator = {
  validate(data: {
    amountCents: number;
    categoryId: string;
    transactionDate: string;
  }): ValidationResult {
    const errors: Record<string, string> = {};

    if (!data.amountCents || data.amountCents <= 0) {
      errors.amount = 'Please enter an amount greater than zero.';
    }

    if (!data.categoryId || data.categoryId.trim() === '') {
      errors.categoryId = 'Please select a category.';
    }

    if (!data.transactionDate || !/^\d{4}-\d{2}-\d{2}$/.test(data.transactionDate)) {
      errors.transactionDate = 'Valid transaction date is required (YYYY-MM-DD).';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  },
};

export const IncomeValidator = {
  validate(data: {
    amountCents: number;
    categoryId: string;
    source: string;
    transactionDate: string;
  }): ValidationResult {
    const errors: Record<string, string> = {};

    if (!data.amountCents || data.amountCents <= 0) {
      errors.amount = 'Please enter an amount greater than zero.';
    }

    if (!data.categoryId || data.categoryId.trim() === '') {
      errors.categoryId = 'Please select an income category.';
    }

    if (!data.source || data.source.trim() === '') {
      errors.source = 'Income source (employer/client) is required.';
    }

    if (!data.transactionDate || !/^\d{4}-\d{2}-\d{2}$/.test(data.transactionDate)) {
      errors.transactionDate = 'Valid date is required (YYYY-MM-DD).';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  },
};

export const BudgetValidator = {
  validate(data: {
    limitAmountCents: number;
    periodStart: string;
  }): ValidationResult {
    const errors: Record<string, string> = {};

    if (!data.limitAmountCents || data.limitAmountCents <= 0) {
      errors.limitAmount = 'Budget limit must be greater than zero.';
    }

    if (!data.periodStart || !/^\d{4}-\d{2}-01$/.test(data.periodStart)) {
      errors.periodStart = 'Period start must be the first of the month (YYYY-MM-01).';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  },
};
