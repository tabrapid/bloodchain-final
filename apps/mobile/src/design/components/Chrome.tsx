import { useContext, type ReactNode } from 'react';
import { Platform, Pressable, View, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from 'expo-router/js-tabs';
import { useDesign } from '../useDesign';
import { elevation, hitTarget, icon as iconScale, radius, space } from '../tokens';
import { Text } from './Text';
import { IconButton } from './Button';

export interface ScreenHeaderProps {
  title?: string;
  /** Smaller line above the title: a breadcrumb, a step count, a date. */
  eyebrow?: string;
  onBack?: () => void;
  backLabel?: string;
  /** Controls at the trailing edge. */
  actions?: ReactNode;
  style?: ViewStyle;
}

/**
 * The bar at the top of a pushed screen.
 *
 * Back on the left, title beside it rather than centred. A centred title looks
 * tidier and truncates far sooner -- which matters here because the titles are
 * Uzbek and Russian, and the Russian for "Notification preferences" is not
 * going to fit between two 44pt buttons. Left-aligned, it gets the width.
 *
 * `title` is a `header` for assistive technology, so the screen announces what
 * it is on arrival.
 */
export function ScreenHeader({ title, eyebrow, onBack, backLabel = 'Go back', actions, style }: ScreenHeaderProps) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          minHeight: hitTarget.comfortable,
          paddingHorizontal: space.lg,
          paddingVertical: space.sm,
        },
        style,
      ]}
    >
      {onBack ? (
        <IconButton
          accessibilityLabel={backLabel}
          onPress={onBack}
          style={{ marginLeft: -space.md }}
          icon={({ size, color }) => (
            <Text style={{ fontSize: size + 4, color, lineHeight: size + 6 }}>‹</Text>
          )}
        />
      ) : null}

      <View style={{ flex: 1, gap: 2 }}>
        {eyebrow ? (
          <Text variant="overline" tone="tertiary" caps numberOfLines={1}>
            {eyebrow}
          </Text>
        ) : null}
        {title ? (
          <Text variant="h2" accessibilityRole="header" numberOfLines={1}>
            {title}
          </Text>
        ) : null}
      </View>

      {actions}
    </View>
  );
}

/**
 * The floating bottom tab bar.
 *
 * This is the one place in V2 that spends translucency. It is a single surface
 * over scrolling content, which is exactly the case blur is for, and a single
 * failure here is a slightly flat pill rather than a dimmed app -- which is why
 * V1 had to switch it off everywhere else.
 *
 * Two things it must do that a custom tab bar easily forgets:
 *
 *   It reports its own height. A navigator only knows how tall a DEFAULT bar
 *   would be, so a custom one that stays silent leaves every screen padding its
 *   content by the wrong amount and the last card sitting underneath the bar.
 *
 *   It honours `href: null`. `state.routes` is EVERY route registered in the
 *   navigator, including the dozen pushed screens that are not tabs. Expo
 *   Router implements `href: null` as `tabBarButton: () => null` plus
 *   `tabBarItemStyle: { display: 'none' }`, and both of those are read only by
 *   React Navigation's own bar. A custom one gets the unfiltered list and will
 *   happily lay out a flex cell for all nineteen.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useDesign();
  const insets = useSafeAreaInsets();
  const reportHeight = useContext(BottomTabBarHeightCallbackContext);

  const visible = state.routes.filter((route) => {
    const options = descriptors[route.key]?.options;
    if (!options) return false;
    const itemStyle = options.tabBarItemStyle as { display?: string } | undefined;
    if (itemStyle?.display === 'none') return false;
    return Boolean(options.tabBarIcon);
  });

  const focusedKey = state.routes[state.index]?.key;

  return (
    <View
      // Compared by key, not index: `state.index` indexes the FULL route list,
      // so comparing it against the filtered one highlights the wrong tab.
      onLayout={(event) => reportHeight?.(event.nativeEvent.layout.height + insets.bottom)}
      style={{
        position: 'absolute',
        left: space.lg,
        right: space.lg,
        bottom: insets.bottom + space.sm,
        borderRadius: radius.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.chrome.border,
        ...(Platform.OS === 'ios'
          ? {
              shadowColor: '#000',
              shadowOpacity: elevation.floating.shadowOpacity,
              shadowRadius: elevation.floating.shadowRadius,
              shadowOffset: { width: 0, height: elevation.floating.shadowOffsetY },
            }
          : null),
      }}
    >
      <BlurView
        intensity={colors.chrome.blurIntensity}
        tint={colors.chrome.blurTint}
        style={{ flexDirection: 'row', backgroundColor: colors.chrome.fill }}
      >
        {visible.map((route) => {
          const { options } = descriptors[route.key]!;
          const focused = focusedKey === route.key;
          const label = (options.title as string) ?? route.name;
          const color = focused ? colors.rose.text : colors.textTertiary;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={(options.tabBarAccessibilityLabel as string) ?? label}
              accessibilityState={{ selected: focused }}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                paddingVertical: space.md,
                minHeight: hitTarget.comfortable,
              }}
            >
              {options.tabBarIcon?.({ focused, color, size: iconScale.md })}
              {/* The label stays at every state. An icon-only bar is two taps
                  of guessing for anyone who does not already know the app, and
                  the icons here (a droplet, a heart, a calendar) are not
                  self-evident in a language the donor may not read. */}
              <Text
                variant="caption"
                style={{ color, fontSize: 10, lineHeight: 13, fontWeight: focused ? '600' : '400' }}
                numberOfLines={1}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </BlurView>
    </View>
  );
}
