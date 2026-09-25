import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LocaleProvider } from '../i18n';
import { ThemeProvider } from '../theme';
import { ApiRequestError } from '../api/client';

/**
 * Sprint 0.5: the recovery flow the API has had since Sprint 0, now reachable.
 *
 * The rules these tests exist to hold are the ones that are easy to break by
 * being helpful: the server answers a reset request identically for a
 * registered and an unregistered address, and refuses an unknown, expired and
 * already-spent token with one indistinguishable error. A client that renders
 * "no account with that email", or that tells the two token failures apart,
 * puts back exactly the oracle the API declines to be.
 */

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => 'dark',
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockRouteParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
    back: (...args: unknown[]) => mockBack(...args), dismissAll: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => mockRouteParams,
}));

const mockRequestPasswordReset = jest.fn();
const mockResetPassword = jest.fn();

jest.mock('../api/auth', () => ({
  requestPasswordReset: (...args: unknown[]) => mockRequestPasswordReset(...args),
  resetPassword: (...args: unknown[]) => mockResetPassword(...args),
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  me: jest.fn(),
  verifyEmail: jest.fn(),
  resendVerification: jest.fn(),
}));

const mockClearAuthTokens = jest.fn().mockResolvedValue(undefined);
jest.mock('../auth/storage', () => ({
  clearAuthTokens: () => mockClearAuthTokens(),
  getRefreshToken: jest.fn().mockResolvedValue(null),
  setAccessToken: jest.fn(),
  setRefreshToken: jest.fn(),
  deleteAccessToken: jest.fn(),
  deleteRefreshToken: jest.fn(),
}));

import ForgotPassword from '../../app/(auth)/forgot-password';
import ResetPassword from '../../app/(auth)/reset-password';
import Login from '../../app/(auth)/login';

const mounted: renderer.ReactTestRenderer[] = [];

function render(Screen: React.ComponentType) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });

  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <ThemeProvider>
        <LocaleProvider>
          <SafeAreaProvider
            initialMetrics={{
              frame: { x: 0, y: 0, width: 390, height: 844 },
              insets: { top: 47, left: 0, right: 0, bottom: 34 },
            }}
          >
            <QueryClientProvider client={queryClient}>
              <Screen />
            </QueryClientProvider>
          </SafeAreaProvider>
        </LocaleProvider>
      </ThemeProvider>,
    );
  });
  mounted.push(tree);
  return tree;
}

/** Every string the screen renders, flattened, so copy can be asserted on. */
function textOf(tree: renderer.ReactTestRenderer): string {
  const parts: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node === 'string') parts.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
  };
  tree.root.findAll((node) => typeof node.type === 'string').forEach((node) => walk(node.props.children));
  return parts.join(' ');
}

function field(tree: renderer.ReactTestRenderer, label: string) {
  return tree.root.find(
    (node) => typeof node.type === 'object' && (node.props as { label?: string }).label === label,
  );
}

function fieldsLabelled(tree: renderer.ReactTestRenderer, label: string) {
  return tree.root.findAll(
    (node) => typeof node.type === 'object' && (node.props as { label?: string }).label === label,
  );
}

/**
 * The outermost pressable carrying this label.
 *
 * Matched on the label and an `onPress`, not on the component type: some of
 * these controls are `AppButton` (a function component) and some are a bare
 * `Pressable` (a forwardRef object), and a test that only knew about one of
 * them would silently skip the other.
 */
function control(tree: renderer.ReactTestRenderer, accessibilityLabel: string) {
  const match = tree.root
    .findAll(
      (node) =>
        (node.props as { accessibilityLabel?: string }).accessibilityLabel === accessibilityLabel &&
        typeof (node.props as { onPress?: unknown }).onPress === 'function',
      { deep: true },
    )
    .at(0);
  if (!match) throw new Error(`No pressable labelled "${accessibilityLabel}"`);
  return match;
}

const type = async (tree: renderer.ReactTestRenderer, label: string, value: string) => {
  await act(async () => {
    field(tree, label).props.onChangeText(value);
  });
};

const press = async (tree: renderer.ReactTestRenderer, label: string) => {
  await act(async () => {
    await control(tree, label).props.onPress();
  });
};

