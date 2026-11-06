import { useMemo, useState } from 'react';
import { cn } from '../cn';

export interface DataTableColumn<T> {
  key: string;
  sortValue?: (row: T) => string | number;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  keyExtractor: (row: T) => string;
  className?: string;
  selectedKey?: string;
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
  selectedKey,
  loading,
  emptyMessage,
  onRowClick,
  rowLabel,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; descending: boolean } | null>(null);
  const displayedRows = useMemo(() => {
    const column = columns.find((c) => c.key === sort?.key);
    if (!column?.sortValue || !sort) return rows;
    const value = column.sortValue;
    return [...rows].sort((a, b) => {
      const left = value(a),
        right = value(b);
      const result =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : String(left).localeCompare(String(right), undefined, { numeric: true });
      return sort.descending ? -result : result;
    });
  }, [rows, columns, sort]);
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
      <div className="bc-table-scroll">
        <table className="bc-data-table w-full text-left text-sm">
          {/* Solid, not glass -- a translucent sticky header would let scrolled
              rows show through and blur the column labels along with them. */}
          <thead className="bc-solid border-0 border-b border-donor-border/60">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={
                    col.sortValue
                      ? sort?.key === col.key
                        ? sort.descending
                          ? 'descending'
                          : 'ascending'
                        : 'none'
                      : undefined
                  }
                  className={cn(
                    'whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-wider text-donor-muted',
                    col.className,
                  )}
                >
                  {col.sortValue ? (
                    <button
                      type="button"
                      className="bc-sort-button"
                      onClick={() =>
                        setSort((previous) => ({
                          key: col.key,
                          descending: previous?.key === col.key && !previous.descending,
                        }))
                      }
                    >
                      {col.header}
                      <span aria-hidden="true">
                        {sort?.key === col.key ? (sort.descending ? ' ↓' : ' ↑') : ' ↕'}
                      </span>
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-donor-border/60">
            {displayedRows.map((row) => (
              <tr
                key={keyExtractor(row)}
                data-selected={selectedKey === keyExtractor(row) || undefined}
                className={cn(
                  'transition-colors hover:bg-donor-elevated/60',
                  onRowClick &&
                    'cursor-pointer focus:bg-donor-elevated/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-donor-primary',
                )}
                {...(onRowClick && {
                  onClick: (event: React.MouseEvent<HTMLTableRowElement>) => {
                    if (
                      !(event.target instanceof Element) ||
                      !event.target.closest('button,a,input,select,textarea')
                    )
                      onRowClick(row);
                  },
                  onKeyDown: (event: React.KeyboardEvent<HTMLTableRowElement>) => {
                    if (
                      event.target === event.currentTarget &&
                      (event.key === 'Enter' || event.key === ' ')
                    ) {
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
