import { View, ActivityIndicator } from 'react-native';
import { spacing, useTheme } from '../theme';
import { AppText } from './AppText';

export interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
      <ActivityIndicator size="large" color={colors.secondary} />
      <AppText muted style={{ marginTop: spacing.md }}>
        {message}
      </AppText>
    </View>
  );
}
