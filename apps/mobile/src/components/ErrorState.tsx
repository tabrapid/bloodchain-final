import { View } from 'react-native';
import { AlertTriangle, LucideIcon } from 'lucide-react-native';
import { spacing, useTheme } from '../theme';
import { AppText } from './AppText';
import { AppButton } from './AppButton';

export interface ErrorStateProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'We could not load the requested information. Please try again.',
  icon: Icon = AlertTriangle,
  onRetry,
}: ErrorStateProps) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.dangerMuted,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.md,
        }}
      >
        <Icon size={28} color={colors.onMuted.danger} />
      </View>
      <AppText style={{ textAlign: 'center' }}>{title}</AppText>
      <AppText
        muted
        style={{ textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.md }}
      >
        {description}
      </AppText>
      {onRetry && (
        <AppButton onPress={onRetry} variant="secondary">
          Retry
        </AppButton>
      )}
    </View>
  );
}
