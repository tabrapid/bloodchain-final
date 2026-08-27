import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DashboardShell } from './DashboardShell';
import type { SidebarItem, SidebarLinkComponent } from './Sidebar';

const items: SidebarItem[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/' },
  { id: 'shipments', label: 'Shipments', href: '/shipments' },
];

/**
 * The shell's job is to pass navigation state through to the Sidebar. It did
 * not forward `currentPath` or `linkComponent` before P3-15 because neither
 * existed, which is why every page had to hand-copy an `activeItem` literal.
 */
describe('DashboardShell', () => {
  it('renders the sidebar, the topbar and its children together', () => {
    render(
      <DashboardShell title="Shipments" subtitle="Hospital" sidebarItems={items}>
        <p>Shipment table</p>
      </DashboardShell>,
    );

    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Shipments' })).toBeInTheDocument();
    expect(screen.getByText('Shipment table')).toBeInTheDocument();
  });

  it('forwards currentPath so the sidebar can derive the active entry', () => {
    render(
      <DashboardShell title="Shipments" sidebarItems={items} currentPath="/shipments">
        <p>content</p>
      </DashboardShell>,
    );

    expect(screen.getByText('Shipments', { selector: 'span' }).closest('a')?.className).toContain(
      'bg-[#172731]',
    );
  });

  it('forwards the injected link component down to the sidebar', () => {
    const RouterLink: SidebarLinkComponent = ({ href, className, children }) => (
      <a href={href} className={className} data-router-link="true">
        {children}
      </a>
    );

    const { container } = render(
      <DashboardShell title="Shipments" sidebarItems={items} linkComponent={RouterLink}>
        <p>content</p>
      </DashboardShell>,
    );

    expect(container.querySelectorAll('[data-router-link="true"]')).toHaveLength(2);
  });
});
