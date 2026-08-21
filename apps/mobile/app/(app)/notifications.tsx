import { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { AppButton, AppText, Card, Screen, SectionHeader } from '../../src/components';
import { useNotificationPreferences, useUpdateNotificationPreferences } from '../../src/hooks/useNotifications';
import { colors, spacing } from '../../src/theme';

interface NotificationToggleProps {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

function NotificationToggle({ label, description, value, onValueChange }: NotificationToggleProps) {
  return (
    <View style={styles.toggleItem}>
      <View style={styles.toggleText}>
        <AppText variant="heading">{label}</AppText>
        <AppText muted style={styles.description}>{description}</AppText>
      </View>
      <AppButton
        variant={value ? 'primary' : 'secondary'}
        size="small"
        onPress={() => onValueChange(!value)}
      >
        {value ? 'ON' : 'OFF'}
      </AppButton>
    </View>
  );
}

export default function Notifications() {
  const { data, isLoading } = useNotificationPreferences();
  const updatePrefs = useUpdateNotificationPreferences();
  const prefs = data?.data;

  const [localPrefs, setLocalPrefs] = useState({
    emergencyRequests: prefs?.emergencyRequests ?? true,
    appointments: prefs?.appointments ?? true,
    donationReminders: prefs?.donationReminders ?? true,
    healthResults: prefs?.healthResults ?? false,
    system: prefs?.system ?? true,
    promotional: prefs?.promotional ?? false,
  });

  const updateField = (field: string, value: boolean) => {
    setLocalPrefs((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      await updatePrefs.mutateAsync(localPrefs);
      Alert.alert('Success', 'Notification preferences updated.');
    } catch (error) {
      Alert.alert('Error', 'Failed to update preferences.');
    }
  };

  const hasChanges = prefs && (
    localPrefs.emergencyRequests !== prefs.emergencyRequests ||
    localPrefs.appointments !== prefs.appointments ||
    localPrefs.donationReminders !== prefs.donationReminders ||
    localPrefs.healthResults !== prefs.healthResults ||
    localPrefs.system !== prefs.system ||
    localPrefs.promotional !== prefs.promotional
  );

  if (isLoading) {
    return (
      <Screen>
        <AppText>Loading...</AppText>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="title">Notifications</AppText>

        <SectionHeader>ALERTS</SectionHeader>
        <Card>
          <NotificationToggle
            label="Emergency blood requests"
            description="Be alerted when there is an urgent need for your blood type"
            value={localPrefs.emergencyRequests}
            onValueChange={(v) => updateField('emergencyRequests', v)}
          />
        </Card>

        <SectionHeader>APPOINTMENTS</SectionHeader>
        <Card>
          <NotificationToggle
            label="Appointment reminders"
            description="Get reminded about upcoming donation appointments"
            value={localPrefs.appointments}
            onValueChange={(v) => updateField('appointments', v)}
          />
          <NotificationToggle
            label="Donation reminders"
            description="Stay informed about your donation schedule"
            value={localPrefs.donationReminders}
            onValueChange={(v) => updateField('donationReminders', v)}
          />
        </Card>

        <SectionHeader>HEALTH</SectionHeader>
        <Card>
          <NotificationToggle
            label="Health results"
            description="Receive notifications about blood test results"
            value={localPrefs.healthResults}
            onValueChange={(v) => updateField('healthResults', v)}
          />
        </Card>

        <SectionHeader>SYSTEM</SectionHeader>
        <Card>
          <NotificationToggle
            label="System notifications"
            description="Important updates about your account and the platform"
            value={localPrefs.system}
            onValueChange={(v) => updateField('system', v)}
          />
          <NotificationToggle
            label="Promotional"
            description="News, tips, and promotional content"
            value={localPrefs.promotional}
            onValueChange={(v) => updateField('promotional', v)}
          />
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <AppButton
          onPress={handleSave}
          disabled={!hasChanges || updatePrefs.isPending}
        >
          {updatePrefs.isPending ? 'Saving...' : 'Save Preferences'}
        </AppButton>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing['2xl'],
  },
  toggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  toggleText: {
    flex: 1,
    marginRight: spacing.md,
  },
  description: {
    fontSize: 13,
    marginTop: 2,
  },
  footer: {
    marginTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
});