import type { ReactNode } from 'react';
import { PropsWithChildren, useEffect, useState } from 'react';
import { Sidebar, SidebarItem, type SidebarLinkComponent } from './Sidebar';
import { Topbar } from './Topbar';
import { cn } from '../cn';
import { WorkspaceToolbar } from './WorkspaceToolbar';

export interface DashboardShellProps extends PropsWithChildren {
  clinical?: boolean;
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
  /** Extra top-bar controls, passed through to `Topbar`. */
  topbarActions?: ReactNode;
  className?: string;
}

export function DashboardShell({
  children,
  clinical = false,
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
  topbarActions,
  className,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [compact, setCompact] = useState(clinical);
  const densityKey = clinical ? 'bloodchain.clinical.compact' : 'bloodchain.workspace.compact';

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(densityKey);
      setCompact(saved === null ? clinical : saved === 'true');
    } catch {
      /* Private browsing can disable storage. */
    }
  }, [densityKey, clinical]);

  const changeCompact = (value: boolean) => {
    setCompact(value);
    try {
      window.localStorage.setItem(densityKey, String(value));
    } catch {
      /* The toggle still works for the current page. */
    }
  };

  // A route change is the one moment a drawer left open should close itself
  // -- otherwise the backdrop from the page you navigated away from sits
  // over the new one.
  useEffect(() => {
    setSidebarOpen(false);
  }, [currentPath]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [sidebarOpen]);

  return (
    <div
      className={cn(
        'bc-app-bg flex min-h-screen text-donor-text',
        compact && 'bc-compact',
        clinical && 'bc-clinical',
        className,
      )}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:p-3 focus:text-slate-900"
      >
        {title}
      </a>
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
      <div className="bc-workspace flex min-w-0 flex-1 flex-col">
        <Topbar
          title={title}
          subtitle={subtitle}
          userName={userName}
          onSearch={onSearch}
          onNotifications={onNotifications}
          onLogout={onLogout}
          onMenuClick={() => setSidebarOpen((open) => !open)}
          actions={topbarActions}
        />
        <WorkspaceToolbar
          organizationName={organizationName}
          compact={compact}
          onCompactChange={changeCompact}
        />
        <main id="main-content" className="bc-main flex-1 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
