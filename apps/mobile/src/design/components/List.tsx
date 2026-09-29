import { type ReactNode } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useDesign } from '../useDesign';
import { hitTarget, icon as iconScale, radius, space, type AccentName } from '../tokens';
import { Text } from './Text';
import { IconTile } from './Surface';

export interface SectionHeaderProps {
  title: string;
  /** One line under the title. Rare: most sections explain themselves. */
  subtitle?: string;
  /** A link or small control on the right — "See all", "Edit". */
  action?: ReactNode;
  /**
   * `micro` draws the title as an uppercase overline, for a label above a
   * single value or a compact group. `section` (default) is the real section
   * title: 18pt in the display face, which is what gives a screen its
   * scannable skeleton.
   */
  size?: 'section' | 'micro';
  style?: ViewStyle;
}

/**
 * The label above a group of content.
 *
 * Three earlier systems drew every section title as an 11pt uppercase
 * overline. That is a label for a value, not a heading for a screen region,
 * and a page of them has no skeleton: the eye scanning for "Appointments" has
 * to read every line at the same size. A real title at 18pt in the display
 * face is what lets a reader find a section without reading the page.
 */
export function SectionHeader({ title, subtitle, action, size = 'section', style }: SectionHeaderProps) {
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
        style,
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        {size === 'micro' ? (
          <Text variant="overline" tone="tertiary" caps accessibilityRole="header">
            {title}
          </Text>
        ) : (
          <Text variant="h3" accessibilityRole="header">
            {title}
          </Text>
        )}
        {subtitle ? (
          <Text variant="caption" tone="tertiary">
            {subtitle}
          </Text>
        ) : null}
      </View>
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
  /** Draws `value` in the accent's text colour. For a value that is a state. */
  valueTone?: AccentName;
  /** An icon, drawn in a tile. Prefer this to `leading` for a navigation row. */
  icon?: (props: { size: number; color: string }) => ReactNode;
  /** The tile's tint. Omit for neutral. */
  iconTone?: AccentName;
  /** Anything else at the leading edge: an avatar, a date block. */
  leading?: ReactNode;
  trailing?: ReactNode;
  /** The disclosure chevron. On by default for a pressable row with no `trailing`. */
  chevron?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  /** Announced in place of the composed title/subtitle when they read badly together. */
  accessibilityLabel?: string;
  /** Lets the title wrap. Off by default so a list scans as a column. */
  multiline?: boolean;
  style?: ViewStyle;
}

/**
 * One line in a list.
 *
 * A row is not a card, and this is the component that keeps the difference.
 * Cards are for things you would pick up and move; rows are for things you
 * would run your finger down. Its leading icon sits in a tile of consistent
 * size so a settings list reads as one column of controls rather than a
 * scattering of glyphs at different optical weights.
 */
export function ListRow({
  title,
  subtitle,
  subtitleTrailing,
  value,
  valueTone,
  icon,
  iconTone,
  leading,
  trailing,
  chevron,
  onPress,
  disabled = false,
  accessibilityLabel,
  multiline = false,
  style,
}: ListRowProps) {
  const { colors } = useDesign();
  const showChevron = chevron ?? (Boolean(onPress) && !trailing);

  const body = (
    <>
      {icon ? <IconTile icon={icon} tone={iconTone} /> : leading ? <View>{leading}</View> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyMedium" numberOfLines={multiline ? undefined : 1}>
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
        <Text
          variant="label"
          tone={valueTone ?? 'secondary'}
          numberOfLines={1}
          style={{ maxWidth: '45%' }}
        >
          {value}
        </Text>
      ) : null}
      {trailing}
      {showChevron ? <ChevronRight size={iconScale.md} color={colors.textTertiary} /> : null}
    </>
  );

  const frame: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
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
        pressed
          ? {
              backgroundColor: colors.surfacePressed,
              marginHorizontal: -space.lg,
              paddingHorizontal: space.lg,
              borderRadius: radius.sm,
            }
          : null,
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
 * `inset` aligns it with the text rather than the icon tile, which is what
 * stops a list with leading icons looking like a table.
 */
export function Divider({ inset = false, style }: { inset?: boolean; style?: ViewStyle }) {
  const { colors } = useDesign();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          height: 1,
          backgroundColor: colors.divider,
          marginLeft: inset ? 36 + space.md : 0,
        },
        style,
      ]}
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
 *
 * `plain` draws the rows on the page with dividers and no container: for a
 * list that IS the screen (history, notifications) rather than a group on it.
 */
export function ListGroup({
  rows,
  inset = true,
  plain = false,
  style,
}: {
  rows: ReactNode[];
  inset?: boolean;
  plain?: boolean;
  style?: ViewStyle;
}) {
  const { colors } = useDesign();
  const present = rows.filter(Boolean);

  return (
    <View
      style={[
        plain
          ? null
          : {
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              paddingHorizontal: space.lg,
              overflow: 'hidden',
            },
        style,
      ]}
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

/**
 * A label and its value on one line: the anatomy of a detail screen.
 *
 * "Organisation — Northstar Hospital", "Volume — 450 ml". Label left in the
 * secondary colour, value right in the primary, wrapping onto its own line
 * when it is long. Every appointment, donation and delivery detail screen
 * drew this by hand before; it is one row now.
 */
export function KeyValueRow({
  label,
  value,
  valueTone,
  trailing,
  multiline = false,
}: {
  label: string;
  value: string;
  valueTone?: AccentName;
  trailing?: ReactNode;
  multiline?: boolean;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={{
        flexDirection: multiline ? 'column' : 'row',
        alignItems: multiline ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        gap: multiline ? 2 : space.lg,
        minHeight: hitTarget.min,
        paddingVertical: space.sm + 2,
      }}
    >
      <Text variant="body" tone="secondary" style={multiline ? undefined : { flexShrink: 1 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 }}>
        <Text
          variant="bodyMedium"
          tone={valueTone}
          align={multiline ? 'left' : 'right'}
          style={{ flexShrink: 1 }}
        >
          {value}
        </Text>
        {trailing}
      </View>
    </View>
  );
}

/**
 * A date as a small block: the day number over the short month.
 *
 * The leading element of an appointment or donation row. A date read as a
 * sentence ("26 Sept 2026") is what a row's subtitle is for; the block lets a
 * list of appointments be scanned by day the way a calendar is.
 */
export function DateBlock({ day, month, tone }: { day: string; month: string; tone?: AccentName }) {
  const { colors } = useDesign();
  const accent = tone ? colors[tone] : null;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: 48,
        paddingVertical: space.sm - 2,
        borderRadius: radius.sm,
        alignItems: 'center',
        backgroundColor: accent ? accent.soft : colors.surfaceRaised,
        gap: 0,
      }}
    >
      <Text
        variant="valueSm"
        style={{ color: accent ? accent.text : colors.textPrimary, fontVariant: ['tabular-nums'] }}
      >
        {day}
      </Text>
      <Text variant="overline" caps style={{ color: accent ? accent.text : colors.textTertiary }}>
        {month}
      </Text>
    </View>
  );
}
