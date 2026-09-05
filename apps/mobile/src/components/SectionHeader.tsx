import { View, TouchableOpacity } from 'react-native';
import { AppText } from './AppText';
import { layout, radius, typography, useTheme } from '../theme';

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
          marginTop: layout.sectionGapTop,
          marginBottom: layout.sectionGapBottom,
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
        marginTop: layout.sectionGapTop,
        marginBottom: layout.sectionGapBottom,
      }}
    >
      <AppText style={{ ...typography.caption, color: colors.text, opacity: 0.55 }}>
        {children.toUpperCase()}
      </AppText>
      {/* A chip, not bare colored text. "View all" set in the accent with no
          edge is a web link: on a touch surface it gives no target to aim at
          and no affordance that it is pressable at all. */}
      <TouchableOpacity
        onPress={action.onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        hitSlop={6}
        style={{
          minHeight: 28,
          justifyContent: 'center',
          paddingHorizontal: 12,
          borderRadius: radius.pill,
          backgroundColor: colors.primaryMuted,
          borderWidth: 1,
          borderColor: `${colors.onMuted.primary}33`,
        }}
      >
        <AppText style={{ fontSize: 12, fontWeight: '600', color: colors.onMuted.primary }}>
          {action.label}
        </AppText>
      </TouchableOpacity>
    </View>
  );
}
