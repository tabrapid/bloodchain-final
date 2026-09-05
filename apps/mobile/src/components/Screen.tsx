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
  const content = <View style={[{ flex: 1, padding: spacing.md }, style]}>{children}</View>;

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            { flexGrow: 1, paddingBottom: tabBarHeight },
            contentContainerStyle,
          ]}
          showsVerticalScrollIndicator={false}
          {...props}
        >
          {content}
        </ScrollView>
      ) : (
        // A non-scrolling screen keeps its own list/scroller inside, so the
        // clearance goes on the frame instead of a content container.
        <View style={{ flex: 1, paddingBottom: tabBarHeight }}>{content}</View>
      )}
    </SafeAreaView>
  );
}

