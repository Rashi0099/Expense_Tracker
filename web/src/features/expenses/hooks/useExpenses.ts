import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { expenseApi } from '@/services/api/expenseApi';
import {
  ExpenseCreateInput,
  ExpenseFilters,
  ExpenseUpdateInput,
} from '@/types/expense';

export const EXPENSES_QUERY_KEY = 'expenses';

export function useExpenses(filters?: ExpenseFilters) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [EXPENSES_QUERY_KEY, filters],
    queryFn: () => expenseApi.getExpenses(filters),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  const createMutation = useMutation({
    mutationFn: (payload: ExpenseCreateInput) => expenseApi.createExpense(payload),
    onSuccess: () => {
      // Invalidate all related queries to maintain cross-view consistency (Section 25 & 34)
      queryClient.invalidateQueries({ queryKey: [EXPENSES_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ExpenseUpdateInput }) =>
      expenseApi.updateExpense(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EXPENSES_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expenseApi.deleteExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EXPENSES_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });

  return {
    expenses: query.data?.results || [],
    totalCount: query.data?.count || 0,
    hasNextPage: !!query.data?.next,
    hasPreviousPage: !!query.data?.previous,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    createExpense: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateExpense: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteExpense: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
