import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import * as Location from 'expo-location';
import {
  AlertTriangle,
  Building2,
  CheckCircle,
  Droplet,
  MapPin,
  Navigation,
  Package,
} from 'lucide-react-native';
import {
  Badge,
  Banner,
  BottomSheet,
  Button,
  EmptyState,
  ErrorState,
  Field,
  PermissionExplainer,
  Row,
  ScreenHeader,
  ScrollScreen,
  Skeleton,
  Stack,
  Surface,
  Text,
  iconSize,
  radius,
  useDesign,
} from '../../src/design';
import { LocationMap, type MapMarkerPoint } from '../../src/components/map/LocationMap';
import { useTranslation } from '../../src/i18n';
import type { TranslateFn } from '@bloodchain/i18n';
import {
  acceptShipment,
  arriveAtHospital,
  confirmPickup,
  declineShipment,
  failShipment,
  getActiveShipment,
  getShipmentTracking,
  startDelivery,
  startPickup,
  updateLocation,
  type Shipment,
  type ShipmentTracking,
} from '../../src/api/courier';

const LOCATION_UPDATE_INTERVAL_MS = 20000;
const LOCATION_UPDATE_DISTANCE_M = 75;

/**
 * Two of these read better to a courier than the raw shipment status does
 * ("New assignment" for COURIER_ASSIGNED, "At pickup" for PICKUP_STARTED); the
 * rest are the ordinary status words, so they come from the shared
 * `status.shipment` namespace rather than a second set of translations.
 */
const STATUS_KEY: Record<string, string> = {
  COURIER_ASSIGNED: 'courier.assignmentNew',
  COURIER_ACCEPTED: 'status.shipment.COURIER_ACCEPTED',
  PICKUP_STARTED: 'courier.atPickup',
  PICKED_UP: 'status.shipment.PICKED_UP',
  IN_TRANSIT: 'status.shipment.IN_TRANSIT',
  ARRIVED_AT_HOSPITAL: 'status.shipment.ARRIVED_AT_HOSPITAL',
};

/** The statuses during which a problem can still be reported. */
const IN_FLIGHT = ['COURIER_ACCEPTED', 'PICKUP_STARTED', 'PICKED_UP', 'IN_TRANSIT'];

/**
 * "3 A+, 1 O-" -- blood group notation is the same in every language, so only
 * the fallback ("4 units", when no unit carries a group) needs translating.
 * The translator is passed in because this runs inside a render.
 */
function unitsSummary(shipment: Shipment, t: TranslateFn): string {
  const counts = new Map<string, number>();
  for (const unit of shipment.units ?? []) {
    if (!unit.bloodUnit) continue;
    const bloodType = `${unit.bloodUnit.bloodType}${unit.bloodUnit.rhFactor === 'POSITIVE' ? '+' : '-'}`;
    counts.set(bloodType, (counts.get(bloodType) ?? 0) + 1);
  }
  if (counts.size === 0) return t('units.bloodUnits', { count: shipment.units?.length ?? 0 });
  return Array.from(counts.entries())
    .map(([type, count]) => `${count} ${type}`)
    .join(', ');
}

/** What the courier has decided about sharing their position. */
type LocationConsent = 'unasked' | 'granted' | 'declined' | 'blocked';

/**
 * The courier's active delivery, rebuilt for V2.
 *
 * Two things changed beyond the surface:
 *
 *   The operating system was asked for location the moment a delivery went
 *   in transit, with the explanation only appearing in an Alert afterwards if
 *   it was refused. The courier now reads what is shared, with whom, and for
 *   how long, before anything is asked -- and a refusal is a stated state, not
 *   a dead end: the delivery still completes, the hospital just cannot see
 *   where it is.
 *
 *   The map drew a dashed line between pickup, courier and hospital. That is
 *   three points joined in order, not a road route, and on a screen whose job
 *   is a time-critical delivery it reads as one. The line is gone and the map
 *   says what it is showing.
 */
