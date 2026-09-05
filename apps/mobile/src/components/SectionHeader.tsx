import { View, TouchableOpacity } from 'react-native';
import { AppText } from './AppText';
import { spacing, typography, useTheme } from '../theme';

export interface SectionHeaderAction {
  label: string;
  onPress: () => void;
}

export interface SectionHeaderProps {
  children: string;
  action?: SectionHeaderAction;
}

export function SectionHeader({ children, action }: SectionHeaderProps) {
  const { colors } = useTheme();

  if (!action) {
    return (
      <AppText
        style={{
          ...typography.caption,
          color: colors.text,
          opacity: 0.55,
          marginTop: spacing.lg,
          marginBottom: 12,
        }}
      >
        {children.toUpperCase()}
      </AppText>
    );
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: spacing.lg,
        marginBottom: 12,
      }}
    >
      <AppText style={{ ...typography.caption, color: colors.text, opacity: 0.55 }}>
        {children.toUpperCase()}
      </AppText>
      <TouchableOpacity onPress={action.onPress} hitSlop={8}>
        <AppText style={{ fontSize: 13, fontWeight: '500', color: colors.primary }}>
          {action.label}
        </AppText>
      </TouchableOpacity>
    </View>
  );
}
