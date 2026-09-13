import type { ReactNode } from 'react';
import { cn } from '../cn';
import { Activity, type LucideIcon } from 'lucide-react';

export interface SidebarItem {
  id: string;
  /**
   * The rendered text.
   *
   * Kept alongside `labelKey` rather than replaced by it: a console builds its
   * item list at module load, where there is no locale, so it stores the key
   * and its shell resolves it. `label` remains the fallback for anything that
   * has no catalogue entry yet.
   */
  label: string;
  /** A catalogue key, resolved by the shell that renders this item. */
  labelKey?: string;
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
  /**
   * Below `lg`, the sidebar becomes an off-canvas drawer instead of a
   * permanent column. `isOpen`/`onClose` drive that state; both are optional
   * so the component still renders sensibly (permanently open, no backdrop)
   * for a consumer that hasn't wired up the toggle.
   */
  isOpen?: boolean;
  onClose?: () => void;
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
  isOpen = true,
  onClose,
}: SidebarProps) {
  const active = activeItem ?? resolveActiveItem(items, currentPath);

  return (
    <>
      {/* Backdrop: only meaningful (and only rendered) below `lg`, where the
          sidebar is an off-canvas drawer over the content instead of a
          permanent column. */}
      {onClose && (
        <div
          className={cn(
            'fixed inset-0 z-30 bg-black/50 transition-opacity lg:hidden',
            isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'bc-glass-chrome fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-donor-border/60 px-5 py-8 transition-transform duration-200 ease-out lg:static lg:z-10 lg:w-64 lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          className,
        )}
      >
        <div className="mb-10 flex items-center gap-3 px-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-donor-primary/15 text-donor-primary">
            <Activity size={18} />
          </span>
          <span className="font-semibold tracking-wider text-donor-text">BloodChain</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto" aria-label="Main">
          {items.map((item) => {
            const Icon = item.icon ?? Activity;
            const isActive = item.id === active;
            const className = cn(
              'group relative flex items-center gap-3 rounded-lg py-2.5 pl-4 pr-3 text-sm font-medium outline-none transition-colors',
              'focus-visible:ring-2 focus-visible:ring-donor-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-donor-bg',
              isActive && 'bg-donor-primary/12 text-donor-text',
              !isActive &&
                !item.disabled &&
                'text-donor-muted hover:bg-donor-elevated hover:text-donor-text',
              item.disabled && 'cursor-not-allowed text-donor-muted/50',
            );
            const content = (
              <>
                {/* Active-state affordance beyond color alone: a left accent
                    bar, so the current item is unmistakable for anyone who
                    can't rely on the red tint (color-blindness, a washed-out
                    display). */}
                <span
                  className={cn(
                    'absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-donor-primary transition-opacity',
                    isActive ? 'opacity-100' : 'opacity-0',
                  )}
                  aria-hidden="true"
                />
                <Icon size={17} className={isActive ? 'text-donor-primary' : undefined} />
                <span className="flex-1">{item.label}</span>
                {item.disabled && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-donor-muted">
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
              <Link
                key={item.id}
                href={item.href}
                className={className}
                aria-current={isActive ? 'page' : undefined}
              >
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
    </>
  );
}
