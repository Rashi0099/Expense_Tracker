import { apiClient } from './client';
import {
  RecurringCreateInput,
  RecurringExpense,
  RecurringUpdateInput,
} from '@/types/recurring';

export const recurringApi = {
  async getRecurring(): Promise<RecurringExpense[]> {
    const response = await apiClient.get<RecurringExpense[]>('/recurring/');
    return response.data;
  },

  async createRecurring(payload: RecurringCreateInput): Promise<RecurringExpense> {
    const response = await apiClient.post<RecurringExpense>('/recurring/', payload);
    return response.data;
  },

  async updateRecurring(id: string, payload: RecurringUpdateInput): Promise<RecurringExpense> {
    const response = await apiClient.patch<RecurringExpense>(`/recurring/${id}/`, payload);
    return response.data;
  },

  async deleteRecurring(id: string): Promise<void> {
    await apiClient.delete(`/recurring/${id}/`);
  },
};
