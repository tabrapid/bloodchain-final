import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { ArrowRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppButton } from './AppButton';
import { ThemeProvider, colors as darkColors } from '../theme';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => 'dark',
}));

function render(element: React.ReactElement) {
  let tree: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<ThemeProvider>{element}</ThemeProvider>);
  });
  return tree!;
}

describe('AppButton gradient', () => {
  it('paints the CTA gradient on a gradient primary', () => {
    const tree = render(<AppButton gradient>Sign In</AppButton>);
    const gradients = tree.root.findAllByType(LinearGradient);

    expect(gradients).toHaveLength(1);
    expect(gradients[0]!.props.colors).toEqual(darkColors.ctaGradient);
  });

  it('paints nothing extra on an ordinary primary', () => {
    const tree = render(<AppButton>Sign In</AppButton>);

    expect(tree.root.findAllByType(LinearGradient)).toHaveLength(0);
  });

  /**
   * A gradient over a ghost button would turn a quiet, secondary action into a
   * second primary -- the exact thing the gradient exists to mark out. The
   * prop is ignored there rather than trusted.
   */
  it('ignores the gradient on ghost and secondary variants', () => {
    expect(
      render(<AppButton gradient variant="ghost">Cancel</AppButton>).root.findAllByType(
        LinearGradient,
      ),
    ).toHaveLength(0);
    expect(
      render(<AppButton gradient variant="secondary">Cancel</AppButton>).root.findAllByType(
        LinearGradient,
      ),
    ).toHaveLength(0);
  });

  it('renders a trailing icon, and drops it while loading', () => {
    expect(
      render(<AppButton trailingIcon={ArrowRight}>Continue</AppButton>).root.findAllByProps({
        testID: 'icon-ArrowRight',
      }).length,
    ).toBeGreaterThan(0);
    expect(
      render(
        <AppButton trailingIcon={ArrowRight} loading>
          Continue
        </AppButton>,
      ).root.findAllByProps({ testID: 'icon-ArrowRight' }),
    ).toHaveLength(0);
  });
});
