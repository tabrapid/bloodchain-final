import { PropsWithChildren } from 'react';
import { ScrollView, ScrollViewProps, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { spacing, useTheme } from '../theme';

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
  const { colors } = useTheme();
  const content = (
    <View style={[{ flex: 1, padding: spacing.lg }, style]}>{children}</View>
  );

  return (
    <LinearGradient
      colors={colors.backgroundGradient}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
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
    </LinearGradient>
  );
}
