import { useMemo, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { View, StyleSheet, Pressable } from 'react-native';
import { MapPin, Building2, Check } from 'lucide-react-native';
import {
  AppButton,
  AppText,
  BookingStep,
  EmptyState,
  GlassCard,
  SkeletonCard,
} from '../../src/components';
import { useOrganizations } from '../../src/hooks/useAppointments';
import { radius, spacing, useTheme, ThemeColors } from '../../src/theme';
import { useTranslation } from '../../src/i18n';

export default function SelectOrganization() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ type: string }>();
  const [selected, setSelected] = useState<string | null>(null);

  const {
    data: organizations = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useOrganizations(params.type ? { type: params.type } : undefined);

  return (
    <BookingStep
      step={2}
      title={t('booking.selectLocation')}
      subtitle={
        params.type === 'BLOOD_DONATION'
          ? t('booking.selectLocationHintDonation')
          : t('booking.selectLocationHintTest')
      }
      nextDisabled={!selected}
      onNext={() =>
        router.push({
          pathname: '/(booking)/date',
          params: { organizationId: selected!, type: params.type },
        })
      }
    >
      {isLoading ? (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </View>
      ) : isError ? (
        <GlassCard style={styles.stateCard}>
          <EmptyState
            title={t('booking.locationsFailed')}
            description={t('common.offline')}
          />
          <AppButton
            variant="secondary"
            onPress={() => refetch()}
            disabled={isRefetching}
            loading={isRefetching}
            style={styles.retry}
          >
            {t('common.retry')}
          </AppButton>
        </GlassCard>
      ) : organizations.length === 0 ? (
        <GlassCard style={styles.stateCard}>
          <EmptyState
            title={t('booking.noLocations')}
            description={t('booking.noLocationsHint')}
          />
        </GlassCard>
      ) : (
        <View style={styles.list}>
          {organizations.map((org) => {
            const isSelected = selected === org.id;
            const isHospital = org.type === 'HOSPITAL';
            return (
              <Pressable
                key={org.id}
                onPress={() => setSelected(org.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                style={({ pressed }) => ({ opacity: pressed && !isSelected ? 0.7 : 1 })}
              >
                <GlassCard
                  tier={isSelected ? 'elevated' : 'standard'}
                  style={isSelected ? styles.cardSelected : undefined}
                >
                  <View style={styles.row}>
                    <View
                      style={[
                        styles.icon,
                        {
                          backgroundColor: isHospital
                            ? colors.primaryMuted
                            : colors.secondaryMuted,
                        },
                      ]}
                    >
                      <Building2
                        size={18}
                        color={isHospital ? colors.onMuted.primary : colors.onMuted.secondary}
                      />
                    </View>
                    <View style={styles.body}>
                      <AppText style={styles.name}>{org.name}</AppText>
                      {org.address && (
                        <View style={styles.addressRow}>
                          <MapPin size={11} color={colors.textMuted} />
                          <AppText style={styles.address} numberOfLines={2}>
                            {org.address}
                          </AppText>
                        </View>
                      )}
                    </View>
                    {isSelected && (
                      <View style={styles.check}>
                        <Check size={13} color="#FFFFFF" strokeWidth={3} />
                      </View>
                    )}
                  </View>
                </GlassCard>
              </Pressable>
            );
          })}
        </View>
      )}
    </BookingStep>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    list: {
      gap: 10,
    },
    stateCard: {
      paddingVertical: spacing.lg,
    },
    retry: {
      marginTop: spacing.md,
      alignSelf: 'center',
    },
    cardSelected: {
      borderColor: 'rgba(216, 83, 96, 0.45)',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    icon: {
      width: 40,
      height: 40,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    body: {
      flex: 1,
    },
    name: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    addressRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 4,
      marginTop: 2,
    },
    address: {
      flex: 1,
      fontSize: 12,
      color: colors.textMuted,
    },
    check: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
  });
}
