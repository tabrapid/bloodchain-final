import type { PropsWithChildren } from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderLocalized } from '../lib/test-render';

vi.mock('../components/AppShell', () => ({
  AppShell: ({ children }: PropsWithChildren) => <main>{children}</main>,
}));
vi.mock('@lib/auth', () => ({
  isAuthenticated: () => true,
  me: vi.fn().mockResolvedValue({ firstName: 'Test', lastName: 'Admin', roles: ['SUPER_ADMIN'] }),
  login: vi.fn(),
}));
vi.mock('@lib/api', () => ({
  getDashboard: vi.fn().mockResolvedValue(null),
  getSystemHealth: vi.fn().mockResolvedValue(null),
  listOrganizations: vi.fn().mockResolvedValue({ data: [] }),
  listEmergencies: vi.fn().mockResolvedValue({ data: [] }),
  listAlerts: vi.fn().mockResolvedValue({ data: [] }),
}));

import Dashboard from './page';
import { getDashboard } from '@lib/api';

describe('admin dashboard recovery', () => {
  it('distinguishes a failed API request from empty data and retries', async () => {
    vi.mocked(getDashboard).mockRejectedValueOnce(new Error('Service unavailable'));
    renderLocalized(<Dashboard />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /retry|try again/i }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(getDashboard).toHaveBeenCalledTimes(2);
  });
});
