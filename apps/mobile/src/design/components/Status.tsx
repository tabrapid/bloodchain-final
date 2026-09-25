import { type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { useDesign } from '../useDesign';
import { icon as iconScale, radius, space, type AccentName } from '../tokens';
import { Text } from './Text';

export type StatusTone = AccentName | 'neutral';

export interface BadgeProps {
  label: string;
  tone?: StatusTone;
  /** Strongly recommended. See the note on colour-only status below. */
  icon?: (props: { size: number; color: string }) => ReactNode;
  style?: ViewStyle;
}

/**
 * A small labelled marker: "Verified", "Confirmed", "Under review".
 *
 * The label is never optional, and that is the point. A status conveyed only by
 * colour is invisible to a colour-blind donor and to a screen reader alike, and
 * in this app the statuses are things like whether a laboratory result has been
 * reviewed. Every badge therefore carries words; the colour is the second
 * signal, not the only one, and an icon makes it a third.
 */
export function Badge({ label, tone = 'neutral', icon, style }: BadgeProps) {
  const { colors } = useDesign();

  const background = tone === 'neutral' ? colors.surfaceRaised : colors[tone].soft;
  const foreground = tone === 'neutral' ? colors.textSecondary : colors[tone].text;

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.xs,
          alignSelf: 'flex-start',
          paddingHorizontal: space.sm,
          paddingVertical: 4,
          borderRadius: radius.xs,
          backgroundColor: background,
        },
        style,
      ]}
    >
      {icon?.({ size: iconScale.sm, color: foreground })}
      <Text variant="caption" style={{ color: foreground, fontWeight: '600' }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * A status with a dot in front of it.
 *
 * Used in lists where a badge would be too heavy -- an appointment row, a
 * donation record. Same rule: the word carries the meaning, the dot repeats it.
 */
export function StatusDot({ label, tone = 'neutral' }: { label: string; tone?: StatusTone }) {
  const { colors } = useDesign();
  const dot = tone === 'neutral' ? colors.textTertiary : colors[tone].base;

  return (
    <View accessible accessibilityRole="text" accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
      <Text variant="label" tone="secondary" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export interface BannerProps {
  title: string;
  description?: string;
  tone?: StatusTone;
  icon?: (props: { size: number; color: string }) => ReactNode;
  action?: ReactNode;
  style?: ViewStyle;
}

/**
 * A full-width message attached to the content it is about.
 *
 * For things the donor needs to know before they act: a profile that is
 * incomplete, a result waiting on review, a request that failed. Not for
 * transient confirmations -- those are a Toast.
 */
export function Banner({ title, description, tone = 'clinical', icon, action, style }: BannerProps) {
  const { colors } = useDesign();
  const accent = tone === 'neutral' ? null : colors[tone];

  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLabel={description ? `${title}. ${description}` : title}
      style={[
        {
          flexDirection: 'row',
          gap: space.md,
          padding: space.lg,
          borderRadius: radius.md,
          backgroundColor: accent ? accent.soft : colors.surfaceRaised,
          // A left rule rather than a full border: it marks the block as
          // belonging to a state without drawing a second card around it.
          borderLeftWidth: 3,
          borderLeftColor: accent ? accent.base : colors.border,
        },
        style,
      ]}
    >
      {icon ? <View style={{ paddingTop: 2 }}>{icon({ size: iconScale.md, color: accent?.base ?? colors.textSecondary })}</View> : null}
      <View style={{ flex: 1, gap: space.xs }}>
        <Text variant="bodyStrong">{title}</Text>
        {description ? (
          <Text variant="caption" tone="secondary">
            {description}
          </Text>
        ) : null}
        {action ? <View style={{ marginTop: space.sm }}>{action}</View> : null}
      </View>
    </View>
  );
}

/**
 * The one place in the app a saturated red fills a surface.
 *
 * Reserved for an active emergency. It is a separate component rather than a
 * Banner tone so that the restriction is enforceable by reading the imports:
 * anything that renders this is, by construction, an emergency surface.
 */
export function EmergencyBanner({ title, description, icon, action, style }: Omit<BannerProps, 'tone'>) {
  const { colors } = useDesign();

  return (
    // `accessible` on the outer view collapses everything inside it into one
    // element -- including the action -- so VoiceOver and TalkBack could read
    // the emergency but never reach the button that answers it. The text is
    // grouped and announced as an alert; the action stays its own element,
    // which on this banner is the whole point of the banner.
    <View
      style={[
        {
          flexDirection: 'row',
          gap: space.md,
          padding: space.lg,
          borderRadius: radius.md,
          backgroundColor: colors.critical.fill,
        },
        style,
      ]}
    >
      {icon ? <View style={{ paddingTop: 2 }}>{icon({ size: iconScale.md, color: colors.textOnAccent })}</View> : null}
      <View style={{ flex: 1, gap: space.xs }}>
        <View
          accessible
          accessibilityRole="alert"
          accessibilityLabel={description ? `${title}. ${description}` : title}
          style={{ gap: space.xs }}
        >
          <Text variant="bodyStrong" tone="onAccent">
            {title}
          </Text>
          {description ? (
            <Text variant="caption" style={{ color: colors.textOnAccent, opacity: 0.9 }}>
              {description}
            </Text>
          ) : null}
        </View>
        {action ? <View style={{ marginTop: space.sm }}>{action}</View> : null}
      </View>
    </View>
  );
}
