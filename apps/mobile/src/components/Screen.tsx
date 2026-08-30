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
  const content = <View style={[{ flex: 1, padding: spacing.lg }, style]}>{children}</View>;

  return (
    <LinearGradient colors={colors.backgroundGradient} style={{ flex: 1 }}>
      {/*
        Soft color blooms behind the content. Glass panels blur whatever sits
        behind them, so a flat single-color background blurs to that exact same
        flat color -- the effect only becomes visible when there is color
        variation to smear. These orbs are that variation.
        pointerEvents="none" keeps them out of the touch path entirely.
      */}
      <View style={{ ...StyleSheetAbsoluteFill }} pointerEvents="none">
        {colors.ambientOrbs.map((orb, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              top: orb.top,
              left: orb.left,
              width: orb.size,
              height: orb.size,
              borderRadius: orb.size / 2,
              backgroundColor: orb.color,
            }}
          />
        ))}
      </View>

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

const StyleSheetAbsoluteFill = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  overflow: 'hidden' as const,
};
