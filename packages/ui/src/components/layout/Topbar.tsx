import { Bell, LogOut, Search } from 'lucide-react';
import { cn } from '../cn';

export interface TopbarProps {
  title: string;
  subtitle?: string;
  userName?: string;
  onSearch?: (query: string) => void;
  onNotifications?: () => void;
  onLogout?: () => void;
  className?: string;
}

export function Topbar({
  title,
  subtitle,
  userName,
  onSearch,
  onNotifications,
  onLogout,
  className,
}: TopbarProps) {
  return (
    <header
      className={cn(
        'bc-glass-chrome relative z-10 flex items-center justify-between border-b border-donor-border/60 px-6 py-5 lg:px-10',
        className,
      )}
    >
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-donor-muted">
          {subtitle}
        </p>
        <h1 className="font-semibold text-donor-text">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        {onSearch && (
          <div className="bc-solid hidden items-center gap-2 rounded-lg px-3 py-2 focus-within:border-donor-secondary md:flex">
            <Search size={16} className="text-donor-muted" />
            <input
              type="text"
              placeholder="Search..."
              onChange={(e) => onSearch(e.target.value)}
              className="bg-transparent text-sm text-donor-text placeholder:text-donor-muted focus:outline-none"
            />
          </div>
        )}
        {onNotifications && (
          <button
            onClick={onNotifications}
            className="bc-solid rounded-lg p-2.5 text-donor-text transition-colors hover:bg-donor-elevated"
            aria-label="Notifications"
          >
            <Bell size={18} />
          </button>
        )}
        {userName && (
          <div className="hidden items-center gap-3 md:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-donor-primary/15 text-sm font-semibold text-donor-primary">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="hidden text-sm text-donor-text lg:block">{userName}</span>
          </div>
        )}
        {onLogout && (
          <button
            onClick={onLogout}
            className="bc-solid rounded-lg p-2.5 text-donor-text transition-colors hover:bg-donor-elevated"
            aria-label="Log out"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
    </header>
  );
}
