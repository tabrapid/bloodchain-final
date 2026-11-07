import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('../lib/api/auth', () => ({ login: vi.fn(), authAction: vi.fn() }));
import { AuthScreen } from './AuthScreen';
import { authAction, login } from '../lib/api/auth';
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, '', '/auth');
});
describe('donor account entry', () => {
  it('accepts the mobile account identifier and signs in without writing tokens to storage', async () => {
    vi.mocked(login).mockResolvedValue({});
    render(<AuthScreen />);
    await userEvent.type(screen.getByLabelText('Telefon yoki email'), '+998901234567');
    await userEvent.type(screen.getByLabelText('Parol'), 'MobilePassword!123');
    await userEvent.click(screen.getByRole('button', { name: /^Kirish$/ }));
    await waitFor(() => expect(login).toHaveBeenCalledWith('+998901234567', 'MobilePassword!123'));
    expect(replace).toHaveBeenCalledWith('/');
    expect(localStorage.getItem('donor_access_token')).toBeNull();
  });
  it('does not consume an email verification token merely by opening its URL', async () => {
    window.history.replaceState({}, '', '/auth?mode=verify-email&token=verification-fixture');
    vi.mocked(authAction).mockResolvedValue({ message: 'OK' });
    render(<AuthScreen />);
    await screen.findByRole('heading', { name: 'Emailni tasdiqlash' });
    expect(authAction).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Davom etish' }));
    await waitFor(() =>
      expect(authAction).toHaveBeenCalledWith('verify-email', { token: 'verification-fixture' }),
    );
  });
  it('keeps the phone code purpose tied to password recovery', async () => {
    vi.mocked(authAction).mockResolvedValue({ message: 'OK' });
    render(<AuthScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'SMS orqali parolni tiklash' }));
    await userEvent.type(screen.getByLabelText('Telefon (+998…)'), '+998901234567');
    await userEvent.click(screen.getByRole('button', { name: 'Davom etish' }));
    await waitFor(() =>
      expect(authAction).toHaveBeenCalledWith('phone/request-code', {
        phone: '+998901234567',
        purpose: 'PASSWORD_RESET',
        locale: 'uz',
      }),
    );
    await screen.findByLabelText('Olti xonali SMS kod');
  });
});
