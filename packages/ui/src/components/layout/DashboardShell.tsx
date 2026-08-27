import { PropsWithChildren } from 'react';
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
  return (
    <div className={cn('flex min-h-screen bg-[#081018] text-[#F2F5F7]', className)}>
      <Sidebar
        items={sidebarItems}
        activeItem={activeItem}
        currentPath={currentPath}
        linkComponent={linkComponent}
        organizationName={organizationName}
        organizationType={organizationType}
      />
      <div className="flex flex-1 flex-col">
        <Topbar
          title={title}
          subtitle={subtitle}
          userName={userName}
          onSearch={onSearch}
          onNotifications={onNotifications}
          onLogout={onLogout}
        />
        <main className="flex-1 p-6 lg:p-10">{children}</main>
      </div>
    </div>
  );
}
