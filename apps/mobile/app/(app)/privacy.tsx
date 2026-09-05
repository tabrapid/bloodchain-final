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

export default function Privacy() {
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
          Alert.alert(
            'Error',
            'Could not update your location sharing preference. Please try again.',
          );
        },
        onSuccess: () => setPendingConsent(null),
      },
    );
  };

  return (
    <Screen scroll={false}>
      <ScreenHeader title="Privacy" subtitle="Control what you share" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* The reference shows five toggles. Four of them (public profile,
            donation history visibility, leaderboard opt-out, anonymized
            analytics) have no field behind them anywhere in this system, and
            a privacy switch that silently does nothing is worse than one
            that is absent. Only the consent this app actually stores and
            honours is offered. */}
        <SectionHeader>Location &amp; data</SectionHeader>
        <GlassCard>
          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <AppText style={styles.toggleLabel}>Share location</AppText>
              <AppText style={styles.toggleDesc}>
                Lets nearby emergency requests reach you during an SOS
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

        <SectionHeader>Your data</SectionHeader>
        <GlassCard>
          <ListItem
            title="Download your data"
            subtitle="Contact support to request a copy of your data"
          />
          <Divider />
          <ListItem
            title="Delete account"
            subtitle="Contact support to permanently delete your account"
            destructive
          />
        </GlassCard>

        <SectionHeader>Policies</SectionHeader>
        <GlassCard>
          <ListItem title="Privacy Policy" subtitle="Not yet published" />
          <Divider />
          <ListItem title="Terms of Service" subtitle="Not yet published" />
          <Divider />
          <ListItem
            title="Medical Disclaimer"
            subtitle="Important information about medical content"
          />
        </GlassCard>

        <SectionHeader>About</SectionHeader>
        <GlassCard style={styles.compactCard}>
          <View style={styles.aboutRow}>
            <AppText style={styles.aboutLabel}>Version</AppText>
            <AppText style={styles.aboutValue}>1.0.0</AppText>
          </View>
          <Divider />
          <View style={styles.aboutRow}>
            <AppText style={styles.aboutLabel}>Last updated</AppText>
            <AppText style={styles.aboutValue}>September 2026</AppText>
          </View>
        </GlassCard>

        <AppText style={styles.disclaimer}>
          This application handles health-related information. What it shows is not a substitute
          for professional medical advice, diagnosis, or treatment.
        </AppText>
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
