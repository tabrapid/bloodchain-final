import { type ReactNode } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { useDesign } from '../useDesign';
import { hitTarget, icon as iconScale, radius, space } from '../tokens';
import { Text } from './Text';

export interface SectionHeaderProps {
  title: string;
  /** A link or small control on the right — "See all", "Edit". */
  action?: ReactNode;
  style?: ViewStyle;
}

/**
 * The label above a group of content.
 *
 * Sentence case at `overline`, not the 11pt uppercase with 1.5 tracking V1
 * used. Wide-tracked uppercase is a magazine device; at 11pt on a phone, in
 * Russian or Uzbek, it is hard to read and it wraps badly. This is quieter and
 * survives translation.
 */
export function SectionHeader({ title, action, style }: SectionHeaderProps) {
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
        style,
      ]}
    >
      <Text variant="overline" tone="tertiary" caps accessibilityRole="header" style={{ flex: 1 }}>
        {title}
      </Text>
      {action}
    </View>
  );
}

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /**
   * A small element on the subtitle line: a status dot, a count.
   *
   * `trailing` sits on the row's right edge and is measured at its full width
   * before the title column gets any, so a badge there eats the title -- which
   * on an appointment row is the one thing that identifies the appointment.
   * This sits under the title instead, where it competes with nothing.
   */
  subtitleTrailing?: ReactNode;
  /** Right-aligned secondary text: a date, a value, a count. */
  value?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  /** Announced in place of the composed title/subtitle when they read badly together. */
  accessibilityLabel?: string;
  style?: ViewStyle;
}

/**
 * One line in a list.
 *
 * A row is not a card, and this is the component that keeps the difference.
 * V1's settings screens were columns of individually shadowed cards, which
 * makes eight settings look like eight separate features; a list of rows with
 * hairlines between them reads as one group of eight choices. Cards are for
 * things you would pick up and move, rows are for things you would run your
 * finger down.
 */
export function ListRow({
  title,
  subtitle,
  subtitleTrailing,
  value,
  leading,
  trailing,
  onPress,
  disabled = false,
  accessibilityLabel,
  style,
}: ListRowProps) {
  const { colors } = useDesign();

  const body = (
    <>
      {leading ? <View style={{ width: iconScale.lg, alignItems: 'center' }}>{leading}</View> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body" numberOfLines={1}>
          {title}
        </Text>
        {subtitle || subtitleTrailing ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
            {subtitle ? (
              <Text variant="caption" tone="tertiary" numberOfLines={2} style={{ flexShrink: 1 }}>
                {subtitle}
              </Text>
            ) : null}
            {subtitleTrailing}
          </View>
        ) : null}
      </View>
      {value ? (
        <Text variant="label" tone="secondary" numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {trailing}
    </>
  );

  const frame: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    minHeight: hitTarget.comfortable,
    paddingVertical: space.md,
    opacity: disabled ? 0.5 : 1,
  };

  if (!onPress) {
    return <View style={[frame, style]}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}. ${subtitle}` : title)}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        frame,
        // The highlight extends past the gutter so the whole row lights up
        // rather than a rectangle floating inside it.
        pressed ? { backgroundColor: colors.surfacePressed, marginHorizontal: -space.lg, paddingHorizontal: space.lg, borderRadius: radius.xs } : null,
        style,
      ]}
    >
      {body}
    </Pressable>
  );
}

/**
 * A hairline between rows.
 *
 * `inset` aligns it with the text rather than the icon, which is what stops a
 * list with leading icons looking like a table.
 */
export function Divider({ inset = false }: { inset?: boolean }) {
  const { colors } = useDesign();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        height: 1,
        backgroundColor: colors.divider,
        marginLeft: inset ? iconScale.lg + space.lg : 0,
      }}
    />
  );
}

/**
 * Rows grouped into one surface, with the dividers drawn for you.
 *
 * Takes an array rather than children so that it can put a divider between
 * every pair and after none of them -- which is the detail that makes a list
 * look finished, and the one that every hand-rolled list gets wrong at the
 * bottom.
 */
export function ListGroup({ rows, inset = true }: { rows: ReactNode[]; inset?: boolean }) {
  const { colors } = useDesign();
  const present = rows.filter(Boolean);

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.divider,
        paddingHorizontal: space.lg,
        overflow: 'hidden',
      }}
    >
      {present.map((row, index) => (
        <View key={index}>
          {index > 0 ? <Divider inset={inset} /> : null}
          {row}
        </View>
      ))}
    </View>
  );
}
