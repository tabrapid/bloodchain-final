import { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Calendar, Clock, Building2, Droplet, AlertCircle } from 'lucide-react-native';
import { AppButton, AppText, Card, GlassCard, Screen } from '../../src/components';
import { useAvailability, useBookAppointment, useOrganizations } from '../../src/hooks/useAppointments';
import { colors, spacing } from '../../src/theme';

export default function ReviewBooking() {
  const params = useLocalSearchParams<{
    slotId: string;
    organizationId: string;
    type: string;
    date: string;
  }>();

  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: slotsData } = useAvailability({ date: params.date });
  const slot = slotsData?.data.find((s) => s.id === params.slotId);

  const { data: orgsData } = useOrganizations();
  const organization = orgsData?.data.find((o) => o.id === params.organizationId);

  const bookMutation = useBookAppointment();

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'BLOOD_DONATION':
        return 'Blood Donation';
      case 'BLOOD_TEST':
        return 'Blood Test';
      case 'CONSULTATION':
        return 'Consultation';
      default:
        return type;
    }
  };

  const handleConfirm = async () => {
    setError(null);
    try {
      const result = await bookMutation.mutateAsync({
        slotId: params.slotId,
        appointmentType: params.type,
        notes: notes.trim() || undefined,
      });
      router.replace({
        pathname: '/(booking)/confirmation',
        params: { appointmentId: result.data.id },
      });
    } catch (err: any) {
      setError(err.message || 'Failed to book appointment. Please try again.');
    }
  };

  if (!slot || !organization) {
    return (
      <Screen>
        <AppText>Loading...</AppText>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="title" style={styles.title}>
          Review Booking
        </AppText>
        <AppText muted style={styles.subtitle}>
          Please review your appointment details before confirming.
        </AppText>

        <GlassCard style={styles.summaryCard}>
          <AppText variant="heading" style={styles.sectionTitle}>
            Appointment Details
          </AppText>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Droplet size={20} color={colors.primary} />
            </View>
            <View style={styles.detailInfo}>
              <AppText muted style={styles.detailLabel}>
                Type
              </AppText>
              <AppText>{getTypeLabel(params.type)}</AppText>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Building2 size={20} color={colors.primary} />
            </View>
            <View style={styles.detailInfo}>
              <AppText muted style={styles.detailLabel}>
                Location
              </AppText>
              <AppText>{organization.name}</AppText>
              {organization.address && (
                <AppText muted style={styles.addressText}>
                  {organization.address}
                </AppText>
              )}
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Calendar size={20} color={colors.primary} />
            </View>
            <View style={styles.detailInfo}>
              <AppText muted style={styles.detailLabel}>
                Date
              </AppText>
              <AppText>{formatDate(params.date)}</AppText>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Clock size={20} color={colors.primary} />
            </View>
            <View style={styles.detailInfo}>
              <AppText muted style={styles.detailLabel}>
                Time
              </AppText>
              <AppText>
                {formatTime(slot.startAt)} - {formatTime(slot.endAt)}
              </AppText>
            </View>
          </View>
        </GlassCard>

        <Card style={styles.notesCard}>
          <AppText variant="heading" style={styles.sectionTitle}>
            Notes (Optional)
          </AppText>
          <View style={styles.notesInput}>
            <AppText muted style={{ fontSize: 14 }}>
              Add any notes or special requirements for your appointment...
            </AppText>
          </View>
        </Card>

        {error && (
          <Card style={styles.errorCard}>
            <AlertCircle size={20} color={colors.danger} />
            <AppText style={styles.errorText}>{error}</AppText>
          </Card>
        )}

        <Card style={styles.infoCard}>
          <AppText muted style={styles.infoText}>
            By confirming this booking, you agree to arrive on time for your appointment.
            Cancellations must be made at least 24 hours in advance.
          </AppText>
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <AppButton
          onPress={handleConfirm}
          loading={bookMutation.isPending}
          disabled={bookMutation.isPending}
        >
          Confirm Booking
        </AppButton>
        <AppButton
          variant="secondary"
          onPress={() => router.back()}
          style={styles.backButton}
          disabled={bookMutation.isPending}
        >
          Back
        </AppButton>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xl,
  },
  title: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    marginBottom: spacing.xl,
  },
  summaryCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    marginBottom: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  detailInfo: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  addressText: {
    fontSize: 13,
    marginTop: 2,
  },
  notesCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  notesInput: {
    padding: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.danger + '15',
    marginBottom: spacing.lg,
  },
  errorText: {
    color: colors.danger,
    flex: 1,
  },
  infoCard: {
    padding: spacing.md,
    backgroundColor: colors.surfaceElevated,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    paddingTop: spacing.lg,
  },
  backButton: {
    marginTop: spacing.md,
  },
});