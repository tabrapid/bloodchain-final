import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import {
  AlertTriangle,
  Building2,
  CheckCircle,
  Droplet,
  MapPin,
  Navigation,
  Package,
  XCircle,
} from 'lucide-react-native';
import { AppButton, AppHeader, AppText, Badge, Card, EmptyState, LoadingState, Screen } from '../../src/components';
import { LocationMap, type MapMarkerPoint } from '../../src/components/map/LocationMap';
import { useTranslation } from '../../src/i18n';
import { layout, spacing, useTheme } from '../../src/theme';
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

/**
 * "3 A+, 1 O-" -- blood group notation is the same in every language, so only
 * the fallback ("4 units", when no unit carries a group) needs translating.
 * The translator is passed in because this runs inside a render.
 */
function unitsSummary(
  shipment: Shipment,
  t: (key: string, options?: Record<string, string | number>) => string,
): string {
  const counts = new Map<string, number>();
  for (const unit of shipment.units ?? []) {
    if (!unit.bloodUnit) continue;
    const bloodType = `${unit.bloodUnit.bloodType}${unit.bloodUnit.rhFactor === 'POSITIVE' ? '+' : '-'}`;
    counts.set(bloodType, (counts.get(bloodType) ?? 0) + 1);
  }
  if (counts.size === 0) return t('units.bloodUnits', { count: shipment.units?.length ?? 0 });
  return Array.from(counts.entries()).map(([type, count]) => `${count} ${type}`).join(', ');
}

