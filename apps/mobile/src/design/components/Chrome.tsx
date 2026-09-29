import { useContext, type ReactNode } from 'react';
import { Platform, Pressable, View, type ViewStyle } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from 'expo-router/js-tabs';
import { useDesign } from '../useDesign';
import { elevation, hitTarget, icon as iconScale, layout, radius, space } from '../tokens';
import { fonts } from '../fonts';
import { Text } from './Text';
import { IconButton } from './Button';

/**
 * `backLabel` is required whenever `onBack` is, and impossible without it.
 *
 * The back control is an icon, so the label IS the control for anyone using a
 * screen reader. A default in English would be invisible in review and would
 * ship untranslated to a Uzbek donor, so the type refuses the header rather
 * than filling the gap in.
 */
export type ScreenHeaderProps = {
  title?: string;
  /** Smaller line above the title: a breadcrumb, a step count, a date. */
  eyebrow?: string;
  /**
   * A sentence under the title, `size="large"` only. An eyebrow is a word or
   * a count and lives in caps; a sentence set in caps on one clipped line is
   * what "JOIN CAMPAIGNS TO HELP SAVE LIVES IN YOUR COMM..." looked like.
   */
  subtitle?: string;
  /** Controls at the trailing edge. */
  actions?: ReactNode;
  /**
   * `inline` (default) keeps the title beside the back button at 18pt.
   * `large` puts a 28pt title on its own line under the bar, for a pushed
   * screen that is a destination in its own right rather than a step.
   */
  size?: 'inline' | 'large';
  style?: ViewStyle;
} & ({ onBack: () => void; backLabel: string } | { onBack?: never; backLabel?: never });

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
export function ScreenHeader({
  title,
  eyebrow,
  subtitle,
  onBack,
  backLabel,
  actions,
  size = 'inline',
  style,
}: ScreenHeaderProps) {
  const large = size === 'large' && Boolean(title);
  return (
    <View style={[{ paddingHorizontal: layout.gutter - space.sm }, style]}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          minHeight: hitTarget.comfortable,
          paddingVertical: space.xs,
        }}
      >
        {onBack ? (
          <IconButton
            accessibilityLabel={backLabel!}
            onPress={onBack}
            icon={({ size: s, color }) => <ChevronLeft size={s + 2} color={color} />}
          />
        ) : (
          <View style={{ width: space.sm }} />
        )}

        {large ? (
          <View style={{ flex: 1 }} />
        ) : (
          <View style={{ flex: 1, gap: 1, paddingLeft: onBack ? 0 : space.xs }}>
            {eyebrow ? (
              <Text variant="overline" tone="tertiary" caps numberOfLines={1}>
                {eyebrow}
              </Text>
            ) : null}
            {title ? (
              <Text variant="h3" accessibilityRole="header" numberOfLines={1}>
                {title}
              </Text>
            ) : null}
          </View>
        )}

        {actions}
      </View>
      {large ? (
        <View style={{ paddingHorizontal: space.sm, paddingTop: space.xs, paddingBottom: space.sm, gap: 2 }}>
          {eyebrow ? (
            <Text variant="overline" tone="tertiary" caps numberOfLines={1}>
              {eyebrow}
            </Text>
          ) : null}
          <Text variant="h1" accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="body" tone="secondary" style={{ marginTop: space.xs }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export interface ScreenTitleProps {
  /** The name of the screen. Announced as a heading. */
  title: string;
  /** One line saying what the screen is for. */
  subtitle?: string;
  /** A small line above the title: today's date, a context word. */
  eyebrow?: string;
  /** A control at the trailing edge: a button, an icon button, a status badge. */
  action?: ReactNode;
  style?: ViewStyle;
}

/**
 * The title of a root tab screen.
 *
 * `h1` (28) rather than the pushed header's `h3` (18): a root screen is a
 * place and a pushed screen is a step, and the 10pt between them is what says
 * which.
 */
export function ScreenTitle({ title, subtitle, eyebrow, action, style }: ScreenTitleProps) {
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.md, minHeight: 44 },
        style,
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        {eyebrow ? (
          <Text variant="label" tone="tertiary" numberOfLines={1}>
            {eyebrow}
          </Text>
        ) : null}
        <Text variant="h1" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="body" tone="secondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}

/**
 * The bottom tab bar.
 *
 * Full width, opaque, a hairline above it and the safe area below: the shape
 * of a native tab bar on both platforms, which is what a donor's thumb already
 * knows. The earlier floating pill read as a template and cost every screen
 * 24pt of dead space at the foot.
 *
 * The active tab is marked three ways -- a tinted pill behind the icon, the
 * rose colour, and a heavier label face -- so it survives colour blindness
 * and a renderer that disagrees about weight.
 *
 * Two things it must do that a custom tab bar easily forgets:
 *
 *   It reports its own height. A navigator only knows how tall a DEFAULT bar
 *   would be, so a custom one that stays silent leaves every screen padding its
 *   content by the wrong amount and the last card sitting underneath the bar.
 *
 *   It honours `href: null`. `state.routes` is EVERY route registered in the
 *   navigator, including the dozen pushed screens that are not tabs.
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

  // One decision for the whole bar, so the six labels share a size.
  const compact = visible.some((route) => {
    const label = (descriptors[route.key]?.options.title as string | undefined) ?? route.name;
    return label.length > 9;
  });

  return (
    <View
      // Compared by key, not index: `state.index` indexes the FULL route list,
      // so comparing it against the filtered one highlights the wrong tab.
      onLayout={(event) => reportHeight?.(event.nativeEvent.layout.height)}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingTop: space.sm,
        paddingBottom: Math.max(insets.bottom, space.sm),
        paddingHorizontal: space.xs,
        backgroundColor: colors.chrome.fill,
        borderTopWidth: 1,
        borderTopColor: colors.chrome.border,
        ...(Platform.OS === 'ios'
          ? {
              shadowColor: '#000',
              shadowOpacity: elevation.floating.shadowOpacity,
              shadowRadius: elevation.floating.shadowRadius,
              shadowOffset: { width: 0, height: -4 },
            }
          : { elevation: elevation.floating.android }),
      }}
    >
      {visible.map((route) => {
        const { options } = descriptors[route.key]!;
        const focused = focusedKey === route.key;
        const label = (options.title as string) ?? route.name;
        const color = focused ? colors.rose.base : colors.textTertiary;

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
              justifyContent: 'flex-start',
              gap: 4,
              minHeight: hitTarget.min,
              paddingHorizontal: 1,
            }}
          >
            <View
              style={{
                width: 52,
                height: 30,
                borderRadius: radius.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: focused ? colors.rose.soft : 'transparent',
              }}
            >
              {options.tabBarIcon?.({ focused, color, size: iconScale.md + 2 })}
            </View>
            {/* The label stays at every state. An icon-only bar is two taps
                of guessing for anyone who does not already know the app, and
                the icons here (a droplet, a heart, a calendar) are not
                self-evident in a language the donor may not read. */}
            <Text
              variant="caption"
              // 11 when every label is short; 10 -- the size iOS itself uses
              // for a tab label -- when one is not. "Сообщество" is a single
              // ten-letter word and at 11 it splits mid-word in a sixth of a
              // 393pt phone; at 10 it fits. Two lines rather than an
              // ellipsis for the labels that have a space to break at
              // ("Сдать кровь"), because "Сообщес…" is not a label. The
              // focused state changes FACE, not weight.
              style={{
                color: focused ? colors.rose.text : colors.textTertiary,
                fontSize: compact ? 10 : 11,
                lineHeight: 13,
                fontFamily: focused ? fonts.semibold : fonts.medium,
                textAlign: 'center',
              }}
              numberOfLines={2}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
