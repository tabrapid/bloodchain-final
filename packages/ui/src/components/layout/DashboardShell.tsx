import { PropsWithChildren, useEffect, useState } from 'react';
import { Sidebar, SidebarItem, type SidebarLinkComponent } from './Sidebar';
import { Topbar } from './Topbar';
import { cn } from '../cn';

export interface DashboardShellProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  sidebarItems: SidebarItem[];
  activeItem?: string;
  currentPath?: string;
  linkComponent?: SidebarLinkComponent;
  organizationName?: string;
  organizationType?: string;
  userName?: string;
  onSearch?: (query: string) => void;
  onNotifications?: () => void;
  onLogout?: () => void;
  className?: string;
}

export function DashboardShell({
  children,
  title,
  subtitle,
  sidebarItems,
  activeItem,
  currentPath,
  linkComponent,
  organizationName,
  organizationType,
  userName,
  onSearch,
  onNotifications,
  onLogout,
  className,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // A route change is the one moment a drawer left open should close itself
  // -- otherwise the backdrop from the page you navigated away from sits
  // over the new one.
  useEffect(() => {
    setSidebarOpen(false);
  }, [currentPath]);

  return (
    <div className={cn('bc-app-bg flex min-h-screen text-donor-text', className)}>
      <Sidebar
        items={sidebarItems}
        activeItem={activeItem}
        currentPath={currentPath}
        linkComponent={linkComponent}
        organizationName={organizationName}
        organizationType={organizationType}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          title={title}
          subtitle={subtitle}
          userName={userName}
          onSearch={onSearch}
          onNotifications={onNotifications}
          onLogout={onLogout}
          onMenuClick={() => setSidebarOpen((open) => !open)}
        />
        <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-10">{children}</main>
      </div>
    </div>
  );
}
