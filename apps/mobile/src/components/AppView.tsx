import { PropsWithChildren } from 'react';
import { View, ViewProps } from 'react-native';
import { useTheme } from '../theme';

export function AppView({ children, style, ...props }: PropsWithChildren<ViewProps>) {
  const { colors } = useTheme();
  return (
    <View style={[{ backgroundColor: colors.background }, style]} {...props}>
      {children}
    </View>
  );
}
