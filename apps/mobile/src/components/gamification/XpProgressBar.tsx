import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
} from 'react-native-reanimated';
import { spacing, useTheme, ThemeColors } from '../../theme';
import { AppText } from '../../components/AppText';

interface XpProgressBarProps {
  currentXp: number;
  xpToNextLevel: number;
  progress: number;
  size?: 'small' | 'medium' | 'large';
}

export function XpProgressBar({
  currentXp,
  xpToNextLevel,
  progress,
  size = 'medium',
}: XpProgressBarProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const animatedWidth = useSharedValue(0);

  React.useEffect(() => {
    animatedWidth.value = withTiming(progress, { duration: 800 });
  }, [progress]);

  const height = size === 'small' ? 6 : size === 'large' ? 12 : 8;
  const borderRadius = height / 2;

  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: `${animatedWidth.value}%`,
    };
  });

  return (
    <View style={styles.container}>
      <View style={[styles.track, { height, borderRadius }]}>
        <Animated.View
          style={[
            styles.fill,
            { height, borderRadius },
            animatedStyle,
          ]}
        />
      </View>
      <View style={styles.labelContainer}>
        <AppText variant="bodySmall" muted>
          {currentXp} XP
        </AppText>
        <AppText variant="bodySmall" muted>
          {xpToNextLevel} XP to next level
        </AppText>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      width: '100%',
    },
    track: {
      backgroundColor: colors.surfaceHighlight,
      overflow: 'hidden',
    },
    fill: {
      backgroundColor: colors.primary,
    },
    labelContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing.xs,
    },
  });
}
