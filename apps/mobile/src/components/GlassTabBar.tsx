import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { radius, spacing, useTheme } from '../theme';
import { AppText } from './AppText';

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

  // `state.routes` is EVERY route registered in the navigator, including the
  // ones marked `href: null` to keep them out of the tab bar. Expo Router
  // implements `href: null` as `tabBarButton: () => null` plus
  // `tabBarItemStyle: { display: 'none' }` -- and both of those are honored
  // only by React Navigation's *default* bar. A custom `tabBar` like this one
  // gets the unfiltered list, so iterating it directly lays out a flex cell
  // for all ~19 routes and renders the 13 hidden ones as blank gaps, which is
  // what shipped: six icons squeezed into the left edge with dead space after
  // them. Filtering here is what actually honors `href: null`.
  const visibleRoutes = state.routes.filter((route) => {
    const options = descriptors[route.key]?.options;
    if (!options) return false;
    const itemStyle = StyleSheet.flatten(options.tabBarItemStyle) as ViewStyle | undefined;
    if (itemStyle?.display === 'none') return false;
    // An icon-only bar has nothing to draw for a route with no icon.
    return Boolean(options.tabBarIcon);
  });

  const focusedKey = state.routes[state.index]?.key;

  const bar = (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.xs,
        overflow: 'hidden',
      }}
    >
      {visibleRoutes.map((route) => {
        const { options } = descriptors[route.key]!;
        // Compared by key, not by array index: `state.index` indexes the full
        // route list, so an index comparison against the filtered list would
        // highlight the wrong tab.
        const focused = focusedKey === route.key;
        const label = (options.title as string) ?? route.name;
        // A filled, solid pill (not a translucent tint) so the active tab is
        // unambiguous at a glance -- the previous faint red circle was too
        // subtle to tell "active" from "just tinted" on a real device,
        // especially between visually similar icons (heart vs. droplet).
        const color = focused ? colors.white : colors.textMuted;

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
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xs }}
          >
            {({ pressed }) => (
              <View
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  paddingVertical: 6,
                  paddingHorizontal: spacing.sm,
                  borderRadius: radius.pill,
                  backgroundColor: focused ? colors.primary : 'transparent',
                  transform: [{ scale: pressed ? 0.94 : 1 }],
                }}
              >
                {options.tabBarIcon?.({ focused, color, size: 20 })}
                <AppText
                  style={{ fontSize: 10, fontWeight: focused ? '700' : '600', color }}
                  numberOfLines={1}
                >
                  {label}
                </AppText>
              </View>
            )}
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
