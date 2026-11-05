import { type ReactNode } from 'react';
import { View } from 'react-native';
import { useDesign } from '../useDesign';
import { radius, space } from '../tokens';
import { Text } from './Text';

export interface ChartFrameProps {
  /** What the chart shows: the parameter name. */
  title: string;
  /** The unit on the y-axis, e.g. "g/dL". */
  unit?: string;
  /** The range of the x-axis in words: "Mar 2025 – Sep 2026". */
  period?: string;
  /** Legend entries. Every series and every reference line has one. */
  legend?: { label: string; tone: 'clinical' | 'rose' | 'insight' | 'reference' }[];
  /** A one-line note under the chart: how many measurements, the source. */
  footnote?: string;
  children: ReactNode;
}

/**
 * The container every chart sits in.
 *
 * A chart with no title, no unit and no period is a shape; this is what turns
 * it into a record. The legend is mandatory for every series drawn, including
 * the reference lines, because a dashed line nobody has named is a guess.
 */
export function ChartFrame({ title, unit, period, legend, footnote, children }: ChartFrameProps) {
  const { colors } = useDesign();
  const swatch = (tone: NonNullable<ChartFrameProps['legend']>[number]['tone']) =>
    tone === 'reference' ? colors.textTertiary : colors[tone].base;

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: space.lg,
        gap: space.md,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title">{title}</Text>
          {period ? (
            <Text variant="caption" tone="tertiary">
              {period}
            </Text>
          ) : null}
        </View>
        {unit ? (
          <Text variant="label" tone="tertiary">
            {unit}
          </Text>
        ) : null}
      </View>

      {children}

      {legend?.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
          {legend.map((entry) => (
            <View key={entry.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View
                style={{
                  width: 14,
                  height: entry.tone === 'reference' ? 0 : 3,
                  borderRadius: 2,
                  backgroundColor: swatch(entry.tone),
                  ...(entry.tone === 'reference'
                    ? { borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.textTertiary }
                    : null),
                }}
              />
              <Text variant="caption" tone="secondary">
                {entry.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {footnote ? (
        <Text variant="caption" tone="tertiary">
          {footnote}
        </Text>
      ) : null}
    </View>
  );
}