const apiError = (statusCode: number, message: string, code = 'ERROR') =>
  new ApiRequestError({ statusCode, code, message });

beforeEach(() => {
  mockRouteParams = {};
  mockPush.mockClear();
  mockReplace.mockClear();
  mockBack.mockClear();
  mockClearAuthTokens.mockClear();
  mockRequestPasswordReset.mockReset();
  mockResetPassword.mockReset();
});

afterEach(() => {
  mounted.splice(0).forEach((tree) => act(() => tree.unmount()));
});

describe('the deep link the reset email sends', () => {
  /**
   * The other half of a contract pinned in the API's own spec: it mails
   * `donor://reset-password?token=…`, and Expo Router resolves that to a file
   * named reset-password in the app directory, group folders stripped. Moving
   * or renaming this screen would break every link already sitting in someone's
   * inbox, with no error anywhere -- so the file path is asserted, not assumed.
   */
  it('resolves to a route file that exists', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const route = path.join(__dirname, '..', '..', 'app', '(auth)', 'reset-password.tsx');

    expect(fs.existsSync(route)).toBe(true);
  });

  it('reads its token from the query string, which is how the link carries it', async () => {
    mockRouteParams = { token: 'c'.repeat(64) };
    mockResetPassword.mockResolvedValue({ success: true, message: 'ok' });
    const tree = render(ResetPassword);

    await act(async () => {
      field(tree, 'New password').props.onChangeText('NewPassword!2026');
    });
    await act(async () => {
      field(tree, 'Confirm new password').props.onChangeText('NewPassword!2026');
    });
    await press(tree, 'Set new password');

    expect(mockResetPassword.mock.calls[0][0]).toBe('c'.repeat(64));
  });
});

describe('Login', () => {
  it('offers a way out of a forgotten password', async () => {
    const tree = render(Login);

    await press(tree, 'Reset your password');

    expect(mockPush).toHaveBeenCalledWith('/(auth)/forgot-password');
  });
});

describe('ForgotPassword', () => {
  it('sends the request and confirms without revealing whether the account exists', async () => {
    mockRequestPasswordReset.mockResolvedValue({ success: true, message: 'ok' });
    const tree = render(ForgotPassword);

    await type(tree, 'Email address', 'donor@donor.local');
    await press(tree, 'Send password reset link');

    expect(mockRequestPasswordReset.mock.calls[0][0]).toBe('donor@donor.local');

    const copy = textOf(tree);
    expect(copy).toContain('If an account exists');
    // The words a helpful-but-wrong implementation would reach for.
    expect(copy).not.toMatch(/no account|not found|unregistered|does not exist/i);
  });

  it('does not call the API for an address that is not an address', async () => {
    const tree = render(ForgotPassword);

    await type(tree, 'Email address', 'not-an-email');
    await press(tree, 'Send password reset link');

    expect(mockRequestPasswordReset).not.toHaveBeenCalled();
    expect(textOf(tree)).not.toContain('If an account exists');
  });

  it('explains the rate limit rather than reporting it as a failure to send', async () => {
    mockRequestPasswordReset.mockRejectedValue(apiError(429, 'ThrottlerException: Too Many Requests'));
    const tree = render(ForgotPassword);

    await type(tree, 'Email address', 'donor@donor.local');
    await press(tree, 'Send password reset link');

    const copy = textOf(tree);
    expect(copy).toContain('Too many requests');
    expect(copy).toContain('15 minutes');
    // Still on the form, because waiting and retrying is the remedy.
    expect(copy).not.toContain('If an account exists');
  });

  it('surfaces a network failure with the message the client built for it', async () => {
    mockRequestPasswordReset.mockRejectedValue(
      apiError(0, 'Could not reach the server. Tried http://10.0.2.2:3001/api/v1.', 'NETWORK_ERROR'),
    );
    const tree = render(ForgotPassword);

    await type(tree, 'Email address', 'donor@donor.local');
    await press(tree, 'Send password reset link');

    expect(textOf(tree)).toContain('Could not reach the server');
  });
});

