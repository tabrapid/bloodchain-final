import { screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { renderLocalized } from '../lib/test-render';
vi.mock('../lib/laboratory', () => ({
  getLaboratoryResult: vi
    .fn()
    .mockResolvedValue({
      id: 'r1',
      status: 'REVIEWED',
      performedAt: '2026-11-06T07:00:00Z',
      performedBy: 'tech-1',
      reviewedAt: '2026-11-06T08:00:00Z',
      reviewedBy: 'reviewer-1',
      testType: { name: 'CBC' },
      items: [],
    }),
}));
import { LaboratoryInspector } from './LaboratoryInspector';
import type { LaboratoryAppointment } from '../lib/laboratory';
const appointment: LaboratoryAppointment = {
  id: 'a1',
  referenceNumber: 'LAB-001',
  status: 'RESULT_READY',
  scheduledStart: '2026-11-06T07:00:00Z',
  scheduledEnd: '2026-11-06T07:30:00Z',
  donor: { id: 'd1', firstName: 'Test', lastName: 'Donor', email: 'sample@example.test' },
  organization: { id: 'org1', name: 'Test center' },
  laboratoryResult: { id: 'r1', status: 'REVIEWED' },
};
it('shows server-provided actor IDs and does not fabricate unrecorded publication or sample events', async () => {
  renderLocalized(
    <LaboratoryInspector appointment={appointment} organizationId="org1" onClose={vi.fn()} />,
  );
  expect(await screen.findByText('reviewer-1')).toBeInTheDocument();
  expect(screen.getByText('tech-1')).toBeInTheDocument();
  expect(screen.getAllByText('Not recorded').length).toBeGreaterThan(0);
  expect(screen.getByText(/Separate sample collection/)).toBeInTheDocument();
});
