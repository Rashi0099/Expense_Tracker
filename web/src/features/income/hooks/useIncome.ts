import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { incomeApi } from '@/services/api/incomeApi';
import { IncomeCreateInput, IncomeFilters, IncomeUpdateInput } from '@/types/income';

export const INCOME_QUERY_KEY = 'income';

export function useIncome(filters?: IncomeFilters) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [INCOME_QUERY_KEY, filters],
    queryFn: () => incomeApi.getIncome(filters),
    staleTime: 1000 * 60 * 2,
  });

  const createMutation = useMutation({
    mutationFn: (payload: IncomeCreateInput) => incomeApi.createIncome(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INCOME_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: IncomeUpdateInput }) =>
      incomeApi.updateIncome(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INCOME_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => incomeApi.deleteIncome(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INCOME_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });

  return {
    incomeList: query.data?.results || [],
    totalCount: query.data?.count || 0,
    hasNextPage: !!query.data?.next,
    hasPreviousPage: !!query.data?.previous,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    createIncome: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateIncome: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteIncome: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
