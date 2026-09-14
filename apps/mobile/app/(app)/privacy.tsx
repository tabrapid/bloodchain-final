import { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Switch, Alert } from 'react-native';
import {
  AppText,
  GlassCard,
  Screen,
  ScreenHeader,
  SectionHeader,
  ListItem,
  Divider,
} from '../../src/components';
import { spacing, useTheme, ThemeColors } from '../../src/theme';
import { useDonorProfile, useUpdateDonorProfile } from '../../src/hooks/useDonors';
import { useTranslation } from '../../src/i18n';

/**
 * When the policy text this screen points at was last revised. A date, not a
 * spelled-out month, so the label reads in the reader's language.
 */
const LAST_UPDATED = new Date(2026, 8, 1);

export default function Privacy() {
  const { t, formatMonth } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data: donorProfile } = useDonorProfile();
  const updateDonorProfile = useUpdateDonorProfile();
  const [pendingConsent, setPendingConsent] = useState<boolean | null>(null);

  const consentLocation = pendingConsent ?? donorProfile?.consentLocation ?? false;

  const handleToggleLocation = (value: boolean) => {
    setPendingConsent(value);
    updateDonorProfile.mutate(
      { consentLocation: value },
      {
        onError: () => {
          setPendingConsent(null);
          Alert.alert(t('common.error'), t('privacy.consentUpdateFailed'));
        },
        onSuccess: () => setPendingConsent(null),
      },
    );
  };

  return (
    <Screen scroll={false}>
      <ScreenHeader title={t('privacy.title')} subtitle={t('privacy.subtitle')} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* The reference shows five toggles. Four of them (public profile,
            donation history visibility, leaderboard opt-out, anonymized
            analytics) have no field behind them anywhere in this system, and
            a privacy switch that silently does nothing is worse than one
            that is absent. Only the consent this app actually stores and
            honours is offered. */}
        <SectionHeader>{t('privacy.locationAndData')}</SectionHeader>
        <GlassCard>
          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <AppText style={styles.toggleLabel}>{t('privacy.shareLocation')}</AppText>
              <AppText style={styles.toggleDesc}>
                {t('privacy.shareLocationHint')}
              </AppText>
            </View>
            <Switch
              value={consentLocation}
              onValueChange={handleToggleLocation}
              disabled={updateDonorProfile.isPending}
              trackColor={{ false: colors.surfaceElevated, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>
        </GlassCard>

        <SectionHeader>{t('privacy.yourData')}</SectionHeader>
        <GlassCard>
          <ListItem
            title={t('privacy.downloadData')}
            subtitle={t('privacy.downloadDataHint')}
          />
          <Divider />
          <ListItem
            title={t('privacy.deleteAccount')}
            subtitle={t('privacy.deleteAccountHint')}
            destructive
          />
        </GlassCard>

        <SectionHeader>{t('privacy.policies')}</SectionHeader>
        <GlassCard>
          <ListItem title={t('privacy.privacyPolicy')} subtitle={t('privacy.notPublished')} />
          <Divider />
          <ListItem title={t('privacy.termsOfService')} subtitle={t('privacy.notPublished')} />
          <Divider />
          <ListItem
            title={t('privacy.medicalDisclaimer')}
            subtitle={t('privacy.medicalDisclaimerHint')}
          />
        </GlassCard>

        <SectionHeader>{t('privacy.about')}</SectionHeader>
        <GlassCard style={styles.compactCard}>
          <View style={styles.aboutRow}>
            <AppText style={styles.aboutLabel}>{t('privacy.version')}</AppText>
            <AppText style={styles.aboutValue}>1.0.0</AppText>
          </View>
          <Divider />
          <View style={styles.aboutRow}>
            <AppText style={styles.aboutLabel}>{t('privacy.lastUpdated')}</AppText>
            <AppText style={styles.aboutValue}>{formatMonth(LAST_UPDATED)}</AppText>
          </View>
        </GlassCard>

        <AppText style={styles.disclaimer}>{t('privacy.disclaimer')}</AppText>
      </ScrollView>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      paddingBottom: spacing['2xl'],
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    toggleText: {
      flex: 1,
    },
    toggleLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
    toggleDesc: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    compactCard: {
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    aboutRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.sm,
    },
    aboutLabel: {
      fontSize: 13,
      color: colors.textMuted,
    },
    aboutValue: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.text,
    },
    disclaimer: {
      fontSize: 11,
      lineHeight: 17,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: spacing.lg,
      paddingHorizontal: spacing.md,
    },
  });
}
