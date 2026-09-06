import { View } from 'react-native';
import { useTheme } from '../theme';

export interface StepRailProps {
  steps: number;
  /** Zero-based index of the step being shown. */
  current: number;
}

/**
 * The wizard's progress: one node per step, joined by the segments between
 * them, filled up to the step you are on.
 *
 * A plain progress bar answers "how far along" but not "how far in total" --
 * on a six-step form the difference between step two and step three is four
 * pixels of bar. Discrete nodes make the length of the thing visible before
 * you start it, which is the question someone actually has on step one.
 */
export function StepRail({ steps, current }: StepRailProps) {
  const { colors } = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
      {Array.from({ length: steps }, (_, index) => {
        const done = index <= current;
        return (
          <View key={index} style={{ flexDirection: 'row', alignItems: 'center', flex: index === steps - 1 ? 0 : 1 }}>
            <View
              style={{
                width: done ? 10 : 8,
                height: done ? 10 : 8,
                borderRadius: 5,
                backgroundColor: done ? colors.primary : colors.border,
              }}
            />
            {index < steps - 1 && (
              <View
                style={{
                  flex: 1,
                  height: 2,
                  backgroundColor: index < current ? colors.primary : colors.border,
                }}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}
