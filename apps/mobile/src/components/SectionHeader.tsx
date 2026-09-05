import { View, TouchableOpacity } from 'react-native';
import { AppText } from './AppText';
import { radius, typography, useTheme } from '../theme';

export interface SectionHeaderAction {
  label: string;
  onPress: () => void;
}

/**
 * Space around a section label. These were 24 above and 12 below, which on a
 * screen that also gaps its cards by 12-16 left a band of empty background
 * before every heading -- the reference sets 20/10 and reads much denser.
 */
const SECTION_GAP_TOP = 20;
const SECTION_GAP_BOTTOM = 10;

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
          marginTop: SECTION_GAP_TOP,
          marginBottom: SECTION_GAP_BOTTOM,
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
        marginTop: SECTION_GAP_TOP,
        marginBottom: SECTION_GAP_BOTTOM,
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
