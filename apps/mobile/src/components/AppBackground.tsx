import { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';

/**
 * The app's backdrop: the reference's 160deg gradient.
 *
 * It used to carry three soft colour blooms as well. They were dimmed twice
 * and then dropped: a bloom bright enough to be seen at all also tints
 * whichever card sits over it, so the same card read as a different material
 * depending on where it landed on the screen. The gradient alone gives the
 * backdrop its depth, and the cards keep the eye.
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
 * Second, it stops being rebuilt on every navigation: one gradient for the
 * whole app instead of a fresh one per screen.
 */
export function AppBackground({ children }: PropsWithChildren) {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* The backdrop first, the app in a sibling declared after it. Painting
          order among siblings is declaration order, so this makes "backdrop
          below, content above" a property of the structure rather than
          something to re-derive from how absolute positioning happens to
          composite. */}
      <LinearGradient
        colors={colors.backgroundGradient}
        // Mostly top-to-bottom with a slight rightward lean, matching the
        // reference's 160deg -- not a 135deg diagonal.
        start={{ x: 0, y: 0 }}
        end={{ x: 0.34, y: 0.94 }}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

