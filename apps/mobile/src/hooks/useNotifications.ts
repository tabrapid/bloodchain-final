import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  getNotifications,
  getNotification,
  getNotificationStats,
  getUnreadCount,
  markNotificationAsRead,
  markNotificationAsUnread,
  markAllNotificationsAsRead,
  markNotificationsRead,
  deleteNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
  registerPushDevice,
  deactivatePushDevice,
  deactivateAllPushDevices,
  type NotificationFilter,
  type UpdateNotificationPreferencesInput,
  type RegisterPushDeviceInput,
} from '../api/notifications';
import type { Notification, NotificationPreferences, NotificationStats } from '../api/notifications';

export function useNotifications(filter?: NotificationFilter) {
  return useQuery<{ items: Notification[]; nextCursor?: string }>({
    queryKey: ['notifications', filter],
    queryFn: () => getNotifications(filter),
  });
}

export function useNotification(id: string) {
  return useQuery<Notification>({
    queryKey: ['notification', id],
    queryFn: () => getNotification(id),
    enabled: !!id,
  });
}

export function useNotificationStats() {
  return useQuery<NotificationStats>({
    queryKey: ['notification-stats'],
    queryFn: getNotificationStats,
  });
}

export function useUnreadCount() {
  return useQuery<{ count: number }>({
    queryKey: ['unread-count'],
    queryFn: getUnreadCount,
    refetchInterval: 60000,
  });
}

export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => markNotificationAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notification-stats'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });
}

export function useMarkNotificationAsUnread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => markNotificationAsUnread(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notification-stats'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });
}

export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => markAllNotificationsAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notification-stats'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => markNotificationsRead(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notification-stats'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notification-stats'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });
}

export function useNotificationPreferences() {
  return useQuery<NotificationPreferences>({
    queryKey: ['notification-preferences'],
    queryFn: getNotificationPreferences,
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateNotificationPreferencesInput) => updateNotificationPreferences(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
  });
}

export function useRegisterPushDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RegisterPushDeviceInput) => registerPushDevice(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['push-devices'] });
    },
  });
}

export function useDeactivatePushDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deactivatePushDevice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['push-devices'] });
    },
  });
}

export function useDeactivateAllPushDevices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deactivateAllPushDevices(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['push-devices'] });
    },
  });
}

export function useNotificationActions() {
  const markAsRead = useMarkNotificationAsRead();
  const markAsUnread = useMarkNotificationAsUnread();
  const deleteNotif = useDeleteNotification();

  const handleAction = useCallback(async (notification: Notification, action: 'read' | 'unread' | 'delete') => {
    switch (action) {
      case 'read':
        return markAsRead.mutateAsync(notification.id);
      case 'unread':
        return markAsUnread.mutateAsync(notification.id);
      case 'delete':
        return deleteNotif.mutateAsync(notification.id);
    }
  }, [markAsRead, markAsUnread, deleteNotif]);

  return { handleAction, isLoading: markAsRead.isPending || markAsUnread.isPending || deleteNotif.isPending };
}
