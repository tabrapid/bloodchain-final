import { LinearGradient } from 'expo-linear-gradient';
import { AppText } from './AppText';

export interface AvatarProps {
  name: string;
  size?: number;
  /**
   * Ring color. The reference draws rank/identity as a colored 2.5px ring
   * around the avatar rather than a separate chip, so podium places and the
   * "this is you" row are legible at a glance.
   */
  ring?: string;
}

/**
 * A gradient-filled badge (the same rose-to-plum gradient as the app's hero
 * cards), matching Create Design's Avatar exactly -- initials are always
 * white since the fill is a saturated gradient in both themes, not a
 * theme-neutral tint.
 */
export function Avatar({ name, size = 48, ring }: AvatarProps) {
  const initials = (name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';

  return (
    <LinearGradient
      colors={['#D85360', '#8E4A75']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: ring ? 2.5 : 2,
        borderColor: ring ?? 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <AppText style={{ fontSize: size * 0.35, fontWeight: '700', color: '#FFFFFF' }}>
        {initials}
      </AppText>
    </LinearGradient>
  );
}
