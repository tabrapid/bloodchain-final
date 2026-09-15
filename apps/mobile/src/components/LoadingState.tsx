import { View, ActivityIndicator } from 'react-native';
import { spacing, useTheme } from '../theme';
import { AppText } from './AppText';
import { useTranslation } from '../i18n';

export interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message }: LoadingStateProps) {
  // Defaulted in the body, not the parameter list: a default read at module
  // evaluation is fixed in one language for the life of the process.
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
      <ActivityIndicator size="large" color={colors.secondary} />
      <AppText muted style={{ marginTop: spacing.md }}>
        {message ?? t('common.loading')}
      </AppText>
    </View>
  );
}
