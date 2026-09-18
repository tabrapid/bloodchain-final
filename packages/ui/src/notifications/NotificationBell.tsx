'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useTranslation } from '../i18n';
import { cn } from '../components/cn';
import { NotificationList } from './NotificationList';
import type { NotificationCenterState } from './useNotificationCenter';
import type { StaffNotification } from './types';

export interface NotificationBellProps {
  center: NotificationCenterState;
  /** Where a notification belongs in this portal; null leaves it unclickable. */
  resolveHref?: (notification: StaffNotification) => string | null;
  /** The portal's own navigation -- `router.push` in Next.js. */
  onNavigate?: (href: string) => void;
  /** The portal's full notifications page. */
  allHref?: string;
  /** How many rows the dropdown shows before "view all". */
  previewCount?: number;
  className?: string;
}

const iconButton =
  'bc-solid relative rounded-lg p-2.5 text-donor-text outline-none transition-colors hover:bg-donor-elevated focus-visible:ring-2 focus-visible:ring-donor-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-donor-bg';

/**
 * The topbar bell, its unread badge and the latest-notifications dropdown.
 *
 * Every staff portal had a bell that did nothing: `Topbar` rendered it only
 * when given an `onNotifications` handler, and no portal passed one, so the
 * three consoles showed no inventory alert, no shipment event and no emergency
 * -- the notification rows existed in the database and nothing read them. This
 * is the one shared surface for all three.
 */
export function NotificationBell({
  center,
  resolveHref,
  onNavigate,
  allHref,
  previewCount = 6,
  className,
}: NotificationBellProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // A dropdown that stays open behind the page the user just navigated to is
  // the usual bug here, so it closes on outside click and on Escape.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const openNotification = async (notification: StaffNotification) => {
    // Read first, then navigate: if the caller's navigation unmounts this
    // component, the PATCH is already in flight.
    void center.markRead(notification.id).catch(() => {});
    const href = resolveHref?.(notification) ?? null;
    if (href && onNavigate) {
      setOpen(false);
      onNavigate(href);
    }
  };

  const preview = center.items.slice(0, previewCount);
  const badge = center.unreadCount > 99 ? '99+' : String(center.unreadCount);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={iconButton}
        aria-label={t('notifications.title')}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Bell size={18} />
        {center.unreadCount > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-donor-primary px-1 text-[10px] font-bold leading-none text-white"
            aria-label={t('notifications.unreadCount', { count: center.unreadCount })}
          >
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="bc-glass-chrome absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-donor-border/60 shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-donor-border/60 px-4 py-3">
            <p className="text-sm font-bold text-donor-text">{t('notifications.title')}</p>
            {center.unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void center.markAllRead()}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-donor-primary outline-none transition-colors hover:bg-donor-elevated focus-visible:ring-2 focus-visible:ring-donor-primary/60"
              >
                <CheckCheck size={13} />
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>

          <div className="max-h-[22rem] overflow-y-auto">
            {center.isLoading ? (
              <p className="px-4 py-6 text-center text-xs text-donor-muted">
                {t('ops.common.loading')}
              </p>
            ) : center.error ? (
              <p className="px-4 py-6 text-center text-xs text-donor-onDangerMuted">
                {t('notifications.loadFailed')}
              </p>
            ) : (
              <NotificationList
                items={preview}
                dense
                resolveHref={resolveHref}
                onOpen={(notification) => void openNotification(notification)}
              />
            )}
          </div>

          {allHref && onNavigate && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onNavigate(allHref);
              }}
              className="w-full border-t border-donor-border/60 px-4 py-3 text-center text-xs font-semibold text-donor-primary outline-none transition-colors hover:bg-donor-elevated focus-visible:ring-2 focus-visible:ring-donor-primary/60"
            >
              {t('notifications.viewAll')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
