import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View, Alert, Pressable, TouchableOpacity } from 'react-native';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Clock,
  MapPin,
  Navigation,
  XCircle,
} from 'lucide-react-native';
import {
  AppButton,
  AppText,
  Badge,
  Card,
  LoadingState,
  Screen,
  ScreenHeader,
} from '../src/components';
import { LocationMap, type MapMarkerPoint } from '../src/components/map/LocationMap';
import { layout, spacing, useTheme } from '../src/theme';
import { useTranslation } from '../src/i18n';
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

/**
 * How long until the hospital needs the units. `requiredBefore` is optional on
 * an emergency, and an expired one shows as "Overdue" rather than a negative
 * count -- the request is still live and still worth answering.
 */
function timeLeftLabel(requiredBefore?: string): string | null {
  if (!requiredBefore) return null;
  const minutes = Math.round((new Date(requiredBefore).getTime() - Date.now()) / 60000);
  if (Number.isNaN(minutes)) return null;
  if (minutes <= 0) return 'Overdue';
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h left`;
  return `${Math.round(hours / 24)}d left`;
}

export default function SosScreen() {
  const { t } = useTranslation();
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
      setError(err.message || t('sos.loadFailed'));
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
        Alert.alert(t('sos.locationPermissionTitle'), t('sos.locationPermissionBody'));
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

  // Read defensively. The declared response type says `locations` and
  // `emergencyRequest` are always present, but the type describes the
  // contract, not what the socket actually delivers -- and an unguarded
  // property access here crashes the whole screen at the worst possible
  // moment, with a donor already en route to a hospital and no error boundary
  // above to catch it.
  const donorPing = tracking?.locations?.[0];
  const trackedHospital = tracking?.emergencyRequest?.hospital;
  const trackingMarkers: MapMarkerPoint[] = tracking
    ? [
        ...(donorPing
          ? [
              {
                id: 'donor',
                latitude: Number(donorPing.latitude),
                longitude: Number(donorPing.longitude),
                label: t('sos.you'),
                variant: 'donor' as const,
              },
            ]
          : []),
        ...(trackedHospital?.latitude && trackedHospital?.longitude
          ? [
              {
                id: 'hospital',
                latitude: Number(trackedHospital.latitude),
                longitude: Number(trackedHospital.longitude),
                label: trackedHospital.name,
                sublabel: trackedHospital.address,
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
      Alert.alert(t('common.error'), err.message || t('sos.viewFailed'));
    }
  };

  const handleAcceptEmergency = async (emergency: EmergencyRequest) => {
    if (!emergency.matchId) return;
    try {
      const response = await acceptEmergency(emergency.matchId);
      await loadEmergencies();
      // Carry the donor straight into their accepted response rather than
      // dropping them back on the list to hunt for it again. They have just
      // committed to travelling to a hospital under time pressure; the next
      // thing they need is "Start Journey", not a list.
      setSelectedEmergency({
        ...emergency,
        responseId: response.id,
        responseStatus: response.status ?? 'ACCEPTED',
      });
      setStatus('responding');
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || t('sos.acceptFailed'));
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
      Alert.alert(t('common.error'), err.message || t('sos.declineFailed'));
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
      Alert.alert(t('common.error'), err.message || t('sos.startJourneyFailed'));
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
      Alert.alert(t('common.error'), err.message || t('sos.arriveFailed'));
    }
  };

  const handleCancelResponse = async (emergency: EmergencyRequest) => {
    if (!emergency.responseId) return;
    Alert.alert(
      t('sos.cancelResponseTitle'),
      t('sos.cancelResponseBody'),
      [
        { text: t('appointment.cancelKeep'), style: 'cancel' },
        {
          text: t('appointment.cancelConfirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelResponse(emergency.responseId!);
              await loadEmergencies();
              setStatus('idle');
              setSelectedEmergency(null);
            } catch (err: any) {
              Alert.alert(t('common.error'), err.message || t('sos.cancelResponseFailed'));
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
      if (emergency.responseStatus === 'ACCEPTED') return t('sos.responseReadyToGo');
      return t(`status.response.${emergency.responseStatus}`);
    }
    if (emergency.matchStatus) {
      switch (emergency.matchStatus) {
        case 'MATCHED':
          return t('sos.matchNew');
        case 'NOTIFIED':
          return t('sos.matchNotified');
        case 'VIEWED':
          return t('sos.matchViewed');
        default:
          return emergency.matchStatus;
      }
    }
    return t(`status.emergency.${emergency.status}`);
  };

  const renderEmergencyCard = (emergency: EmergencyRequest) => {
    // The reference distinguishes urgency by tier, not by a left rule: a
    // critical request is a danger-tinted card, anything else an elevated one.
    const isCritical = emergency.urgencyLevel?.toUpperCase() === 'CRITICAL';
    const rh =
      emergency.rhFactor === 'POSITIVE' ? '+' : emergency.rhFactor === 'NEGATIVE' ? '-' : '';

    return (
      <Card key={emergency.id} tier={isCritical ? 'danger' : 'elevated'}>
        {/* The reference splits the card: what is needed on the left, how
            pressed you are on the right. */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 6 }}>
              <AppText style={{ fontSize: 28, fontWeight: '800', color: colors.danger, letterSpacing: -0.84 }}>
                {emergency.bloodType}
                {rh}
              </AppText>
              <Badge variant={isCritical ? 'danger' : 'warning'}>{emergency.urgencyLevel}</Badge>
            </View>
            <AppText style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
              {emergency.hospital.name}
            </AppText>
            <AppText style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
              {emergency.description ?? emergency.emergencyReference}
            </AppText>
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            {timeLeftLabel(emergency.requiredBefore) && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Clock size={11} color={colors.danger} />
                <AppText style={{ fontSize: 12, fontWeight: '600', color: colors.danger }}>
                  {timeLeftLabel(emergency.requiredBefore)}
                </AppText>
              </View>
            )}
            <AppText style={{ fontSize: 11, color: colors.textMuted, marginTop: 3 }}>
              {emergency.unitsRequired} unit{emergency.unitsRequired !== 1 ? 's' : ''} needed
            </AppText>
            {emergency.donationLocation && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }}>
                <MapPin size={11} color={colors.textMuted} />
                <AppText style={{ fontSize: 11, color: colors.textMuted }}>
                  {emergency.donationLocation}
                </AppText>
              </View>
            )}
          </View>
        </View>

        <View
          style={{
            marginTop: spacing.md,
            paddingTop: spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.borderSubtle,
          }}
        >
          <AppText style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>
            {getStatusLabel(emergency)}
          </AppText>
        </View>
      </Card>
    );
  };

  if (status === 'loading') {
    return (
      <Screen>
        <ScreenHeader title={t('sos.title')} />
        <LoadingState />
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen>
        <ScreenHeader title={t('sos.title')} />
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.lg }}>
          <Card style={{ alignItems: 'center' }}>
            <XCircle size={48} color={colors.danger} />
            <AppText variant="heading" style={{ marginTop: spacing.md, textAlign: 'center' }}>
              {t('sos.loadFailedTitle')}
            </AppText>
            <AppText variant="body" style={{ color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }}>
              {error}
            </AppText>
            <AppButton variant="primary" onPress={loadEmergencies} style={{ marginTop: spacing.lg }}>
              {t('common.retry')}
            </AppButton>
          </Card>
        </View>
      </Screen>
    );
  }

  if (status === 'viewing' && selectedEmergency) {
    return (
      <Screen>
        <ScreenHeader title={t('sos.details')} onBack={() => setStatus('idle')} />
        <ScrollView style={{ flex: 1, padding: spacing.lg }}>
          <Card style={{ marginBottom: layout.cardGap }}>
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
                  <AppText variant="body" style={{ color: colors.textMuted }}>{t('sos.bloodTypeNeeded')}</AppText>
                  <AppText variant="heading" style={{ color: colors.text }}>
                    {selectedEmergency.bloodType}-{selectedEmergency.rhFactor}
                  </AppText>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <AppText variant="body" style={{ color: colors.textMuted }}>{t('sos.unitsRequired')}</AppText>
                  <AppText variant="heading" style={{ color: colors.text }}>
                    {selectedEmergency.unitsRequired}
                  </AppText>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <AppText variant="body" style={{ color: colors.textMuted }}>{t('table.hospital')}</AppText>
                  <AppText variant="heading" style={{ color: colors.text, textAlign: 'right', maxWidth: '60%' }}>
                    {selectedEmergency.hospital.name}
                  </AppText>
                </View>
                {selectedEmergency.donationLocation && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <AppText variant="body" style={{ color: colors.textMuted }}>{t('table.location')}</AppText>
                    <AppText variant="heading" style={{ color: colors.text, textAlign: 'right', maxWidth: '60%' }}>
                      {selectedEmergency.donationLocation}
                    </AppText>
                  </View>
                )}
                {selectedEmergency.description && (
                  <View>
                    <AppText variant="body" style={{ color: colors.textMuted, marginBottom: spacing.xs }}>{t('sos.description')}</AppText>
                    <AppText variant="body" style={{ color: colors.text }}>
                      {selectedEmergency.description}
                    </AppText>
                  </View>
                )}
              </View>
            </View>
          </Card>

          <Card style={{ marginBottom: layout.cardGap }}>
            <AppText variant="heading" style={{ marginBottom: spacing.md }}>
              {t('sos.canYouHelp')}
            </AppText>
            <AppText variant="body" style={{ color: colors.textMuted, marginBottom: spacing.lg }}>
              {t('sos.compatible', {
                bloodType: `${selectedEmergency.bloodType}${
                  selectedEmergency.rhFactor === 'POSITIVE' ? '+' : '-'
                }`,
              })}
            </AppText>
            <View style={{ gap: spacing.sm }}>
              <AppButton
                variant="primary"
                onPress={() => handleAcceptEmergency(selectedEmergency)}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}
              >
                <CheckCircle size={20} />
                {t('sos.yesICanHelp')}
              </AppButton>
              <AppButton
                variant="danger"
                onPress={() => handleDeclineEmergency(selectedEmergency)}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}
              >
                <XCircle size={20} />
                {t('sos.declineRequest')}
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
          title={t('sos.yourResponse')}
          onBack={() => {
            if (status === 'en_route' || status === 'arrived') {
              Alert.alert(
                t('sos.leaveTitle'),
                t('sos.leaveBody'),
                [
                  { text: t('sos.stay'), style: 'cancel' },
                  { text: t('sos.leave'), style: 'destructive', onPress: () => setStatus('idle') },
                ]
              );
            } else {
              setStatus('idle');
            }
          }}
        />
        <ScrollView style={{ flex: 1, padding: spacing.lg }}>
          <Card style={{ marginBottom: layout.cardGap }}>
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
                {t('sos.responseAccepted')}
              </AppText>
              <AppText variant="body" style={{ color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }}>
                {t('sos.responseAcceptedBody')}
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
            <Card style={{ marginBottom: layout.cardGap, padding: 0, overflow: 'hidden' }}>
              <LocationMap markers={trackingMarkers} height={200} />
            </Card>
          )}

          <Card style={{ marginBottom: layout.cardGap }}>
            <AppText variant="heading" style={{ marginBottom: spacing.md }}>
              {t('sos.whatToDoNext')}
            </AppText>
            <View style={{ gap: spacing.md }}>
              {status === 'responding' && (
                <AppButton
                  variant="primary"
                  onPress={() => handleStartJourney(selectedEmergency)}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}
                >
                  <Navigation size={20} />
                  {t('sos.startJourney')}
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
                      {t('sos.onYourWay')}
                    </AppText>
                  </View>
                  <AppButton
                    variant="primary"
                    onPress={() => handleArrived(selectedEmergency)}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}
                  >
                    <CheckCircle size={20} />
                    {t('sos.iHaveArrived')}
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
                    {t('sos.checkInAtReception')}
                  </AppText>
                  <AppText variant="body" style={{ color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' }}>
                    {t('sos.staffNotified')}
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
                  {t('sos.cancelMyResponse')}
                </AppButton>
              )}
            </View>
          </Card>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <LinearGradient
        colors={[colors.dangerMuted, 'transparent']}
        style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.lg }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('auth.a11y.goBack')}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            minHeight: 44,
            alignSelf: 'flex-start',
            paddingRight: spacing.sm,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <ArrowLeft size={16} color={colors.primary} strokeWidth={2.5} />
          <AppText style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>{t('actions.back')}</AppText>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: spacing.md }}>
          <View>
            {/* The reference rings the mark, so it reads as live rather than
                as one more icon in a header. */}
            <View
              style={{
                position: 'absolute',
                top: -8,
                left: -8,
                right: -8,
                bottom: -8,
                borderRadius: 34,
                borderWidth: 2,
                borderColor: 'rgba(216, 83, 96, 0.4)',
              }}
              pointerEvents="none"
            />
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: colors.danger,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: colors.danger,
                shadowOpacity: 0.5,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 6 },
                elevation: 6,
              }}
            >
              <AlertTriangle size={26} color="#FFFFFF" />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <AppText style={{ fontSize: 24, fontWeight: '800', letterSpacing: -0.48, color: colors.text }}>
              {t('sos.title')}
            </AppText>
            <AppText muted style={{ fontSize: 13, marginTop: 2 }}>
              {emergencies.length > 0
                ? t('units.activeRequestsNearYou', { count: emergencies.length })
                : t('sos.noActiveRequests')}
            </AppText>
          </View>
        </View>
      </LinearGradient>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {emergencies.length > 0 ? (
          <>
            <AppText variant="caption" style={{ color: colors.textMuted, marginBottom: spacing.sm }}>
              {t('sos.activeNearYou')}
            </AppText>
            {emergencies.map((emergency) => (
              <TouchableOpacity
                key={emergency.id}
                activeOpacity={0.8}
                onPress={() => handleViewMatch(emergency)}
              >
                {renderEmergencyCard(emergency)}
              </TouchableOpacity>
            ))}
          </>
        ) : (
          <Card style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
            <AlertTriangle size={48} color={colors.textMuted} />
            <AppText variant="heading" style={{ marginTop: spacing.md }}>
              {t('sos.noActiveEmergencies')}
            </AppText>
            <AppText variant="body" style={{ color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' }}>
              {t('sos.noActiveEmergenciesHint')}
            </AppText>
          </Card>
        )}

        {myResponses.length > 0 && (
          <>
            <AppText variant="caption" style={{ color: colors.textMuted, marginBottom: spacing.sm, marginTop: spacing.lg }}>
              {t('sos.yourActiveResponses')}
            </AppText>
            {myResponses.map((emergency) => (
              <TouchableOpacity
                key={emergency.id}
                activeOpacity={0.8}
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
              </TouchableOpacity>
            ))}
          </>
        )}

        <AppButton variant="secondary" onPress={loadEmergencies} style={{ marginTop: spacing.sm }}>
          {t('actions.refresh')}
        </AppButton>

        <Card style={{ paddingVertical: 12, paddingHorizontal: 14 }}>
          <AppText
            style={{ fontSize: 12, lineHeight: 19, color: colors.textMuted, textAlign: 'center' }}
          >
            {t('sos.commitmentNotice')}
          </AppText>
        </Card>
      </ScrollView>
    </Screen>
  );
}
