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
      <div className={cn('rounded-2xl border border-[#253442] bg-[#111A24] p-6', className)}>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-[#182431]" />
          ))}
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div
        className={cn(
          'rounded-2xl border border-[#253442] bg-[#111A24] p-10 text-center',
          className,
        )}
      >
        <p className="text-sm text-[#8495A3]">{emptyMessage ?? 'No data available.'}</p>
      </div>
    );
  }

  return (
    <div
      className={cn('overflow-hidden rounded-2xl border border-[#253442] bg-[#111A24]', className)}
    >
      <table className="w-full text-left text-sm">
        <thead className="bg-[#182431]">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[#8495A3]',
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#253442]">
          {rows.map((row) => (
            <tr key={keyExtractor(row)} className="hover:bg-[#182431]/50">
              {columns.map((col) => (
                <td key={col.key} className={cn('px-5 py-3.5 text-[#F2F5F7]', col.className)}>
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
