import { cn } from '../cn';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  keyExtractor: (row: T) => string;
  className?: string;
  loading?: boolean;
  emptyMessage?: string;
  /**
   * Makes each row open something -- a detail modal, a drilldown page.
   * Rows already carried a hover highlight, which promises a click; wiring
   * this is what makes the promise true, and it adds the keyboard path
   * (Enter / Space) that a bare `onClick` on a `<tr>` would not have.
   */
  onRowClick?: (row: T) => void;
  /** Accessible label for a clickable row, e.g. `(u) => \`Unit \${u.reference}\``. */
  rowLabel?: (row: T) => string;
}

export function DataTable<T>({
  columns,
  rows,
  keyExtractor,
  className,
  loading,
  emptyMessage,
  onRowClick,
  rowLabel,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className={cn('bc-glass rounded-card p-6', className)}>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-donor-elevated" />
          ))}
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={cn('bc-glass rounded-card p-10 text-center', className)}>
        <p className="text-sm text-donor-muted">{emptyMessage ?? 'No data available.'}</p>
      </div>
    );
  }

  return (
    <div className={cn('bc-glass overflow-hidden rounded-card', className)}>
      {/* The card clips to its rounded corners (`overflow-hidden` above);
          this inner wrapper is what actually scrolls a table too wide for a
          small screen, instead of silently clipping columns off the edge. */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          {/* Solid, not glass -- a translucent sticky header would let scrolled
              rows show through and blur the column labels along with them. */}
          <thead className="bc-solid border-0 border-b border-donor-border/60">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    'whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-wider text-donor-muted',
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-donor-border/60">
            {rows.map((row) => (
              <tr
                key={keyExtractor(row)}
                className={cn(
                  'transition-colors hover:bg-donor-elevated/60',
                  onRowClick &&
                    'cursor-pointer focus:bg-donor-elevated/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-donor-primary',
                )}
                {...(onRowClick && {
                  onClick: () => onRowClick(row),
                  onKeyDown: (event: React.KeyboardEvent<HTMLTableRowElement>) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onRowClick(row);
                    }
                  },
                  role: 'button',
                  tabIndex: 0,
                  'aria-label': rowLabel?.(row),
                })}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-5 py-3.5 text-donor-text', col.className)}>
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
