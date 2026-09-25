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
 * own: the background colour, the safe-area insets, and the space the floating
 * tab bar occupies. In V1 each screen painted its own gradient and guessed at
 * the bottom inset, which is why the last card on several screens sat under
 * the tab bar.
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
          // A phone layout stretched across a tablet or an unfolded foldable
          // is a 700pt line of body text, which nobody can read. The column
          // stops growing and centres instead.
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
 * A scrolling page.
 *
 * `flexGrow` rather than `flex` on the content container, which is the
 * difference between a short screen filling the viewport and a long screen
 * being clamped to it. V1 shipped `flex: 1` here for a while and everything
 * past the fold was unreachable, with the last card cut in half.
 *
 * Bottom padding is the tab bar's measured height when there is one, and a
 * documented clearance when there is not -- so content always scrolls clear of
 * the floating bar instead of ending underneath it.
 */
/**
 * How much room the floating tab bar needs at the foot of a scrolling surface.
 *
 * The bar draws over the content, and its height depends on the device -- a
 * home indicator adds to it. `ScrollScreen` has always measured it; the six
 * FlatList screens each hard-coded `layout.tabBarClearance` instead, which is
 * the fallback for screens that are not inside the tab navigator at all. On a
 * phone with a home indicator that constant is about 10pt short, so the last
 * card in every one of those lists sat under the bar, and none of them left
 * the `space.xl` of breathing room the scrolling screens do.
 *
 * Exported so a list cannot get this wrong by copying a number.
 */
export function useTabBarClearance(): number {
  const tabBarHeight = useContext(BottomTabBarHeightContext);
  return (tabBarHeight ?? layout.tabBarClearance) + space.xl;
}

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
          // See `Screen`: the column stops growing past a readable width.
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
            paddingBottom: bottomClearance,
          },
          contentStyle,
        ]}
        showsVerticalScrollIndicator={false}
        // Without this the first tap with a keyboard open only dismisses the
        // keyboard, so every button on a form screen needs pressing twice --
        // including the one that submits it.
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.textSecondary}
              colors={[colors.rose.base]}
              progressBackgroundColor={colors.surface}
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
 * submit button ends up under the keyboard on one platform only, which is the
 * kind of bug that survives review because the reviewer had the other phone.
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
