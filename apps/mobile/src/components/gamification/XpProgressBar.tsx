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
  /** Set when rendered on top of a vivid, saturated gradient (not a theme
   * surface) -- the track and labels switch to white-based tones since the
   * themed `surfaceHighlight`/muted-text colors are unreadable there. */
  onGradient?: boolean;
}

export function XpProgressBar({
  currentXp,
  xpToNextLevel,
  progress,
  size = 'medium',
  onGradient = false,
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
      <View
        style={[
          styles.track,
          { height, borderRadius },
          onGradient && styles.trackOnGradient,
        ]}
      >
        <Animated.View
          style={[
            styles.fill,
            { height, borderRadius },
            onGradient && styles.fillOnGradient,
            animatedStyle,
          ]}
        />
      </View>
      <View style={styles.labelContainer}>
        <AppText variant="bodySmall" muted={!onGradient} style={onGradient ? styles.labelOnGradient : undefined}>
          {currentXp} XP
        </AppText>
        <AppText variant="bodySmall" muted={!onGradient} style={onGradient ? styles.labelOnGradient : undefined}>
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
    trackOnGradient: {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    fill: {
      backgroundColor: colors.primary,
    },
    fillOnGradient: {
      backgroundColor: '#FFFFFF',
    },
    labelContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing.xs,
    },
    labelOnGradient: {
      color: 'rgba(255,255,255,0.75)',
    },
  });
}
