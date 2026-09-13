import { apiClient } from './client';
import { BudgetCreateInput, BudgetOverview } from '@/types/budget';

export const budgetApi = {
  async getBudgets(month?: string): Promise<BudgetOverview> {
    const url = month ? `/budgets/?month=${month}` : '/budgets/';
    const response = await apiClient.get<BudgetOverview>(url);
    return response.data;
  },

  async createBudget(payload: BudgetCreateInput): Promise<unknown> {
    const response = await apiClient.post('/budgets/', payload);
    return response.data;
  },

  async updateBudget(id: string, limitAmount: string): Promise<unknown> {
    const response = await apiClient.patch(`/budgets/${id}/`, { limitAmount });
    return response.data;
  },

  async deleteBudget(id: string): Promise<void> {
    await apiClient.delete(`/budgets/${id}/`);
  },
};
