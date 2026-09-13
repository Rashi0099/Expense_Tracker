import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { budgetApi } from '@/services/api/budgetApi';
import { BudgetCreateInput } from '@/types/budget';

export const BUDGETS_QUERY_KEY = 'budgets';

export function useBudgets(month?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [BUDGETS_QUERY_KEY, month],
    queryFn: () => budgetApi.getBudgets(month),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const createMutation = useMutation({
    mutationFn: (payload: BudgetCreateInput) => budgetApi.createBudget(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BUDGETS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, limitAmount }: { id: string; limitAmount: string }) =>
      budgetApi.updateBudget(id, limitAmount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BUDGETS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => budgetApi.deleteBudget(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BUDGETS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });

  return {
    overview: query.data,
    overallBudget: query.data?.overallBudget || null,
    categoryBudgets: query.data?.categoryBudgets || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    createBudget: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateBudget: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteBudget: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
