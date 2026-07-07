import { useQuery } from '@tanstack/react-query';
import { getExecutions } from '@/services/database';
import { useAuth } from '@/hooks/useAuth';
import { useExecutions } from '@/hooks/useRealtime';

export function useExecutionsQuery() {
  const { user } = useAuth();
  
  // Mount real-time listener globally for executions
  useExecutions(() => {}, user?.id);

  return useQuery({
    queryKey: ['executions', user?.id],
    queryFn: () => getExecutions(user!.id, 1000), // Fetch up to 1000 for analytics
    enabled: !!user?.id,
    staleTime: 0, // Always consider stale to let realtime invalidate easily, or we can use default staleTime
  });
}
