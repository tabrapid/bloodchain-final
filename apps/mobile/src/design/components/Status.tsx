import { type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react-native';
import { fonts } from '../fonts';
import { useDesign } from '../useDesign';
import { icon as iconScale, radius, space, type AccentName } from '../tokens';
import { Text } from './Text';

export type StatusTone = AccentName | 'neutral';

export interface BadgeProps {
  label: string;
  tone?: StatusTone;
  /** Strongly recommended. See the note on colour-only status below. */
  icon?: (props: { size: number; color: string }) => ReactNode;
  /** A small dot before the label: the compact alternative to an icon. */
  dot?: boolean;
  /** `solid` fills the pill with the accent; for the one state that must dominate. */
  emphasis?: 'soft' | 'solid';
  style?: ViewStyle;
}

/**
 * A small labelled pill: "Verified", "Confirmed", "Under review".
 *
 * The label is never optional, and that is the point. A status conveyed only by
 * colour is invisible to a colour-blind donor and to a screen reader alike, and
 * in this app the statuses are things like whether a laboratory result has been
 * reviewed. Every badge therefore carries words; the colour is the second
 * signal, not the only one, and a dot or an icon makes it a third.
 */
export function Badge({ label, tone = 'neutral', icon, dot = false, emphasis = 'soft', style }: BadgeProps) {
  const { colors } = useDesign();
  const accent = tone === 'neutral' ? null : colors[tone];

  const background =
    emphasis === 'solid' && accent ? accent.fill : accent ? accent.soft : colors.surfaceRaised;
  const foreground =
    emphasis === 'solid' && accent ? colors.textOnAccent : accent ? accent.text : colors.textSecondary;
  const marker = emphasis === 'solid' ? colors.textOnAccent : accent ? accent.base : colors.textTertiary;

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          alignSelf: 'flex-start',
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: radius.full,
          backgroundColor: background,
        },
        style,
      ]}
    >
      {dot ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: marker }} /> : null}
      {icon?.({ size: iconScale.sm - 2, color: marker })}
      <Text variant="caption" style={{ color: foreground, fontFamily: fonts.semibold }} numberOfLines={1}>
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
  const text = tone === 'neutral' ? colors.textSecondary : colors[tone].text;

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
    >
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} />
      <Text variant="caption" style={{ color: text, fontFamily: fonts.medium }} numberOfLines={1}>
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
 * transient confirmations.
 *
 * A tinted ground and an icon in a small circle of the same tint. No left
 * rule, no border: the tint is the signal, and a bordered banner on a page of
 * unbordered cards is the one thing that looks like it came from somewhere
 * else.
 */
export function Banner({ title, description, tone = 'clinical', icon, action, style }: BannerProps) {
  const { colors } = useDesign();
  const accent = tone === 'neutral' ? null : colors[tone];

  // A banner with no icon is a coloured block; the icon is the second signal
  // that says WHAT KIND of message it is, for a reader who does not see the
  // tint. The tone chooses a default so no screen ships a bare block.
  const glyph =
    icon ??
    (tone === 'critical'
      ? ({ size, color }: { size: number; color: string }) => <AlertCircle size={size} color={color} />
      : tone === 'warning'
        ? ({ size, color }: { size: number; color: string }) => <AlertTriangle size={size} color={color} />
        : tone === 'success'
          ? ({ size, color }: { size: number; color: string }) => <CheckCircle2 size={size} color={color} />
          : tone === 'clinical'
            ? ({ size, color }: { size: number; color: string }) => <Info size={size} color={color} />
            : undefined);

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
          borderRadius: radius.lg,
          backgroundColor: accent ? accent.soft : colors.surfaceRaised,
        },
        style,
      ]}
    >
      {glyph ? (
        <View style={{ paddingTop: 1 }}>{glyph({ size: iconScale.md, color: accent?.base ?? colors.textSecondary })}</View>
      ) : null}
      <View style={{ flex: 1, gap: space.xs }}>
        <Text variant="bodyMedium">{title}</Text>
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
    // grouped and announced as an alert; the action stays its own element.
    <View
      style={[
        {
          flexDirection: 'row',
          gap: space.md,
          padding: space.lg,
          borderRadius: radius.lg,
          backgroundColor: colors.critical.fill,
        },
        style,
      ]}
    >
      {icon ? (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.sm,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.16)',
          }}
        >
          {icon({ size: iconScale.md, color: colors.textOnAccent })}
        </View>
      ) : null}
      <View style={{ flex: 1, gap: space.xs }}>
        <View
          accessible
          accessibilityRole="alert"
          accessibilityLabel={description ? `${title}. ${description}` : title}
          style={{ gap: 2 }}
        >
          <Text variant="title" tone="onAccent">
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

export interface TimelineStep {
  label: string;
  /** A line under the label: a time, a note. */
  detail?: string;
}

/**
 * A vertical sequence of states, with the current one marked.
 *
 * The emergency journey (accepted → en route → arrived) and a delivery
 * (assigned → picked up → delivered) are both sequences, and a sequence shown
 * as a column of dots joined by a line is unmistakable in a way three badges
 * are not: a reader sees where they are AND how far there is to go.
 *
 * `current` is the index of the active step; everything before it is done,
 * everything after it is still to come. The whole thing is one accessible
 * element that says exactly that.
 */
export function Timeline({
  steps,
  current,
  tone = 'rose',
  doneLabel,
  currentLabel,
}: {
  steps: TimelineStep[];
  current: number;
  tone?: AccentName;
  /** Announced suffix for completed steps, e.g. "done". */
  doneLabel?: string;
  /** Announced suffix for the active step, e.g. "current". */
  currentLabel?: string;
}) {
  const { colors } = useDesign();
  const accent = colors[tone];

  const announced = steps
    .map((step, i) =>
      i < current
        ? `${step.label}${doneLabel ? `, ${doneLabel}` : ''}`
        : i === current
          ? `${step.label}${currentLabel ? `, ${currentLabel}` : ''}`
          : step.label,
    )
    .join('. ');

  return (
    <View accessible accessibilityRole="text" accessibilityLabel={announced} style={{ gap: 0 }}>
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const last = i === steps.length - 1;
        return (
          <View key={step.label} style={{ flexDirection: 'row', gap: space.md, minHeight: last ? 0 : 44 }}>
            <View style={{ width: 20, alignItems: 'center' }}>
              <View
                style={{
                  width: active ? 14 : 10,
                  height: active ? 14 : 10,
                  marginTop: active ? 4 : 6,
                  borderRadius: radius.full,
                  backgroundColor: done || active ? accent.base : colors.track,
                  borderWidth: active ? 3 : 0,
                  borderColor: accent.soft,
                }}
              />
              {last ? null : (
                <View
                  style={{ flex: 1, width: 2, marginVertical: 4, backgroundColor: done ? accent.base : colors.track }}
                />
              )}
            </View>
            <View style={{ flex: 1, paddingBottom: last ? 0 : space.md, gap: 1 }}>
              <Text
                variant={active ? 'bodyStrong' : 'body'}
                tone={active ? 'primary' : done ? 'secondary' : 'tertiary'}
              >
                {step.label}
              </Text>
              {step.detail ? (
                <Text variant="caption" tone="tertiary">
                  {step.detail}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
