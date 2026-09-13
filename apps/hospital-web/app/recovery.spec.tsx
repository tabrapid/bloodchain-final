import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderLocalized } from '../lib/test-render';

/**
 * Sprint 0.6: password recovery in the hospital console.
 *
 * The rules worth a test are the ones it is tempting to break by being helpful.
 * The API answers a reset request identically for a registered and an
 * unregistered address, and refuses an unknown, expired and already-spent token
 * with one indistinguishable error. A console that renders "no account with
 * that email", or that tells those token failures apart, hands back exactly the
 * oracle the API declines to be.
 */

const mockPush = vi.fn();
const mockRequestPasswordReset = vi.fn();
const mockResetPassword = vi.fn();
let mockToken = '';

vi.mock('next/navigation', () => ({
  // AppShell, which wraps these pages, reads the pathname to mark the active
  // sidebar item.
  usePathname: () => '/forgot-password',
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(mockToken ? `token=${mockToken}` : ''),
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    className,
    children,
  }: {
    href: string;
    className?: string;
    children?: React.ReactNode;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

class FakeApiRequestError extends Error {
  constructor(public readonly error: { statusCode: number; code: string; message: string }) {
    super(error.message);
  }
}

vi.mock('../lib/auth', () => ({
  requestPasswordReset: (...args: unknown[]) => mockRequestPasswordReset(...args),
  resetPassword: (...args: unknown[]) => mockResetPassword(...args),
  isRejectedResetToken: (error: unknown) =>
    error instanceof FakeApiRequestError && error.error.statusCode === 400,
  recoveryErrorMessage: (error: unknown) => {
    if (error instanceof FakeApiRequestError) {
      if (error.error.statusCode === 429) {
        return 'Too many requests. Password reset is limited to a few attempts every 15 minutes — please wait and try again.';
      }
      return error.error.message;
    }
    return 'Could not reach the server. Check your connection and try again.';
  },
}));

import ForgotPasswordPage from './forgot-password/page';
import ResetPasswordPage from './reset-password/page';

const apiError = (statusCode: number, message: string) =>
  new FakeApiRequestError({ statusCode, code: 'ERR', message });

beforeEach(() => {
  mockToken = '';
  mockPush.mockClear();
  mockRequestPasswordReset.mockReset();
  mockResetPassword.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('hospital console: requesting a reset link', () => {
  it('sends the address and confirms without revealing whether the account exists', async () => {
    mockRequestPasswordReset.mockResolvedValue({ success: true, message: 'ok' });
    const user = userEvent.setup();
    renderLocalized(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText('Email'), 'staff@hospital.local');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => expect(mockRequestPasswordReset).toHaveBeenCalledWith('staff@hospital.local'));

    expect(await screen.findByText(/if an account exists/i)).toBeInTheDocument();
    // The words a helpful-but-wrong implementation would reach for.
    expect(document.body.textContent).not.toMatch(/no account|not found|unregistered|does not exist/i);
  });

  it('explains the rate limit rather than reporting it as a failure to send', async () => {
    mockRequestPasswordReset.mockRejectedValue(apiError(429, 'Too Many Requests'));
    const user = userEvent.setup();
    renderLocalized(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText('Email'), 'staff@hospital.local');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/too many requests/i);
    expect(screen.queryByText(/if an account exists/i)).not.toBeInTheDocument();
  });

  it('offers a way back to this console’s own sign-in', () => {
    renderLocalized(<ForgotPasswordPage />);
    const back = screen.getAllByRole('link', { name: /back to sign in/i })[0];
    expect(back).toHaveAttribute('href', '/');
  });
});

describe('hospital console: setting a new password', () => {
  const fill = async (user: ReturnType<typeof userEvent.setup>, password: string, confirm = password) => {
    await user.type(screen.getByLabelText('New password'), password);
    await user.type(screen.getByLabelText('Confirm new password'), confirm);
    await user.click(screen.getByRole('button', { name: /set new password/i }));
  };

  it('takes the token from the link and does not ask for it again', async () => {
    mockToken = 'a'.repeat(64);
    mockResetPassword.mockResolvedValue({ success: true, message: 'ok' });
    const user = userEvent.setup();
    renderLocalized(<ResetPasswordPage />);

    expect(screen.queryByLabelText('Reset code')).not.toBeInTheDocument();
    await fill(user, 'NewPassword!2026');

    await waitFor(() =>
      expect(mockResetPassword).toHaveBeenCalledWith('a'.repeat(64), 'NewPassword!2026'),
    );
  });

  it('asks for the code when opened without one', async () => {
    renderLocalized(<ResetPasswordPage />);
    expect(await screen.findByLabelText('Reset code')).toBeInTheDocument();
  });

  it('enforces the server password policy in the form, not by round trip', async () => {
    mockToken = 'a'.repeat(64);
    const user = userEvent.setup();
    renderLocalized(<ResetPasswordPage />);

    // Long enough, but no uppercase, digit or symbol.
    await fill(user, 'abcdefghijklmno');

    expect(mockResetPassword).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent(/uppercase/i);
  });

  it('catches a mistyped confirmation before spending the token', async () => {
    mockToken = 'a'.repeat(64);
    const user = userEvent.setup();
    renderLocalized(<ResetPasswordPage />);

    await fill(user, 'NewPassword!2026', 'NewPassword!2027');

    expect(mockResetPassword).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent(/do not match/i);
  });

  it('treats a refused token as a dead link, not a form error', async () => {
    mockToken = 'a'.repeat(64);
    mockResetPassword.mockRejectedValue(
      apiError(400, 'This password reset link is invalid or has expired.'),
    );
    const user = userEvent.setup();
    renderLocalized(<ResetPasswordPage />);

    await fill(user, 'NewPassword!2026');

    // One state for unknown, expired and already-used, because the server
    // deliberately does not say which.
    expect(await screen.findByText(/this link no longer works/i)).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/used once and expire/i);
    expect(screen.getByRole('link', { name: /request a new link/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('reports a rate limit without losing what was typed', async () => {
    mockToken = 'a'.repeat(64);
    mockResetPassword.mockRejectedValue(apiError(429, 'Too Many Requests'));
    const user = userEvent.setup();
    renderLocalized(<ResetPasswordPage />);

    await fill(user, 'NewPassword!2026');

    expect(await screen.findByRole('alert')).toHaveTextContent(/too many requests/i);
    expect(screen.getByLabelText('New password')).toHaveValue('NewPassword!2026');
  });

  it('returns to this console’s sign-in after a successful reset', async () => {
    mockToken = 'a'.repeat(64);
    mockResetPassword.mockResolvedValue({ success: true, message: 'ok' });
    const user = userEvent.setup();
    renderLocalized(<ResetPasswordPage />);

    await fill(user, 'NewPassword!2026');

    expect(await screen.findByText(/password updated/i)).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/signed out everywhere else/i);

    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    expect(mockPush).toHaveBeenCalledWith('/');
  });
});
