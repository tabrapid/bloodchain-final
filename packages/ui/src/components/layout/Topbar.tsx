import { Bell, LogOut, Menu, Search } from 'lucide-react';
import { cn } from '../cn';

export interface TopbarProps {
  title: string;
  subtitle?: string;
  userName?: string;
  onSearch?: (query: string) => void;
  onNotifications?: () => void;
  onLogout?: () => void;
  /** Renders a hamburger button, `lg:hidden`, that opens the off-canvas sidebar. */
  onMenuClick?: () => void;
  className?: string;
}

const iconButton =
  'bc-solid rounded-lg p-2.5 text-donor-text outline-none transition-colors hover:bg-donor-elevated focus-visible:ring-2 focus-visible:ring-donor-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-donor-bg';

export function Topbar({
  title,
  subtitle,
  userName,
  onSearch,
  onNotifications,
  onLogout,
  onMenuClick,
  className,
}: TopbarProps) {
  return (
    <header
      className={cn(
        'bc-glass-chrome relative z-10 flex items-center justify-between gap-4 border-b border-donor-border/60 px-4 py-4 sm:px-6 sm:py-5 lg:px-10',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className={cn(iconButton, 'lg:hidden')}
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
        )}
        <div className="min-w-0">
          {subtitle && (
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-donor-muted">
              {subtitle}
            </p>
          )}
          <h1 className="truncate text-xl font-bold tracking-tight text-donor-text sm:text-[26px]">
            {title}
          </h1>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {onSearch && (
          <div className="bc-solid hidden items-center gap-2 rounded-lg px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-donor-primary/50 md:flex">
            <Search size={16} className="text-donor-muted" />
            <input
              type="text"
              placeholder="Search..."
              onChange={(e) => onSearch(e.target.value)}
              className="w-40 bg-transparent text-sm text-donor-text placeholder:text-donor-muted focus:outline-none lg:w-56"
            />
          </div>
        )}
        {onNotifications && (
          <button onClick={onNotifications} className={iconButton} aria-label="Notifications">
            <Bell size={18} />
          </button>
        )}
        {userName && (
          <div className="hidden items-center gap-3 border-l border-donor-border/60 pl-3 md:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-donor-primary/15 text-sm font-semibold text-donor-primary ring-1 ring-donor-border/60">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="hidden max-w-[10rem] truncate text-sm font-medium text-donor-text lg:block">
              {userName}
            </span>
          </div>
        )}
        {onLogout && (
          <button onClick={onLogout} className={iconButton} aria-label="Log out">
            <LogOut size={18} />
          </button>
        )}
      </div>
    </header>
  );
}
