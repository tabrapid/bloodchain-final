import { useCallback, useMemo, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { View } from 'react-native';
import * as Location from 'expo-location';
import { Building2, MapPin, Navigation, ShieldCheck, SlidersHorizontal } from 'lucide-react-native';
import {
  Badge,
  BottomSheet,
  Button,
  Choice,
  EmptyState,
  ErrorState,
  FilterChip,
  FlowStep,
  LinkButton,
  ListGroup,
  ListRow,
  PermissionExplainer,
  Row,
  SkeletonRow,
  Stack,
  Surface,
  Text,
  space,
  useDesign,
} from '../../src/design';
import { useDiscoverOrganizations } from '../../src/hooks/useOrganizations';
import { useDistricts, useGeographyCoverage, useRegions } from '../../src/hooks/useGeography';
import { geoName } from '../../src/api/geography';
import {
  capabilityFor,
  type DirectoryOrganization,
  type OrganizationServiceType,
} from '../../src/api/organizations';
import { useTranslation } from '../../src/i18n';
import { BOOKING_STEP_COUNT } from './select-type';

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
  const [explainingLocation, setExplainingLocation] = useState(false);
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

  const { data, isLoading, isError, refetch } = useDiscoverOrganizations(query);
  const organizations = data?.organizations ?? [];

  const activeFilters =
    (regionId ? 1 : 0) +
    (districtId ? 1 : 0) +
    (orgType ? 1 : 0) +
    (service ? 1 : 0) +
    (coordinates ? 1 : 0);

  const clearFilters = useCallback(() => {
    setRegionId(undefined);
    setDistrictId(undefined);
    setOrgType(undefined);
    setService(undefined);
    setCoordinates(null);
    setLocationError(null);
  }, []);

  /** Reads the position. Only reached once permission is in hand. */
  const readPosition = useCallback(async () => {
    try {
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
  }, [t]);

  /**
   * Nearby search, without asking the operating system before the donor knows
   * what for.
   *
   * A donor who has already granted location gets what they asked for on the
   * tap. A donor who has not sees the explanation first: what it is used for
   * here (sorting this list by distance), what it is not, and a "Not now" that
   * costs them nothing. The system prompt only ever follows their Allow.
   */
  const toggleNearby = useCallback(async () => {
    if (coordinates) {
      setCoordinates(null);
      setLocationError(null);
      return;
    }
    setLocationError(null);
    const existing = await Location.getForegroundPermissionsAsync();
    if (existing.status === 'granted') {
      await readPosition();
      return;
    }
    setExplainingLocation(true);
  }, [coordinates, readPosition]);

  /** Only ever reached from the explainer's Allow button. */
  const askOperatingSystemForLocation = useCallback(async () => {
    setExplainingLocation(false);
    const granted = await Location.requestForegroundPermissionsAsync();
    if (granted.status !== 'granted') {
      setLocationError(t('directory.nearbyDenied'));
      return;
    }
    await readPosition();
  }, [readPosition, t]);

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
    <FlowStep
      step={2}
      total={BOOKING_STEP_COUNT}
      counterLabel={t('booking.stepOf', { current: 2, total: BOOKING_STEP_COUNT })}
      title={t('booking.selectLocation')}
      subtitle={
        params.type === 'BLOOD_DONATION'
          ? t('booking.selectLocationHintDonation')
          : t('booking.selectLocationHintTest')
      }
      onBack={() => router.back()}
      backLabel={t('common.a11yGoBack')}
      onClose={() => router.replace('/(app)/donate')}
      closeLabel={t('common.a11yCloseBooking')}
      primaryLabel={t('common.continue')}
      primaryDisabled={!selected}
      onPrimary={() =>
        router.push({
          pathname: '/(booking)/date',
          params: { organizationId: selected!, type: params.type },
        })
      }
    >
      <Stack gap="lg">
        <Row gap="md">
          <Button
            label={
              activeFilters > 0
                ? `${t('directory.filters')} · ${activeFilters}`
                : t('directory.filters')
            }
            accessibilityLabel={showFilters ? t('directory.hideFilters') : t('directory.showFilters')}
            variant="secondary"
            size="md"
            block={false}
            icon={({ size, color }) => <SlidersHorizontal size={size} color={color} />}
            onPress={() => setShowFilters((open) => !open)}
          />
          <View style={{ flex: 1 }} />
          {!isLoading && !isError ? (
            <Text variant="caption" tone="tertiary">
              {t('directory.resultsCount', { count: data?.total ?? organizations.length })}
            </Text>
          ) : null}
        </Row>

        {showFilters ? (
          <Surface>
            <Stack gap="md">
              <Row gap="sm" style={{ flexWrap: 'wrap' }}>
                <FilterChip
                  field={t('directory.region')}
                  label={region ? geoName(region, locale) : t('directory.anyRegion')}
                  active={Boolean(regionId)}
                  onPress={() => setPicker('region')}
                />
                <FilterChip
                  field={t('directory.district')}
                  label={district ? geoName(district, locale) : t('directory.anyDistrict')}
                  active={Boolean(districtId)}
                  disabled={!regionId}
                  onPress={() => setPicker('district')}
                />
                <FilterChip
                  field={t('directory.organizationType')}
                  label={orgType ? t(`directory.organizationTypes.${orgType}`) : t('directory.anyType')}
                  active={Boolean(orgType)}
                  onPress={() => setPicker('type')}
                />
                <FilterChip
                  field={t('directory.service')}
                  label={service ? t(`medical.services.${service}`) : t('directory.anyService')}
                  active={Boolean(service)}
                  onPress={() => setPicker('service')}
                />
                <FilterChip
                  field={t('directory.nearby')}
                  label={
                    coordinates ? t('directory.nearbyRadius', { km: radiusKm }) : t('directory.nearby')
                  }
                  active={Boolean(coordinates)}
                  opens={false}
                  icon={({ size, color }) => <Navigation size={size} color={color} />}
                  onPress={() => void toggleNearby()}
                />
              </Row>

              {!regionId ? (
                <Text variant="caption" tone="tertiary">
                  {t('directory.chooseRegionFirst')}
                </Text>
              ) : null}
              {coverage?.districtsAuthoritative === false ? (
                <Text variant="caption" tone="tertiary">
                  {t('directory.demoDistricts')}
                </Text>
              ) : null}
              {locationError ? (
                <Text variant="caption" tone="warning">
                  {locationError}
                </Text>
              ) : null}

              {coordinates ? (
                <Row gap="sm" style={{ flexWrap: 'wrap' }}>
                  {RADIUS_OPTIONS.map((km) => (
                    <FilterChip
                      key={km}
                      field={t('directory.nearby')}
                      label={t('directory.nearbyRadius', { km })}
                      active={radiusKm === km}
                      opens={false}
                      onPress={() => setRadiusKm(km)}
                    />
                  ))}
                </Row>
              ) : null}

              {activeFilters > 0 ? (
                <LinkButton label={t('directory.clearFilters')} onPress={clearFilters} />
              ) : null}
            </Stack>
          </Surface>
        ) : null}

        {isLoading ? (
          <Surface>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </Surface>
        ) : isError ? (
          <ErrorState
            title={t('booking.locationsFailed')}
            description={t('common.offline')}
            retryLabel={t('common.retry')}
            onRetry={() => void refetch()}
          />
        ) : organizations.length === 0 ? (
          <EmptyState
            title={activeFilters > 0 ? t('directory.noResults') : t('booking.noLocations')}
            description={
              activeFilters > 0 ? t('directory.noResultsHint') : t('booking.noLocationsHint')
            }
            {...(activeFilters > 0
              ? { action: { label: t('directory.clearFilters'), onPress: clearFilters } }
              : {})}
          />
        ) : (
          <Stack gap="md">
            {organizations.map((org) => (
              <OrganizationOption
                key={org.id}
                organization={org}
                selected={selected === org.id}
                onPress={() => setSelected(org.id)}
              />
            ))}
          </Stack>
        )}
      </Stack>

      <BottomSheet
        visible={picker !== null}
        onClose={() => setPicker(null)}
        title={pickerOptions?.title ?? ''}
        closeLabel={t('common.close')}
      >
        <ListGroup
          rows={[
            <ListRow
              key="any"
              title={pickerOptions?.empty ?? ''}
              trailing={
                !pickerOptions?.selectedId ? (
                  <Badge label={t('common.done')} tone="rose" />
                ) : undefined
              }
              onPress={() => {
                pickerOptions?.onSelect(undefined);
                setPicker(null);
              }}
            />,
            ...(pickerOptions?.options ?? []).map((option) => (
              <ListRow
                key={option.id}
                title={option.label}
                trailing={
                  pickerOptions?.selectedId === option.id ? (
                    <Badge label={t('common.done')} tone="rose" />
                  ) : undefined
                }
                onPress={() => {
                  pickerOptions?.onSelect(option.id);
                  setPicker(null);
                }}
              />
            )),
          ]}
        />
      </BottomSheet>

      <PermissionExplainer
        visible={explainingLocation}
        title={t('directory.nearbyExplainerTitle')}
        description={t('directory.nearbyExplainerBody')}
        assurances={[
          t('directory.nearbyAssuranceSorting'),
          t('directory.nearbyAssuranceNotStored'),
          t('directory.nearbyAssuranceOptional'),
        ]}
        allowLabel={t('directory.nearbyAllow')}
        denyLabel={t('sos.locationNotNow')}
        onAllow={() => void askOperatingSystemForLocation()}
        onDeny={() => setExplainingLocation(false)}
        icon={({ size, color }) => <Navigation size={size} color={color} />}
      />
    </FlowStep>
  );
}

