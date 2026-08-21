import { PropsWithChildren } from 'react';
import { ScrollView, ScrollViewProps, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

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
  const content = (
    <View style={[{ flex: 1, backgroundColor: colors.background, padding: spacing.lg }, style]}>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[{ flexGrow: 1 }, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
          {...props}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}