export default function CourierActive() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [showFail, setShowFail] = useState(false);
  const [failReason, setFailReason] = useState('');
  const [tracking, setTracking] = useState<ShipmentTracking | null>(null);

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  const load = useCallback(async () => {
    try {
      const active = await getActiveShipment();
      setShipment(active);
      setLoadError(false);
    } catch (err) {
      console.error('Failed to load active shipment:', err);
      setLoadError(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const shipmentId = shipment?.id;
    const isInTransit = shipment?.status === 'IN_TRANSIT';

    async function startTracking() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('sos.locationPermissionTitle'), t('courier.locationPermissionBody'));
        return;
      }

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: LOCATION_UPDATE_INTERVAL_MS,
          distanceInterval: LOCATION_UPDATE_DISTANCE_M,
        },
        (position) => {
          if (!shipmentId) return;
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
    }

    if (isInTransit && shipmentId) {
      startTracking();
    }

    return () => {
      locationSubscription.current?.remove();
      locationSubscription.current = null;
    };
  }, [shipment?.id, shipment?.status]);

  useEffect(() => {
    const shipmentId = shipment?.id;
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
  }, [shipment?.id]);

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
    try {
      const updated = await action();
      setShipment(updated);
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message || t('common.error'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccept = () => {
    if (!shipment) return;
    runAction(() => acceptShipment(shipment.id));
  };

  const handleDecline = async () => {
    if (!shipment) return;
    setActionLoading(true);
    try {
      await declineShipment(shipment.id, declineReason.trim() || undefined);
      setShowDecline(false);
      setDeclineReason('');
      await load();
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message || t('courier.declineFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartPickup = () => {
    if (!shipment) return;
    runAction(() => startPickup(shipment.id));
  };

  const handleConfirmPickup = () => {
    if (!shipment) return;
    runAction(() => confirmPickup(shipment.id));
  };

  const handleStartDelivery = () => {
    if (!shipment) return;
    runAction(() => startDelivery(shipment.id));
  };

  const handleArrived = () => {
    if (!shipment) return;
    runAction(() => arriveAtHospital(shipment.id));
  };

  const handleFail = async () => {
    if (!shipment || !failReason.trim()) {
      Alert.alert(t('courier.reasonRequired'), t('courier.reasonRequiredBody'));
      return;
    }
    setActionLoading(true);
    try {
      await failShipment(shipment.id, { reason: failReason.trim() });
      setShowFail(false);
      setFailReason('');
      await load();
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message || t('courier.reportFailed'));
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Screen>
        <AppHeader title={t('courier.activeTitle')} />
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <AppHeader title={t('courier.activeTitle')} />
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {!shipment ? (
          loadError ? (
            <>
              <EmptyState
                icon={AlertTriangle}
                title={t('courier.activeLoadFailed')}
                description={t('common.offline')}
              />
              <AppButton variant="secondary" onPress={load} style={{ marginTop: spacing.md }}>
                {t('common.retry')}
              </AppButton>
            </>
          ) : (
            <EmptyState
              icon={Package}
              title={t('courier.noActive')}
              description={t('courier.noActiveHint')}
            />
          )
        ) : (
          <>
            <Card style={{ marginBottom: layout.cardGap }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
                <AppText variant="heading">{shipment.shipmentReference}</AppText>
                <Badge variant={shipment.status === 'IN_TRANSIT' ? 'primary' : 'secondary'}>
                  {t(STATUS_KEY[shipment.status] ?? `status.shipment.${shipment.status}`)}
                </Badge>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                <Droplet size={16} color={colors.primary} />
                <AppText muted>{unitsSummary(shipment, t)}</AppText>
              </View>

              {shipment.sourceOrganization && (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm }}>
                  <Building2 size={16} color={colors.textMuted} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <AppText style={{ fontSize: 13 }}>
                      {t('courier.pickupFrom', { organization: shipment.sourceOrganization.name })}
                    </AppText>
                    {shipment.sourceOrganization.address && (
                      <AppText muted style={{ fontSize: 12 }}>{shipment.sourceOrganization.address}</AppText>
                    )}
                  </View>
                </View>
              )}

              {shipment.destinationOrganization && (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
                  <MapPin size={16} color={colors.textMuted} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <AppText style={{ fontSize: 13 }}>
                      {t('courier.deliverTo', {
                        organization: shipment.destinationOrganization.name,
                      })}
                    </AppText>
                    {shipment.destinationOrganization.address && (
                      <AppText muted style={{ fontSize: 12 }}>{shipment.destinationOrganization.address}</AppText>
                    )}
                  </View>
                </View>
              )}
            </Card>

            {trackingMarkers.length > 0 && (
              <Card style={{ marginBottom: layout.cardGap, padding: 0, overflow: 'hidden' }}>
                <LocationMap markers={trackingMarkers} showRoute height={200} />
              </Card>
            )}

            {shipment.status === 'COURIER_ASSIGNED' && !showDecline && (
              <View style={{ gap: spacing.sm }}>
                <AppButton onPress={handleAccept} disabled={actionLoading}>
                  <CheckCircle size={18} /> {t('courier.acceptDelivery')}
                </AppButton>
                <AppButton variant="danger" onPress={() => setShowDecline(true)} disabled={actionLoading}>
                  <XCircle size={18} /> {t('courier.decline')}
                </AppButton>
              </View>
            )}

            {shipment.status === 'COURIER_ASSIGNED' && showDecline && (
              <Card>
                <AppText variant="heading" style={{ marginBottom: spacing.sm }}>
                  {t('courier.declineTitle')}
                </AppText>
                <TextInput
                  placeholder={t('courier.declineReasonPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={declineReason}
                  onChangeText={setDeclineReason}
                  style={{
                    backgroundColor: colors.surfaceSolid,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 10,
                    padding: 12,
                    color: colors.text,
                    marginBottom: spacing.md,
                  }}
                />
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <AppButton variant="secondary" onPress={() => setShowDecline(false)} style={{ flex: 1 }}>
                    {t('actions.cancel')}
                  </AppButton>
                  <AppButton variant="danger" onPress={handleDecline} disabled={actionLoading} style={{ flex: 1 }}>
                    {t('courier.confirmDecline')}
                  </AppButton>
                </View>
              </Card>
            )}

            {shipment.status === 'COURIER_ACCEPTED' && (
              <AppButton onPress={handleStartPickup} disabled={actionLoading}>
                <Navigation size={18} /> {t('courier.startPickup')}
              </AppButton>
            )}

            {shipment.status === 'PICKUP_STARTED' && (
              <AppButton onPress={handleConfirmPickup} disabled={actionLoading}>
                <CheckCircle size={18} /> {t('courier.confirmUnitsCollected')}
              </AppButton>
            )}

            {shipment.status === 'PICKED_UP' && (
              <AppButton onPress={handleStartDelivery} disabled={actionLoading}>
                <Navigation size={18} /> {t('courier.startDelivery')}
              </AppButton>
            )}

            {shipment.status === 'IN_TRANSIT' && (
              <>
                <Card style={{ marginBottom: layout.cardGap, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Navigation size={18} color={colors.primary} />
                  <AppText style={{ color: colors.primary, flex: 1 }}>
                    {t('courier.sharingLocation')}
                  </AppText>
                </Card>
                <AppButton onPress={handleArrived} disabled={actionLoading}>
                  <CheckCircle size={18} /> {t('courier.arrivedAtHospital')}
                </AppButton>
              </>
            )}

            {shipment.status === 'ARRIVED_AT_HOSPITAL' && (
              <Card style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
                <CheckCircle size={40} color={colors.success} />
                <AppText variant="heading" style={{ marginTop: spacing.md, textAlign: 'center' }}>
                  {t('courier.awaitingConfirmation')}
                </AppText>
                <AppText muted style={{ marginTop: spacing.xs, textAlign: 'center' }}>
                  {t('courier.awaitingConfirmationHint')}
                </AppText>
              </Card>
            )}

            {['COURIER_ACCEPTED', 'PICKUP_STARTED', 'PICKED_UP', 'IN_TRANSIT'].includes(shipment.status) && !showFail && (
              <AppButton variant="ghost" onPress={() => setShowFail(true)} style={{ marginTop: spacing.md }} disabled={actionLoading}>
                <AlertTriangle size={16} color={colors.danger} /> {t('courier.reportProblem')}
              </AppButton>
            )}

            {showFail && (
              <Card style={{ marginTop: layout.cardGap, borderColor: colors.danger }}>
                <AppText variant="heading" style={{ marginBottom: spacing.sm, color: colors.danger }}>
                  {t('courier.reportProblem')}
                </AppText>
                <TextInput
                  placeholder={t('courier.reportProblemPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={failReason}
                  onChangeText={setFailReason}
                  multiline
                  style={{
                    backgroundColor: colors.surfaceSolid,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 10,
                    padding: 12,
                    color: colors.text,
                    marginBottom: spacing.md,
                    minHeight: 80,
                    textAlignVertical: 'top',
                  }}
                />
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <AppButton variant="secondary" onPress={() => setShowFail(false)} style={{ flex: 1 }}>
                    {t('actions.cancel')}
                  </AppButton>
                  <AppButton variant="danger" onPress={handleFail} disabled={actionLoading} style={{ flex: 1 }}>
                    {t('actions.submit')}
                  </AppButton>
                </View>
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
