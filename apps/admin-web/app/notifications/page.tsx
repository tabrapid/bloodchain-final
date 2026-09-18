'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCheck, RefreshCw } from 'lucide-react';
import { ErrorState, LoadingState } from '@bloodchain/ui/components';
import { NotificationList, useNotificationCenter } from '@bloodchain/ui/notifications';
import { useTranslation } from '@bloodchain/ui/i18n';

import { AppShell } from '../../components/AppShell';
import { notificationsClient, resolveNotificationHref } from '@lib/notifications';

/**
 * The full inbox, behind the topbar bell's "view all".
 *
 * Same hook and same list as the dropdown -- the difference is the page reads
 * more rows, offers the unread filter and can archive. Notification state lives
 * entirely on the server; nothing about read or archived is tracked here.
 */
export default function NotificationsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [unreadOnly, setUnreadOnly] = useState(false);

  const filters = useMemo(
    () => ({ limit: 30, ...(unreadOnly ? { isRead: false } : {}) }),
    [unreadOnly],
  );
  // The page is the active surface, so it re-reads more often than the bell.
  const center = useNotificationCenter(notificationsClient, { filters, pollMs: 30_000 });

  return (
    <AppShell title={t('notifications.title')} subtitle={t('notifications.staffSubtitle')}>
      <div className="bc-glass rounded-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-donor-border/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <FilterChip active={!unreadOnly} onClick={() => setUnreadOnly(false)}>
              {t('notifications.all')}
            </FilterChip>
            <FilterChip active={unreadOnly} onClick={() => setUnreadOnly(true)}>
              {t('notifications.unreadOnly')}
            </FilterChip>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void center.refresh()}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-donor-muted outline-none transition-colors hover:bg-donor-elevated hover:text-donor-text focus-visible:ring-2 focus-visible:ring-donor-primary/60"
            >
              <RefreshCw size={13} />
              {t('actions.refresh')}
            </button>
            {center.unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void center.markAllRead()}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-donor-primary outline-none transition-colors hover:bg-donor-elevated focus-visible:ring-2 focus-visible:ring-donor-primary/60"
              >
                <CheckCheck size={13} />
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>
        </div>

        {center.isLoading ? (
          <LoadingState />
        ) : center.error ? (
          <ErrorState title={t("notifications.loadFailed")} description={t("ops.common.loadFailed")} onRetry={() => void center.refresh()} />
        ) : (
          <>
            <NotificationList
              items={center.items}
              resolveHref={resolveNotificationHref}
              onOpen={(notification) => {
                void center.markRead(notification.id).catch(() => {});
                const href = resolveNotificationHref(notification);
                if (href) router.push(href);
              }}
              onArchive={(notification) => void center.archive(notification.id)}
              emptyTitle={t('notifications.empty')}
              emptyHint={t('notifications.allCaughtUp')}
            />

            {center.nextCursor && (
              <button
                type="button"
                onClick={() => void center.loadMore()}
                className="w-full border-t border-donor-border/60 px-4 py-3 text-center text-xs font-semibold text-donor-primary outline-none transition-colors hover:bg-donor-elevated focus-visible:ring-2 focus-visible:ring-donor-primary/60"
              >
                {t('notifications.loadMore')}
              </button>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? 'rounded-full bg-donor-primary px-3 py-1.5 text-xs font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-donor-primary/60'
          : 'bc-solid rounded-full px-3 py-1.5 text-xs font-semibold text-donor-muted outline-none transition-colors hover:text-donor-text focus-visible:ring-2 focus-visible:ring-donor-primary/60'
      }
    >
      {children}
    </button>
  );
}
