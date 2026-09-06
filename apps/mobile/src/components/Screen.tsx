import { PropsWithChildren, useContext } from 'react';
import { ScrollView, ScrollViewProps, View } from 'react-native';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing } from '../theme';

export interface ScreenProps extends ScrollViewProps {
  scroll?: boolean;
}

export function Screen({
  children,
  scroll = true,
  style,
  contentContainerStyle,
  ...props
}: PropsWithChildren<ScreenProps>) {
  // The tab bar floats over the content, so the last card would otherwise sit
  // underneath it with no way to scroll clear. Read from context rather than
  // `useBottomTabBarHeight()`, which throws on the screens that are not inside
  // the tab navigator at all (auth, booking, SOS).
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;

  // 16px, matching the reference's content gutter. This was 24px, which made
  // every card noticeably narrower than the reference's.
  const padding = spacing.md;

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[{ flexGrow: 1 }, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
          // Without this, the first tap with a keyboard open only dismisses
          // the keyboard -- so every button on a form screen needs pressing
          // twice, including the one that submits it.
          keyboardShouldPersistTaps="handled"
          {...props}
        >
          {/*
            `flexGrow`, never `flex`. `flex: 1` sets `flexBasis: 0`, which
            inside a scroll container resolves the child's height against the
            *viewport* -- so content longer than one screen was clamped to one
            screen and everything past it became unreachable: scrolling simply
            stopped, with the last card cut in half. `flexGrow: 1` still fills
            the viewport when the content is short, and lets it grow past when
            it is not.
          */}
          <View
            style={[
              { flexGrow: 1, padding, paddingBottom: padding + tabBarHeight },
              style,
            ]}
          >
            {children}
          </View>
        </ScrollView>
      ) : (
        // A non-scrolling screen keeps its own list or scroller inside, so it
        // does fill the frame -- and the clearance goes to the frame, since
        // the inner scroller needs to know where the bar starts.
        <View style={[{ flex: 1, padding, paddingBottom: padding + tabBarHeight }, style]}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

