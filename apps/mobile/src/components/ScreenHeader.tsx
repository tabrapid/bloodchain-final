import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { spacing, useTheme, ThemeColors } from '../theme';
import { AppText } from './AppText';
import { IconButton } from './IconButton';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}

/**
 * Every screen in this app renders `headerShown: false` at the navigator
 * level (Tabs and root Stack both set it), so a bare `<Stack.Screen
 * options={{ headerLeft: ... }}>` never actually renders -- there is no
 * native header to attach it to. This is the in-content replacement: a
 * back button paired with the screen's title, used by every pushed screen
 * that isn't a bottom-tab root.
 */
export function ScreenHeader({ title, subtitle, onBack }: ScreenHeaderProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <IconButton
        icon={ArrowLeft}
        onPress={onBack ?? (() => router.back())}
        style={styles.backButton}
      />
      <View style={styles.titleContainer}>
        <AppText variant="title">{title}</AppText>
        {subtitle && (
          <AppText muted variant="bodySmall" style={styles.subtitle}>
            {subtitle}
          </AppText>
        )}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    backButton: {
      marginTop: 2,
    },
    titleContainer: {
      flex: 1,
    },
    subtitle: {
      marginTop: spacing.xs,
    },
  });
}
