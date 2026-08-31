import { Pressable, PressableProps, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { radius, useTheme } from '../theme';
import { LucideIcon } from '../types/icons';
import { AppText } from './AppText';

export interface IconButtonProps extends Omit<PressableProps, 'style'> {
  icon: LucideIcon;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  /** Small numeric badge in the top-right corner (e.g. unread count). */
  badge?: number;
}

/**
 * A real glass icon button -- previously rendered a plain `View` with a
 * translucent `colors.surface` background and no `BlurView`, the same "flat
 * dull tile" bug `StatCard`/`Card` had before their fix: a translucent color
 * with nothing behind it to blur just reads as a flat tint.
 */
export function IconButton({
  icon: Icon,
  size = 22,
  color,
  style,
  badge,
  ...props
}: IconButtonProps) {
  const { colors, isDark } = useTheme();
  const flattenedStyle = StyleSheet.flatten(style);
  const resolvedColor = color ?? colors.text;

  return (
    <Pressable {...props}>
      {({ pressed }) => (
        <View
          style={[
            { width: 44, height: 44, borderRadius: radius.md, opacity: pressed ? 0.8 : 1 },
            flattenedStyle,
          ]}
        >
          <View style={{ flex: 1, borderRadius: radius.md, overflow: 'hidden' }}>
            <BlurView
              intensity={isDark ? 42 : 55}
              tint={colors.blurTint}
              experimentalBlurMethod="dimezisBlurView"
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colors.glassBorder,
                borderRadius: radius.md,
              }}
            >
              <Icon size={size} color={resolvedColor} />
            </BlurView>
          </View>
          {badge != null && badge > 0 && (
            <View
              style={{
                position: 'absolute',
                top: -3,
                right: -3,
                minWidth: 16,
                height: 16,
                paddingHorizontal: 3,
                borderRadius: 8,
                backgroundColor: colors.danger,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppText style={{ fontSize: 9, fontWeight: '700', color: colors.white }}>
                {badge > 9 ? '9+' : badge}
              </AppText>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}
