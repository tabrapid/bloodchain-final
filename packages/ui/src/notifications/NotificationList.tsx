'use client';

import {
  AlertTriangle,
  Archive,
  Bell,
  Droplet,
  FlaskConical,
  Package,
  ShieldAlert,
  Trophy,
  Truck,
  CalendarClock,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from '../i18n';
import { cn } from '../components/cn';
import type { NotificationPriority, NotificationType, StaffNotification } from './types';

/** One icon per notification type, so the list is scannable without reading. */
const TYPE_ICON: Record<NotificationType, LucideIcon> = {
  EMERGENCY: AlertTriangle,
  DONATION: Droplet,
  APPOINTMENT: CalendarClock,
  LABORATORY: FlaskConical,
  AI: Bell,
  GAMIFICATION: Trophy,
  BLOOD_REQUEST: Droplet,
  SHIPMENT: Truck,
  INVENTORY: Package,
  SECURITY: ShieldAlert,
  SYSTEM: Bell,
};

const PRIORITY_TINT: Record<NotificationPriority, string> = {
  CRITICAL: 'bg-donor-dangerMuted text-donor-onDangerMuted',
  HIGH: 'bg-donor-warningMuted text-donor-onWarningMuted',
  NORMAL: 'bg-donor-secondaryMuted text-donor-onSecondaryMuted',
  LOW: 'bg-donor-surface text-donor-muted',
};

export interface NotificationListProps {
  items: StaffNotification[];
  /**
   * Where this notification belongs in *this* portal, from its `sourceType`
   * and `sourceId`. The stored `deepLink` is the mobile app's route, so each
   * portal resolves its own; returning null renders the row unclickable
   * rather than linking somewhere that does not exist here.
   */
  resolveHref?: (notification: StaffNotification) => string | null;
  onOpen?: (notification: StaffNotification) => void;
  onArchive?: (notification: StaffNotification) => void;
  /** Compact rows for the topbar dropdown; roomier ones for the full page. */
  dense?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  className?: string;
}

export function NotificationList({
  items,
  resolveHref,
  onOpen,
  onArchive,
  dense = false,
  emptyTitle,
  emptyHint,
  className,
}: NotificationListProps) {
  const { t, formatDateTime } = useTranslation();

  if (items.length === 0) {
    return (
      <div className={cn('px-4 py-8 text-center', className)}>
        <Bell size={22} className="mx-auto text-donor-muted" />
        <p className="mt-2 text-sm font-semibold text-donor-text">
          {emptyTitle ?? t('notifications.empty')}
        </p>
        <p className="mt-1 text-xs text-donor-muted">
          {emptyHint ?? t('notifications.allCaughtUp')}
        </p>
      </div>
    );
  }

  return (
    <ul className={cn('divide-y divide-donor-border/50', className)}>
      {items.map((notification) => {
        const Icon = TYPE_ICON[notification.type] ?? Bell;
        const isUnread = !notification.readAt;
        const href = resolveHref?.(notification) ?? null;
        const clickable = Boolean(href || onOpen);

        return (
          <li key={notification.id} className={cn(isUnread && 'bg-donor-primary/[0.06]')}>
            <div className="flex items-start gap-3 px-4 py-3">
              <span
                className={cn(
                  'mt-0.5 flex shrink-0 items-center justify-center rounded-lg',
                  dense ? 'h-8 w-8' : 'h-9 w-9',
                  PRIORITY_TINT[notification.priority] ?? PRIORITY_TINT.NORMAL,
                )}
              >
                <Icon size={dense ? 15 : 17} />
              </span>

              <button
                type="button"
                disabled={!clickable}
                onClick={() => onOpen?.(notification)}
                className={cn(
                  'min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-donor-primary/60',
                  clickable ? 'cursor-pointer' : 'cursor-default',
                )}
              >
                <p
                  className={cn(
                    'truncate text-sm text-donor-text',
                    isUnread ? 'font-semibold' : 'font-medium',
                  )}
                >
                  {notification.title}
                </p>
                <p
                  className={cn(
                    'text-xs text-donor-muted',
                    dense ? 'truncate' : 'mt-0.5',
                  )}
                >
                  {notification.body}
                </p>
                <p className="mt-1 text-[11px] text-donor-muted">
                  {formatDateTime(notification.createdAt)}
                </p>
              </button>

              <div className="flex shrink-0 items-center gap-2">
                {isUnread && (
                  <span
                    className="mt-1.5 h-2 w-2 rounded-full bg-donor-primary"
                    aria-label={t('notifications.unread')}
                  />
                )}
                {onArchive && (
                  <button
                    type="button"
                    onClick={() => onArchive(notification)}
                    aria-label={t('notifications.archive')}
                    title={t('notifications.archive')}
                    className="rounded-md p-1.5 text-donor-muted outline-none transition-colors hover:bg-donor-elevated hover:text-donor-text focus-visible:ring-2 focus-visible:ring-donor-primary/60"
                  >
                    <Archive size={14} />
                  </button>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
