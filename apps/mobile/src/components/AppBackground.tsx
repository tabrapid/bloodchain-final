import { PropsWithChildren } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { useTheme } from '../theme';

/**
 * The app's backdrop: the reference's 160deg gradient plus the soft color
 * blooms that give the glass something to blur.
 *
 * Mounted once at the root, beneath the navigator, rather than by each screen.
 * Two reasons, and the first is a bug:
 *
 * `expo-blur` wraps the platform's backdrop-blur view, which samples whatever
 * has already been drawn beneath it. When the gradient was rendered by
 * `Screen`, it mounted in the *same commit* as that screen's cards -- so on a
 * cold start every blur sampled a backdrop that did not exist yet and the
 * platform fell back to a flat frosted plate. A screen of flat plates is the
 * milky wash the app opened with, and why leaving and coming back cleared it:
 * the second mount finally had a painted background underneath. Rendered at
 * the root, the backdrop is on screen before any screen's glass mounts.
 *
 * Second, it stops being rebuilt on every navigation: one gradient and one
 * bloom layer for the whole app instead of a fresh pair per screen.
 */
export function AppBackground({ children }: PropsWithChildren) {
  const { colors } = useTheme();

  return (
    <LinearGradient
      colors={colors.backgroundGradient}
      // Mostly top-to-bottom with a slight rightward lean, matching the
      // reference's 160deg -- not a 135deg diagonal.
      start={{ x: 0, y: 0 }}
      end={{ x: 0.34, y: 0.94 }}
      locations={[0, 0.55, 1]}
      style={{ flex: 1 }}
    >
      {/*
        Glass panels blur whatever sits behind them, so a flat single-color
        background blurs to that same flat color -- the effect only becomes
        visible when there is color variation to smear. These orbs are that
        variation. Each is a radial gradient (full color at the center, fading
        to fully transparent at the edge) rather than a flat-filled circle: a
        real soft glow instead of a hard-edged blob, and cheaper than a
        full-screen BlurView.
      */}
      <View style={ABSOLUTE_FILL} pointerEvents="none">
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

      {children}
    </LinearGradient>
  );
}

const ABSOLUTE_FILL = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  overflow: 'hidden' as const,
};
