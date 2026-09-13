import { apiClient } from './client';
import { PaginatedResponse } from '@/types/api';
import {
  Income,
  IncomeCreateInput,
  IncomeFilters,
  IncomeUpdateInput,
} from '@/types/income';

export const incomeApi = {
  async getIncome(filters?: IncomeFilters): Promise<PaginatedResponse<Income>> {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.pageSize) params.append('page_size', String(filters.pageSize));
    if (filters?.search) params.append('search', filters.search);
    if (filters?.categoryId) params.append('category_id', filters.categoryId);
    if (filters?.startDate) params.append('date_from', filters.startDate);
    if (filters?.endDate) params.append('date_to', filters.endDate);

    const queryString = params.toString();
    const url = `/income/${queryString ? `?${queryString}` : ''}`;
    const response = await apiClient.get<PaginatedResponse<Income>>(url);
    return response.data;
  },

  async getIncomeItem(id: string): Promise<Income> {
    const response = await apiClient.get<Income>(`/income/${id}/`);
    return response.data;
  },

  async createIncome(payload: IncomeCreateInput): Promise<Income> {
    const response = await apiClient.post<Income>('/income/', payload);
    return response.data;
  },

  async updateIncome(id: string, payload: IncomeUpdateInput): Promise<Income> {
    const response = await apiClient.patch<Income>(`/income/${id}/`, payload);
    return response.data;
  },

  async deleteIncome(id: string): Promise<void> {
    await apiClient.delete(`/income/${id}/`);
  },
};
