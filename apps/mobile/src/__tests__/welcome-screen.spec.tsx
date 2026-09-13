import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { FlatList, ScrollView } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Welcome from '../../app/(auth)/welcome';
import { LocaleProvider } from '../i18n';
import { ThemeProvider, colors as darkColors } from '../theme';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => 'dark',
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));

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

function buttonWithLabel(tree: renderer.ReactTestRenderer, label: string) {
  return tree.root.find(
    (node) =>
      typeof node.type === 'function' &&
      (node.props as { accessibilityLabel?: string }).accessibilityLabel === label,
  );
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
    expect(mockPush).toHaveBeenCalledWith('/(auth)/register');

    act(() => {
      buttonWithLabel(tree, 'Sign in to Bloodchain').props.onPress();
    });
    expect(mockPush).toHaveBeenCalledWith('/(auth)/login');
  });

  /**
   * Both actions are the same width and height; the hierarchy is carried by
   * fill and label colour alone. A secondary that keeps the variant's rose
   * label puts the screen's two weakest contrasts on top of each other, over
   * brand colour.
   */
  it('gives the secondary action a legible label on the wave', () => {
    const secondary = buttonWithLabel(render(), 'Sign in to Bloodchain');

    expect(secondary.props.textColor).toBe('#FFFFFF');
    expect(secondary.props.textColor).not.toBe(darkColors.primary);
  });

  /**
   * The first attempt at fixing the contrast overshot into a near-black plate,
   * which read as a disabled control cut out of the band. It has to stay a
   * light film over the wave, with a border you can actually see.
   */
  it('keeps the secondary a light film, not a hole punched in the wave', () => {
    const style = (
      buttonWithLabel(render(), 'Sign in to Bloodchain').props as {
        style: { backgroundColor: string; borderColor: string };
      }
    ).style;

    expect(style.backgroundColor).toMatch(/^rgba\(255,255,255,0\.1[0-9]?\)$/);
    expect(style.borderColor).toMatch(/^rgba\(255,255,255,0\.[23][0-9]?\)$/);
  });

  it('keeps both actions above the 44pt touch target', () => {
    const tree = render();

    for (const label of ['Create Bloodchain account', 'Sign in to Bloodchain']) {
      const height = (buttonWithLabel(tree, label).props as { style: { height: number } }).style
        .height;
      expect(height).toBeGreaterThanOrEqual(44);
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
