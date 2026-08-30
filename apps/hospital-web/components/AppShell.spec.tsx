import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

vi.mock('../lib/auth', () => ({ logout: vi.fn() }));

import { logout } from '../lib/auth';
import { sidebarItems } from '../lib/navigation';
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
    render(<AppShell title="Dashboard">
      <p>page body</p>
    </AppShell>);

    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(screen.getByText('page body')).toBeInTheDocument();
    // Every nav entry the app declares is present — the loading branch of the
    // dashboard used to pass sidebarItems={[]} and render an empty sidebar.
    for (const item of sidebarItems) {
      // Scoped to the nav: the Topbar title can repeat a nav label.
      expect(within(nav).getByText(item.label)).toBeInTheDocument();
    }
  });

  it('actually logs out, instead of the no-op most pages used to pass', async () => {
    render(<AppShell title="Dashboard"><p>body</p></AppShell>);

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));

    expect(logout).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("navigates with the router's link rather than a plain anchor", () => {
    const { container } = render(<AppShell title="Dashboard"><p>body</p></AppShell>);

    const enabled = sidebarItems.filter((item) => item.href && !item.disabled);
    expect(container.querySelectorAll('[data-next-link="true"]')).toHaveLength(enabled.length);
  });

  it('highlights the entry for the current route, with no page passing an id', () => {
    const target = sidebarItems.find((item) => item.href && item.href !== '/' && !item.disabled)!;
    pathname.current = target.href!;

    render(<AppShell title="Dashboard"><p>body</p></AppShell>);

    expect(screen.getByText(target.label).closest('a')?.className).toContain('bg-donor-elevated');
  });

  it('keeps the section highlighted on a nested route', () => {
    const target = sidebarItems.find((item) => item.href && item.href !== '/' && !item.disabled)!;
    pathname.current = `${target.href}/some-id`;

    render(<AppShell title="Dashboard"><p>body</p></AppShell>);

    expect(screen.getByText(target.label).closest('a')?.className).toContain('bg-donor-elevated');
  });

  it('renders no notifications bell, since this app has no notifications route', () => {
    render(<AppShell title="Dashboard"><p>body</p></AppShell>);

    expect(screen.queryByRole('button', { name: 'Notifications' })).not.toBeInTheDocument();
  });
});
