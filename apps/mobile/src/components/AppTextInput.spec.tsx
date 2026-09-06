import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { TextInput } from 'react-native';
import { AppTextInput } from './AppTextInput';
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

function focusEvent() {
  return { nativeEvent: {} } as never;
}

describe('AppTextInput', () => {
  /**
   * The field tracks its own focus so it can light its border. react-hook-form
   * registers validation through the same `onBlur`, so a version that sets
   * state and returns silently drops every per-field error on the login and
   * register forms -- with nothing to see in the UI except errors that never
   * appear.
   */
  it('calls the caller onBlur as well as clearing its own focus', () => {
    const onBlur = jest.fn();
    const tree = render(<AppTextInput label="Email address" onBlur={onBlur} />);
    const input = tree.root.findByType(TextInput);

    act(() => {
      input.props.onFocus(focusEvent());
    });
    act(() => {
      input.props.onBlur(focusEvent());
    });

    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('calls the caller onFocus too', () => {
    const onFocus = jest.fn();
    const tree = render(<AppTextInput onFocus={onFocus} />);

    act(() => {
      tree.root.findByType(TextInput).props.onFocus(focusEvent());
    });

    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it('works with no handlers passed at all', () => {
    const tree = render(<AppTextInput />);
    const input = tree.root.findByType(TextInput);

    expect(() => {
      act(() => {
        input.props.onFocus(focusEvent());
        input.props.onBlur(focusEvent());
      });
    }).not.toThrow();
  });

  /** An error has to win over focus, or a field lights up rose while rejecting. */
  it('shows the danger border when it has an error, focused or not', () => {
    const tree = render(<AppTextInput label="Email" error="Enter a valid email" />);
    const input = tree.root.findByType(TextInput);
    act(() => {
      input.props.onFocus(focusEvent());
    });

    const field = tree.root.findAllByType('View' as never).find((node) =>
      Boolean((node.props as { style?: { borderWidth?: number } }).style?.borderWidth),
    );

    expect((field!.props as { style: { borderColor: string } }).style.borderColor).toBe(
      darkColors.danger,
    );
  });
});
