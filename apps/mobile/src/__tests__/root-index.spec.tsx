import React from 'react';
import renderer, { act } from 'react-test-renderer';

/**
 * Regression test for the app's real entry point (`app/index.tsx`).
 *
 * Before this file existed, nothing owned the bare `/` route: Expo Router
 * strips group-folder names from the URL, so both `(booking)/index.tsx`
 * and `(onboarding)/index.tsx` independently resolved to `/`. Cold start
 * landed on whichever one the router happened to pick -- confirmed live,
 * it landed on the booking flow -- skipping the welcome/login screen
 * entirely regardless of auth state. This test asserts the real fix: a
 * single unambiguous root that redirects based on auth state.
 */

let mockIsLoading = true;
let mockIsAuthenticated = false;
let mockUser: { roles: string[] } | null = null;

jest.mock('../stores/auth.store', () => ({
  useAuthStore: (selector: (s: any) => unknown) =>
    selector({
      isLoading: mockIsLoading,
      isAuthenticated: mockIsAuthenticated,
      user: mockUser,
    }),
}));

jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = require('react-native');
    return <Text testID="redirect">{href}</Text>;
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Index = require('../../app/index').default;

function renderIndex() {
  let tree: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<Index />);
  });
  return tree!;
}

describe('app/index.tsx (real entry point)', () => {
  beforeEach(() => {
    mockIsLoading = true;
    mockIsAuthenticated = false;
    mockUser = null;
  });

  it('renders nothing while auth state is still loading', () => {
    mockIsLoading = true;
    const tree = renderIndex();
    expect(tree.toJSON()).toBeNull();
  });

  it('redirects to the welcome screen when not authenticated', () => {
    mockIsLoading = false;
    mockIsAuthenticated = false;
    const tree = renderIndex();
    expect(tree.root.findByProps({ testID: 'redirect' }).props.children).toBe('/(auth)/welcome');
  });

  it('redirects a courier to the courier workspace, not the donor home tab', () => {
    mockIsLoading = false;
    mockIsAuthenticated = true;
    mockUser = { roles: ['COURIER'] };
    const tree = renderIndex();
    expect(tree.root.findByProps({ testID: 'redirect' }).props.children).toBe('/(courier)/active');
  });

  it('redirects a donor to the donor home tab', () => {
    mockIsLoading = false;
    mockIsAuthenticated = true;
    mockUser = { roles: ['DONOR'] };
    const tree = renderIndex();
    expect(tree.root.findByProps({ testID: 'redirect' }).props.children).toBe('/(app)/home');
  });
});
