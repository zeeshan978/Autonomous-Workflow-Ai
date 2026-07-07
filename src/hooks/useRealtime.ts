import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { queryClient } from '@/lib/queryClient';

export function useRealtimeSubscription<T>(
  table: string,
  callback: (payload: { eventType: string; new: T; old: T }) => void,
  filter?: string
) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel(`${table}_changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: filter ? `user_id=eq.${filter}` : undefined
        },
        (payload) => {
          callback({
            eventType: payload.eventType,
            new: payload.new as T,
            old: payload.old as T
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [table, filter, callback]);
}

export function useNotifications(callback: (notification: { new: unknown }) => void, userId?: string) {
  useRealtimeSubscription('notifications', callback, userId);
}


export function useExecutions(callback: (execution: { eventType: string; new: unknown }) => void, userId?: string) {
  useRealtimeSubscription('executions', (payload) => {
    queryClient.invalidateQueries({ queryKey: ['executions'] });
    callback(payload);
  }, userId);
}

export function useTasks(callback: (task: { eventType: string; new: unknown }) => void, userId?: string) {
  useRealtimeSubscription('tasks', callback, userId);
}

export function useLogs(callback: (log: { new: unknown }) => void, executionId?: string) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!executionId) return;

    const channel = supabase
      .channel(`logs_${executionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'logs',
          filter: `execution_id=eq.${executionId}`
        },
        (payload) => {
          callback({ new: payload.new });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [executionId, callback]);
}