export default function CourierActive() {
  const { t } = useTranslation();
  const { colors } = useDesign();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [showFail, setShowFail] = useState(false);
  const [failReason, setFailReason] = useState('');
  const [failReasonError, setFailReasonError] = useState<string | null>(null);
  const [tracking, setTracking] = useState<ShipmentTracking | null>(null);
  const [locationConsent, setLocationConsent] = useState<LocationConsent>('unasked');
  const [explainingLocation, setExplainingLocation] = useState(false);

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  const load = useCallback(async () => {
    try {
      const active = await getActiveShipment();
      setShipment(active);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shipmentId = shipment?.id;
  const isInTransit = shipment?.status === 'IN_TRANSIT';

  /** Starts the watch. Only ever called once permission is in hand. */
  const startWatching = useCallback(async () => {
    if (!shipmentId || locationSubscription.current) return;
    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: LOCATION_UPDATE_INTERVAL_MS,
        distanceInterval: LOCATION_UPDATE_DISTANCE_M,
      },
      (position) => {
        updateLocation(shipmentId, {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy ?? undefined,
          heading: position.coords.heading ?? undefined,
          // expo-location reports speed in meters/second; the backend
          // (ETA averaging, speed sanity checks) expects km/h.
          speed: position.coords.speed != null ? position.coords.speed * 3.6 : undefined,
        }).catch(() => {
          // Best-effort: a single missed ping shouldn't interrupt the delivery.
        });
      },
    );
  }, [shipmentId]);

  /**
   * A delivery in transit is when position matters, so that is when the
   * courier is asked -- and asked in the app first. A courier who has already
   * granted is not made to read the explanation again.
   */
  useEffect(() => {
    if (!isInTransit || !shipmentId) return;
    let cancelled = false;

    Location.getForegroundPermissionsAsync()
      .then(({ status }) => {
        if (cancelled) return;
        if (status === 'granted') {
          setLocationConsent('granted');
          void startWatching();
          return;
        }
        if (locationConsent === 'unasked') setExplainingLocation(true);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [isInTransit, shipmentId, locationConsent, startWatching]);

  useEffect(
    () => () => {
      locationSubscription.current?.remove();
      locationSubscription.current = null;
    },
    [],
  );

  /** Only ever reached from the explainer's Allow button. */
  const askOperatingSystemForLocation = async () => {
    setExplainingLocation(false);
    const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLocationConsent(canAskAgain ? 'declined' : 'blocked');
      return;
    }
    setLocationConsent('granted');
    void startWatching();
  };

  useEffect(() => {
    if (!shipmentId) {
      setTracking(null);
      return;
    }

    let cancelled = false;
    const poll = async () => {
      try {
        const result = await getShipmentTracking(shipmentId);
        if (!cancelled) setTracking(result);
      } catch {
        // Best-effort: the rest of the screen still works from local state alone.
      }
    };

    poll();
    const interval = setInterval(poll, LOCATION_UPDATE_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [shipmentId]);

  const trackingMarkers: MapMarkerPoint[] = tracking
    ? [
        ...(tracking.source.coordinates
          ? [
              {
                id: 'source',
                ...tracking.source.coordinates,
                label: tracking.source.name,
                sublabel: tracking.source.address,
                variant: 'origin' as const,
              },
            ]
          : []),
        ...(tracking.currentLocation
          ? [
              {
                id: 'courier',
                latitude: tracking.currentLocation.latitude,
                longitude: tracking.currentLocation.longitude,
                label: t('sos.you'),
                variant: 'courier' as const,
              },
            ]
          : []),
        ...(tracking.destination.coordinates
          ? [
              {
                id: 'destination',
                ...tracking.destination.coordinates,
                label: tracking.destination.name,
                sublabel: tracking.destination.address,
                variant: 'destination' as const,
              },
            ]
          : []),
      ]
    : [];

  const runAction = async (action: () => Promise<Shipment>) => {
    setActionLoading(true);
    setActionError(null);
    try {
      const updated = await action();
      setShipment(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!shipment) return;
    setActionLoading(true);
    setActionError(null);
    try {
      await declineShipment(shipment.id, declineReason.trim() || undefined);
      setShowDecline(false);
      setDeclineReason('');
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('courier.declineFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleFail = async () => {
    if (!shipment) return;
    if (!failReason.trim()) {
      // Said on the field it belongs to rather than in a system dialog that
      // covers the field.
      setFailReasonError(t('courier.reasonRequiredBody'));
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      await failShipment(shipment.id, { reason: failReason.trim() });
      setShowFail(false);
      setFailReason('');
      setFailReasonError(null);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('courier.reportFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  const header = <ScreenHeader title={t('courier.activeTitle')} />;

  if (isLoading) {
    return (
      <ScrollScreen header={header}>
        <Stack gap="lg">
          <Skeleton height={140} />
          <Skeleton height={200} />
        </Stack>
      </ScrollScreen>
    );
  }

  return (
    <ScrollScreen
      header={header}
      refreshing={isRefreshing}
      onRefresh={() => {
        setIsRefreshing(true);
        void load();
      }}
    >
      <Stack gap="xl">
        {actionError ? <Banner tone="critical" title={actionError} /> : null}

        {!shipment ? (
          loadError ? (
            <ErrorState
              title={t('courier.activeLoadFailed')}
              description={t('common.offline')}
              retryLabel={t('common.retry')}
              onRetry={() => void load()}
            />
          ) : (
            <EmptyState
              title={t('courier.noActive')}
              description={t('courier.noActiveHint')}
              icon={({ size, color }) => <Package size={size} color={color} />}
            />
          )
        ) : (
          <>
            <Surface>
              <Stack gap="md">
                <Row gap="md">
                  <Text variant="h3" style={{ flex: 1 }}>
                    {shipment.shipmentReference}
                  </Text>
                  <Badge
                    label={t(STATUS_KEY[shipment.status] ?? `status.shipment.${shipment.status}`)}
                    tone={shipment.status === 'IN_TRANSIT' ? 'clinical' : 'neutral'}
                  />
                </Row>

                <Row gap="sm">
                  <Droplet size={iconSize.sm} color={colors.rose.base} />
                  <Text variant="body" tone="secondary">
                    {unitsSummary(shipment, t)}
                  </Text>
                </Row>

                {shipment.sourceOrganization ? (
                  <Row gap="sm" align="flex-start">
                    <Building2 size={iconSize.sm} color={colors.textTertiary} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="caption">
                        {t('courier.pickupFrom', {
                          organization: shipment.sourceOrganization.name,
                        })}
                      </Text>
                      {shipment.sourceOrganization.address ? (
                        <Text variant="caption" tone="tertiary">
                          {shipment.sourceOrganization.address}
                        </Text>
                      ) : null}
                    </View>
                  </Row>
                ) : null}

                {shipment.destinationOrganization ? (
                  <Row gap="sm" align="flex-start">
                    <MapPin size={iconSize.sm} color={colors.textTertiary} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="caption">
                        {t('courier.deliverTo', {
                          organization: shipment.destinationOrganization.name,
                        })}
                      </Text>
                      {shipment.destinationOrganization.address ? (
                        <Text variant="caption" tone="tertiary">
                          {shipment.destinationOrganization.address}
                        </Text>
                      ) : null}
                    </View>
                  </Row>
                ) : null}
              </Stack>
            </Surface>

            {trackingMarkers.length > 0 ? (
              <Stack gap="sm">
                <View style={{ borderRadius: radius.md, overflow: 'hidden' }}>
                  {/* No connecting line: three points joined in array order is
                      not a road route, and on a delivery screen it reads as
                      one. */}
                  <LocationMap markers={trackingMarkers} height={200} />
                </View>
                <Text variant="caption" tone="tertiary">
                  {t('sos.noRouteShown')}
                </Text>
              </Stack>
            ) : null}

            {/* ------------------------------------------- location sharing */}
            {isInTransit && locationConsent === 'granted' ? (
              <Banner
                tone="clinical"
                title={t('courier.sharingLocation')}
                icon={({ size, color }) => <Navigation size={size} color={color} />}
              />
            ) : null}
            {isInTransit && (locationConsent === 'declined' || locationConsent === 'blocked') ? (
              <Banner
                tone="warning"
                title={t('courier.locationDeclined')}
                action={
                  locationConsent === 'declined' ? (
                    <Button
                      label={t('courier.locationAllow')}
                      variant="secondary"
                      size="md"
                      block={false}
                      onPress={() => setExplainingLocation(true)}
                    />
                  ) : undefined
                }
              />
            ) : null}

            {/* ------------------------------------------------- the actions */}
            {shipment.status === 'COURIER_ASSIGNED' ? (
              <Stack gap="md">
                <Button
                  label={t('courier.acceptDelivery')}
                  loading={actionLoading}
                  icon={({ size, color }) => <CheckCircle size={size} color={color} />}
                  onPress={() => void runAction(() => acceptShipment(shipment.id))}
                />
                <Button
                  label={t('courier.decline')}
                  variant="secondary"
                  accent="critical"
                  style={{ borderColor: colors.critical.base }}
                  disabled={actionLoading}
                  onPress={() => setShowDecline(true)}
                />
              </Stack>
            ) : null}

            {shipment.status === 'COURIER_ACCEPTED' ? (
              <Button
                label={t('courier.startPickup')}
                loading={actionLoading}
                icon={({ size, color }) => <Navigation size={size} color={color} />}
                onPress={() => void runAction(() => startPickup(shipment.id))}
              />
            ) : null}

            {shipment.status === 'PICKUP_STARTED' ? (
              <Button
                label={t('courier.confirmUnitsCollected')}
                loading={actionLoading}
                icon={({ size, color }) => <CheckCircle size={size} color={color} />}
                onPress={() => void runAction(() => confirmPickup(shipment.id))}
              />
            ) : null}

            {shipment.status === 'PICKED_UP' ? (
              <Button
                label={t('courier.startDelivery')}
                loading={actionLoading}
                icon={({ size, color }) => <Navigation size={size} color={color} />}
                onPress={() => void runAction(() => startDelivery(shipment.id))}
              />
            ) : null}

            {shipment.status === 'IN_TRANSIT' ? (
              <Button
                label={t('courier.arrivedAtHospital')}
                loading={actionLoading}
                icon={({ size, color }) => <CheckCircle size={size} color={color} />}
                onPress={() => void runAction(() => arriveAtHospital(shipment.id))}
              />
            ) : null}

            {shipment.status === 'ARRIVED_AT_HOSPITAL' ? (
              <Surface>
                <Stack gap="sm" style={{ alignItems: 'center' }}>
                  <CheckCircle size={iconSize.xl} color={colors.success.base} />
                  <Text variant="h3" align="center">
                    {t('courier.awaitingConfirmation')}
                  </Text>
                  <Text variant="caption" tone="secondary" align="center">
                    {t('courier.awaitingConfirmationHint')}
                  </Text>
                </Stack>
              </Surface>
            ) : null}

            {IN_FLIGHT.includes(shipment.status) ? (
              <Button
                label={t('courier.reportProblem')}
                variant="secondary"
                disabled={actionLoading}
                icon={({ size }) => <AlertTriangle size={size} color={colors.warning.base} />}
                onPress={() => setShowFail(true)}
              />
            ) : null}
          </>
        )}
      </Stack>

      <BottomSheet
        visible={showDecline}
        onClose={() => setShowDecline(false)}
        title={t('courier.declineTitle')}
        closeLabel={t('actions.cancel')}
        footer={
          <Button
            label={t('courier.confirmDecline')}
            variant="critical"
            loading={actionLoading}
            onPress={() => void handleDecline()}
          />
        }
      >
        <Field
          label={t('courier.declineReasonPlaceholder')}
          placeholder={t('courier.declineReasonPlaceholder')}
          value={declineReason}
          onChangeText={setDeclineReason}
        />
      </BottomSheet>

      <BottomSheet
        visible={showFail}
        onClose={() => setShowFail(false)}
        title={t('courier.reportProblem')}
        closeLabel={t('actions.cancel')}
        footer={
          <Button
            label={t('actions.submit')}
            variant="critical"
            loading={actionLoading}
            onPress={() => void handleFail()}
          />
        }
      >
        <Field
          label={t('courier.reasonRequired')}
          placeholder={t('courier.reportProblemPlaceholder')}
          value={failReason}
          onChangeText={(value) => {
            setFailReason(value);
            if (failReasonError) setFailReasonError(null);
          }}
          error={failReasonError ?? undefined}
          multiline
          required
        />
      </BottomSheet>

      <PermissionExplainer
        visible={explainingLocation}
        title={t('courier.locationExplainerTitle')}
        description={t('courier.locationExplainerBody')}
        assurances={[
          t('courier.locationAssuranceInTransitOnly'),
          t('courier.locationAssuranceHospitalOnly'),
          t('courier.locationAssuranceStops'),
        ]}
        allowLabel={t('courier.locationAllow')}
        denyLabel={t('sos.locationNotNow')}
        onAllow={() => void askOperatingSystemForLocation()}
        onDeny={() => {
          setExplainingLocation(false);
          setLocationConsent('declined');
        }}
        icon={({ size, color }) => <Navigation size={size} color={color} />}
      />
    </ScrollScreen>
  );
}
