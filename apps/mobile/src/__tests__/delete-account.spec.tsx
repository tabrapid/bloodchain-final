import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LocaleProvider } from '../i18n';
import { ThemeProvider } from '../theme';
import { useAuthStore } from '../stores/auth.store';

/**
 * STORE_BLOCKER_ACCOUNT_DELETION, the app half.
 *
 * The rules: the consequences are on the screen before anything is offered;
 * nothing is sent until the donor has confirmed twice (the screen's button,
 * then the sheet); on success the local session is gone and the app is at
 * sign-in; on failure the account is still there and the screen says so.
 */

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => 'dark',
}));

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: (...args: unknown[]) => mockReplace(...args), back: () => mockBack() },
}));

const mockDeleteAccount = jest.fn();
jest.mock('../api/users', () => ({
  deleteAccount: () => mockDeleteAccount(),
  getUserProfile: jest.fn(),
  updateUserProfile: jest.fn(),
}));

const mockClearAuthTokens = jest.fn().mockResolvedValue(undefined);
jest.mock('../auth/storage', () => ({
  clearAuthTokens: () => mockClearAuthTokens(),
  getRefreshToken: jest.fn().mockResolvedValue(null),
}));

import DeleteAccount from '../../app/(app)/delete-account';

const mounted: renderer.ReactTestRenderer[] = [];

function render() {
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
              <DeleteAccount />
            </QueryClientProvider>
          </SafeAreaProvider>
        </LocaleProvider>
      </ThemeProvider>,
    );
  });
  mounted.push(tree);
  return tree;
}

const texts = (tree: renderer.ReactTestRenderer): string[] =>
  tree.root
    .findAll((node) => String(node.type) === 'Text')
    .map((node) => node.children.filter((c): c is string => typeof c === 'string').join(''))
    .filter(Boolean);

function textUnder(instance: renderer.ReactTestInstance): string {
  const strings: string[] = [];
  const walk = (node: renderer.ReactTestInstance) => {
    node.children.forEach((child) => {
      if (typeof child === 'string') strings.push(child);
      else walk(child);
    });
  };
  walk(instance);
  return strings.join(' ');
}

/** The innermost pressable whose own subtree renders `label`. */
const pressByLabel = (tree: renderer.ReactTestRenderer, label: string) => {
  const target = tree.root
    .findAll((node) => typeof node.props?.onPress === 'function', { deep: true })
    .filter((node) => textUnder(node).includes(label))
    .at(-1);
  expect(target).toBeDefined();
  act(() => {
    target!.props.onPress();
  });
};

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

afterEach(() => {
  mounted.splice(0).forEach((tree) => act(() => tree.unmount()));
  jest.clearAllMocks();
  useAuthStore.setState({ isAuthenticated: true, user: null });
});

describe('Delete account', () => {
  it('states what goes, what stays and what it does not do before offering the action', () => {
    const tree = render();
    const all = texts(tree).join('\n');
    expect(all).toContain('What goes');
    expect(all).toContain('What stays');
    expect(all).toContain('What it does not do');
    // Nothing is invented: the record stays and the app claims no period.
    expect(all).toContain('does not decide how long');
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  it('sends nothing until the sheet confirms, then clears the session and goes to sign-in', async () => {
    mockDeleteAccount.mockResolvedValue(undefined);
    const tree = render();

    pressByLabel(tree, 'Delete my account');
    expect(mockDeleteAccount).not.toHaveBeenCalled();

    // The sheet's confirm is the second button carrying the same label.
    pressByLabel(tree, 'Delete my account');
    await flush();

    expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
    expect(mockClearAuthTokens).toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('keeps the account and says so when the request fails', async () => {
    mockDeleteAccount.mockRejectedValue(new Error('offline'));
    const tree = render();

    pressByLabel(tree, 'Delete my account');
    pressByLabel(tree, 'Delete my account');
    await flush();

    expect(mockClearAuthTokens).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(texts(tree).join('\n')).toContain('Could not delete your account');
  });

  it('"Keep my account" goes back without touching anything', () => {
    const tree = render();
    pressByLabel(tree, 'Keep my account');
    expect(mockBack).toHaveBeenCalled();
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });
});
