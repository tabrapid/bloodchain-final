import { Pressable, View } from 'react-native';
import { colors, spacing } from '../theme';
import { AppText } from './AppText';
import { ChevronRight, LucideIcon } from 'lucide-react-native';

export interface ListItemProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  onPress?: () => void;
  destructive?: boolean;
}

export function ListItem({
  title,
  subtitle,
  icon: Icon,
  onPress,
  destructive = false,
}: ListItemProps) {
  const content = (
    <>
      {Icon && (
        <Icon
          size={20}
          color={destructive ? colors.danger : colors.textMuted}
          style={{ marginRight: spacing.md }}
        />
      )}
      <View style={{ flex: 1 }}>
        <AppText style={{ color: destructive ? colors.danger : colors.text }}>{title}</AppText>
        {subtitle && (
          <AppText muted style={{ marginTop: spacing.xs }}>
            {subtitle}
          </AppText>
        )}
      </View>
      {onPress && <ChevronRight size={18} color={colors.textMuted} />}
    </>
  );

  // A row with no onPress isn't tappable -- rendering it as a Pressable with
  // a chevron (as this component used to, unconditionally) implies it leads
  // somewhere when it doesn't. Plain rows render as an inert View instead.
  if (!onPress) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md }}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {content}
    </Pressable>
  );
}
