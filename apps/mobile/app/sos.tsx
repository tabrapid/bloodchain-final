import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View, Alert } from 'react-native';
import * as Location from 'expo-location';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
  Navigation,
  XCircle,
} from 'lucide-react-native';
import { AppButton, AppText, Card, LoadingState, Screen, ScreenHeader } from '../src/components';
import { LocationMap, type MapMarkerPoint } from '../src/components/map/LocationMap';
import { spacing, useTheme } from '../src/theme';
import {
  acceptEmergency,
  arriveAtHospital,
  cancelResponse,
  declineEmergency,
  DonorEmergenciesResponse,
  DonorTrackingResponse,
  EmergencyRequest,
  getDonorEmergencies,
  getDonorTracking,
  startJourney,
  updateLocation,
  viewEmergencyMatch,
} from '../src/api/emergency';

const LOCATION_UPDATE_INTERVAL_MS = 15000;
const LOCATION_UPDATE_DISTANCE_M = 50;

type EmergencyStatus = 'idle' | 'loading' | 'viewing' | 'responding' | 'en_route' | 'arrived' | 'error';

export default function SosScreen() {
  const { colors } = useTheme();
  const [status, setStatus] = useState<EmergencyStatus>('idle');
  const [emergencies, setEmergencies] = useState<EmergencyRequest[]>([]);
  const [myResponses, setMyResponses] = useState<EmergencyRequest[]>([]);
  const [selectedEmergency, setSelectedEmergency] = useState<EmergencyRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState<DonorTrackingResponse | null>(null);

  const loadEmergencies = useCallback(async () => {
    setStatus('loading');
    try {
      const response: DonorEmergenciesResponse = await getDonorEmergencies();
      setEmergencies(response.active);
      setMyResponses(response.myResponses);
      setStatus('idle');
    } catch (err: any) {
      setError(err.message || 'Failed to load emergencies');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    loadEmergencies();
  }, [loadEmergencies]);

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    const responseId = selectedEmergency?.responseId;

    async function startTracking() {
      const { status: permissionStatus } = await Location.requestForegroundPermissionsAsync();
      if (permissionStatus !== 'granted') {
        Alert.alert(
          'Location Permission Needed',
          'DONOR needs your location while en route so the hospital can track your journey.',
        );
        return;
      }

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: LOCATION_UPDATE_INTERVAL_MS,
          distanceInterval: LOCATION_UPDATE_DISTANCE_M,
        },
        (position) => {
          if (!responseId) return;
          updateLocation(responseId, {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy ?? undefined,
            heading: position.coords.heading ?? undefined,
            // expo-location reports speed in meters/second; stored server-side as km/h.
            speed: position.coords.speed != null ? position.coords.speed * 3.6 : undefined,
          }).catch(() => {
            // Best-effort: a single missed location update shouldn't interrupt the journey.
          });
        },
      );
    }

    if (status === 'en_route' && responseId) {
      startTracking();
    }

    return () => {
      locationSubscription.current?.remove();
      locationSubscription.current = null;
    };
  }, [status, selectedEmergency?.responseId]);

  useEffect(() => {
    const responseId = selectedEmergency?.responseId;
    if (!responseId || !['responding', 'en_route', 'arrived'].includes(status)) {
      setTracking(null);
      return;
    }

    let cancelled = false;
    const poll = async () => {
      try {
        const result = await getDonorTracking(responseId);
        if (!cancelled) setTracking(result);
      } catch {
        // Best-effort: the response card below still works from local state alone.
      }
    };

    poll();
    const interval = setInterval(poll, LOCATION_UPDATE_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [status, selectedEmergency?.responseId]);

  const trackingMarkers: MapMarkerPoint[] = tracking
    ? [
        ...(tracking.locations[0]
          ? [
              {
                id: 'donor',
                latitude: Number(tracking.locations[0].latitude),
                longitude: Number(tracking.locations[0].longitude),
                label: 'You',
                variant: 'donor' as const,
              },
            ]
          : []),
        ...(tracking.emergencyRequest.hospital.latitude && tracking.emergencyRequest.hospital.longitude
          ? [
              {
                id: 'hospital',
                latitude: Number(tracking.emergencyRequest.hospital.latitude),
                longitude: Number(tracking.emergencyRequest.hospital.longitude),
                label: tracking.emergencyRequest.hospital.name,
                sublabel: tracking.emergencyRequest.hospital.address,
                variant: 'hospital' as const,
              },
            ]
          : []),
      ]
    : [];

  const handleViewMatch = async (emergency: EmergencyRequest) => {
    if (!emergency.matchId) return;
    try {
      await viewEmergencyMatch(emergency.matchId);
      setSelectedEmergency(emergency);
      setStatus('viewing');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to view emergency');
    }
  };

  const handleAcceptEmergency = async (emergency: EmergencyRequest) => {
    if (!emergency.matchId) return;
    try {
      await acceptEmergency(emergency.matchId);
      await loadEmergencies();
      Alert.alert('Success', 'You have accepted this emergency request. Please proceed to the hospital.');
      setStatus('idle');
      setSelectedEmergency(null);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to accept emergency');
    }
  };

  const handleDeclineEmergency = async (emergency: EmergencyRequest) => {
    if (!emergency.matchId) return;
    try {
      await declineEmergency(emergency.matchId);
      await loadEmergencies();
      setStatus('idle');
      setSelectedEmergency(null);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to decline emergency');
    }
  };

  const handleStartJourney = async (emergency: EmergencyRequest) => {
    if (!emergency.responseId) return;
    try {
      await startJourney(emergency.responseId);
      await loadEmergencies();
      setSelectedEmergency({ ...emergency, responseStatus: 'EN_ROUTE' });
      setStatus('en_route');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to start journey');
    }
  };

  const handleArrived = async (emergency: EmergencyRequest) => {
    if (!emergency.responseId) return;
    try {
      await arriveAtHospital(emergency.responseId);
      await loadEmergencies();
      setSelectedEmergency({ ...emergency, responseStatus: 'ARRIVED' });
      setStatus('arrived');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to confirm arrival');
    }
  };

  const handleCancelResponse = async (emergency: EmergencyRequest) => {
    if (!emergency.responseId) return;
    Alert.alert(
      'Cancel Response',
      'Are you sure you want to cancel your response to this emergency?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelResponse(emergency.responseId!);
              await loadEmergencies();
              setStatus('idle');
              setSelectedEmergency(null);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to cancel response');
            }
          },
        },
      ]
    );
  };

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return { border: colors.danger, bg: colors.dangerMuted, text: colors.onMuted.danger };
      case 'HIGH':
        return { border: colors.warning, bg: colors.warningMuted, text: colors.onMuted.warning };
      case 'MEDIUM':
        return { border: colors.secondary, bg: colors.secondaryMuted, text: colors.onMuted.secondary };
      default:
        return { border: colors.textMuted, bg: colors.surfaceElevated, text: colors.textMuted };
    }
  };

  const getStatusLabel = (emergency: EmergencyRequest) => {
    if (emergency.responseStatus) {
      switch (emergency.responseStatus) {
        case 'ACCEPTED':
          return 'Accepted - Ready to go';
        case 'EN_ROUTE':
          return 'En Route to Hospital';
        case 'ARRIVED':
          return 'Arrived at Hospital';
        case 'DONATION_STARTED':
          return 'Donation in Progress';
        case 'COMPLETED':
          return 'Donation Completed';
        case 'CANCELLED':
          return 'Response Cancelled';
        default:
          return emergency.responseStatus;
      }
    }
    if (emergency.matchStatus) {
      switch (emergency.matchStatus) {
        case 'MATCHED':
          return 'New Match - Tap to view';
        case 'NOTIFIED':
          return 'Notification Sent';
        case 'VIEWED':
          return 'Viewed - Accept or Decline';
        default:
          return emergency.matchStatus;
      }
    }
    return emergency.status;
  };

  const renderEmergencyCard = (emergency: EmergencyRequest) => (
    <Card
      key={emergency.id}
      style={{
        marginBottom: spacing.md,
        borderLeftWidth: 4,
        borderLeftColor: getUrgencyColor(emergency.urgencyLevel).border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: getUrgencyColor(emergency.urgencyLevel).bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AlertTriangle size={24} color={getUrgencyColor(emergency.urgencyLevel).text} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <AppText variant="heading" style={{ color: colors.text }}>
              {emergency.emergencyReference}
            </AppText>
            <View
              style={{
                backgroundColor: getUrgencyColor(emergency.urgencyLevel).bg,
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
                borderRadius: 4,
              }}
            >
              <AppText
                variant="caption"
                style={{ color: getUrgencyColor(emergency.urgencyLevel).text, fontWeight: '600' }}
              >
                {emergency.urgencyLevel}
              </AppText>
            </View>
          </View>
          <AppText variant="body" style={{ color: colors.textMuted, marginTop: spacing.xs }}>
            {emergency.bloodType}-{emergency.rhFactor} • {emergency.unitsRequired} unit
            {emergency.unitsRequired !== 1 ? 's' : ''}
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm }}>
            <MapPin size={12} color={colors.textMuted} />
            <AppText variant="caption" style={{ color: colors.textMuted }}>
              {emergency.hospital.name}
            </AppText>
          </View>
          {emergency.donationLocation && (
            <AppText variant="caption" style={{ color: colors.textMuted, marginTop: spacing.xs }}>
              {emergency.donationLocation}
            </AppText>
          )}
          <View
            style={{
              marginTop: spacing.md,
              paddingTop: spacing.sm,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <AppText variant="caption" style={{ color: colors.primary, fontWeight: '600' }}>
              {getStatusLabel(emergency)}
            </AppText>
          </View>
        </View>
      </View>
    </Card>
  );

  if (status === 'loading') {
    return (
      <Screen>
        <ScreenHeader title="Emergency SOS" />
        <LoadingState />
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen>
        <ScreenHeader title="Emergency SOS" />
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.lg }}>
          <Card style={{ alignItems: 'center' }}>
            <XCircle size={48} color={colors.danger} />
            <AppText variant="heading" style={{ marginTop: spacing.md, textAlign: 'center' }}>
              Error Loading Emergencies
            </AppText>
            <AppText variant="body" style={{ color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }}>
              {error}
            </AppText>
            <AppButton variant="primary" onPress={loadEmergencies} style={{ marginTop: spacing.lg }}>
              Try Again
            </AppButton>
          </Card>
        </View>
      </Screen>
    );
  }

  if (status === 'viewing' && selectedEmergency) {
    return (
      <Screen>
        <ScreenHeader title="Emergency Details" onBack={() => setStatus('idle')} />
        <ScrollView style={{ flex: 1, padding: spacing.lg }}>
          <Card style={{ marginBottom: spacing.lg }}>
            <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: getUrgencyColor(selectedEmergency.urgencyLevel).bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertTriangle size={32} color={getUrgencyColor(selectedEmergency.urgencyLevel).text} />
              </View>
              <AppText variant="heading" style={{ marginTop: spacing.md, textAlign: 'center' }}>
                {selectedEmergency.emergencyReference}
              </AppText>
              <View
                style={{
                  backgroundColor: getUrgencyColor(selectedEmergency.urgencyLevel).bg,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                  borderRadius: 8,
                  marginTop: spacing.sm,
                }}
              >
                <AppText
                  style={{
                    color: getUrgencyColor(selectedEmergency.urgencyLevel).text,
                    fontWeight: '700',
                  }}
                >
                  {selectedEmergency.urgencyLevel} PRIORITY
                </AppText>
              </View>
            </View>

            <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg }}>
              <View style={{ gap: spacing.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <AppText variant="body" style={{ color: colors.textMuted }}>Blood Type Needed</AppText>
                  <AppText variant="heading" style={{ color: colors.text }}>
                    {selectedEmergency.bloodType}-{selectedEmergency.rhFactor}
                  </AppText>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <AppText variant="body" style={{ color: colors.textMuted }}>Units Required</AppText>
                  <AppText variant="heading" style={{ color: colors.text }}>
                    {selectedEmergency.unitsRequired}
                  </AppText>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <AppText variant="body" style={{ color: colors.textMuted }}>Hospital</AppText>
                  <AppText variant="heading" style={{ color: colors.text, textAlign: 'right', maxWidth: '60%' }}>
                    {selectedEmergency.hospital.name}
                  </AppText>
                </View>
                {selectedEmergency.donationLocation && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <AppText variant="body" style={{ color: colors.textMuted }}>Location</AppText>
                    <AppText variant="heading" style={{ color: colors.text, textAlign: 'right', maxWidth: '60%' }}>
                      {selectedEmergency.donationLocation}
                    </AppText>
                  </View>
                )}
                {selectedEmergency.description && (
                  <View>
                    <AppText variant="body" style={{ color: colors.textMuted, marginBottom: spacing.xs }}>Description</AppText>
                    <AppText variant="body" style={{ color: colors.text }}>
                      {selectedEmergency.description}
                    </AppText>
                  </View>
                )}
              </View>
            </View>
          </Card>

          <Card style={{ marginBottom: spacing.lg }}>
            <AppText variant="heading" style={{ marginBottom: spacing.md }}>
              Are you able to help?
            </AppText>
            <AppText variant="body" style={{ color: colors.textMuted, marginBottom: spacing.lg }}>
              Your blood type ({selectedEmergency.bloodType}
              {selectedEmergency.rhFactor === 'POSITIVE' ? '+' : '-'}) is compatible with this request.
            </AppText>
            <View style={{ gap: spacing.sm }}>
              <AppButton
                variant="primary"
                onPress={() => handleAcceptEmergency(selectedEmergency)}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}
              >
                <CheckCircle size={20} />
                Yes, I Can Help
              </AppButton>
              <AppButton
                variant="danger"
                onPress={() => handleDeclineEmergency(selectedEmergency)}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}
              >
                <XCircle size={20} />
                Decline Request
              </AppButton>
            </View>
          </Card>
        </ScrollView>
      </Screen>
    );
  }

  if (['responding', 'en_route', 'arrived'].includes(status) && selectedEmergency) {
    return (
      <Screen>
        <ScreenHeader
          title="Your Response"
          onBack={() => {
            if (status === 'en_route' || status === 'arrived') {
              Alert.alert(
                'Go Back',
                'Are you sure? You will lose your progress.',
                [
                  { text: 'Stay', style: 'cancel' },
                  { text: 'Leave', style: 'destructive', onPress: () => setStatus('idle') },
                ]
              );
            } else {
              setStatus('idle');
            }
          }}
        />
        <ScrollView style={{ flex: 1, padding: spacing.lg }}>
          <Card style={{ marginBottom: spacing.lg }}>
            <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: colors.successMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckCircle size={40} color={colors.onMuted.success} />
              </View>
              <AppText variant="heading" style={{ marginTop: spacing.md, textAlign: 'center' }}>
                Response Accepted
              </AppText>
              <AppText variant="body" style={{ color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }}>
                You have committed to help. Please proceed to the hospital.
              </AppText>
            </View>

            <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg }}>
              <View style={{ gap: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <MapPin size={16} color={colors.primary} />
                  <AppText variant="heading">{selectedEmergency.hospital.name}</AppText>
                </View>
                {selectedEmergency.donationLocation && (
                  <AppText variant="body" style={{ color: colors.textMuted, paddingLeft: spacing.xl + spacing.xs }}>
                    {selectedEmergency.donationLocation}
                  </AppText>
                )}
              </View>
            </View>
          </Card>

          {trackingMarkers.length > 0 && (
            <Card style={{ marginBottom: spacing.lg, padding: 0, overflow: 'hidden' }}>
              <LocationMap markers={trackingMarkers} height={200} />
            </Card>
          )}

          <Card style={{ marginBottom: spacing.lg }}>
            <AppText variant="heading" style={{ marginBottom: spacing.md }}>
              What to do next
            </AppText>
            <View style={{ gap: spacing.md }}>
              {status === 'responding' && (
                <AppButton
                  variant="primary"
                  onPress={() => handleStartJourney(selectedEmergency)}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}
                >
                  <Navigation size={20} />
                  Start Journey
                </AppButton>
              )}
              {status === 'en_route' && (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                      padding: spacing.md,
                      backgroundColor: colors.primaryMuted,
                      borderRadius: 8,
                    }}
                  >
                    <Navigation size={20} color={colors.onMuted.primary} />
                    <AppText variant="body" style={{ color: colors.onMuted.primary, flex: 1 }}>
                      You are on your way to the hospital
                    </AppText>
                  </View>
                  <AppButton
                    variant="primary"
                    onPress={() => handleArrived(selectedEmergency)}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}
                  >
                    <CheckCircle size={20} />
                    I Have Arrived
                  </AppButton>
                </>
              )}
              {status === 'arrived' && (
                <View
                  style={{
                    alignItems: 'center',
                    padding: spacing.lg,
                    backgroundColor: colors.successMuted,
                    borderRadius: 8,
                  }}
                >
                  <CheckCircle size={40} color={colors.onMuted.success} />
                  <AppText variant="heading" style={{ marginTop: spacing.md }}>
                    Please check in at the reception
                  </AppText>
                  <AppText variant="body" style={{ color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' }}>
                    The hospital staff has been notified of your arrival.
                  </AppText>
                </View>
              )}
              {(status === 'responding' || status === 'en_route' || status === 'arrived') && (
                <AppButton
                  variant="ghost"
                  onPress={() => handleCancelResponse(selectedEmergency)}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}
                >
                  <XCircle size={20} />
                  Cancel My Response
                </AppButton>
              )}
            </View>
          </Card>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Emergency SOS" />
      <ScrollView style={{ flex: 1, padding: spacing.lg }}>
        {emergencies.length > 0 ? (
          <>
            <AppText variant="caption" style={{ color: colors.textMuted, marginBottom: spacing.sm }}>
              ACTIVE EMERGENCY REQUESTS NEAR YOU
            </AppText>
            {emergencies.map((emergency) => (
              <View key={emergency.id} style={{ marginBottom: spacing.md }}>
                <AppButton
                  variant="secondary"
                  onPress={() => handleViewMatch(emergency)}
                >
                  {renderEmergencyCard(emergency)}
                </AppButton>
              </View>
            ))}
          </>
        ) : (
          <Card style={{ alignItems: 'center', paddingVertical: spacing.xl, marginBottom: spacing.lg }}>
            <AlertTriangle size={48} color={colors.textMuted} />
            <AppText variant="heading" style={{ marginTop: spacing.md }}>
              No Active Emergencies
            </AppText>
            <AppText variant="body" style={{ color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' }}>
              There are no emergency blood requests matching your blood type right now.
            </AppText>
          </Card>
        )}

        {myResponses.length > 0 && (
          <>
            <AppText variant="caption" style={{ color: colors.textMuted, marginBottom: spacing.sm, marginTop: spacing.lg }}>
              YOUR ACTIVE RESPONSES
            </AppText>
            {myResponses.map((emergency) => (
              <View key={emergency.id} style={{ marginBottom: spacing.md }}>
                <AppButton
                  variant="secondary"
                  onPress={() => {
                    setSelectedEmergency(emergency);
                    if (emergency.responseStatus === 'EN_ROUTE') {
                      setStatus('en_route');
                    } else if (emergency.responseStatus === 'ARRIVED') {
                      setStatus('arrived');
                    } else {
                      setStatus('responding');
                    }
                  }}
                >
                  {renderEmergencyCard(emergency)}
                </AppButton>
              </View>
            ))}
          </>
        )}

        <AppButton variant="secondary" onPress={loadEmergencies} style={{ marginTop: spacing.md }}>
          <Clock size={16} />
          Refresh
        </AppButton>
      </ScrollView>
    </Screen>
  );
}
