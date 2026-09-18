'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NotificationsClient } from './client';
import type { NotificationListFilters, StaffNotification } from './types';

export interface NotificationCenterState {
  items: StaffNotification[];
  unreadCount: number;
  nextCursor: string | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  archive: (id: string) => Promise<void>;
}

export interface UseNotificationCenterOptions {
  filters?: NotificationListFilters;
  /**
   * How often to re-read the list and unread count, in milliseconds. The API
   * has no push channel for the web portals, so the bell polls; 0 disables it
   * for a page that only wants one read.
   */
  pollMs?: number;
  enabled?: boolean;
}

/**
 * The staff notification centre's state.
 *
 * One hook behind the topbar bell and the full notifications page in all three
 * portals, so read/archive behaviour cannot drift between them. Every mutation
 * updates local state from what the server returned rather than guessing, and
 * the unread count is re-read afterwards -- it is the server's number, not a
 * decrement.
 */
export function useNotificationCenter(
  client: NotificationsClient,
  { filters, pollMs = 60_000, enabled = true }: UseNotificationCenterOptions = {},
): NotificationCenterState {
  const [items, setItems] = useState<StaffNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  // Serialised so a caller can pass an object literal without re-running the
  // effect on every render.
  const filterKey = JSON.stringify(filters ?? {});
  const stableFilters = useMemo(
    () => JSON.parse(filterKey) as NotificationListFilters,
    [filterKey],
  );

  // Survives unmount: a poll that lands after the user navigates away must not
  // set state on a dead component.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const [page, count] = await Promise.all([
        client.list(stableFilters),
        client.unreadCount(),
      ]);
      if (!mounted.current) return;
      setItems(page?.items ?? []);
      setNextCursor(page?.nextCursor ?? null);
      setUnreadCount(count);
      setError(null);
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof Error ? err.message : 'Could not load notifications');
    } finally {
      if (mounted.current) setIsLoading(false);
    }
  }, [client, enabled, stableFilters]);

  useEffect(() => {
    void refresh();
    if (!enabled || pollMs <= 0) return;
    const timer = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(timer);
  }, [refresh, enabled, pollMs]);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    try {
      const page = await client.list({ ...stableFilters, cursor: nextCursor });
      if (!mounted.current) return;
      setItems((current) => [...current, ...(page?.items ?? [])]);
      setNextCursor(page?.nextCursor ?? null);
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof Error ? err.message : 'Could not load notifications');
    }
  }, [client, nextCursor, stableFilters]);

  const markRead = useCallback(
    async (id: string) => {
      const target = items.find((item) => item.id === id);
      // Already read: the PATCH would be a no-op write and a needless
      // round-trip every time the list is re-opened.
      if (target?.readAt) return;
      const updated = await client.markRead(id);
      if (!mounted.current) return;
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, ...updated } : item)),
      );
      setUnreadCount(await client.unreadCount());
    },
    [client, items],
  );

  const markAllRead = useCallback(async () => {
    await client.markAllRead();
    await refresh();
  }, [client, refresh]);

  const archive = useCallback(
    async (id: string) => {
      await client.archive(id);
      if (!mounted.current) return;
      // The default list excludes ARCHIVED, so the row leaves the inbox.
      setItems((current) => current.filter((item) => item.id !== id));
      setUnreadCount(await client.unreadCount());
    },
    [client],
  );

  return {
    items,
    unreadCount,
    nextCursor,
    isLoading,
    error,
    refresh,
    loadMore,
    markRead,
    markAllRead,
    archive,
  };
}