describe('ResetPassword', () => {
  const fill = async (tree: renderer.ReactTestRenderer, password: string, confirm = password) => {
    await type(tree, 'New password', password);
    await type(tree, 'Confirm new password', confirm);
  };

  it('takes the token from the deep link and does not ask for it again', async () => {
    mockRouteParams = { token: 'a'.repeat(64) };
    mockResetPassword.mockResolvedValue({ success: true, message: 'ok' });
    const tree = render(ResetPassword);

    expect(fieldsLabelled(tree, 'Reset code')).toHaveLength(0);

    await fill(tree, 'NewPassword!2026');
    await press(tree, 'Set new password');

    expect(mockResetPassword.mock.calls[0].slice(0, 2)).toEqual(['a'.repeat(64), 'NewPassword!2026']);
  });

  it('asks for the code when opened without one', async () => {
    mockResetPassword.mockResolvedValue({ success: true, message: 'ok' });
    const tree = render(ResetPassword);

    expect(fieldsLabelled(tree, 'Reset code')).toHaveLength(1);

    await type(tree, 'Reset code', '  b'.padEnd(66, 'b') + '  ');
    await fill(tree, 'NewPassword!2026');
    await press(tree, 'Set new password');

    // Trimmed: a pasted code routinely carries whitespace from the mail client.
    expect(mockResetPassword.mock.calls[0][0]).toBe(mockResetPassword.mock.calls[0][0].trim());
  });

  it('catches a mistyped confirmation before spending the token', async () => {
    mockRouteParams = { token: 'a'.repeat(64) };
    const tree = render(ResetPassword);

    await fill(tree, 'NewPassword!2026', 'NewPassword!2027');
    await press(tree, 'Set new password');

    expect(mockResetPassword).not.toHaveBeenCalled();
    expect(textOf(tree)).toContain('Passwords do not match');
  });

  it('enforces the server password policy in the form, not by round trip', async () => {
    mockRouteParams = { token: 'a'.repeat(64) };
    const tree = render(ResetPassword);

    // Long enough for the shared length rule, but no uppercase, digit or symbol.
    await fill(tree, 'abcdefghijklmno');
    await press(tree, 'Set new password');

    expect(mockResetPassword).not.toHaveBeenCalled();
    expect(textOf(tree)).toMatch(/must contain an uppercase letter/i);
  });

  it('treats a refused token as a dead link, not a form error', async () => {
    mockRouteParams = { token: 'a'.repeat(64) };
    mockResetPassword.mockRejectedValue(
      apiError(400, 'This password reset link is invalid or has expired.'),
    );
    const tree = render(ResetPassword);

    await fill(tree, 'NewPassword!2026');
    await press(tree, 'Set new password');

    const copy = textOf(tree);
    expect(copy).toContain('This link no longer works');
    // One state for unknown, expired and already-used, because the server
    // deliberately does not say which.
    expect(copy).toMatch(/used once and expire/i);

    await press(tree, 'Request a new reset link');
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/forgot-password');
  });

  it('reports a rate limit without losing what was typed', async () => {
    mockRouteParams = { token: 'a'.repeat(64) };
    mockResetPassword.mockRejectedValue(apiError(429, 'ThrottlerException: Too Many Requests'));
    const tree = render(ResetPassword);

    await fill(tree, 'NewPassword!2026');
    await press(tree, 'Set new password');

    expect(textOf(tree)).toContain('Too many requests');
    expect(field(tree, 'New password').props.value).toBe('NewPassword!2026');
  });

  it('clears local auth and sends the donor back to sign in', async () => {
    mockRouteParams = { token: 'a'.repeat(64) };
    mockResetPassword.mockResolvedValue({ success: true, message: 'ok' });
    const tree = render(ResetPassword);

    await fill(tree, 'NewPassword!2026');
    await press(tree, 'Set new password');

    // The server has just revoked every refresh token for this account,
    // including any this device still holds.
    expect(mockClearAuthTokens).toHaveBeenCalled();

    const copy = textOf(tree);
    expect(copy).toContain('Password updated');
    expect(copy).toMatch(/signed out everywhere else/i);

    await press(tree, 'Go to sign in');
    // `replace`, not `push`: there is nothing behind this worth going back to.
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
  });
});
