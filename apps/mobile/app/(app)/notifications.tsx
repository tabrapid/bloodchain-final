import { useMemo, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, Pressable, RefreshControl } from 'react-native';
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
  AppText,
  GlassCard,
  Screen,
  ScreenHeader,
  SegmentedControl,
  EmptyState,
  ErrorState,
  SkeletonCard,
} from '../../src/components';
import {
  useNotifications,
  useNotificationStats,
  useMarkAllNotificationsAsRead,
  useMarkNotificationAsRead,
} from '../../src/hooks/useNotifications';
import { spacing, useTheme, ThemeColors } from '../../src/theme';
import type { Notification, NotificationType } from '../../src/api/notifications';
import { useTranslation } from '../../src/i18n';

const TYPE_ICON: Record<NotificationType, LucideIcon> = {
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

/**
 * The reference tints each notification's icon square by what the
 * notification is about. These stay on the app's `xMuted` / `onMuted` pairs
 * rather than the reference's raw `rgba(accent, 0.15)`: the accents are
 * mid-tones that fall under 4.5:1 against their own tint, and this app fixed
 * that class of bug once already.
 */
function typeTint(colors: ThemeColors): Record<NotificationType, { bg: string; icon: string }> {
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

// Keys, not words: this list is built at module load, where there is no
// locale. The count is appended at render, where both are known.
const FILTERS = [
  { labelKey: 'filters.all', value: 'all' },
  { labelKey: 'notifications.unread', value: 'unread' },
] as const;

type Filter = (typeof FILTERS)[number]['value'];

export default function NotificationsCenter() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch } = useNotifications(
    filter === 'unread' ? { isRead: false } : undefined,
  );
  const { data: stats } = useNotificationStats();
  const markAllRead = useMarkAllNotificationsAsRead();
  const markAsRead = useMarkNotificationAsRead();

  const notifications = data?.items ?? [];
  const hasUnread = notifications.some((n) => !n.readAt);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handlePress = useCallback(
    (notification: Notification) => {
      if (!notification.readAt) markAsRead.mutate(notification.id);
      if (notification.deepLink) {
        router.push(notification.deepLink as Parameters<typeof router.push>[0]);
      }
    },
    [router, markAsRead],
  );

  const filterOptions = useMemo(
    () =>
      FILTERS.map(({ labelKey, value }) => ({
        value,
        label:
          value === 'unread' && stats?.unread
            ? `${t(labelKey)} (${stats.unread})`
            : t(labelKey),
      })),
    [stats?.unread, t],
  );

  return (
    <Screen scroll={false}>
      <ScreenHeader
        title={t('notifications.title')}
        subtitle={stats?.unread ? `${stats.unread} unread` : undefined}
        trailing={
          hasUnread ? (
            <Pressable
              onPress={() => markAllRead.mutate()}
              hitSlop={8}
              accessibilityRole="button"
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <AppText style={styles.markAll}>{t('notifications.markAllRead')}</AppText>
            </Pressable>
          ) : undefined
        }
      />

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationRow notification={item} onPress={() => handlePress(item)} />
        )}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <SegmentedControl
            options={filterOptions}
            value={filter}
            onChange={setFilter}
            style={styles.filter}
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.skeletons}>
              {[0, 1, 2, 3].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </View>
          ) : isError ? (
            // "All caught up" and "we could not reach the server" are not the
            // same message, and one of them is reassuring when it should not be.
            <ErrorState onRetry={() => void refetch()} />
          ) : (
            <EmptyState
              title={t('notifications.empty')}
              description={
                filter === 'unread'
                  ? t('notifications.allCaughtUp')
                  : t('notifications.emptyHint')
              }
            />
          )
        }
      />
    </Screen>
  );
}

function NotificationRow({
  notification,
  onPress,
}: {
  notification: Notification;
  onPress: () => void;
}) {
  const { t, formatDate } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const unread = !notification.readAt;
  const tint = typeTint(colors)[notification.type] ?? {
    bg: colors.surfaceElevated,
    icon: colors.textMuted,
  };
  const Icon = TYPE_ICON[notification.type] ?? Settings;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <GlassCard tier={unread ? 'elevated' : 'standard'} style={styles.rowCard}>
        <View style={styles.row}>
          <View style={[styles.rowIcon, { backgroundColor: tint.bg }]}>
            <Icon size={18} color={tint.icon} />
            {unread && <View style={[styles.unreadDot, { borderColor: colors.background }]} />}
          </View>

          <View style={styles.rowBody}>
            <View style={styles.rowTitleLine}>
              <AppText style={[styles.rowTitle, unread && styles.rowTitleUnread]} numberOfLines={2}>
                {notification.title}
              </AppText>
              <AppText style={styles.rowTime}>
                {formatTimeAgo(new Date(notification.createdAt), t, formatDate)}
              </AppText>
            </View>
            <AppText style={styles.rowBodyText} numberOfLines={3}>
              {notification.body}
            </AppText>
            {notification.priority === 'CRITICAL' && (
              <View style={styles.urgent}>
                <AppText style={styles.urgentText}>{t('status.priority.CRITICAL')}</AppText>
              </View>
            )}
          </View>
        </View>
      </GlassCard>
    </Pressable>
  );
}

/**
 * The translator and the date formatter are passed in rather than read from a
 * hook, because this is a plain function called from a row's render -- and a
 * string built without them is stuck in whatever language the bundle shipped.
 */
function formatTimeAgo(
  date: Date,
  t: (key: string, options?: Record<string, string | number>) => string,
  formatDate: (value: Date | string | number, style?: 'full' | 'long' | 'medium' | 'short') => string,
): string {
  const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return t('common.justNow');
  if (diffMins < 60) return t('common.minutesAgo', { count: diffMins });
  if (diffHours < 24) return t('common.hoursAgo', { count: diffHours });
  if (diffDays === 1) return t('common.yesterday');
  if (diffDays < 7) return t('units.daysAgo', { count: diffDays });
  return formatDate(date, 'short');
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    markAll: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.primary,
    },
    list: { flex: 1 },
    listContent: {
      gap: spacing.sm,
      paddingBottom: spacing.xl,
    },
    filter: {
      marginBottom: spacing.sm,
    },
    skeletons: {
      gap: spacing.sm,
    },

    rowCard: {
      padding: 14,
    },
    row: {
      flexDirection: 'row',
      gap: 12,
    },
    rowIcon: {
      width: 42,
      height: 42,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
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
    rowBody: {
      flex: 1,
      minWidth: 0,
    },
    rowTitleLine: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    rowTitle: {
      flex: 1,
      fontSize: 13,
      fontWeight: '500',
      color: colors.text,
    },
    rowTitleUnread: {
      fontWeight: '700',
    },
    rowTime: {
      fontSize: 11,
      color: colors.textMuted,
      flexShrink: 0,
    },
    rowBodyText: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.textMuted,
      marginTop: 3,
    },
    urgent: {
      alignSelf: 'flex-start',
      backgroundColor: colors.dangerMuted,
      borderWidth: 1,
      borderColor: `${colors.onMuted.danger}28`,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: 999,
      marginTop: spacing.sm,
    },
    urgentText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1,
      color: colors.onMuted.danger,
    },
  });
}
