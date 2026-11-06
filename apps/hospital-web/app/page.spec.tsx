import type { PropsWithChildren } from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderLocalized } from '../lib/test-render';

vi.mock('../components/AppShell', () => ({
  AppShell: ({ children }: PropsWithChildren) => <main>{children}</main>,
}));
vi.mock('../lib/auth', () => ({
  isAuthenticated: () => false,
  login: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn().mockResolvedValue(undefined),
  me: vi.fn().mockResolvedValue({
    firstName: 'Test',
    lastName: 'Admin',
    roles: ['HOSPITAL_ADMIN'],
    organizations: [
      {
        organizationId: 'org-test',
        name: 'Test institution',
        type: 'HOSPITAL',
        status: 'ACTIVE',
        organizationStatus: 'ACTIVE',
        role: 'HOSPITAL_ADMIN',
      },
    ],
  }),
}));
vi.mock('../lib/analytics', () => ({
  DateRangeType: { TODAY: 'TODAY' },
  getOverviewAnalytics: vi.fn().mockResolvedValue(null),
  getAlerts: vi.fn().mockResolvedValue(null),
  getLaboratoryAnalytics: vi.fn().mockResolvedValue(null),
  getShipmentAnalytics: vi.fn().mockResolvedValue(null),
}));

import Dashboard from './page';
import { getOverviewAnalytics } from '../lib/analytics';

describe('dashboard sign-in', () => {
  it('requests the selected institution metrics immediately after a fresh sign-in', async () => {
    renderLocalized(<Dashboard />);
    await userEvent.type(await screen.findByLabelText('Email'), 'staff@example.test');
    await userEvent.type(screen.getByLabelText('Password'), 'TestPassword!123');
    await userEvent.click(screen.getByRole('button', { name: /^Sign in$/ }));
    await waitFor(() =>
      expect(getOverviewAnalytics).toHaveBeenCalledWith('org-test', { range: 'TODAY' }),
    );
  });
});

describe('dashboard data recovery', () => {
  it('shows a failed request as an error and recovers after retry', async () => {
    vi.mocked(getOverviewAnalytics).mockRejectedValueOnce(new Error('Service unavailable'));
    renderLocalized(<Dashboard />);
    await userEvent.type(await screen.findByLabelText('Email'), 'staff@example.test');
    await userEvent.type(screen.getByLabelText('Password'), 'TestPassword!123');
    await userEvent.click(screen.getByRole('button', { name: /^Sign in$/ }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /retry|try again/i }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});
