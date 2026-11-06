import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RequestWorklist, type WorklistRequest } from './RequestWorklist';
import { createLocalization, DEFAULT_LOCALE } from '@bloodchain/i18n';
const { t } = createLocalization(DEFAULT_LOCALE);
const row: WorklistRequest = {
  id: 'request 1',
  requestReference: 'REQ-001',
  status: 'SUBMITTED',
  priority: 'URGENT',
  createdAt: '2026-11-06T07:00:00Z',
  requestingOrganization: { name: 'Requesting hospital' },
  fulfillingOrganization: { name: 'Fulfilling center' },
  items: [{ bloodType: 'A', rhFactor: 'POSITIVE', componentType: 'RED_CELLS', unitsRequested: 4 }],
};
describe('request worklist', () => {
  it('compares requested and allocated quantities without inventing missing values', () => {
    render(<RequestWorklist rows={[row]} incoming onRetry={vi.fn()} />);
    expect(screen.getByText('Requesting hospital')).toBeInTheDocument();
    const cells = screen.getAllByRole('cell');
    expect(cells[3]).toHaveTextContent('4');
    expect(cells[4]).toHaveTextContent('—');
    expect(cells[5]).toHaveTextContent('—');
    expect(screen.getByRole('link', { name: 'REQ-001' })).toHaveAttribute(
      'href',
      '/requests/request%201',
    );
  });
  it('shows failure as an actionable alert instead of an empty table', async () => {
    const retry = vi.fn();
    render(<RequestWorklist rows={[]} failed onRetry={retry} />);
    const alert = screen.getByRole('alert');
    await userEvent.click(within(alert).getByRole('button', { name: t('common.retry') }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
