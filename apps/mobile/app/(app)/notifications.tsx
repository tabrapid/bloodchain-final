import { useCallback, useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AlertCircle,
  Bell,
  Calendar,
  Cpu,
  Droplet,
  FlaskConical,
  Heart,
  Package,
  Settings,
  Shield,
  Trophy,
  Truck,
} from 'lucide-react-native';
import {
  Badge,
  Divider,
  EmptyState,
  ErrorState,
  LinkButton,
  Screen,
  ScreenHeader,
  SegmentedControl,
  SkeletonRow,
  Surface,
  Text,
  iconSize,
  layout,
  radius,
  space,
  useDesign,
  type AccentName,
} from '../../src/design';
import { LucideIcon } from '../../src/types/icons';
import {
  useNotifications,
  useNotificationStats,
  useMarkAllNotificationsAsRead,
  useMarkNotificationAsRead,
} from '../../src/hooks/useNotifications';
import type { Notification, NotificationType } from '../../src/api/notifications';
import { useTranslation } from '../../src/i18n';
import type { TranslateFn } from '@bloodchain/i18n';

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
 * What each kind of notification is about, as an accent.
 *
 * The reference tints each icon square with `rgba(accent, 0.15)` and draws the
 * icon in the accent itself; the accents are mid-tones that fall under 4.5:1
 * against their own tint. These use the token pairs, where the `.base` is
 * checked against the `.soft` it sits on.
 */
const TYPE_TONE: Record<NotificationType, AccentName | null> = {
  EMERGENCY: 'critical',
  DONATION: 'rose',
  APPOINTMENT: 'clinical',
  LABORATORY: 'clinical',
  AI: 'insight',
  GAMIFICATION: 'warning',
  BLOOD_REQUEST: 'critical',
  SHIPMENT: 'clinical',
  INVENTORY: 'warning',
  SECURITY: 'warning',
  SYSTEM: null,
};

// Keys, not words: this list is built at module load, where there is no
// locale. The count is appended at render, where both are known.
const FILTERS = [
  { labelKey: 'filters.all', value: 'all' },
  { labelKey: 'notifications.unread', value: 'unread' },
] as const;

type Filter = (typeof FILTERS)[number]['value'];

export default function NotificationsCenter() {
  const { t } = useTranslation();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');

  const { data, isPending, isError, refetch, isRefetching } = useNotifications(
    filter === 'unread' ? { isRead: false } : undefined,
  );
  const { data: stats } = useNotificationStats();
  const markAllRead = useMarkAllNotificationsAsRead();
  const markAsRead = useMarkNotificationAsRead();

  const notifications = data?.items ?? [];
  const hasUnread = notifications.some((n) => !n.readAt);

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
          value === 'unread' && stats?.unread ? `${t(labelKey)} (${stats.unread})` : t(labelKey),
      })),
    [stats?.unread, t],
  );

  return (
    <Screen gutter={false}>
      <ScreenHeader
        title={t('notifications.title')}
        // `${n} unread` was an English literal; the plural key it needed has
        // existed since the notifications namespace shipped.
        eyebrow={stats?.unread ? t('notifications.unreadCount', { count: stats.unread }) : undefined}
        onBack={() => router.back()}
        backLabel={t('common.a11yGoBack')}
        actions={
          hasUnread ? (
            <LinkButton
              label={t('notifications.markAllRead')}
              onPress={() => markAllRead.mutate()}
            />
          ) : undefined
        }
      />

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationRow notification={item} onPress={() => handlePress(item)} />
        )}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: layout.gutter,
          paddingBottom: layout.tabBarClearance,
        }}
        ItemSeparatorComponent={() => <Divider inset />}
        showsVerticalScrollIndicator={false}
        refreshing={isRefetching}
        onRefresh={() => void refetch()}
        ListHeaderComponent={
          <View style={{ paddingBottom: space.md }}>
            <SegmentedControl
              options={filterOptions}
              value={filter}
              onChange={setFilter}
              accessibilityLabel={t('notifications.title')}
            />
          </View>
        }
        ListEmptyComponent={
          isPending ? (
            <Surface>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </Surface>
          ) : isError ? (
            // "All caught up" and "we could not reach the server" are not the
            // same message, and one of them is reassuring when it should not be.
            <ErrorState
              title={t('common.errorTitle')}
              description={t('common.errorBody')}
              retryLabel={t('common.retry')}
              onRetry={() => void refetch()}
            />
          ) : (
            <EmptyState
              title={t('notifications.empty')}
              description={
                filter === 'unread' ? t('notifications.allCaughtUp') : t('notifications.emptyHint')
              }
              icon={({ size, color }) => <Bell size={size} color={color} />}
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
  const { colors } = useDesign();

  const unread = !notification.readAt;
  const tone = TYPE_TONE[notification.type] ?? null;
  const accent = tone ? colors[tone] : null;
  const Icon = TYPE_ICON[notification.type] ?? Settings;
  const when = formatTimeAgo(new Date(notification.createdAt), t, formatDate);

  return (
    <Surface
      level="flat"
      bordered={false}
      padded={false}
      onPress={onPress}
      accessibilityLabel={`${unread ? `${t('notifications.unread')}. ` : ''}${notification.title}. ${
        notification.body
      }. ${when}`}
      style={{ backgroundColor: 'transparent' }}
    >
      <View style={{ flexDirection: 'row', gap: space.md, paddingVertical: space.md }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.sm,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: accent ? accent.soft : colors.surfaceRaised,
          }}
        >
          <Icon size={iconSize.md} color={accent ? accent.base : colors.textSecondary} />
        </View>

        <View style={{ flex: 1, gap: space.xs }}>
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
            <Text
              variant={unread ? 'bodyStrong' : 'body'}
              tone={unread ? 'primary' : 'secondary'}
              numberOfLines={2}
              style={{ flex: 1 }}
            >
              {notification.title}
            </Text>
            <Text variant="caption" tone="tertiary">
              {when}
            </Text>
          </View>

          <Text variant="caption" tone="secondary" numberOfLines={3}>
            {notification.body}
          </Text>

          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
            {notification.priority === 'CRITICAL' ? (
              <Badge label={t('status.priority.CRITICAL')} tone="critical" />
            ) : null}
            {/* Unread is a word as well as a weight: "slightly bolder" is not
                a state anyone can see next to a read row they cannot compare
                it against. */}
            {unread ? <Badge label={t('notifications.unread')} tone="clinical" /> : null}
          </View>
        </View>
      </View>
    </Surface>
  );
}

/**
 * The translator and the date formatter are passed in rather than read from a
 * hook, because this is a plain function called from a row's render -- and a
 * string built without them is stuck in whatever language the bundle shipped.
 */
function formatTimeAgo(date: Date, t: TranslateFn, formatDate: (value: Date | string | number, style?: 'full' | 'long' | 'medium' | 'short') => string): string {
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
