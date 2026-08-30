import { Pressable, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { radius, spacing, useTheme } from '../theme';

/**
 * A floating, glass-styled bottom tab bar, replacing React Navigation's
 * default flat bar. Docked (not `position: absolute`) so scroll content
 * never needs manual bottom-inset padding to avoid being hidden behind it --
 * it still reads as a "floating pill" thanks to its own margin and rounded
 * corners, it just occupies its own row instead of overlapping content.
 */
export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const bar = (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.xs,
        overflow: 'hidden',
      }}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key]!;
        const focused = state.index === index;
        const color = focused ? colors.primary : colors.textMuted;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? (options.title as string)}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xs }}
          >
            <View
              style={{
                width: 44,
                height: 34,
                borderRadius: radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: focused ? colors.primaryMuted : 'transparent',
              }}
            >
              {options.tabBarIcon?.({ focused, color, size: 22 })}
            </View>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View
      style={{
        paddingHorizontal: spacing.md,
        paddingBottom: Math.max(insets.bottom, spacing.sm),
        paddingTop: spacing.xs,
      }}
    >
      <View
        style={{
          borderRadius: radius.xl,
          shadowColor: '#000',
          shadowOpacity: isDark ? 0.4 : 0.1,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
        }}
      >
        <BlurView
          intensity={isDark ? 50 : 65}
          tint={colors.blurTint}
          experimentalBlurMethod="dimezisBlurView"
          style={{ borderRadius: radius.xl, overflow: 'hidden' }}
        >
          {bar}
        </BlurView>
      </View>
    </View>
  );
}
