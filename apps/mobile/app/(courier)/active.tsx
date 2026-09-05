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

const STATUS_LABEL: Record<string, string> = {
  COURIER_ASSIGNED: 'New Assignment',
  COURIER_ACCEPTED: 'Accepted',
  PICKUP_STARTED: 'At Pickup',
  PICKED_UP: 'Picked Up',
  IN_TRANSIT: 'In Transit',
  ARRIVED_AT_HOSPITAL: 'Arrived',
};

function unitsSummary(shipment: Shipment): string {
  const counts = new Map<string, number>();
  for (const unit of shipment.units ?? []) {
    const bloodType = unit.bloodUnit ? `${unit.bloodUnit.bloodType}${unit.bloodUnit.rhFactor === 'POSITIVE' ? '+' : '-'}` : 'unit';
    counts.set(bloodType, (counts.get(bloodType) ?? 0) + 1);
  }
  if (counts.size === 0) return `${shipment.units?.length ?? 0} unit(s)`;
  return Array.from(counts.entries()).map(([type, count]) => `${count} ${type}`).join(', ');
}

export default function CourierActive() {
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
        Alert.alert('Location Permission Needed', 'DONOR needs your location while in transit so the hospital can track the delivery.');
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
                label: 'You',
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
      Alert.alert('Error', err?.message || 'Something went wrong. Please try again.');
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
      Alert.alert('Error', err?.message || 'Failed to decline shipment');
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
      Alert.alert('Reason required', 'Please describe what went wrong.');
      return;
    }
    setActionLoading(true);
    try {
      await failShipment(shipment.id, { reason: failReason.trim() });
      setShowFail(false);
      setFailReason('');
      await load();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to report the problem');
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Screen>
        <AppHeader title="Active Delivery" />
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <AppHeader title="Active Delivery" />
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
                title="Couldn't load your delivery"
                description="Something went wrong reaching the server. Check your connection and try again."
              />
              <AppButton variant="secondary" onPress={load} style={{ marginTop: spacing.md }}>
                Retry
              </AppButton>
            </>
          ) : (
            <EmptyState
              icon={Package}
              title="No active delivery"
              description="When a blood center assigns you a shipment, it will show up here."
            />
          )
        ) : (
          <>
            <Card style={{ marginBottom: layout.cardGap }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
                <AppText variant="heading">{shipment.shipmentReference}</AppText>
                <Badge variant={shipment.status === 'IN_TRANSIT' ? 'primary' : 'secondary'}>
                  {STATUS_LABEL[shipment.status] || shipment.status}
                </Badge>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                <Droplet size={16} color={colors.primary} />
                <AppText muted>{unitsSummary(shipment)}</AppText>
              </View>

              {shipment.sourceOrganization && (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm }}>
                  <Building2 size={16} color={colors.textMuted} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <AppText style={{ fontSize: 13 }}>Pickup: {shipment.sourceOrganization.name}</AppText>
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
                    <AppText style={{ fontSize: 13 }}>Deliver to: {shipment.destinationOrganization.name}</AppText>
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
                  <CheckCircle size={18} /> Accept Delivery
                </AppButton>
                <AppButton variant="danger" onPress={() => setShowDecline(true)} disabled={actionLoading}>
                  <XCircle size={18} /> Decline
                </AppButton>
              </View>
            )}

            {shipment.status === 'COURIER_ASSIGNED' && showDecline && (
              <Card>
                <AppText variant="heading" style={{ marginBottom: spacing.sm }}>Decline this delivery?</AppText>
                <TextInput
                  placeholder="Reason (optional)"
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
                    Cancel
                  </AppButton>
                  <AppButton variant="danger" onPress={handleDecline} disabled={actionLoading} style={{ flex: 1 }}>
                    Confirm Decline
                  </AppButton>
                </View>
              </Card>
            )}

            {shipment.status === 'COURIER_ACCEPTED' && (
              <AppButton onPress={handleStartPickup} disabled={actionLoading}>
                <Navigation size={18} /> Start Pickup
              </AppButton>
            )}

            {shipment.status === 'PICKUP_STARTED' && (
              <AppButton onPress={handleConfirmPickup} disabled={actionLoading}>
                <CheckCircle size={18} /> Confirm Units Collected
              </AppButton>
            )}

            {shipment.status === 'PICKED_UP' && (
              <AppButton onPress={handleStartDelivery} disabled={actionLoading}>
                <Navigation size={18} /> Start Delivery
              </AppButton>
            )}

            {shipment.status === 'IN_TRANSIT' && (
              <>
                <Card style={{ marginBottom: layout.cardGap, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Navigation size={18} color={colors.primary} />
                  <AppText style={{ color: colors.primary, flex: 1 }}>
                    Sharing your live location with the hospital
                  </AppText>
                </Card>
                <AppButton onPress={handleArrived} disabled={actionLoading}>
                  <CheckCircle size={18} /> Arrived at Hospital
                </AppButton>
              </>
            )}

            {shipment.status === 'ARRIVED_AT_HOSPITAL' && (
              <Card style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
                <CheckCircle size={40} color={colors.success} />
                <AppText variant="heading" style={{ marginTop: spacing.md, textAlign: 'center' }}>
                  Awaiting hospital confirmation
                </AppText>
                <AppText muted style={{ marginTop: spacing.xs, textAlign: 'center' }}>
                  Hand off the units to hospital staff. They'll confirm receipt.
                </AppText>
              </Card>
            )}

            {['COURIER_ACCEPTED', 'PICKUP_STARTED', 'PICKED_UP', 'IN_TRANSIT'].includes(shipment.status) && !showFail && (
              <AppButton variant="ghost" onPress={() => setShowFail(true)} style={{ marginTop: spacing.md }} disabled={actionLoading}>
                <AlertTriangle size={16} color={colors.danger} /> Report a Problem
              </AppButton>
            )}

            {showFail && (
              <Card style={{ marginTop: layout.cardGap, borderColor: colors.danger }}>
                <AppText variant="heading" style={{ marginBottom: spacing.sm, color: colors.danger }}>
                  Report a Problem
                </AppText>
                <TextInput
                  placeholder="What went wrong?"
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
                    Cancel
                  </AppButton>
                  <AppButton variant="danger" onPress={handleFail} disabled={actionLoading} style={{ flex: 1 }}>
                    Submit
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
