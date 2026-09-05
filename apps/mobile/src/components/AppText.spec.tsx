import React from 'react';
import renderer from 'react-test-renderer';
import { StyleSheet, type TextStyle } from 'react-native';
import { AppText } from './AppText';
import { ThemeProvider } from '../theme';
import { typography } from '../theme';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => 'dark',
}));

/**
 * `AppText` merges a typography variant under the call site's own style. The
 * default variant is `body`: 15pt text in a 22pt line box. A call site that
 * raised only `fontSize` kept that 22pt box, so 28pt glyphs were drawn into a
 * line too short for them and clipped -- on Home's overview tiles "0" rendered
 * as "U" and "5.0" lost its top half. Thirteen places in the app set a larger
 * size this way.
 */
function styleOf(element: React.ReactElement): TextStyle {
  const tree = renderer.create(<ThemeProvider>{element}</ThemeProvider>);
  const json = tree.toJSON() as unknown as { props: { style: unknown } };
  return StyleSheet.flatten(json.props.style) as TextStyle;
}

describe('AppText line box', () => {
  it('drops the variant line height when the call site overrides only the size', () => {
    const style = styleOf(<AppText style={{ fontSize: 28 }}>0</AppText>);

    expect(style.fontSize).toBe(28);
    expect(style.lineHeight).toBeUndefined();
  });

  it('keeps a line height the call site asked for', () => {
    const style = styleOf(<AppText style={{ fontSize: 28, lineHeight: 30 }}>0</AppText>);

    expect(style.lineHeight).toBe(30);
  });

  it('keeps the variant line height when the size is not overridden', () => {
    const style = styleOf(<AppText>body</AppText>);

    expect(style.fontSize).toBe(typography.body.fontSize);
    expect(style.lineHeight).toBe(typography.body.lineHeight);
  });

  it('still applies a variant that sets both', () => {
    const style = styleOf(<AppText variant="numeric">28</AppText>);

    expect(style.fontSize).toBe(typography.numeric.fontSize);
    expect(style.lineHeight).toBe(typography.numeric.lineHeight);
  });
});
