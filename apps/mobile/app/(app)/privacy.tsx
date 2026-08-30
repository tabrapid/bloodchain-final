import { useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { AppText, Card, Screen, SectionHeader, ListItem, Divider } from '../../src/components';
import { spacing, useTheme, ThemeColors } from '../../src/theme';

export default function Privacy() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="title">Privacy</AppText>

        <SectionHeader>DATA SHARING</SectionHeader>
        <Card>
          <ListItem
            title="Emergency requests"
            subtitle="Allow hospitals to see your blood type in emergencies"
          />
          <Divider />
          <ListItem
            title="Location sharing"
            subtitle="Share your approximate location for nearby centers"
          />
          <Divider />
          <ListItem
            title="Hospital contact"
            subtitle="Allow hospitals to contact you for donations"
          />
          <Divider />
          <ListItem
            title="Blood center contact"
            subtitle="Allow blood centers to send you updates"
          />
        </Card>

        <SectionHeader>YOUR DATA</SectionHeader>
        <Card>
          <ListItem
            title="Download your data"
            subtitle="Request a copy of all your data"
          />
          <Divider />
          <ListItem
            title="Delete account"
            subtitle="Permanently delete your account and data"
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
      borderRadius: 12,
    },
    disclaimerText: {
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
}