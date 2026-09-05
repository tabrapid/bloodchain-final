import { Pressable, PressableProps, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme';
import { LucideIcon } from '../types/icons';
import { AppText } from './AppText';

/** The reference sets 14 here — between the sm (12) and md (18) steps. */
const ICON_BUTTON_RADIUS = 14;

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
  const { colors } = useTheme();
  const flattenedStyle = StyleSheet.flatten(style);
  const resolvedColor = color ?? colors.text;

  return (
    <Pressable {...props}>
      {({ pressed }) => (
        <View
          style={[
            {
              width: 40,
              height: 40,
              borderRadius: ICON_BUTTON_RADIUS,
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.94 : 1 }],
            },
            flattenedStyle,
          ]}
        >
          <View style={{ flex: 1, borderRadius: ICON_BUTTON_RADIUS, overflow: 'hidden' }}>
            <BlurView
              intensity={colors.glass.standard.blur}
              tint={colors.blurTint}
              experimentalBlurMethod="dimezisBlurView"
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.glass.standard.fill,
                borderWidth: 1,
                borderColor: colors.glass.standard.border,
                borderRadius: ICON_BUTTON_RADIUS,
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
