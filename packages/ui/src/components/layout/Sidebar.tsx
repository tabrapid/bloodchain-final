import type { ReactNode } from 'react';
import { cn } from '../cn';
import { Activity, type LucideIcon } from 'lucide-react';

export interface SidebarItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  href?: string;
  disabled?: boolean;
  badge?: string;
}

/**
 * Anything that renders an anchor: a plain `a`, or a router-aware link such as
 * Next.js's. This package stays framework-agnostic — it peer-depends on React
 * alone — so consumers inject their own rather than the library importing a
 * router. Without one every sidebar click is a full document load.
 */
export interface SidebarLinkProps {
  href: string;
  className?: string;
  children?: ReactNode;
}

/**
 * Typed as a plain function rather than `ComponentType`, because Next.js's
 * `Link` is a `ForwardRefExoticComponent` whose legacy `propTypes` static
 * declares `href: Url` — assignable to `ComponentType<{ href: string }>` fails
 * on that static alone. A call signature is all this component needs.
 */
export type SidebarLinkComponent = (props: SidebarLinkProps) => ReactNode;

const DefaultLink: SidebarLinkComponent = ({ href, className, children }) => (
  <a href={href} className={className}>
    {children}
  </a>
);

export interface SidebarProps {
  items: SidebarItem[];
  /** Explicit active item id. Wins over `currentPath` when both are given. */
  activeItem?: string;
  /**
   * The route currently being displayed. When `activeItem` is absent the active
   * entry is derived from this by longest matching `href`, so callers do not
   * have to hand-copy an id onto every page — which is how admin-web ended up
   * highlighting nothing at all across all fifteen of its pages.
   */
  currentPath?: string;
  linkComponent?: SidebarLinkComponent;
  organizationName?: string;
  organizationType?: string;
  className?: string;
}

/**
 * Longest matching href wins, so `/requests/new` selects the `/requests` entry
 * rather than the `/` one. Exported for tests; the matching rule is the part
 * worth pinning.
 */
export function resolveActiveItem(
  items: SidebarItem[],
  currentPath?: string,
): string | undefined {
  if (!currentPath) return undefined;

  let best: SidebarItem | undefined;
  for (const item of items) {
    if (item.disabled || !item.href) continue;
    const matches =
      item.href === '/'
        ? currentPath === '/'
        : currentPath === item.href || currentPath.startsWith(`${item.href}/`);
    if (matches && (!best || item.href.length > best.href!.length)) {
      best = item;
    }
  }
  return best?.id;
}

export function Sidebar({
  items,
  activeItem,
  currentPath,
  linkComponent: Link = DefaultLink,
  organizationName,
  organizationType,
  className,
}: SidebarProps) {
  const active = activeItem ?? resolveActiveItem(items, currentPath);

  return (
    <aside
      className={cn(
        'bc-glass-chrome relative z-10 flex w-64 flex-col border-r border-donor-border/60 px-5 py-8',
        className,
      )}
    >
      <div className="mb-10 flex items-center gap-3 px-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-donor-primary/15 text-donor-primary">
          <Activity size={18} />
        </span>
        <span className="font-semibold tracking-wider text-donor-text">BloodChain</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
        {items.map((item) => {
          const Icon = item.icon ?? Activity;
          const isActive = item.id === active;
          const className = cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
            isActive && 'bg-donor-elevated text-donor-text',
            !isActive &&
              !item.disabled &&
              'text-donor-muted hover:bg-donor-surface hover:text-donor-text',
            item.disabled && 'cursor-not-allowed opacity-50',
          );
          const content = (
            <>
              <Icon size={17} />
              <span className="flex-1">{item.label}</span>
              {item.disabled && (
                <span className="text-[10px] uppercase tracking-wider text-donor-muted/70">
                  Soon
                </span>
              )}
              {item.badge && (
                <span className="rounded-full bg-donor-primary px-2 py-0.5 text-[10px] font-semibold text-white">
                  {item.badge}
                </span>
              )}
            </>
          );

          if (item.disabled || !item.href) {
            return (
              <div key={item.id} className={className} aria-disabled={item.disabled}>
                {content}
              </div>
            );
          }

          return (
            <Link key={item.id} href={item.href} className={className}>
              {content}
            </Link>
          );
        })}
      </nav>

      {(organizationName || organizationType) && (
        <div className="mt-auto border-t border-donor-border/60 px-3 pt-5">
          <p className="text-sm font-medium text-donor-text">{organizationName}</p>
          {organizationType && <p className="text-xs text-donor-muted">{organizationType}</p>}
        </div>
      )}
    </aside>
  );
}
