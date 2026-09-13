/**
 * useLocalQuery — Reactive SQLite Query Hook
 *
 * Runs a query function against local SQLite and automatically re-executes
 * when any matching DataEventType is fired, ensuring zero-lag UI consistency.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { DataEvents, DataEventType } from './DataEvents';

export interface UseLocalQueryResult<T> {
  data: T;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useLocalQuery<T>(
  queryFn: () => Promise<T>,
  dependencies: unknown[] = [],
  listenEvents: DataEventType[] = []
): UseLocalQueryResult<T> {
  const [data, setData] = useState<T>(undefined as unknown as T);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const isMounted = useRef<boolean>(true);

  const execute = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await queryFn();
      if (isMounted.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  useEffect(() => {
    isMounted.current = true;
    execute();

    // Subscribe to events
    const unsubscribes = listenEvents.map((evt) =>
      DataEvents.subscribe(evt, () => {
        execute();
      })
    );

    return () => {
      isMounted.current = false;
      unsubscribes.forEach((unsub) => unsub());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execute]);

  return {
    data,
    isLoading,
    error,
    refetch: execute,
  };
}
