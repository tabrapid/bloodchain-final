import { PropsWithChildren } from 'react';
import { View, ViewProps } from 'react-native';
import { colors } from '../theme';

export function AppView({ children, style, ...props }: PropsWithChildren<ViewProps>) {
  return (
    <View style={[{ backgroundColor: colors.background }, style]} {...props}>
      {children}
    </View>
  );
}
