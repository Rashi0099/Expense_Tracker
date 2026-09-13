import { apiClient } from './client';
import { PaginatedResponse } from '@/types/api';
import {
  Expense,
  ExpenseCreateInput,
  ExpenseFilters,
  ExpenseUpdateInput,
} from '@/types/expense';

export const expenseApi = {
  async getExpenses(filters?: ExpenseFilters): Promise<PaginatedResponse<Expense>> {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.pageSize) params.append('page_size', String(filters.pageSize));
    if (filters?.search) params.append('search', filters.search);
    if (filters?.categoryId) params.append('category_id', filters.categoryId);
    if (filters?.startDate) params.append('date_from', filters.startDate);
    if (filters?.endDate) params.append('date_to', filters.endDate);
    if (filters?.paymentMethod) params.append('payment_method', filters.paymentMethod);

    const queryString = params.toString();
    const url = `/expenses/${queryString ? `?${queryString}` : ''}`;
    const response = await apiClient.get<PaginatedResponse<Expense>>(url);
    return response.data;
  },

  async getExpense(id: string): Promise<Expense> {
    const response = await apiClient.get<Expense>(`/expenses/${id}/`);
    return response.data;
  },

  async createExpense(payload: ExpenseCreateInput): Promise<Expense> {
    const response = await apiClient.post<Expense>('/expenses/', payload);
    return response.data;
  },

  async updateExpense(id: string, payload: ExpenseUpdateInput): Promise<Expense> {
    const response = await apiClient.patch<Expense>(`/expenses/${id}/`, payload);
    return response.data;
  },

  async deleteExpense(id: string): Promise<void> {
    await apiClient.delete(`/expenses/${id}/`);
  },
};
