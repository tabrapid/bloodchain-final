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
        'flex items-center justify-between border-b border-[#1B2B34] bg-[#081018]/80 px-6 py-5 backdrop-blur lg:px-10',
        className,
      )}
    >
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#8495A3]">
          {subtitle}
        </p>
        <h1 className="font-semibold text-[#F2F5F7]">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        {onSearch && (
          <div className="hidden items-center gap-2 rounded-lg border border-[#253442] bg-[#111A24] px-3 py-2 md:flex">
            <Search size={16} className="text-[#8495A3]" />
            <input
              type="text"
              placeholder="Search..."
              onChange={(e) => onSearch(e.target.value)}
              className="bg-transparent text-sm text-[#F2F5F7] placeholder:text-[#8495A3] focus:outline-none"
            />
          </div>
        )}
        {onNotifications && (
          <button
            onClick={onNotifications}
            className="rounded-lg border border-[#253442] bg-[#111A24] p-2.5 text-[#BACAD0] transition-colors hover:bg-[#182431]"
            aria-label="Notifications"
          >
            <Bell size={18} />
          </button>
        )}
        {userName && (
          <div className="hidden items-center gap-3 md:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#253442] text-sm font-semibold text-[#F2F5F7]">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="hidden text-sm text-[#F2F5F7] lg:block">{userName}</span>
          </div>
        )}
        {onLogout && (
          <button
            onClick={onLogout}
            className="rounded-lg border border-[#253442] bg-[#111A24] p-2.5 text-[#BACAD0] transition-colors hover:bg-[#182431]"
            aria-label="Log out"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
    </header>
  );
}
