import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { recurringApi } from '@/services/api/recurringApi';
import {
  RecurringCreateInput,
  RecurringUpdateInput,
} from '@/types/recurring';

export const RECURRING_QUERY_KEY = 'recurring';

export function useRecurring() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [RECURRING_QUERY_KEY],
    queryFn: () => recurringApi.getRecurring(),
    staleTime: 1000 * 60 * 5,
  });

  const createMutation = useMutation({
    mutationFn: (payload: RecurringCreateInput) => recurringApi.createRecurring(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RECURRING_QUERY_KEY] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RecurringUpdateInput }) =>
      recurringApi.updateRecurring(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RECURRING_QUERY_KEY] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => recurringApi.deleteRecurring(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [RECURRING_QUERY_KEY] });
    },
  });

  return {
    recurringList: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    createRecurring: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateRecurring: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteRecurring: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
