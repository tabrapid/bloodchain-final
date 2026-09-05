import { ReactNode } from 'react';
import { View } from 'react-native';
import { spacing, typography, useTheme } from '../theme';
import { AppText } from './AppText';

export interface AppHeaderProps {
  title: string;
  subtitle?: string;
  /** Right-aligned slot — notification bell, avatar, a small action button. */
  trailing?: ReactNode;
}

/** The header for a tab-root screen: large title, optional subtitle, trailing slot. */
export function AppHeader({ title, subtitle, trailing }: AppHeaderProps) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingTop: 8,
        paddingBottom: spacing.lg,
      }}
    >
      <View style={{ flex: 1 }}>
        <AppText style={{ ...typography.title, color: colors.text }}>{title}</AppText>
        {subtitle && (
          <AppText style={{ fontSize: 13, color: colors.textMuted, marginTop: 3 }}>
            {subtitle}
          </AppText>
        )}
      </View>
      {trailing && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: 4 }}>
          {trailing}
        </View>
      )}
    </View>
  );
}
