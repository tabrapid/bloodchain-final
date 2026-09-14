import { useMemo, type ReactNode } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { spacing, useTheme, ThemeColors } from '../theme';
import { AppText } from './AppText';
import { useTranslation } from '../i18n';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  /**
   * A screen-level action rendered beside the title, as the reference draws
   * "Mark all read" on Notifications -- baseline-aligned with the title
   * rather than stacked above the list.
   */
  trailing?: ReactNode;
}

/**
 * Every screen in this app renders `headerShown: false` at the navigator
 * level (Tabs and root Stack both set it), so a bare `<Stack.Screen
 * options={{ headerLeft: ... }}>` never actually renders -- there is no
 * native header to attach it to. This is the in-content replacement, used by
 * every pushed screen that isn't a bottom-tab root.
 *
 * The back affordance is a labelled link above the title rather than an icon
 * button beside it: it reads unambiguously, gives the 44pt touch target real
 * width instead of relying on invisible hit-slop, and leaves the title the
 * full width of the screen.
 */
export function ScreenHeader({ title, subtitle, onBack, trailing }: ScreenHeaderProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Pressable
        onPress={onBack ?? (() => router.back())}
        accessibilityRole="button"
        accessibilityLabel={t('common.a11yGoBack')}
        style={({ pressed }) => [styles.backLink, { opacity: pressed ? 0.6 : 1 }]}
      >
        <ArrowLeft size={16} color={colors.primary} strokeWidth={2.5} />
        <AppText style={styles.backLabel}>{t('common.back')}</AppText>
      </Pressable>

      <View style={styles.titleRow}>
        <View style={styles.titleBlock}>
          <AppText style={styles.title}>{title}</AppText>
          {subtitle && <AppText style={styles.subtitle}>{subtitle}</AppText>}
        </View>
        {trailing}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      marginBottom: spacing.lg,
    },
    backLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 44,
      alignSelf: 'flex-start',
      paddingRight: spacing.sm,
    },
    backLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    titleBlock: {
      flex: 1,
    },
    title: {
      fontSize: 27,
      fontWeight: '700',
      letterSpacing: -0.8,
      color: colors.text,
      marginTop: spacing.sm,
    },
    subtitle: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 2,
    },
  });
}
