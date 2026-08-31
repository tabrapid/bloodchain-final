import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Activity, Droplet, LayoutDashboard, Package } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import { Sidebar, resolveActiveItem, type SidebarItem, type SidebarLinkComponent } from './Sidebar';

/**
 * P3-15 regression tests.
 *
 * The sidebar had three defects that no test could have caught, because it had
 * no tests: it rendered plain anchors with nobody injecting a router-aware link
 * (so every click was a full document load), it only knew which entry was
 * active if the caller hand-copied an id onto every page (admin-web never did,
 * across all fifteen of its pages), and disabled entries were indistinguishable
 * to assistive tech from enabled ones.
 */

const items: SidebarItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { id: 'requests', label: 'Blood Requests', icon: Droplet, href: '/requests' },
  { id: 'shipments', label: 'Shipments', icon: Activity, href: '/shipments' },
  { id: 'inventory', label: 'Inventory', icon: Package, disabled: true },
];

describe('resolveActiveItem', () => {
  it('matches an exact route', () => {
    expect(resolveActiveItem(items, '/requests')).toBe('requests');
  });

  it('matches a nested route to its section', () => {
    expect(resolveActiveItem(items, '/requests/abc-123')).toBe('requests');
    expect(resolveActiveItem(items, '/requests/new')).toBe('requests');
  });

  it('does not let the root entry swallow every route', () => {
    // '/' is a prefix of everything, so a naive startsWith would light up
    // Dashboard on every page in the app.
    expect(resolveActiveItem(items, '/shipments')).toBe('shipments');
    expect(resolveActiveItem(items, '/')).toBe('dashboard');
  });

  it('does not match a route that merely shares a prefix', () => {
    expect(resolveActiveItem(items, '/requests-archive')).toBeUndefined();
  });

  it('never selects a disabled entry', () => {
    expect(resolveActiveItem(items, '/inventory')).toBeUndefined();
  });

  it('returns nothing when there is no current path', () => {
    expect(resolveActiveItem(items, undefined)).toBeUndefined();
  });
});

describe('Sidebar', () => {
  it('renders every item, with disabled ones marked for assistive tech', () => {
    render(<Sidebar items={items} />);

    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    for (const item of items) {
      expect(screen.getByText(item.label)).toBeInTheDocument();
    }
    expect(screen.getByText('Inventory').closest('[aria-disabled="true"]')).not.toBeNull();
    expect(screen.getByText('Soon')).toBeInTheDocument();
  });

  it('gives disabled items no link at all, so they cannot be navigated to', () => {
    render(<Sidebar items={items} />);

    const links = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/', '/requests', '/shipments']);
  });

  it('highlights the entry derived from currentPath', () => {
    render(<Sidebar items={items} currentPath="/shipments" />);

    expect(screen.getByText('Shipments').closest('a')?.className).toContain('bg-donor-primary/12');
    expect(screen.getByText('Dashboard').closest('a')?.className).not.toContain('bg-donor-primary/12');
  });

  it('lets an explicit activeItem override the derived one', () => {
    render(<Sidebar items={items} currentPath="/shipments" activeItem="requests" />);

    expect(screen.getByText('Blood Requests').closest('a')?.className).toContain('bg-donor-primary/12');
    expect(screen.getByText('Shipments').closest('a')?.className).not.toContain('bg-donor-primary/12');
  });

  it('highlights nothing when neither is supplied', () => {
    const { container } = render(<Sidebar items={items} />);

    expect(container.querySelectorAll('.bg-\\[\\#172731\\]')).toHaveLength(0);
  });

  it('routes clicks through an injected link component instead of reloading', async () => {
    // The real bug: with plain anchors, every sidebar click in these Next.js
    // apps threw away the React tree and re-downloaded the bundle.
    const navigate = vi.fn();
    const RouterLink: SidebarLinkComponent = ({ href, className, children }) => (
      <a
        href={href}
        className={className}
        onClick={(event) => {
          event.preventDefault();
          navigate(href);
        }}
      >
        {children}
      </a>
    );

    render(<Sidebar items={items} linkComponent={RouterLink} />);
    await userEvent.click(screen.getByText('Blood Requests'));

    expect(navigate).toHaveBeenCalledWith('/requests');
  });

  it('renders the organization footer only when given one', () => {
    const { rerender } = render(<Sidebar items={items} />);
    expect(screen.queryByText('Northstar')).not.toBeInTheDocument();

    rerender(<Sidebar items={items} organizationName="Northstar" organizationType="Blood Center" />);
    expect(screen.getByText('Northstar')).toBeInTheDocument();
    expect(screen.getByText('Blood Center')).toBeInTheDocument();
  });

  it('shows a badge when an item carries one', () => {
    render(<Sidebar items={[{ id: 'alerts', label: 'Alerts', href: '/alerts', badge: '7' }]} />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });
});
