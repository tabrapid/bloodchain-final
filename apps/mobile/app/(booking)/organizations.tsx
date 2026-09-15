import { useCallback, useMemo, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import {
  Building2,
  Check,
  ChevronDown,
  MapPin,
  Navigation,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react-native';
import {
  AppButton,
  AppText,
  Badge,
  BookingStep,
  EmptyState,
  GlassCard,
  Modal,
  SkeletonCard,
} from '../../src/components';
import { useDiscoverOrganizations } from '../../src/hooks/useOrganizations';
import { useDistricts, useGeographyCoverage, useRegions } from '../../src/hooks/useGeography';
import { geoName } from '../../src/api/geography';
import {
  capabilityFor,
  type DirectoryOrganization,
  type OrganizationServiceType,
} from '../../src/api/organizations';
import { radius, spacing, useTheme, ThemeColors } from '../../src/theme';
import { useTranslation } from '../../src/i18n';

/** The organization types a donor can be sent to. SYSTEM is internal. */
const ORGANIZATION_TYPES = ['HOSPITAL', 'BLOOD_CENTER'] as const;

const SERVICES: OrganizationServiceType[] = [
  'WHOLE_BLOOD_DONATION',
  'PLASMA_DONATION',
  'PLATELET_DONATION',
  'LABORATORY_TESTING',
  'BLOOD_TYPING',
  'HEALTH_SCREENING',
  'MOBILE_DONATION_DRIVE',
  'EMERGENCY_SUPPLY',
];

/** Offered once a donor has shared their location, smallest first. */
const RADIUS_OPTIONS = [10, 25, 50, 100];
const DEFAULT_RADIUS_KM = 25;

interface Coordinates {
  latitude: number;
  longitude: number;
}

export default function SelectOrganization() {
  const { t, locale } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ type: string }>();
  const [selected, setSelected] = useState<string | null>(null);

  const [showFilters, setShowFilters] = useState(false);
  const [regionId, setRegionId] = useState<string | undefined>();
  const [districtId, setDistrictId] = useState<string | undefined>();
  const [orgType, setOrgType] = useState<'HOSPITAL' | 'BLOOD_CENTER' | undefined>();
  const [service, setService] = useState<OrganizationServiceType | undefined>();
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [picker, setPicker] = useState<'region' | 'district' | 'type' | 'service' | null>(null);

  const { data: regions = [] } = useRegions();
  const { data: districts = [] } = useDistricts(regionId);
  const { data: coverage } = useGeographyCoverage();

  const region = regions.find((r) => r.id === regionId);
  const district = districts.find((d) => d.id === districtId);

  /**
   * What the donor picked in step 1 decides which organizations can serve them,
   * and that is a capability (`acceptsDonations`) rather than an organization
   * type -- so it is translated once here and never sent as `type`.
   */
  const query = useMemo(
    () => ({
      ...capabilityFor(params.type),
      regionId,
      districtId,
      type: orgType,
      service,
      ...(coordinates ? { ...coordinates, radiusKm } : {}),
      limit: 50,
    }),
    [params.type, regionId, districtId, orgType, service, coordinates, radiusKm],
  );

  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useDiscoverOrganizations(query);
  const organizations = data?.organizations ?? [];

  const activeFilters =
    (regionId ? 1 : 0) + (districtId ? 1 : 0) + (orgType ? 1 : 0) + (service ? 1 : 0) +
    (coordinates ? 1 : 0);

  const clearFilters = useCallback(() => {
    setRegionId(undefined);
    setDistrictId(undefined);
    setOrgType(undefined);
    setService(undefined);
    setCoordinates(null);
    setLocationError(null);
  }, []);

  /**
   * Nearby search is off until the donor asks for it and the platform agrees.
   *
   * Permission is requested on the tap that needs it rather than on mount, and
   * a refusal turns the filter off with a line saying why -- the one thing a
   * toggle that silently does nothing cannot do.
   */
  const toggleNearby = useCallback(async () => {
    if (coordinates) {
      setCoordinates(null);
      setLocationError(null);
      return;
    }
    setLocationError(null);
    try {
      const existing = await Location.getForegroundPermissionsAsync();
      const granted =
        existing.status === 'granted'
          ? existing
          : await Location.requestForegroundPermissionsAsync();
      if (granted.status !== 'granted') {
        setLocationError(t('directory.nearbyDenied'));
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoordinates({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch {
      setLocationError(t('directory.nearbyFailed'));
    }
  }, [coordinates, t]);

  const pickerOptions = useMemo(() => {
    switch (picker) {
      case 'region':
        return {
          title: t('directory.region'),
          empty: t('directory.anyRegion'),
          options: regions.map((r) => ({ id: r.id, label: geoName(r, locale) })),
          selectedId: regionId,
          onSelect: (id?: string) => {
            setRegionId(id);
            // A district only means something inside its region; keeping the
            // old one would filter on a district the region does not contain
            // and return nothing, with no visible reason why.
            setDistrictId(undefined);
          },
        };
      case 'district':
        return {
          title: t('directory.district'),
          empty: t('directory.anyDistrict'),
          options: districts.map((d) => ({ id: d.id, label: geoName(d, locale) })),
          selectedId: districtId,
          onSelect: setDistrictId,
        };
      case 'type':
        return {
          title: t('directory.organizationType'),
          empty: t('directory.anyType'),
          options: ORGANIZATION_TYPES.map((value) => ({
            id: value,
            label: t(`directory.organizationTypes.${value}`),
          })),
          selectedId: orgType,
          onSelect: (id?: string) => setOrgType(id as 'HOSPITAL' | 'BLOOD_CENTER' | undefined),
        };
      case 'service':
        return {
          title: t('directory.service'),
          empty: t('directory.anyService'),
          options: SERVICES.map((value) => ({
            id: value,
            label: t(`medical.services.${value}`),
          })),
          selectedId: service,
          onSelect: (id?: string) => setService(id as OrganizationServiceType | undefined),
        };
      default:
        return null;
    }
  }, [picker, regions, districts, regionId, districtId, orgType, service, locale, t]);

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
      <View style={styles.toolbar}>
        <Pressable
          onPress={() => setShowFilters((open) => !open)}
          accessibilityRole="button"
          accessibilityLabel={showFilters ? t('directory.hideFilters') : t('directory.showFilters')}
          style={styles.toolbarButton}
        >
          <SlidersHorizontal size={14} color={colors.text} />
          <AppText style={styles.toolbarLabel}>{t('directory.filters')}</AppText>
          {activeFilters > 0 && (
            <View style={styles.filterCount}>
              <AppText style={styles.filterCountText}>{activeFilters}</AppText>
            </View>
          )}
        </Pressable>
        {!isLoading && !isError && (
          <AppText style={styles.resultCount}>
            {t('directory.resultsCount', { count: data?.total ?? organizations.length })}
          </AppText>
        )}
      </View>

      {showFilters && (
        <GlassCard style={styles.filterCard}>
          <View style={styles.chipRow}>
            <FilterChip
              colors={colors}
              field={t('directory.region')}
              label={region ? geoName(region, locale) : t('directory.anyRegion')}
              active={Boolean(regionId)}
              onPress={() => setPicker('region')}
            />
            <FilterChip
              colors={colors}
              field={t('directory.district')}
              label={district ? geoName(district, locale) : t('directory.anyDistrict')}
              active={Boolean(districtId)}
              disabled={!regionId}
              onPress={() => setPicker('district')}
            />
            <FilterChip
              colors={colors}
              field={t('directory.organizationType')}
              label={orgType ? t(`directory.organizationTypes.${orgType}`) : t('directory.anyType')}
              active={Boolean(orgType)}
              onPress={() => setPicker('type')}
            />
            <FilterChip
              colors={colors}
              field={t('directory.service')}
              label={service ? t(`medical.services.${service}`) : t('directory.anyService')}
              active={Boolean(service)}
              onPress={() => setPicker('service')}
            />
            <FilterChip
              colors={colors}
              field={t('directory.nearby')}
              label={coordinates ? t('directory.nearbyRadius', { km: radiusKm }) : t('directory.nearby')}
              active={Boolean(coordinates)}
              icon={<Navigation size={12} color={coordinates ? '#FFFFFF' : colors.textMuted} />}
              onPress={toggleNearby}
            />
          </View>

          {!regionId && (
            <AppText style={styles.hint}>{t('directory.chooseRegionFirst')}</AppText>
          )}
          {coverage?.districtsAuthoritative === false && (
            <AppText style={styles.hint}>{t('directory.demoDistricts')}</AppText>
          )}
          {locationError && <AppText style={styles.error}>{locationError}</AppText>}

          {coordinates && (
            <View style={styles.chipRow}>
              {RADIUS_OPTIONS.map((km) => (
                <FilterChip
                  key={km}
                  colors={colors}
                  field={t('directory.nearby')}
                  label={t('directory.nearbyRadius', { km })}
                  active={radiusKm === km}
                  onPress={() => setRadiusKm(km)}
                />
              ))}
            </View>
          )}

          {activeFilters > 0 && (
            <AppButton variant="ghost" onPress={clearFilters} style={styles.clear}>
              {t('directory.clearFilters')}
            </AppButton>
          )}
        </GlassCard>
      )}

      {isLoading ? (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </View>
      ) : isError ? (
        <GlassCard style={styles.stateCard}>
          <EmptyState title={t('booking.locationsFailed')} description={t('common.offline')} />
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
            title={activeFilters > 0 ? t('directory.noResults') : t('booking.noLocations')}
            description={
              activeFilters > 0 ? t('directory.noResultsHint') : t('booking.noLocationsHint')
            }
          />
          {activeFilters > 0 && (
            <AppButton variant="secondary" onPress={clearFilters} style={styles.retry}>
              {t('directory.clearFilters')}
            </AppButton>
          )}
        </GlassCard>
      ) : (
        <View style={styles.list}>
          {organizations.map((org) => (
            <OrganizationCard
              key={org.id}
              organization={org}
              selected={selected === org.id}
              onPress={() => setSelected(org.id)}
              colors={colors}
              styles={styles}
              locale={locale}
              t={t}
            />
          ))}
        </View>
      )}

      <Modal
        visible={picker !== null}
        onClose={() => setPicker(null)}
        title={pickerOptions?.title}
      >
        <ScrollView style={styles.pickerScroll}>
          <PickerRow
            label={pickerOptions?.empty ?? ''}
            selected={!pickerOptions?.selectedId}
            onPress={() => {
              pickerOptions?.onSelect(undefined);
              setPicker(null);
            }}
            colors={colors}
            styles={styles}
          />
          {pickerOptions?.options.map((option) => (
            <PickerRow
              key={option.id}
              label={option.label}
              selected={pickerOptions.selectedId === option.id}
              onPress={() => {
                pickerOptions.onSelect(option.id);
                setPicker(null);
              }}
              colors={colors}
              styles={styles}
            />
          ))}
        </ScrollView>
      </Modal>
    </BookingStep>
  );
}

/**
 * `field` is what makes the chip readable out of context: the visible label is
 * the chosen value ("Tashkent City"), which on its own says nothing about which
 * filter it belongs to -- to a screen reader, or to a test looking for the
 * region control rather than the word.
 */
function FilterChip({
  colors,
  field,
  label,
  active,
  disabled,
  icon,
  onPress,
}: {
  colors: ThemeColors;
  field: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${field}: ${label}`}
      accessibilityState={{ selected: active, disabled }}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          paddingVertical: 7,
          paddingHorizontal: 12,
          borderRadius: radius.pill,
          borderWidth: 1,
          backgroundColor: active ? colors.primary : colors.surfaceElevated,
          borderColor: active ? colors.primary : colors.border,
          opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
        },
      ]}
    >
      {icon}
      <AppText
        style={{ fontSize: 12, fontWeight: '600', color: active ? '#FFFFFF' : colors.text }}
        numberOfLines={1}
      >
        {label}
      </AppText>
      {!icon && <ChevronDown size={12} color={active ? '#FFFFFF' : colors.textMuted} />}
    </Pressable>
  );
}

function PickerRow({
  label,
  selected,
  onPress,
  colors,
  styles,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.pickerRow, { opacity: pressed ? 0.7 : 1 }]}
    >
      <AppText style={styles.pickerLabel}>{label}</AppText>
      {selected && <Check size={16} color={colors.primary} strokeWidth={3} />}
    </Pressable>
  );
}

function OrganizationCard({
  organization,
  selected,
  onPress,
  colors,
  styles,
  locale,
  t,
}: {
  organization: DirectoryOrganization;
  selected: boolean;
  onPress: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  locale: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const isHospital = organization.type === 'HOSPITAL';
  const place = [organization.district, organization.region]
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .map((entry) => geoName(entry, locale))
    .join(', ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({ opacity: pressed && !selected ? 0.7 : 1 })}
    >
      <GlassCard
        tier={selected ? 'elevated' : 'standard'}
        style={selected ? styles.cardSelected : undefined}
      >
        <View style={styles.row}>
          <View
            style={[
              styles.icon,
              { backgroundColor: isHospital ? colors.primaryMuted : colors.secondaryMuted },
            ]}
          >
            <Building2
              size={18}
              color={isHospital ? colors.onMuted.primary : colors.onMuted.secondary}
            />
          </View>
          <View style={styles.body}>
            <AppText style={styles.name}>{organization.name}</AppText>
            {place.length > 0 && (
              <View style={styles.addressRow}>
                <MapPin size={11} color={colors.textMuted} />
                <AppText style={styles.address} numberOfLines={2}>
                  {organization.address ? `${organization.address} · ${place}` : place}
                </AppText>
              </View>
            )}
            {!place && organization.address && (
              <View style={styles.addressRow}>
                <MapPin size={11} color={colors.textMuted} />
                <AppText style={styles.address} numberOfLines={2}>
                  {organization.address}
                </AppText>
              </View>
            )}
            <View style={styles.badgeRow}>
              {organization.distanceKm !== null && (
                <Badge variant="secondary">
                  {t('directory.distanceAway', { km: organization.distanceKm })}
                </Badge>
              )}
              {organization.isVerified && (
                <View style={styles.verified}>
                  <ShieldCheck size={11} color={colors.onMuted.success} />
                  <AppText style={styles.verifiedText}>{t('directory.verified')}</AppText>
                </View>
              )}
              {organization.isDemo && <Badge variant="warning">{t('directory.demo')}</Badge>}
            </View>
          </View>
          {selected && (
            <View style={styles.check}>
              <Check size={13} color="#FFFFFF" strokeWidth={3} />
            </View>
          )}
        </View>
      </GlassCard>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    toolbarButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
    },
    toolbarLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    filterCount: {
      minWidth: 16,
      height: 16,
      paddingHorizontal: 4,
      borderRadius: 8,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterCountText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    resultCount: {
      fontSize: 12,
      color: colors.textMuted,
    },
    filterCard: {
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    hint: {
      fontSize: 11,
      color: colors.textMuted,
    },
    error: {
      fontSize: 11,
      color: colors.danger,
    },
    clear: {
      alignSelf: 'flex-start',
    },
    pickerScroll: {
      maxHeight: 360,
    },
    pickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: 12,
    },
    pickerLabel: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
    },
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
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 6,
    },
    verified: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 1,
      backgroundColor: colors.successMuted,
      borderColor: colors.successMuted,
    },
    verifiedText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.onMuted.success,
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
