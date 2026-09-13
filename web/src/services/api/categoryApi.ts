import { apiClient } from './client';
import { Category, CategoryCreateInput, CategoryUpdateInput } from '@/types/category';

export const categoryApi = {
  async getCategories(): Promise<Category[]> {
    const response = await apiClient.get<Category[]>('/categories/');
    return response.data;
  },

  async createCategory(payload: CategoryCreateInput): Promise<Category> {
    const response = await apiClient.post<Category>('/categories/', payload);
    return response.data;
  },

  async updateCategory(id: string, payload: CategoryUpdateInput): Promise<Category> {
    const response = await apiClient.patch<Category>(`/categories/${id}/`, payload);
    return response.data;
  },

  async deleteCategory(id: string): Promise<void> {
    await apiClient.delete(`/categories/${id}/`);
  },
};
