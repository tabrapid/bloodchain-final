import { useMemo } from 'react';
import { View, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';

export interface SegmentedOption<T extends string> {
  label: string;
  value: T;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * The reference has no tab component of its own -- every screen it designed
 * shows one list. Several real screens do need a filter (leaderboard time
 * range, donation status, read/unread), and each had grown its own inline
 * tab strip with a different shape and a different active treatment. This is
 * that control drawn once in the reference's vocabulary: a pill-shaped glass
 * track with the selected segment carried by a primary tint rather than by
 * an underline, which is the only selection idiom the reference uses.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  style,
}: SegmentedControlProps<T>) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.track, style]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.segment,
              active && styles.segmentActive,
              { opacity: pressed && !active ? 0.6 : 1 },
            ]}
          >
            <AppText style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    track: {
      flexDirection: 'row',
      backgroundColor: colors.glass.standard.fill,
      borderWidth: 1,
      borderColor: colors.glass.standard.border,
      borderRadius: radius.pill,
      padding: 3,
      gap: 3,
    },
    segment: {
      flex: 1,
      minHeight: 34,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
    },
    segmentActive: {
      backgroundColor: colors.primaryMuted,
    },
    label: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textMuted,
    },
    labelActive: {
      fontWeight: '600',
      color: colors.onMuted.primary,
    },
  });
}
