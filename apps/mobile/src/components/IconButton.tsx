import { Pressable, PressableProps, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';
import { LucideIcon } from '../types/icons';

export interface IconButtonProps extends PressableProps {
  icon: LucideIcon;
  size?: number;
  color?: string;
}

export function IconButton({
  icon: Icon,
  size = 22,
  color = colors.text,
  style,
  ...props
}: IconButtonProps) {
  const flattenedStyle = StyleSheet.flatten(style);

  return (
    <Pressable
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.8 : 1,
        ...flattenedStyle,
      })}
      {...props}
    >
      <Icon size={size} color={color} />
    </Pressable>
  );
}
