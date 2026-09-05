import { PropsWithChildren } from 'react';
import { ScrollView, ScrollViewProps, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { spacing, useTheme } from '../theme';

export interface ScreenProps extends ScrollViewProps {
  scroll?: boolean;
}

export function Screen({
  children,
  scroll = true,
  style,
  contentContainerStyle,
  ...props
}: PropsWithChildren<ScreenProps>) {
  const { colors } = useTheme();
  const content = <View style={[{ flex: 1, padding: spacing.lg }, style]}>{children}</View>;

  return (
    <LinearGradient
      colors={colors.backgroundGradient}
      // The reference's background is a 160deg gradient — mostly top-to-bottom
      // with a slight rightward lean, not the 135deg diagonal this used before.
      start={{ x: 0, y: 0 }}
      end={{ x: 0.34, y: 0.94 }}
      locations={[0, 0.55, 1]}
      style={{ flex: 1 }}
    >
      {/*
        Soft color blooms behind the content. Glass panels blur whatever sits
        behind them, so a flat single-color background blurs to that exact same
        flat color -- the effect only becomes visible when there is color
        variation to smear. These orbs are that variation.
        Each is a radial gradient (full color at center, fading to fully
        transparent at the edge) rather than a flat-filled circle -- a real
        soft glow instead of a hard-edged "concept art" blob, and cheaper than
        a full-screen BlurView (no extra compositing pass on top of the blur
        every glass card already does). pointerEvents="none" keeps it out of
        the touch path.
      */}
      <View style={StyleSheetAbsoluteFill} pointerEvents="none">
        {colors.ambientOrbs.map((orb, i) => (
          <Svg
            key={i}
            style={{ position: 'absolute', top: orb.top, left: orb.left }}
            width={orb.size}
            height={orb.size}
          >
            <Defs>
              <RadialGradient id={`orb-${i}`} cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={orb.color} stopOpacity={1} />
                <Stop offset="100%" stopColor={orb.color} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={orb.size / 2} cy={orb.size / 2} r={orb.size / 2} fill={`url(#orb-${i})`} />
          </Svg>
        ))}
      </View>

      <SafeAreaView style={{ flex: 1 }}>
        {scroll ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[{ flexGrow: 1 }, contentContainerStyle]}
            showsVerticalScrollIndicator={false}
            {...props}
          >
            {content}
          </ScrollView>
        ) : (
          content
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const StyleSheetAbsoluteFill = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  overflow: 'hidden' as const,
};
