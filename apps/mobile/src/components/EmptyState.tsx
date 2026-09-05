import { View } from 'react-native';
import { Inbox, LucideIcon } from 'lucide-react-native';
import { spacing, useTheme } from '../theme';
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
  const { colors } = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
        paddingHorizontal: spacing.xl,
        gap: 12,
      }}
    >
      {/* A rounded square held back to 60% opacity: present enough to anchor
          the message, quiet enough that an empty screen stays calm. */}
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          backgroundColor: colors.glass.standard.fill,
          borderWidth: 1,
          borderColor: colors.glass.standard.border,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.6,
          marginBottom: spacing.xs,
        }}
      >
        <Icon size={28} color={colors.textMuted} />
      </View>
      <AppText style={{ fontSize: 16, fontWeight: '600', textAlign: 'center' }}>{title}</AppText>
      <AppText
        muted
        style={{ fontSize: 14, lineHeight: 22, textAlign: 'center', maxWidth: 260 }}
      >
        {description}
      </AppText>
    </View>
  );
}
