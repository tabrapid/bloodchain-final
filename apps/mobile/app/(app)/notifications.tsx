import { useMemo, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AlertCircle,
  Heart,
  Calendar,
  FlaskConical,
  Cpu,
  Trophy,
  Droplet,
  Truck,
  Package,
  Shield,
  Settings,
  type LucideIcon,
} from 'lucide-react-native';
import {
  AppButton,
  AppText,
  Card,
  Screen,
  ScreenHeader,
  SegmentedControl,
  EmptyState,
  LoadingState,
} from '../../src/components';
import {
  useNotifications,
  useNotificationStats,
  useMarkAllNotificationsAsRead,
  useMarkNotificationAsRead,
} from '../../src/hooks/useNotifications';
import { spacing, radius, useTheme, ThemeColors } from '../../src/theme';
import type { Notification, NotificationType } from '../../src/api/notifications';

const TYPE_ICON_COMPONENTS: Record<NotificationType, LucideIcon> = {
  EMERGENCY: AlertCircle,
  DONATION: Heart,
  APPOINTMENT: Calendar,
  LABORATORY: FlaskConical,
  AI: Cpu,
  GAMIFICATION: Trophy,
  BLOOD_REQUEST: Droplet,
  SHIPMENT: Truck,
  INVENTORY: Package,
  SECURITY: Shield,
  SYSTEM: Settings,
};

function getTypeStyle(colors: ThemeColors): Record<NotificationType, { bg: string; icon: string }> {
  return {
    EMERGENCY: { bg: colors.dangerMuted, icon: colors.onMuted.danger },
    DONATION: { bg: colors.primaryMuted, icon: colors.onMuted.primary },
    APPOINTMENT: { bg: colors.secondaryMuted, icon: colors.onMuted.secondary },
    LABORATORY: { bg: colors.secondaryMuted, icon: colors.onMuted.secondary },
    AI: { bg: colors.aiMuted, icon: colors.onMuted.ai },
    GAMIFICATION: { bg: colors.warningMuted, icon: colors.onMuted.warning },
    BLOOD_REQUEST: { bg: colors.dangerMuted, icon: colors.onMuted.danger },
    SHIPMENT: { bg: colors.secondaryMuted, icon: colors.onMuted.secondary },
    INVENTORY: { bg: colors.warningMuted, icon: colors.onMuted.warning },
    SECURITY: { bg: colors.warningMuted, icon: colors.onMuted.warning },
    SYSTEM: { bg: colors.surfaceElevated, icon: colors.textMuted },
  };
}

interface NotificationItemProps {
  notification: Notification;
  onPress: () => void;
}

function NotificationItem({ notification, onPress }: NotificationItemProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isUnread = !notification.readAt;
  const typeStyle = getTypeStyle(colors)[notification.type] || {
    bg: colors.surfaceElevated,
    icon: colors.textMuted,
  };
  const Icon = TYPE_ICON_COMPONENTS[notification.type] || Settings;
  const timeAgo = formatTimeAgo(new Date(notification.createdAt));

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card tier={isUnread ? 'elevated' : 'standard'} style={styles.notificationCard}>
        <View style={styles.notificationHeader}>
          <View style={[styles.typeIcon, { backgroundColor: typeStyle.bg }]}>
            <Icon size={18} color={typeStyle.icon} />
            {isUnread && (
              <View style={[styles.unreadDot, { borderColor: colors.background }]} />
            )}
          </View>
          <View style={styles.notificationContent}>
            <View style={styles.notificationTitleRow}>
              <AppText
                variant="heading"
                style={[styles.notificationTitle, isUnread && styles.notificationTitleUnread]}
                numberOfLines={1}
              >
                {notification.title}
              </AppText>
              <AppText muted style={styles.timeAgo}>{timeAgo}</AppText>
            </View>
            <AppText muted style={styles.notificationBody} numberOfLines={2}>
              {notification.body}
            </AppText>
            {notification.priority === 'CRITICAL' && (
              <View style={styles.priorityBadge}>
                <AppText style={styles.priorityText}>URGENT</AppText>
              </View>
            )}
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

  const tabs = useMemo(
    () => [
      { value: 'all' as const, label: 'All' },
      {
        value: 'unread' as const,
        label: `Unread${stats?.unread ? ` (${stats.unread})` : ''}`,
      },
    ],
    [stats?.unread],
  );

  const renderNotification = ({ item }: { item: Notification }) => (
    <NotificationItem
      notification={item}
      onPress={() => handleNotificationPress(item)}
    />
  );

  if (isLoading) {
    return (
      <Screen scroll={false}>
        <ScreenHeader title="Notifications" />
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <ScreenHeader title="Notifications" />
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <SegmentedControl
              options={tabs}
              value={activeTab === 'unread' ? 'unread' : 'all'}
              onChange={setActiveTab}
              style={styles.tabs}
            />
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
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
    },
    tabs: {
      flex: 1,
    },
    notificationCard: {
      marginHorizontal: spacing.md,
      marginTop: spacing.sm,
      padding: spacing.md,
    },

    notificationHeader: {
      flexDirection: 'row',
    },
    typeIcon: {
      width: 42,
      height: 42,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.sm,
      flexShrink: 0,
    },
    notificationContent: {
      flex: 1,
    },
    notificationTitleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.xs,
    },
    notificationTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: '500',
    },
    notificationTitleUnread: {
      fontWeight: '700',
    },
    unreadDot: {
      position: 'absolute',
      top: -2,
      right: -2,
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
      borderWidth: 2,
    },
    notificationBody: {
      fontSize: 13,
      marginTop: 3,
      lineHeight: 18,
    },
    timeAgo: {
      fontSize: 11,
      flexShrink: 0,
    },
    priorityBadge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.danger,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      borderRadius: radius.sm,
      marginTop: spacing.xs,
    },
    priorityText: {
      fontSize: 10,
      color: colors.white,
      fontWeight: '600',
    },
  });
}
