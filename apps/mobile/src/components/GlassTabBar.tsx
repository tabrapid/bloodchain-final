import { useContext } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BottomTabBarHeightCallbackContext,
  type BottomTabBarProps,
} from 'expo-router/js-tabs';
import { radius, spacing, translucentElevation, useTheme } from '../theme';
import { AppText } from './AppText';

/**
 * A floating, glass-styled bottom tab bar, replacing React Navigation's flat
 * default.
 *
 * It overlays the content rather than taking a row below it -- that is what
 * lets it read as glass, since there is something behind it to blur. Two
 * things follow from that, and both have to be done here: it positions itself
 * (a navigator given a custom `tabBar` never applies `tabBarStyle`), and it
 * reports its measured height so `Screen` can pad content clear of it.
 */
export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // The navigator only knows how tall a *default* tab bar would be; a custom
  // one has to report its own size or every screen pads its content by the
  // wrong amount. This pill is roughly twice the default height, so without
  // it the last card still ended up behind the bar.
  const setTabBarHeight = useContext(BottomTabBarHeightCallbackContext);

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
        paddingVertical: 8,
        paddingHorizontal: 4,
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
                  gap: 3,
                  minWidth: 44,
                  minHeight: 44,
                  transform: [{ scale: pressed ? 0.94 : 1 }],
                }}
              >
                {/*
                  The pill wraps the icon alone, with the label underneath it.
                  Wrapping both meant only the active tab could be labelled --
                  a bar of five unlabelled glyphs, where a droplet and a heart
                  next to each other are a guess. Every tab is named now, and
                  the pill still says which one you are on.
                */}
                <View
                  style={{
                    width: 42,
                    height: 30,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: radius.pill,
                    backgroundColor: focused ? colors.primary : 'transparent',
                    // The active pill carries its own rose glow, so the
                    // selected tab lifts off the bar rather than just changing
                    // color.
                    shadowColor: colors.primary,
                    shadowOpacity: focused ? 0.38 : 0,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: focused ? 4 : 0,
                  }}
                >
                  {options.tabBarIcon?.({ focused, color, size: 19 })}
                </View>
                <AppText
                  style={{
                    fontSize: 9.5,
                    fontWeight: focused ? '700' : '500',
                    color: focused ? colors.text : colors.textMuted,
                    letterSpacing: 0.2,
                    lineHeight: 12,
                  }}
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
      onLayout={(event) => setTabBarHeight?.(event.nativeEvent.layout.height)}
      style={{
        // Floats over the content rather than taking a strip below it. The
        // navigator ignores `tabBarStyle` when a custom `tabBar` is supplied,
        // so this has to live here; `Screen` pads its content by the height
        // the navigator measures, so nothing ends up stranded underneath.
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 14,
        // Clear of the home indicator *and* off the bottom edge. `Math.max`
        // alone put the pill flush against the indicator zone on a notched
        // phone, so it read as docked rather than floating; the extra 10 is
        // the gap that makes it read as a pill hovering over the content.
        paddingBottom: Math.max(insets.bottom, 12) + 10,
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
          elevation: translucentElevation(nav.elevation),
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
