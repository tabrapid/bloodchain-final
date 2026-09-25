import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { type ReactNode } from 'react';
import { useDesign } from '../useDesign';
import { type TypeVariant, type AccentName, type as typeScale } from '../tokens';

export type TextTone = 'primary' | 'secondary' | 'tertiary' | 'onAccent' | AccentName;

export interface TextProps extends Omit<RNTextProps, 'children'> {
  variant?: TypeVariant;
  tone?: TextTone;
  /** Uppercases and letter-spaces. Only `overline` should ever need it. */
  caps?: boolean;
  align?: TextStyle['textAlign'];
  children?: ReactNode;
}

/**
 * The only way text is drawn in V2.
 *
 * A call site picks a role -- "this is a heading", "this is supporting" -- and
 * never a size, weight or colour. That is what keeps forty screens looking like
 * one product, and it is also what makes a change to the scale possible at all:
 * V1 had thirteen screens setting `fontSize` directly on top of a variant,
 * which silently kept the variant's line height and clipped the glyphs. There
 * is no prop here to do that with.
 *
 * `tone` resolves to the accent's TEXT value, never its `base`. The two exist
 * separately precisely so that a label cannot accidentally be drawn in the
 * indicator colour, which is tuned for 3:1 rather than 4.5:1.
 */
export function Text({
  variant = 'body',
  tone = 'primary',
  caps = false,
  align,
  style,
  children,
  ...rest
}: TextProps) {
  const { colors } = useDesign();

  const color =
    tone === 'primary'
      ? colors.textPrimary
      : tone === 'secondary'
        ? colors.textSecondary
        : tone === 'tertiary'
          ? colors.textTertiary
          : tone === 'onAccent'
            ? colors.textOnAccent
            : colors[tone].text;

  const scale = typeScale[variant];

  return (
    <RNText
      // Scalable text is a requirement, but unbounded scaling turns a stat row
      // into a column of ellipses. Three is the point where the layouts here
      // were checked to still hold.
      maxFontSizeMultiplier={3}
      style={[
        {
          fontSize: scale.fontSize,
          lineHeight: scale.lineHeight,
          fontWeight: scale.fontWeight as TextStyle['fontWeight'],
          letterSpacing: caps ? 0.8 : scale.letterSpacing,
          color,
          textAlign: align,
          textTransform: caps ? 'uppercase' : undefined,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}

/**
 * A number meant to be read as a measurement: a lab value, a countdown, a
 * volume. Tabular figures so a column does not shimmer while it updates, which
 * matters here because the columns are clinical results.
 */
export function ValueText({ variant = 'value', style, ...rest }: TextProps) {
  return (
    <Text
      variant={variant}
      style={[{ fontVariant: ['tabular-nums'] }, style]}
      // A value is announced on its own; grouping it with its unit is the
      // caller's job via accessibilityLabel on the row.
      {...rest}
    />
  );
}
