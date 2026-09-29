import { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  View,
  type ScrollViewProps,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import { useContext } from 'react';
import { useDesign } from '../useDesign';
import { layout, space } from '../tokens';

export interface ScreenProps {
  children: ReactNode;
  /** Horizontal gutter. `false` for a screen that manages its own, e.g. a full-bleed list. */
  gutter?: boolean;
  /** Padding at the top, below the header. */
  topPadding?: boolean;
  style?: ViewStyle;
  testID?: string;
}

/**
 * The page frame.
 *
 * It owns three things every screen would otherwise get slightly wrong on its
 * own: the background colour, the safe-area insets, and the space the tab bar
 * occupies.
 *
 * The tab-bar height is read from context rather than from
 * `useBottomTabBarHeight()`, which throws on the screens that are not inside a
 * tab navigator at all -- auth, booking, the emergency screen.
 */
export function Screen({ children, gutter = true, topPadding = true, style, testID }: ScreenProps) {
  const { colors } = useDesign();
  const insets = useSafeAreaInsets();

  return (
    <View
      testID={testID}
      style={[
        {
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: topPadding ? insets.top : 0,
          paddingHorizontal: gutter ? layout.gutter : 0,
          // A phone layout stretched across a tablet is a 700pt line of body
          // text, which nobody can read. The column stops growing and centres.
          width: '100%',
          maxWidth: layout.maxContentWidth,
          alignSelf: 'center',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export interface ScrollScreenProps extends Omit<ScrollViewProps, 'style' | 'contentContainerStyle'> {
  children: ReactNode;
  gutter?: boolean;
  topPadding?: boolean;
  /** Renders above the scroller and does not move with it. */
  header?: ReactNode;
  /** Pull-to-refresh. Passing `onRefresh` is what turns it on. */
  refreshing?: boolean;
  onRefresh?: () => void;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

/**
 * How much room the tab bar needs at the foot of a scrolling surface.
 *
 * The bar's real height comes from context when there is one; the documented
 * clearance is the fallback for screens outside the tab navigator.
 * Exported so a list cannot get this wrong by copying a number.
 */
export function useTabBarClearance(): number {
  const tabBarHeight = useContext(BottomTabBarHeightContext);
  return (tabBarHeight ?? layout.tabBarClearance) + space.xl;
}

/**
 * A scrolling page.
 *
 * `flexGrow` rather than `flex` on the content container, which is the
 * difference between a short screen filling the viewport and a long screen
 * being clamped to it.
 */
export function ScrollScreen({
  children,
  gutter = true,
  topPadding = true,
  header,
  refreshing = false,
  onRefresh,
  style,
  contentStyle,
  ...rest
}: ScrollScreenProps) {
  const { colors } = useDesign();
  const insets = useSafeAreaInsets();
  const bottomClearance = useTabBarClearance();

  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: topPadding ? insets.top : 0,
          width: '100%',
          maxWidth: layout.maxContentWidth,
          alignSelf: 'center',
        },
        style,
      ]}
    >
      {header}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          {
            flexGrow: 1,
            paddingHorizontal: gutter ? layout.gutter : 0,
            // Under a fixed header the content needs a breath before the
            // first surface; without one the card sits against the bar.
            paddingTop: header ? space.md : 0,
            paddingBottom: bottomClearance,
          },
          contentStyle,
        ]}
        showsVerticalScrollIndicator={false}
        // Without this the first tap with a keyboard open only dismisses the
        // keyboard, so every button on a form screen needs pressing twice.
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.textSecondary}
              colors={[colors.rose.base]}
              progressBackgroundColor={colors.surfaceRaised}
            />
          ) : undefined
        }
        {...rest}
      >
        {children}
      </ScrollView>
    </View>
  );
}

/**
 * A form page: scrolls, and lifts its content clear of the keyboard.
 *
 * iOS needs `padding` and Android needs `height`; getting this wrong is why a
 * submit button ends up under the keyboard on one platform only.
 */
export function FormScreen({ children, gutter = true, topPadding = true, header, ...rest }: ScrollScreenProps) {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollScreen gutter={gutter} topPadding={topPadding} header={header} {...rest}>
        {children}
      </ScrollScreen>
    </KeyboardAvoidingView>
  );
}

/**
 * Vertical rhythm between sections of a page.
 *
 * Exists so that "how far apart are two sections" is one decision. A screen
 * that sets its own margins is a screen that will disagree with the next one.
 */
export function Stack({
  gap = 'xl',
  children,
  style,
  ...rest
}: ViewProps & { gap?: keyof typeof space; children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[{ gap: space[gap] }, style]} {...rest}>
      {children}
    </View>
  );
}

/** A horizontal group: an icon and a label, a value and its unit, two buttons. */
export function Row({
  gap = 'md',
  align = 'center',
  children,
  style,
  ...rest
}: ViewProps & {
  gap?: keyof typeof space;
  align?: ViewStyle['alignItems'];
  children: ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: align, gap: space[gap] }, style]} {...rest}>
      {children}
    </View>
  );
}
