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
}

export function DataTable<T>({
  columns,
  rows,
  keyExtractor,
  className,
  loading,
  emptyMessage,
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
      <table className="w-full text-left text-sm">
        {/* Solid, not glass -- a translucent sticky header would let scrolled
            rows show through and blur the column labels along with them. */}
        <thead className="bc-solid border-0 border-b border-donor-border/60">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-5 py-3 text-xs font-semibold uppercase tracking-wider text-donor-muted',
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
            <tr key={keyExtractor(row)} className="transition-colors hover:bg-donor-elevated/60">
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
  );
}
