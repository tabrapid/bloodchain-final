import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { ActivityIndicator } from 'react-native';

/**
 * Regression test for `app/_layout.tsx`.
 *
 * The loading spinner and the navigator (`<Stack>`) used to be rendered as
 * siblings instead of one replacing the other. React Native's default
 * column layout gave each `flex: 1` sibling half the screen, so the
 * spinner permanently ate roughly half the screen height on top of every
 * real screen -- confirmed live, it showed as a large blank area with a
 * spinner sitting above the home screen's content. This test asserts the
 * fix: the spinner and the navigator are mutually exclusive.
 */

let mockIsLoading = true;

jest.mock('../hooks/useAuth', () => ({
  useAuthBootstrap: jest.fn(),
}));

jest.mock('../hooks/usePushNotifications', () => ({
  usePushNotifications: jest.fn(),
}));

jest.mock('../stores/auth.store', () => ({
  useAuthStore: (selector: (s: any) => unknown) => selector({ isLoading: mockIsLoading }),
}));

jest.mock('expo-router', () => {
  const { Text: MockText } = require('react-native');
  return {
    Stack: () => <MockText testID="stack" />,
  };
});

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const RootLayout = require('../../app/_layout').default;

function renderLayout() {
  let tree: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<RootLayout />);
  });
  return tree!;
}

describe('app/_layout.tsx (root layout)', () => {
  beforeEach(() => {
    mockIsLoading = true;
  });

  it('renders only the loading spinner while auth is bootstrapping, never alongside the navigator', () => {
    mockIsLoading = true;
    const tree = renderLayout();
    expect(tree.root.findAllByProps({ testID: 'stack' })).toHaveLength(0);
    expect(tree.root.findAllByType(ActivityIndicator).length).toBeGreaterThan(0);
  });

  it('renders only the navigator once auth finishes loading, not the spinner', () => {
    mockIsLoading = false;
    const tree = renderLayout();
    expect(tree.root.findAllByProps({ testID: 'stack' }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(0);
  });
});
