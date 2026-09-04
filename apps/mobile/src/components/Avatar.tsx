import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';
import { AppText } from './AppText';

export interface AvatarProps {
  name: string;
  size?: number;
}

/**
 * A gradient-filled badge (the same rose-to-plum gradient as the app's hero
 * cards), matching Create Design's Avatar exactly -- initials are always
 * white since the fill is a saturated gradient in both themes, not a
 * theme-neutral tint.
 */
export function Avatar({ name, size = 48 }: AvatarProps) {
  const { colors } = useTheme();
  const initials = (name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';

  return (
    <LinearGradient
      colors={colors.heroGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
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
