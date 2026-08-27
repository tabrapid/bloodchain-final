import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DataTable, type DataTableColumn } from './DataTable';

interface Row {
  id: string;
  reference: string;
  units: number;
  notes?: string | null;
}

const columns: DataTableColumn<Row>[] = [
  { key: 'reference', header: 'Reference' },
  { key: 'units', header: 'Units' },
  { key: 'notes', header: 'Notes' },
];

const rows: Row[] = [
  { id: 'a', reference: 'REQ-1', units: 3, notes: 'urgent' },
  { id: 'b', reference: 'REQ-2', units: 0, notes: null },
];

/**
 * P3-16. DataTable backs every list screen in the three dashboards and had no
 * tests. The cases worth pinning are its three mutually exclusive states and
 * the fallback it applies to missing cell values — `String(value ?? '-')`,
 * which has to leave a real `0` alone rather than treating it as absent.
 */
describe('DataTable', () => {
  it('renders headers and a row per record', () => {
    render(<DataTable columns={columns} rows={rows} keyExtractor={(row) => row.id} />);

    expect(screen.getByRole('columnheader', { name: 'Reference' })).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(rows.length + 1);
    expect(screen.getByText('REQ-1')).toBeInTheDocument();
    expect(screen.getByText('REQ-2')).toBeInTheDocument();
  });

  it('renders a numeric zero as 0, not as a missing value', () => {
    render(<DataTable columns={columns} rows={rows} keyExtractor={(row) => row.id} />);

    const secondRow = screen.getByText('REQ-2').closest('tr')!;
    expect(within(secondRow).getByText('0')).toBeInTheDocument();
  });

  it('falls back to a dash for null and undefined cells', () => {
    render(<DataTable columns={columns} rows={rows} keyExtractor={(row) => row.id} />);

    const secondRow = screen.getByText('REQ-2').closest('tr')!;
    expect(within(secondRow).getByText('-')).toBeInTheDocument();
  });

  it('uses a column render function when one is given', () => {
    const withRender: DataTableColumn<Row>[] = [
      { key: 'reference', header: 'Reference' },
      { key: 'units', header: 'Units', render: (row) => <strong>{row.units} bags</strong> },
    ];

    render(<DataTable columns={withRender} rows={rows} keyExtractor={(row) => row.id} />);

    expect(screen.getByText('3 bags')).toBeInTheDocument();
    expect(screen.getByText('0 bags')).toBeInTheDocument();
  });

  it('shows the empty message instead of a table when there are no rows', () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        keyExtractor={(row) => row.id}
        emptyMessage="No blood requests yet."
      />,
    );

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('No blood requests yet.')).toBeInTheDocument();
  });

  it('has a default empty message', () => {
    render(<DataTable columns={columns} rows={[]} keyExtractor={(row) => row.id} />);

    expect(screen.getByText('No data available.')).toBeInTheDocument();
  });

  it('shows skeletons while loading, even if rows are already present', () => {
    const { container } = render(
      <DataTable columns={columns} rows={rows} keyExtractor={(row) => row.id} loading />,
    );

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('REQ-1')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(4);
  });
});
