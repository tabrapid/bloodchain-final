import { type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useDesign } from '../useDesign';
import { hitTarget, icon as iconScale, radius, space, type AccentName } from '../tokens';
import { Text, ValueText } from './Text';
import { Badge, type StatusTone } from './Status';

export interface RecordRowProps {
  /** What was measured: "Haemoglobin". */
  parameter: string;
  /** The formatted value, without its unit: "14.2". Em dash when absent. */
  value: string;
  unit?: string;
  /** The reference context, in words: "12.0–16.0 g/dL". */
  reference?: string;
  /** The status label, and its tone. */
  status?: { label: string; tone: StatusTone };
  /** Date and source, on one line: "20 Sept 2026 · Northstar Laboratory". */
  meta?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
}

/**
 * One laboratory result, drawn as a record rather than a widget.
 *
 * Parameter on the left in the reading face; the value on the right in the
 * display face with tabular figures, its unit beside it in the tertiary
 * colour; the reference range and the status under them. A normal result is
 * visually quiet -- the badge is the only colour on the row, and it is the
 * calm green. An abnormal one earns its amber or red, and nothing else on the
 * screen competes with it.
 *
 * The whole row is one accessible element: "Haemoglobin, 14.2 grams per
 * decilitre, within reference range, 20 September".
 */
export function RecordRow({
  parameter,
  value,
  unit,
  reference,
  status,
  meta,
  onPress,
  accessibilityLabel,
}: RecordRowProps) {
  const { colors } = useDesign();
  const attention = status && status.tone !== 'neutral' && status.tone !== 'success';

  const body = (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyMedium" numberOfLines={2}>
            {parameter}
          </Text>
          {reference ? (
            <Text variant="caption" tone="tertiary" numberOfLines={1}>
              {reference}
            </Text>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.xs }}>
          <ValueText
            variant="valueSm"
            style={attention ? { color: colors[status.tone as AccentName].text } : undefined}
          >
            {value}
          </ValueText>
          {unit ? (
            <Text variant="caption" tone="tertiary">
              {unit}
            </Text>
          ) : null}
        </View>
        {onPress ? <ChevronRight size={iconScale.md} color={colors.textTertiary} style={{ marginTop: 3 }} /> : null}
      </View>
      {status || meta ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' }}>
          {status ? <Badge label={status.label} tone={status.tone} dot /> : null}
          {meta ? (
            <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ flexShrink: 1 }}>
              {meta}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  const label =
    accessibilityLabel ??
    [parameter, unit ? `${value} ${unit}` : value, status?.label, reference, meta].filter(Boolean).join(', ');

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={label} style={{ paddingVertical: space.md, minHeight: hitTarget.comfortable }}>
        {body}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        { paddingVertical: space.md, minHeight: hitTarget.comfortable },
        pressed
          ? {
              backgroundColor: colors.surfacePressed,
              marginHorizontal: -space.lg,
              paddingHorizontal: space.lg,
              borderRadius: radius.sm,
            }
          : null,
      ]}
    >
      {body}
    </Pressable>
  );
}

/**
 * A large clinical value with its label, unit and context: the headline of
 * a health screen, the hero of a trends screen.
 *
 * Label above in the overline, value in the display face, unit beside it,
 * then a line of context. Quiet by default; the accent is spent only when
 * the value is a state.
 */
export function ValueBlock({
  label,
  value,
  unit,
  context,
  tone,
  trailing,
}: {
  label: string;
  value: string;
  unit?: string;
  context?: ReactNode;
  tone?: AccentName;
  trailing?: ReactNode;
}) {
  const { colors } = useDesign();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}`}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}
    >
      <View style={{ flex: 1, gap: space.xs }}>
        <Text variant="overline" tone="tertiary" caps>
          {label}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
          <ValueText style={tone ? { color: colors[tone].text } : undefined}>{value}</ValueText>
          {unit ? (
            <Text variant="body" tone="tertiary">
              {unit}
            </Text>
          ) : null}
        </View>
        {context}
      </View>
      {trailing}
    </View>
  );
}
