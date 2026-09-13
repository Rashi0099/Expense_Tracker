import { apiClient } from './client';
import { DashboardAnalytics } from '@/types/analytics';

export const analyticsApi = {
  async getDashboardAnalytics(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<DashboardAnalytics> {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.append('startDate', params.startDate);
    if (params?.endDate) searchParams.append('endDate', params.endDate);

    const qs = searchParams.toString();
    const url = `/analytics/dashboard/${qs ? `?${qs}` : ''}`;
    const response = await apiClient.get<DashboardAnalytics>(url);
    return response.data;
  },
};
