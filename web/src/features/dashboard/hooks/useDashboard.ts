import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/services/api/analyticsApi';
import { budgetApi } from '@/services/api/budgetApi';
import { getCurrentMonthString } from '@/utils/date';

export const ANALYTICS_QUERY_KEY = 'analytics';

export function useDashboard(startDate?: string, endDate?: string) {
  const currentMonth = getCurrentMonthString();

  const analyticsQuery = useQuery({
    queryKey: [ANALYTICS_QUERY_KEY, 'dashboard', startDate, endDate],
    queryFn: () => analyticsApi.getDashboardAnalytics({ startDate, endDate }),
    staleTime: 1000 * 60 * 2,
  });

  const budgetsQuery = useQuery({
    queryKey: ['budgets', currentMonth],
    queryFn: () => budgetApi.getBudgets(currentMonth),
    staleTime: 1000 * 60 * 5,
  });

  return {
    analytics: analyticsQuery.data,
    budgetsOverview: budgetsQuery.data,
    isLoading: analyticsQuery.isLoading || budgetsQuery.isLoading,
    isError: analyticsQuery.isError || budgetsQuery.isError,
    error: analyticsQuery.error || budgetsQuery.error,
    refetch: () => {
      analyticsQuery.refetch();
      budgetsQuery.refetch();
    },
  };
}
