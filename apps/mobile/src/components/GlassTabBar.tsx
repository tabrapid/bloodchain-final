import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
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
  const { colors } = useTheme();
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

  const nav = colors.glass.nav;

  const bar = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        backgroundColor: nav.fill,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: nav.border,
        paddingVertical: 10,
        paddingHorizontal: 6,
        overflow: 'hidden',
      }}
    >
      {/* Specular: the lit top edge that makes the bar read as floating glass. */}
      <LinearGradient
        colors={colors.glassSheen}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%' }}
        pointerEvents="none"
      />
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
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            {({ pressed }) => (
              <View
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  minWidth: 44,
                  minHeight: 44,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: radius.pill,
                  backgroundColor: focused ? colors.primary : 'transparent',
                  transform: [{ scale: pressed ? 0.94 : 1 }],
                  // The active pill carries its own rose glow, so the selected
                  // tab lifts off the bar rather than just changing color.
                  shadowColor: colors.primary,
                  shadowOpacity: focused ? 0.38 : 0,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: focused ? 4 : 0,
                }}
              >
                {options.tabBarIcon?.({ focused, color, size: focused ? 17 : 20 })}
                {/* Only the active tab is labelled -- the reference keeps the
                    inactive tabs icon-only so the selected one reads clearly. */}
                {focused && (
                  <AppText
                    style={{
                      fontSize: 9,
                      fontWeight: '700',
                      color,
                      letterSpacing: 0.36,
                      lineHeight: 11,
                    }}
                    numberOfLines={1}
                  >
                    {label}
                  </AppText>
                )}
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
        paddingHorizontal: 14,
        paddingBottom: Math.max(insets.bottom, 22),
        paddingTop: spacing.xs,
      }}
    >
      <View
        style={{
          borderRadius: radius.pill,
          shadowColor: '#000',
          shadowOpacity: nav.shadowOpacity,
          shadowRadius: nav.shadowRadius,
          shadowOffset: { width: 0, height: nav.shadowOffsetY },
          elevation: nav.elevation,
        }}
      >
        <BlurView
          intensity={nav.blur}
          tint={colors.blurTint}
          experimentalBlurMethod="dimezisBlurView"
          style={{ borderRadius: radius.pill, overflow: 'hidden' }}
        >
          {bar}
        </BlurView>
      </View>
    </View>
  );
}