function OrganizationOption({
  organization,
  selected,
  onPress,
}: {
  organization: DirectoryOrganization;
  selected: boolean;
  onPress: () => void;
}) {
  const { t, locale } = useTranslation();
  const { colors } = useDesign();

  const place = [organization.district, organization.region]
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .map((entry) => geoName(entry, locale))
    .join(', ');
  const where = organization.address
    ? place
      ? `${organization.address} · ${place}`
      : organization.address
    : place;

  return (
    <View style={{ gap: space.sm }}>
      <Choice
        label={organization.name}
        description={where || undefined}
        selected={selected}
        onPress={onPress}
        icon={({ size }) => (
          <Building2
            size={size}
            color={organization.type === 'HOSPITAL' ? colors.rose.base : colors.clinical.base}
          />
        )}
      />
      {/* Distance, verification and demo status sit under the option rather
          than inside it: they are facts about the place, not part of the
          choice, and cramming them into the row is what made V1's cards
          three lines tall with the name truncated at the top. */}
      {organization.distanceKm !== null || organization.isVerified || organization.isDemo ? (
        <Row gap="sm" style={{ flexWrap: 'wrap', paddingLeft: space.xl }}>
          {organization.distanceKm !== null ? (
            <Badge
              label={t('directory.distanceAway', { km: organization.distanceKm })}
              tone="clinical"
              icon={({ size, color }) => <MapPin size={size} color={color} />}
            />
          ) : null}
          {organization.isVerified ? (
            <Badge
              label={t('directory.verified')}
              tone="success"
              icon={({ size, color }) => <ShieldCheck size={size} color={color} />}
            />
          ) : null}
          {organization.isDemo ? <Badge label={t('directory.demo')} tone="warning" /> : null}
        </Row>
      ) : null}
    </View>
  );
}
