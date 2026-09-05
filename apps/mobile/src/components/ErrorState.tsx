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
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
        paddingHorizontal: spacing.xl,
        gap: 12,
      }}
    >
      {/* A rounded square rather than a circle, and rose-tinted rather than
          neutral: an error must not be mistaken for an empty state. */}
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          backgroundColor: 'rgba(216,83,96,0.12)',
          borderWidth: 1,
          borderColor: 'rgba(216,83,96,0.25)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={24} color={colors.danger} />
      </View>
      <AppText style={{ fontSize: 15, fontWeight: '600', textAlign: 'center' }}>{title}</AppText>
      <AppText muted style={{ fontSize: 14, lineHeight: 22, textAlign: 'center', maxWidth: 260 }}>
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
