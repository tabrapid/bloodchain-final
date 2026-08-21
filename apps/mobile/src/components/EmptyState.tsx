import { View } from 'react-native';
import { Inbox, LucideIcon } from 'lucide-react-native';
import { colors, spacing } from '../theme';
import { AppText } from './AppText';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
}

export function EmptyState({
  title = 'Nothing here yet',
  description = 'When data is available, it will appear here.',
  icon: Icon = Inbox,
}: EmptyStateProps) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.surfaceElevated,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.md,
        }}
      >
        <Icon size={28} color={colors.textMuted} />
      </View>
      <AppText style={{ textAlign: 'center' }}>{title}</AppText>
      <AppText muted style={{ textAlign: 'center', marginTop: spacing.xs }}>
        {description}
      </AppText>
    </View>
  );
}
