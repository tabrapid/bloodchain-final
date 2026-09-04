import { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Switch, Alert } from 'react-native';
import { AppText, Card, Screen, ScreenHeader, SectionHeader, ListItem, Divider } from '../../src/components';
import { spacing, radius, useTheme, ThemeColors } from '../../src/theme';
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
          Alert.alert('Error', 'Could not update your location sharing preference. Please try again.');
        },
        onSuccess: () => setPendingConsent(null),
      },
    );
  };

  return (
    <Screen scroll={false}>
      <ScreenHeader title="Privacy" />
      <ScrollView contentContainerStyle={styles.content}>

        <SectionHeader>DATA SHARING</SectionHeader>
        <Card>
          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <AppText style={{ fontSize: 14, fontWeight: '500' }}>Location sharing</AppText>
              <AppText muted style={{ fontSize: 12, marginTop: 1 }}>
                Share your location so nearby emergency requests can find you
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
        </Card>

        <SectionHeader>YOUR DATA</SectionHeader>
        <Card>
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
        </Card>

        <SectionHeader>POLICIES</SectionHeader>
        <Card>
          <ListItem
            title="Privacy Policy"
            subtitle="Not yet published"
          />
          <Divider />
          <ListItem
            title="Terms of Service"
            subtitle="Not yet published"
          />
          <Divider />
          <ListItem
            title="Medical Disclaimer"
            subtitle="Important information about medical content"
          />
        </Card>

        <SectionHeader>ABOUT</SectionHeader>
        <Card>
          <View style={styles.aboutItem}>
            <AppText muted>Version</AppText>
            <AppText>1.0.0</AppText>
          </View>
          <Divider />
          <View style={styles.aboutItem}>
            <AppText muted>Last updated</AppText>
            <AppText>August 2026</AppText>
          </View>
        </Card>

        <View style={styles.disclaimer}>
          <AppText muted style={styles.disclaimerText}>
            This application handles health-related information. The information provided
            is not a substitute for professional medical advice, diagnosis, or treatment.
          </AppText>
        </View>
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
      gap: spacing.md,
    },
    toggleText: {
      flex: 1,
    },
    aboutItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.sm,
    },
    disclaimer: {
      marginTop: spacing.xl,
      padding: spacing.lg,
      backgroundColor: colors.surfaceSolid,
      borderRadius: radius.sm,
    },
    disclaimerText: {
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
}