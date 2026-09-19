import { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Switch, Alert } from 'react-native';
import {
  AppText,
  GlassCard,
  LoadingState,
  Screen,
  ScreenHeader,
  SectionHeader,
} from '../../src/components';
import { spacing, useTheme, ThemeColors } from '../../src/theme';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '../../src/hooks/useNotifications';
import type { NotificationPreferences } from '../../src/api/notifications';
import { useTranslation } from '../../src/i18n';

/**
 * The switches a donor was shown once and could never reach again.
 *
 * Onboarding asks about four notification categories and writes them with
 * `PATCH /notifications/preferences`; nothing in the app ever read them back or
 * offered to change them. Someone who declined emergency alerts on the day they
 * signed up had no way to change their mind, and the delivery service honours
 * these settings -- so the app was quietly silent for them with no visible
 * cause.
 *
 * Only the categories this donor can actually receive are listed. Shipment and
 * inventory notifications exist in the same preference row but are routed to
 * staff, so a donor toggle for them would control nothing.
 */
type DonorCategory = keyof Pick<
  NotificationPreferences,
  'emergencyRequests' | 'appointments' | 'donationReminders' | 'healthResults' | 'gamification' | 'system'
>;

const CATEGORIES: Array<{ key: DonorCategory; labelKey: string; hintKey: string }> = [
  {
    key: 'emergencyRequests',
    labelKey: 'notificationSettings.emergency',
    hintKey: 'notificationSettings.emergencyHint',
  },
  {
    key: 'appointments',
    labelKey: 'notificationSettings.appointments',
    hintKey: 'notificationSettings.appointmentsHint',
  },
  {
    key: 'donationReminders',
    labelKey: 'notificationSettings.reminders',
    hintKey: 'notificationSettings.remindersHint',
  },
  {
    key: 'healthResults',
    labelKey: 'notificationSettings.results',
    hintKey: 'notificationSettings.resultsHint',
  },
  {
    key: 'gamification',
    labelKey: 'notificationSettings.gamification',
    hintKey: 'notificationSettings.gamificationHint',
  },
  {
    key: 'system',
    labelKey: 'notificationSettings.system',
    hintKey: 'notificationSettings.systemHint',
  },
];

export default function NotificationSettings() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { data: preferences, isLoading, isError } = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();

  // The switch follows the finger immediately and falls back to the server's
  // answer if the write fails, rather than freezing until the round trip.
  const [pending, setPending] = useState<Partial<Record<DonorCategory, boolean>>>({});

  const valueOf = (key: DonorCategory): boolean =>
    pending[key] ?? (preferences ? Boolean(preferences[key]) : false);

  const toggle = (key: DonorCategory, value: boolean) => {
    setPending((current) => ({ ...current, [key]: value }));
    updatePreferences.mutate(
      { [key]: value },
      {
        onError: () => {
          setPending((current) => {
            const next = { ...current };
            delete next[key];
            return next;
          });
          Alert.alert(t('common.error'), t('notificationSettings.updateFailed'));
        },
        onSuccess: () => {
          setPending((current) => {
            const next = { ...current };
            delete next[key];
            return next;
          });
        },
      },
    );
  };

  return (
    <Screen scroll={false}>
      <ScreenHeader
        title={t('notificationSettings.title')}
        subtitle={t('notificationSettings.subtitle')}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <LoadingState />
        ) : isError || !preferences ? (
          <GlassCard>
            <AppText style={styles.error}>{t('notificationSettings.loadFailed')}</AppText>
          </GlassCard>
        ) : (
          <>
            <SectionHeader>{t('notificationSettings.whatYouReceive')}</SectionHeader>
            <GlassCard>
              {CATEGORIES.map((category, index) => (
                <View key={category.key}>
                  {index > 0 && <View style={styles.divider} />}
                  <View style={styles.toggleRow}>
                    <View style={styles.toggleText}>
                      <AppText style={styles.toggleLabel}>{t(category.labelKey)}</AppText>
                      <AppText style={styles.toggleDesc}>{t(category.hintKey)}</AppText>
                    </View>
                    <Switch
                      value={valueOf(category.key)}
                      onValueChange={(value) => toggle(category.key, value)}
                      disabled={updatePreferences.isPending}
                      trackColor={{ false: colors.surfaceElevated, true: colors.primary }}
                      thumbColor={colors.white}
                    />
                  </View>
                </View>
              ))}
            </GlassCard>

            {/* Said out loud because it is a real exception in the delivery
                service, not a reassurance: an emergency override reaches the
                donor during quiet hours. */}
            <AppText style={styles.note}>{t('notificationSettings.emergencyNote')}</AppText>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      paddingBottom: spacing.xl,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    toggleText: {
      flex: 1,
    },
    toggleLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    toggleDesc: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
    },
    error: {
      fontSize: 13,
      color: colors.onMuted.danger,
    },
    note: {
      fontSize: 12,
      lineHeight: 17,
      color: colors.textMuted,
      marginTop: spacing.lg,
    },
  });
}
