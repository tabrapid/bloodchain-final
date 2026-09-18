import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderLocalized } from '../lib/test-render';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
const refresh = vi.fn();
const pathname = { current: '/' };

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.current,
  useRouter: () => ({ push, refresh }),
}));

vi.mock('next/link', () => ({
  default: ({ href, className, children }: { href: string; className?: string; children?: React.ReactNode }) => (
    <a href={href} className={className} data-next-link="true">
      {children}
    </a>
  ),
}));

vi.mock('@lib/auth', () => ({ logout: vi.fn() }));

import { logout } from '@lib/auth';
import { navItems } from '@lib/navigation';
import { AppShell } from './AppShell';

/**
 * P3-15 regression tests.
 *
 * Three navigation defects were being reproduced by hand on every page of this
 * app. The shell exists so they cannot be: it owns logout, injects the router
 * link, and derives the active entry from the real pathname.
 */
describe('AppShell', () => {
  beforeEach(() => {
    pathname.current = '/';
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the app navigation and the page content', () => {
    renderLocalized(<AppShell title="Dashboard">
      <p>page body</p>
    </AppShell>);

    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(screen.getByText('page body')).toBeInTheDocument();
    // Every nav entry the app declares is present — the loading branch of the
    // dashboard used to pass sidebarItems={[]} and render an empty sidebar.
    for (const item of navItems) {
      // Scoped to the nav: the Topbar title can repeat a nav label.
      expect(within(nav).getByText(item.label)).toBeInTheDocument();
    }
  });

  it('actually logs out, instead of the no-op most pages used to pass', async () => {
    renderLocalized(<AppShell title="Dashboard"><p>body</p></AppShell>);

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));

    expect(logout).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("navigates with the router's link rather than a plain anchor", () => {
    const { container } = renderLocalized(<AppShell title="Dashboard"><p>body</p></AppShell>);

    const enabled = navItems.filter((item) => item.href && !item.disabled);
    expect(container.querySelectorAll('[data-next-link="true"]')).toHaveLength(enabled.length);
  });

  it('highlights the entry for the current route, with no page passing an id', () => {
    const target = navItems.find((item) => item.href && item.href !== '/' && !item.disabled)!;
    pathname.current = target.href!;

    renderLocalized(<AppShell title="Dashboard"><p>body</p></AppShell>);

    expect(screen.getByText(target.label).closest('a')?.className).toContain('bg-donor-primary/12');
  });

  it('keeps the section highlighted on a nested route', () => {
    const target = navItems.find((item) => item.href && item.href !== '/' && !item.disabled)!;
    pathname.current = `${target.href}/some-id`;

    renderLocalized(<AppShell title="Dashboard"><p>body</p></AppShell>);

    expect(screen.getByText(target.label).closest('a')?.className).toContain('bg-donor-primary/12');
  });

  /**
   * The bell used to be absent because no portal passed `onNotifications` to
   * the shared `Topbar` -- the inbox existed in the API and no console read
   * it. Sprint 4 gave all three the same notification centre, so the
   * assertion is now that the bell is here and opens the inbox.
   */
  it('renders the notifications bell in the topbar', () => {
    renderLocalized(<AppShell title="Dashboard"><p>body</p></AppShell>);

    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('opens the notifications page from the bell dropdown', async () => {
    const user = userEvent.setup();
    renderLocalized(<AppShell title="Dashboard"><p>body</p></AppShell>);

    await user.click(screen.getByRole('button', { name: 'Notifications' }));

    await user.click(await screen.findByRole('button', { name: 'View all notifications' }));

    expect(push).toHaveBeenCalledWith('/notifications');
  });
});
