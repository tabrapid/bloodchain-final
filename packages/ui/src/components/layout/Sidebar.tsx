import { cn } from '../cn';
import { Activity, type LucideIcon } from 'lucide-react';

export interface SidebarItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
  badge?: string;
}

export interface SidebarProps {
  items: SidebarItem[];
  activeItem?: string;
  organizationName?: string;
  organizationType?: string;
  className?: string;
}

export function Sidebar({
  items,
  activeItem,
  organizationName,
  organizationType,
  className,
}: SidebarProps) {
  return (
    <aside
      className={cn(
        'flex w-64 flex-col border-r border-[#1B2B34] bg-[#081018] px-5 py-8',
        className,
      )}
    >
      <div className="mb-10 flex items-center gap-3 px-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#D85360]/15 text-[#D85360]">
          <Activity size={18} />
        </span>
        <span className="font-semibold tracking-wider text-[#F2F5F7]">DONOR</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const Icon = item.icon ?? Activity;
          const isActive = item.id === activeItem;
          return (
            <div
              key={item.id}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                isActive && 'bg-[#172731] text-[#F2F5F7]',
                !isActive &&
                  !item.disabled &&
                  'text-[#8495A3] hover:bg-[#111A24] hover:text-[#F2F5F7]',
                item.disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              <Icon size={17} />
              <span className="flex-1">{item.label}</span>
              {item.disabled && (
                <span className="text-[10px] uppercase tracking-wider text-[#52636C]">Soon</span>
              )}
              {item.badge && (
                <span className="rounded-full bg-[#D85360] px-2 py-0.5 text-[10px] font-semibold text-white">
                  {item.badge}
                </span>
              )}
            </div>
          );
        })}
      </nav>

      {(organizationName || organizationType) && (
        <div className="mt-auto border-t border-[#1B2B34] px-3 pt-5">
          <p className="text-sm font-medium text-[#F2F5F7]">{organizationName}</p>
          {organizationType && <p className="text-xs text-[#8495A3]">{organizationType}</p>}
        </div>
      )}
    </aside>
  );
}
