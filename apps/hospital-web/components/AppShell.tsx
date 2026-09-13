'use client';

import type { PropsWithChildren } from 'react';
import { LanguageSwitcher, useTranslation } from '@bloodchain/ui/i18n';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { DashboardShell } from '@bloodchain/ui/components';

import { sidebarItems } from '../lib/navigation';
import { logout } from '../lib/auth';

/**
 * The shell every authenticated page renders inside.
 *
 * It exists because three navigation defects were being re-made by hand on
 * every page (see P3-15):
 *
 * - **Logout did nothing.** `onLogout` was passed as `() => {}` on most
 *   `DashboardShell` call sites, so the button rendered and silently failed —
 *   worst on the loading and error branches of each page, where a user waiting
 *   on a slow request is most likely to give up and try to sign out. Logout now
 *   lives here, once, and always works.
 * - **Every sidebar click was a full page load.** The shared `Sidebar` renders
 *   plain anchors so the package can stay framework-agnostic; nobody was
 *   injecting Next's `Link`, so each navigation threw away the React tree and
 *   re-downloaded the bundle.
 * - **The active item was hand-copied onto every page** as a string literal,
 *   repeated once per render branch. It is now derived from the real pathname.
 */
export function AppShell({
  title,
  subtitle,
  userName,
  organizationName,
  organizationType,
  children,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  userName?: string;
  organizationName?: string;
  organizationType?: string;
}>) {
  const { t } = useTranslation();
  // Labels are catalogue keys held in lib/navigation, resolved here because
  // that list is built at module load where there is no locale.
  const localizedNav = sidebarItems.map((item) => ({
    ...item,
    label: item.labelKey ? t(item.labelKey) : item.label,
  }));

  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    // `logout` clears the stored tokens even if the revoke call fails, so the
    // redirect is safe to run unconditionally. `/` renders the sign-in form.
    await logout();
    router.push('/');
    router.refresh();
  };

  return (
    <DashboardShell
      title={title}
      subtitle={subtitle}
      userName={userName}
      organizationName={organizationName}
      organizationType={organizationType}
      sidebarItems={localizedNav}
      currentPath={pathname}
      linkComponent={Link}
      topbarActions={<LanguageSwitcher />}
      onLogout={handleLogout}
    >
      {children}
    </DashboardShell>
  );
}
