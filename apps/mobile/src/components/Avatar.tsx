import { View } from 'react-native';
import { colors, radius, typography } from '../theme';
import { AppText } from './AppText';

export interface AvatarProps {
  name: string;
  size?: number;
}

export function Avatar({ name, size = 48 }: AvatarProps) {
  const initial = name?.charAt(0).toUpperCase() ?? '?';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceElevated,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <AppText style={{ ...typography.heading, color: colors.text }}>{initial}</AppText>
    </View>
  );
}
