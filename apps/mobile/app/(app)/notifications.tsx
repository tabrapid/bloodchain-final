import { useMemo, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { AppButton, AppText, Card, Screen, EmptyState, LoadingState } from '../../src/components';
import {
  useNotifications,
  useNotificationStats,
  useMarkAllNotificationsAsRead,
  useMarkNotificationAsRead,
} from '../../src/hooks/useNotifications';
import { spacing, radius, useTheme, ThemeColors } from '../../src/theme';
import type { Notification, NotificationType } from '../../src/api/notifications';

const TYPE_ICONS: Record<NotificationType, string> = {
  EMERGENCY: 'alert-circle',
  DONATION: 'heart',
  APPOINTMENT: 'calendar',
  LABORATORY: 'flask',
  AI: 'cpu',
  GAMIFICATION: 'trophy',
  BLOOD_REQUEST: 'droplet',
  SHIPMENT: 'truck',
  INVENTORY: 'package',
  SECURITY: 'shield',
  SYSTEM: 'settings',
};

function getTypeColors(colors: ThemeColors): Record<NotificationType, string> {
  return {
    EMERGENCY: colors.danger,
    DONATION: colors.primary,
    APPOINTMENT: colors.secondary,
    LABORATORY: colors.secondary,
    AI: colors.ai,
    GAMIFICATION: colors.ai,
    BLOOD_REQUEST: colors.danger,
    SHIPMENT: colors.secondary,
    INVENTORY: colors.warning,
    SECURITY: colors.warning,
    SYSTEM: colors.textMuted,
  };
}

interface NotificationItemProps {
  notification: Notification;
  onPress: () => void;
  onMarkRead: () => void;
}

function NotificationItem({ notification, onPress, onMarkRead }: NotificationItemProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isUnread = !notification.readAt;
  const typeColor = getTypeColors(colors)[notification.type] || colors.textMuted;
  const timeAgo = formatTimeAgo(new Date(notification.createdAt));

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card style={[styles.notificationCard, isUnread && styles.unreadCard]}>
        <View style={styles.notificationHeader}>
          <View style={[styles.typeIndicator, { backgroundColor: typeColor }]} />
          <View style={styles.notificationContent}>
            <View style={styles.notificationTitleRow}>
              <AppText variant="heading" style={styles.notificationTitle} numberOfLines={1}>
                {notification.title}
              </AppText>
              {isUnread && <View style={styles.unreadDot} />}
            </View>
            <AppText muted style={styles.notificationBody} numberOfLines={2}>
              {notification.body}
            </AppText>
            <View style={styles.notificationMeta}>
              <AppText muted style={styles.timeAgo}>{timeAgo}</AppText>
              {notification.priority === 'CRITICAL' && (
                <View style={styles.priorityBadge}>
                  <AppText style={styles.priorityText}>URGENT</AppText>
                </View>
              )}
            </View>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationsCenter() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | NotificationType>('all');
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useNotifications(
    activeTab === 'unread' ? { isRead: false } : undefined,
  );
  const { data: stats } = useNotificationStats();
  const markAllRead = useMarkAllNotificationsAsRead();

  const notifications = data?.items || [];
  const markAsRead = useMarkNotificationAsRead();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleNotificationPress = useCallback((notification: Notification) => {
    if (!notification.readAt) {
      markAsRead.mutate(notification.id);
    }

    if (notification.deepLink) {
      router.push(notification.deepLink as any);
    }
  }, [router, markAsRead]);

  const tabs: { key: 'all' | 'unread' | NotificationType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: `Unread${stats?.unread ? ` (${stats.unread})` : ''}` },
  ];

  const renderNotification = ({ item }: { item: Notification }) => (
    <NotificationItem
      notification={item}
      onPress={() => handleNotificationPress(item)}
      onMarkRead={() => markAsRead.mutate(item.id)}
    />
  );

  if (isLoading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.tabs}>
              {tabs.map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tab, activeTab === tab.key && styles.activeTab]}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <AppText
                    variant="body"
                    style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}
                  >
                    {tab.label}
                  </AppText>
                </TouchableOpacity>
              ))}
            </View>
            {notifications.some((n) => !n.readAt) && (
              <AppButton variant="ghost" size="small" onPress={() => markAllRead.mutate()}>
                Mark all read
              </AppButton>
            )}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="No notifications"
            description={
              activeTab === 'unread'
                ? "You're all caught up!"
                : "Push notifications and reminders will appear here."
            }
          />
        }
      />
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    listContent: {
      paddingBottom: spacing['2xl'],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tabs: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    tab: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
    activeTab: {
      borderBottomWidth: 2,
      borderBottomColor: colors.primary,
    },
    tabText: {
      fontSize: 14,
    },
    activeTabText: {
      color: colors.primary,
    },
    notificationCard: {
      marginHorizontal: spacing.md,
      marginTop: spacing.sm,
      padding: spacing.md,
    },
    unreadCard: {
      backgroundColor: colors.surfaceHighlight,
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    notificationHeader: {
      flexDirection: 'row',
    },
    typeIndicator: {
      width: 4,
      borderRadius: 2,
      marginRight: spacing.sm,
    },
    notificationContent: {
      flex: 1,
    },
    notificationTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    notificationTitle: {
      flex: 1,
      fontSize: 15,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    notificationBody: {
      fontSize: 14,
      marginTop: 2,
      lineHeight: 20,
    },
    notificationMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.xs,
      gap: spacing.sm,
    },
    timeAgo: {
      fontSize: 12,
    },
    priorityBadge: {
      backgroundColor: colors.danger,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      borderRadius: radius.sm,
    },
    priorityText: {
      fontSize: 10,
      color: colors.white,
      fontWeight: '600',
    },
    toggleItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
    },
    toggleText: {
      flex: 1,
      marginRight: spacing.md,
    },
    toggleDescription: {
      fontSize: 13,
      marginTop: 2,
    },
  });
}
