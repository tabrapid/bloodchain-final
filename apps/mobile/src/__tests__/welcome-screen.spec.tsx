import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { FlatList, ScrollView } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Welcome from '../../app/(auth)/welcome';
import { LocaleProvider } from '../i18n';
import { ThemeProvider } from '../theme';
import { hitTarget, themes } from '../design';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => 'dark',
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args), dismissAll: jest.fn(), canGoBack: jest.fn(() => true) } }));

function render() {
  let tree: renderer.ReactTestRenderer;
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
            <Welcome />
          </SafeAreaProvider>
        </LocaleProvider>
      </ThemeProvider>,
    );
  });
  return tree!;
}

/**
 * The outermost node carrying that accessible label.
 *
 * `findAll` returns the composite component and the host view it renders, both
 * with the accessibility props on them, so a single button matches twice. The
 * tree is outermost-first, so the first match is the component.
 */
function buttonWithLabel(tree: renderer.ReactTestRenderer, label: string) {
  const matches = tree.root.findAll(
    (node) =>
      (node.props as { accessibilityLabel?: string }).accessibilityLabel === label &&
      // The label is also on the Button component that forwards it; the role
      // is only on the Pressable that actually carries the style and handler.
      (node.props as { accessibilityRole?: string }).accessibilityRole === 'button',
  );
  if (matches.length === 0) throw new Error(`no element labelled "${label}"`);
  return matches[0]!;
}

/** Pressable takes `style` as a function of the press state. */
function styleOf(node: ReturnType<typeof buttonWithLabel>): Record<string, unknown> {
  const raw = (node.props as { style?: unknown }).style;
  const resolved = typeof raw === 'function' ? (raw as (s: { pressed: boolean }) => unknown)({ pressed: false }) : raw;
  return Array.isArray(resolved)
    ? Object.assign({}, ...(resolved.flat(Infinity) as object[]).filter(Boolean))
    : ((resolved ?? {}) as Record<string, unknown>);
}

beforeEach(() => mockPush.mockClear());

describe('Welcome', () => {
  /**
   * The screen carried a three-dot pager indicator while being a single static
   * screen. Dots that cannot move are a promise of content that does not
   * exist, and they invite swipes that do nothing.
   */
  it('shows no pagination, because there is no carousel to page through', () => {
    const tree = render();

    expect(tree.root.findAllByType(FlatList)).toHaveLength(0);
    expect(tree.root.findAllByType(ScrollView)).toHaveLength(0);
  });

  it('routes each call to action at its own screen', () => {
    const tree = render();

    act(() => {
      buttonWithLabel(tree, 'Create Bloodchain account').props.onPress();
    });
    // Phone-first since Sprint 1B: a donor here knows their number without
    // looking it up, and email sign-up is one tap further on.
    expect(mockPush).toHaveBeenCalledWith('/(auth)/phone');

    act(() => {
      buttonWithLabel(tree, 'Sign in to Bloodchain').props.onPress();
    });
    expect(mockPush).toHaveBeenCalledWith('/(auth)/login');
  });

  /**
   * The hierarchy between the two actions is carried by fill alone: one is
   * filled in the brand rose, the other is an outline. V1 had to tune the
   * secondary to a translucent white film because it sat on a brand-coloured
   * band and nothing else stayed legible over colour; V2 removed the band, so
   * both actions sit on the app's own ground and take the system's variants
   * unmodified. The contrast of every one of those is measured in
   * `design/tokens.spec.ts` rather than re-asserted per screen.
   */
  it('makes exactly one of the two actions the filled one', () => {
    const tree = render();

    const primary = styleOf(buttonWithLabel(tree, 'Create Bloodchain account'));
    const secondary = styleOf(buttonWithLabel(tree, 'Sign in to Bloodchain'));

    expect(primary.backgroundColor).toBe(themes.dark.rose.fill);
    expect(secondary.backgroundColor).toBe('transparent');
    expect(secondary.borderWidth).toBe(1);
  });

  it('keeps both actions above the 44pt touch target', () => {
    const tree = render();

    for (const label of ['Create Bloodchain account', 'Sign in to Bloodchain']) {
      const height = styleOf(buttonWithLabel(tree, label)).minHeight as number;
      expect(height).toBeGreaterThanOrEqual(hitTarget.min);
    }
  });

  /** A link with nowhere to go is worse than plain text saying the same thing. */
  it('does not render the legal phrases as links while they have no destination', () => {
    const links = render().root.findAll(
      (node) => (node.props as { accessibilityRole?: string }).accessibilityRole === 'link',
    );

    expect(links).toHaveLength(0);
  });
});
