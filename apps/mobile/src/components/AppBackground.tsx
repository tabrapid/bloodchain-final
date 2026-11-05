import { PropsWithChildren } from 'react';
import { View } from 'react-native';
import { useDesign } from '../design';

/**
 * The app's backdrop.
 *
 * V2 made this flat. It used to be a 160-degree gradient, and before that a
 * gradient with three drifting colour blooms behind it -- which were dimmed
 * twice and then dropped, because a bloom bright enough to see also tints
 * whichever card sits over it, so the same card read as a different material
 * depending on where it landed on the screen. The gradient survived that round
 * and has now gone the same way for the same reason: it made the top of every
 * screen a different colour from the bottom, so a card at the top and an
 * identical card at the bottom did not match, and the eye spent effort on a
 * difference that carried no information.
 *
 * A single near-black plum. Depth in V2 comes from the surfaces sitting on it,
 * which is where depth can actually mean something -- this level is above that
 * one -- rather than from the page underneath them.
 *
 * It stays mounted at the root rather than being painted per screen. Two
 * reasons, and the first is still a bug worth not re-earning: the floating tab
 * bar is a real backdrop blur, and it samples what has already been drawn
 * beneath it. Painted per screen, the backdrop mounted in the same commit as
 * the screen's content, so on a cold start the blur sampled a backdrop that did
 * not exist yet and the platform fell back to a flat frosted plate. Second, it
 * stops being rebuilt on every navigation.
 */
export function AppBackground({ children }: PropsWithChildren) {
  const { colors } = useDesign();

  return <View style={{ flex: 1, backgroundColor: colors.background }}>{children}</View>;
}
