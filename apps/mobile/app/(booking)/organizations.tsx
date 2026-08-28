import { useLocalSearchParams, router } from 'expo-router';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MapPin, Building2 } from 'lucide-react-native';
import { AppButton, AppText, Card, EmptyState, GlassCard, Screen } from '../../src/components';
import { useOrganizations } from '../../src/hooks/useAppointments';
import { colors, spacing, radius } from '../../src/theme';

export default function SelectOrganization() {
  const params = useLocalSearchParams<{ type: string }>();
  const {
    data: organizations = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useOrganizations(params.type ? { type: params.type } : undefined);

  const handleSelect = (organizationId: string) => {
    router.push({
      pathname: '/(booking)/date',
      params: {
        organizationId,
        type: params.type,
      },
    });
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="title" style={styles.title}>
          Select Organization
        </AppText>
        <AppText muted style={styles.subtitle}>
          Choose a {params.type === 'BLOOD_DONATION' ? 'hospital or blood center' : 'healthcare facility'} for your appointment.
        </AppText>

        {isLoading ? (
          <AppText muted>Loading organizations...</AppText>
        ) : isError ? (
          <Card style={styles.emptyCard}>
            <EmptyState
              title="Couldn't load organizations"
              description="Something went wrong reaching the server. Check your connection and try again."
            />
            <AppButton
              variant="secondary"
              onPress={() => refetch()}
              disabled={isRefetching}
              style={styles.retryButton}
            >
              {isRefetching ? 'Retrying...' : 'Retry'}
            </AppButton>
          </Card>
        ) : organizations.length === 0 ? (
          <Card style={styles.emptyCard}>
            <EmptyState
              title="No organizations found"
              description="There are no active organizations available for this appointment type."
            />
          </Card>
        ) : (
          <View style={styles.organizationsList}>
            {organizations.map((org) => (
              <TouchableOpacity
                key={org.id}
                onPress={() => handleSelect(org.id)}
                activeOpacity={0.8}
              >
                <GlassCard style={styles.orgCard}>
                  <View
                    style={[
                      styles.iconContainer,
                      {
                        backgroundColor:
                          org.type === 'HOSPITAL'
                            ? colors.primary + '20'
                            : colors.secondary + '20',
                      },
                    ]}
                  >
                    <Building2
                      size={24}
                      color={org.type === 'HOSPITAL' ? colors.primary : colors.secondary}
                    />
                  </View>
                  <View style={styles.orgInfo}>
                    <AppText variant="heading">{org.name}</AppText>
                    {org.address && (
                      <View style={styles.addressRow}>
                        <MapPin size={14} color={colors.textMuted} />
                        <AppText muted style={styles.address}>
                          {org.address}
                        </AppText>
                      </View>
                    )}
                  </View>
                </GlassCard>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <AppButton variant="secondary" onPress={() => router.back()}>
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
  emptyCard: {
    paddingVertical: spacing.xl,
  },
  retryButton: {
    marginTop: spacing.md,
    alignSelf: 'center',
  },
  organizationsList: {
    gap: spacing.md,
  },
  orgCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  orgInfo: {
    flex: 1,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  address: {
    fontSize: 13,
    flex: 1,
  },
  footer: {
    paddingTop: spacing.lg,
  },
});