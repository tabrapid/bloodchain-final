import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
  Navigation,
  ShieldCheck,
  XCircle,
} from 'lucide-react-native';
import {
  Badge,
  Banner,
  Button,
  ConfirmationSheet,
  EmergencyBanner,
  EmptyState,
  ErrorState,
  LoadingSection,
  PermissionExplainer,
  Row,
  ScreenHeader,
  ScrollScreen,
  SectionHeader,
  Stack,
  Surface,
  Text,
  ValueText,
  iconSize,
  motion,
  radius,
  space,
  useDesign,
} from '../src/design';
import { LocationMap, type MapMarkerPoint } from '../src/components/map/LocationMap';
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
 * Whether the donor has been asked about sharing their position on this
 * journey, and what they said.
 *
 * `unasked` matters as its own value: it is what triggers the explanation, and
 * it is different from having said no.
 */
type LocationConsent = 'unasked' | 'granted' | 'declined' | 'blocked';

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

/**
 * Emergency SOS, rebuilt for V2.
 *
 * The most consequential screen in the app: a donor deciding, under time
 * pressure, whether to travel to a hospital for a life-critical request. Three
 * rules shape it, and none of them is a style preference.
 *
 * THE DONOR CAN NEVER COMPLETE A DONATION. The response advances
 * ACCEPTED -> EN_ROUTE -> ARRIVED from here, and DONATION_STARTED ->
 * COMPLETED only from staff-side systems. Arrival is the end of the donor's
 * authority; a "mark as donated" control anywhere on this screen would let
 * someone credit themselves with a donation that never happened.
 *
 * THE MAP SHOWS POSITIONS AND NOTHING ELSE. No route line, no distance, no
 * estimated arrival. The app has two coordinates and no routing engine, so any
 * line between them would be a straight one drawn over buildings, and any ETA
 * would be invented. A donor who trusts an invented ETA arrives late to an
 * emergency. `LocationMap` can draw a connecting line; it is deliberately not
 * asked to, and the map carries a caption saying what it is.
 *
 * LOCATION IS ASKED FOR IN WORDS FIRST. The operating system's prompt is one
 * line, and on iOS it is one chance -- deny it and it never appears again. So
 * the reason is explained in the app, where there is room to say what is sent,
 * to whom, and when it stops, and where "Not now" costs the donor nothing. It
 * is asked AFTER the journey has started, never as a gate on starting it: a
 * donor who will not share their position is still travelling to a hospital,
 * and blocking the commitment on a permission dialog would be both a dark
 * pattern and a worse outcome for the patient.
 */
export default function SosScreen() {
  const { t } = useTranslation();
  const { colors } = useDesign();
  const [status, setStatus] = useState<EmergencyStatus>('idle');
  const [emergencies, setEmergencies] = useState<EmergencyRequest[]>([]);
  const [myResponses, setMyResponses] = useState<EmergencyRequest[]>([]);
  const [selectedEmergency, setSelectedEmergency] = useState<EmergencyRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [tracking, setTracking] = useState<DonorTrackingResponse | null>(null);
  const [locationConsent, setLocationConsent] = useState<LocationConsent>('unasked');
  const [explainerVisible, setExplainerVisible] = useState(false);
  const [cancelVisible, setCancelVisible] = useState(false);
  const [cancelling, setCancelling] = useState(false);

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

  /**
   * Ask, once, when the journey begins.
   *
   * Gated on `unasked` so that leaving and returning to the screen does not
   * re-open the sheet on someone who already said no -- being asked twice is
   * how a polite request becomes nagging.
   */
  useEffect(() => {
    if (status === 'en_route' && locationConsent === 'unasked') {
      setExplainerVisible(true);
    }
  }, [status, locationConsent]);

  useEffect(() => {
    const responseId = selectedEmergency?.responseId;

    async function startTracking() {
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
            // Best-effort: a single missed update shouldn't interrupt the journey.
          });
        },
      );
    }

    if (status === 'en_route' && responseId && locationConsent === 'granted') {
      startTracking();
    }

    return () => {
      locationSubscription.current?.remove();
      locationSubscription.current = null;
    };
  }, [status, selectedEmergency?.responseId, locationConsent]);

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
  // moment, with a donor already en route and no error boundary above it.
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

  const onAllowLocation = async () => {
    setExplainerVisible(false);
    const { status: permission } = await Location.requestForegroundPermissionsAsync();
    setLocationConsent(permission === 'granted' ? 'granted' : 'blocked');
  };

  const handleViewMatch = async (emergency: EmergencyRequest) => {
    if (!emergency.matchId) return;
    setActionError(null);
    try {
      await viewEmergencyMatch(emergency.matchId);
      setSelectedEmergency(emergency);
      setStatus('viewing');
    } catch (err: any) {
      setActionError(err.message || t('sos.viewFailed'));
    }
  };

  const handleAcceptEmergency = async (emergency: EmergencyRequest) => {
    if (!emergency.matchId) return;
    setActionError(null);
    try {
      const response = await acceptEmergency(emergency.matchId);
      await loadEmergencies();
      // Carry the donor straight into their accepted response rather than
      // dropping them back on the list to hunt for it again. They have just
      // committed to travelling to a hospital under time pressure; the next
      // thing they need is "Start journey", not a list.
      setSelectedEmergency({
        ...emergency,
        responseId: response.id,
        responseStatus: response.status ?? 'ACCEPTED',
      });
      setStatus('responding');
    } catch (err: any) {
      setActionError(err.message || t('sos.acceptFailed'));
    }
  };

  const handleDeclineEmergency = async (emergency: EmergencyRequest) => {
    if (!emergency.matchId) return;
    setActionError(null);
    try {
      await declineEmergency(emergency.matchId);
      await loadEmergencies();
      setStatus('idle');
      setSelectedEmergency(null);
    } catch (err: any) {
      setActionError(err.message || t('sos.declineFailed'));
    }
  };

  const handleStartJourney = async (emergency: EmergencyRequest) => {
    if (!emergency.responseId) return;
    setActionError(null);
    try {
      await startJourney(emergency.responseId);
      await loadEmergencies();
      setSelectedEmergency({ ...emergency, responseStatus: 'EN_ROUTE' });
      setStatus('en_route');
    } catch (err: any) {
      setActionError(err.message || t('sos.startJourneyFailed'));
    }
  };

  const handleArrived = async (emergency: EmergencyRequest) => {
    if (!emergency.responseId) return;
    setActionError(null);
    try {
      await arriveAtHospital(emergency.responseId);
      await loadEmergencies();
      setSelectedEmergency({ ...emergency, responseStatus: 'ARRIVED' });
      setStatus('arrived');
    } catch (err: any) {
      setActionError(err.message || t('sos.arriveFailed'));
    }
  };

  const confirmCancelResponse = async () => {
    const responseId = selectedEmergency?.responseId;
    if (!responseId) return;
    setCancelling(true);
    try {
      await cancelResponse(responseId);
      await loadEmergencies();
      setCancelVisible(false);
      setStatus('idle');
      setSelectedEmergency(null);
      setLocationConsent('unasked');
    } catch (err: any) {
      setCancelVisible(false);
      setActionError(err.message || t('sos.cancelResponseFailed'));
    } finally {
      setCancelling(false);
    }
  };

  const statusLabel = (emergency: EmergencyRequest) => {
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

  /**
   * One request in the list.
   *
   * Critical requests get the accent; everything else is an ordinary surface.
   * That is the restraint the brief asks for -- if every card is red then red
   * has stopped meaning urgent, which is exactly what V1's single rose for both
   * the brand and danger had already done to the whole app.
   */
  const renderEmergencyCard = (emergency: EmergencyRequest, onPress: () => void) => {
    const isCritical = emergency.urgencyLevel?.toUpperCase() === 'CRITICAL';
    const rh = emergency.rhFactor === 'POSITIVE' ? '+' : emergency.rhFactor === 'NEGATIVE' ? '-' : '';
    const deadline = timeLeftLabel(emergency.requiredBefore);

    return (
      <Pressable
        key={emergency.id}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${emergency.emergencyReference}. ${emergency.bloodType}${rh}. ${emergency.hospital.name}. ${statusLabel(emergency)}`}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? motion.pressScale : 1 }] })}
      >
        <Surface
          level="raised"
          style={
            isCritical
              ? { borderWidth: 1, borderColor: colors.critical.base, backgroundColor: colors.critical.soft }
              : undefined
          }
        >
          <Stack gap="md">
            <Row align="flex-start" gap="lg">
              <View style={{ flex: 1, gap: space.sm }}>
                <Row gap="sm">
                  <ValueText variant="h1" style={{ color: isCritical ? colors.critical.text : colors.rose.text }}>
                    {emergency.bloodType}
                    {rh}
                  </ValueText>
                  <Badge
                    label={emergency.urgencyLevel}
                    tone={isCritical ? 'critical' : 'warning'}
                    icon={({ size, color }) => <AlertTriangle size={size} color={color} />}
                  />
                </Row>
                <View style={{ gap: 2 }}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {emergency.hospital.name}
                  </Text>
                  <Text variant="caption" tone="tertiary" numberOfLines={2}>
                    {emergency.description ?? emergency.emergencyReference}
                  </Text>
                </View>
              </View>

              <View style={{ alignItems: 'flex-end', gap: space.xs }}>
                {deadline ? (
                  <Row gap="xs">
                    <Clock size={iconSize.sm} color={colors.critical.text} />
                    <Text variant="label" style={{ color: colors.critical.text }}>
                      {deadline}
                    </Text>
                  </Row>
                ) : null}
                <Text variant="caption" tone="tertiary">
                  {t('units.unitsNeeded', { count: emergency.unitsRequired })}
                </Text>
                {emergency.donationLocation ? (
                  <Row gap="xs">
                    <MapPin size={iconSize.sm} color={colors.textTertiary} />
                    <Text variant="caption" tone="tertiary" numberOfLines={1}>
                      {emergency.donationLocation}
                    </Text>
                  </Row>
                ) : null}
              </View>
            </Row>

            <View style={{ height: 1, backgroundColor: colors.divider }} />
            <Text variant="label" tone={isCritical ? 'critical' : 'clinical'}>
              {statusLabel(emergency)}
            </Text>
          </Stack>
        </Surface>
      </Pressable>
    );
  };

  /* ------------------------------------------------------------- loading */

  if (status === 'loading') {
    return (
      <ScrollScreen header={<ScreenHeader title={t('sos.title')} onBack={() => router.back()} backLabel={t('common.a11yGoBack')} />}>
        <LoadingSection label={t('sos.title')} />
      </ScrollScreen>
    );
  }

  /* --------------------------------------------------------------- error */

  if (status === 'error') {
    return (
      <ScrollScreen header={<ScreenHeader title={t('sos.title')} onBack={() => router.back()} backLabel={t('common.a11yGoBack')} />}>
        <ErrorState
          title={t('sos.loadFailedTitle')}
          description={error ?? undefined}
          onRetry={loadEmergencies}
          retryLabel={t('common.retry')}
        />
      </ScrollScreen>
    );
  }

  /* ------------------------------------------------------------- viewing */

  if (status === 'viewing' && selectedEmergency) {
    const rh = selectedEmergency.rhFactor === 'POSITIVE' ? '+' : '-';

    return (
      <ScrollScreen header={<ScreenHeader title={t('sos.details')} onBack={() => setStatus('idle')} backLabel={t('common.a11yGoBack')} />}>
        <Stack gap="xl">
          <EmergencyBanner
            title={selectedEmergency.emergencyReference}
            description={t('sos.compatible', { bloodType: `${selectedEmergency.bloodType}${rh}` })}
            icon={({ size, color }) => <AlertTriangle size={size} color={color} />}
          />

          <Surface>
            <Stack gap="md">
              <DetailRow label={t('sos.bloodTypeNeeded')} value={`${selectedEmergency.bloodType}${rh}`} />
              <DetailRow label={t('sos.unitsRequired')} value={String(selectedEmergency.unitsRequired)} />
              <DetailRow label={t('table.hospital')} value={selectedEmergency.hospital.name} />
              {selectedEmergency.donationLocation ? (
                <DetailRow label={t('table.location')} value={selectedEmergency.donationLocation} />
              ) : null}
              {selectedEmergency.description ? (
                <View style={{ gap: space.xs }}>
                  <Text variant="label" tone="tertiary">
                    {t('sos.description')}
                  </Text>
                  <Text variant="body">{selectedEmergency.description}</Text>
                </View>
              ) : null}
            </Stack>
          </Surface>

          {actionError ? <Banner tone="critical" title={actionError} /> : null}

          <Stack gap="md">
            <Text variant="h2" accessibilityRole="header">
              {t('sos.canYouHelp')}
            </Text>
            <Button
              label={t('sos.yesICanHelp')}
              onPress={() => handleAcceptEmergency(selectedEmergency)}
              icon={({ size, color }) => <CheckCircle size={size} color={color} />}
            />
            {/* Secondary, not a second red button. Declining is an ordinary,
                blameless choice; drawing it as destructive tells the donor
                they are doing something wrong by being unable to help. */}
            <Button
              label={t('sos.declineRequest')}
              variant="secondary"
              onPress={() => handleDeclineEmergency(selectedEmergency)}
              icon={({ size, color }) => <XCircle size={size} color={color} />}
            />
          </Stack>

          <Text variant="caption" tone="tertiary">
            {t('sos.commitmentNotice')}
          </Text>
        </Stack>
      </ScrollScreen>
    );
  }

  /* ------------------------------------------------ responding / en route */

  if (['responding', 'en_route', 'arrived'].includes(status) && selectedEmergency) {
    return (
      // A View rather than a fragment: the sheets below are siblings of the
      // page, and a fragment at a screen root leaves the tree with no single
      // element -- which is a real thing for anything walking the rendered
      // output, tests included.
      <View style={{ flex: 1 }}>
        <ScrollScreen header={<ScreenHeader title={t('sos.yourResponse')} onBack={() => setStatus('idle')} backLabel={t('common.a11yGoBack')} />}>
          <Stack gap="xl">
            <JourneyProgress status={status} />

            <Surface>
              <Stack gap="md">
                <Row gap="md">
                  <CheckCircle size={iconSize.lg} color={colors.success.base} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="bodyStrong">{t('sos.responseAccepted')}</Text>
                    <Text variant="caption" tone="secondary">
                      {t('sos.responseAcceptedBody')}
                    </Text>
                  </View>
                </Row>
                <View style={{ height: 1, backgroundColor: colors.divider }} />
                <Row gap="md" align="flex-start">
                  <MapPin size={iconSize.md} color={colors.rose.base} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="bodyStrong">{selectedEmergency.hospital.name}</Text>
                    {selectedEmergency.donationLocation ? (
                      <Text variant="caption" tone="secondary">
                        {selectedEmergency.donationLocation}
                      </Text>
                    ) : null}
                  </View>
                </Row>
              </Stack>
            </Surface>

            {status === 'en_route' && locationConsent === 'blocked' ? (
              <Banner
                tone="warning"
                title={t('sos.locationDeniedTitle')}
                description={t('sos.locationDeniedBody')}
                icon={({ size, color }) => <MapPin size={size} color={color} />}
                action={
                  <Button
                    label={t('sos.locationDeniedOpenSettings')}
                    variant="secondary"
                    size="md"
                    block={false}
                    onPress={() => Linking.openSettings()}
                  />
                }
              />
            ) : null}

            {trackingMarkers.length > 0 ? (
              <Stack gap="sm">
                <Surface padded={false} style={{ overflow: 'hidden' }}>
                  {/* `showRoute` is deliberately not passed. See the note at
                      the top of this file: a line between two points is not a
                      route, and drawing one would be a claim the app cannot
                      support. */}
                  <LocationMap markers={trackingMarkers} height={200} />
                </Surface>
                <Text variant="caption" tone="tertiary">
                  {t('sos.noRouteShown')}
                </Text>
              </Stack>
            ) : null}

            {actionError ? <Banner tone="critical" title={actionError} /> : null}

            <Stack gap="md">
              <Text variant="h2" accessibilityRole="header">
                {t('sos.whatToDoNext')}
              </Text>

              {status === 'responding' ? (
                <Button
                  label={t('sos.startJourney')}
                  onPress={() => handleStartJourney(selectedEmergency)}
                  icon={({ size, color }) => <Navigation size={size} color={color} />}
                />
              ) : null}

              {status === 'en_route' ? (
                <>
                  <Banner
                    tone="clinical"
                    title={t('sos.onYourWay')}
                    icon={({ size, color }) => <Navigation size={size} color={color} />}
                  />
                  <Button
                    label={t('sos.iHaveArrived')}
                    onPress={() => handleArrived(selectedEmergency)}
                    icon={({ size, color }) => <CheckCircle size={size} color={color} />}
                  />
                </>
              ) : null}

              {status === 'arrived' ? (
                <Banner
                  tone="success"
                  title={t('sos.checkInAtReception')}
                  description={t('sos.staffNotified')}
                  icon={({ size, color }) => <CheckCircle size={size} color={color} />}
                />
              ) : null}

              <Button
                label={t('sos.cancelMyResponse')}
                variant="ghost"
                onPress={() => setCancelVisible(true)}
                icon={({ size, color }) => <XCircle size={size} color={color} />}
              />
            </Stack>
          </Stack>
        </ScrollScreen>

        <PermissionExplainer
          visible={explainerVisible}
          title={t('sos.locationExplainerTitle')}
          description={t('sos.locationExplainerBody')}
          assurances={[
            t('sos.locationAssuranceOnlyEnRoute'),
            t('sos.locationAssuranceHospitalOnly'),
            t('sos.locationAssuranceStopAnytime'),
          ]}
          allowLabel={t('sos.locationAllow')}
          denyLabel={t('sos.locationNotNow')}
          onAllow={onAllowLocation}
          onDeny={() => {
            setExplainerVisible(false);
            setLocationConsent('declined');
          }}
          icon={({ size, color }) => <ShieldCheck size={size} color={color} />}
        />

        <ConfirmationSheet
          visible={cancelVisible}
          title={t('sos.cancelResponseTitle')}
          description={t('sos.cancelResponseBody')}
          confirmLabel={t('appointment.cancelConfirm')}
          cancelLabel={t('appointment.cancelKeep')}
          destructive
          busy={cancelling}
          onCancel={() => setCancelVisible(false)}
          onConfirm={confirmCancelResponse}
        />
      </View>
    );
  }

  /* ---------------------------------------------------------------- list */

  return (
    <ScrollScreen
      header={
        <ScreenHeader
          title={t('sos.title')}
          eyebrow={
            emergencies.length > 0
              ? t('units.activeRequestsNearYou', { count: emergencies.length })
              : t('sos.noActiveRequests')
          }
          onBack={() => router.back()}
          backLabel={t('common.a11yGoBack')}
        />
      }
      refreshing={false}
      onRefresh={loadEmergencies}
    >
      <Stack gap="xl">
        {actionError ? <Banner tone="critical" title={actionError} /> : null}

        {emergencies.length > 0 ? (
          <Stack gap="md">
            <SectionHeader title={t('sos.activeNearYou')} />
            {emergencies.map((emergency) =>
              renderEmergencyCard(emergency, () => handleViewMatch(emergency)),
            )}
          </Stack>
        ) : (
          <EmptyState
            title={t('sos.noActiveEmergencies')}
            description={t('sos.noActiveEmergenciesHint')}
            icon={({ size, color }) => <AlertTriangle size={size} color={color} />}
          />
        )}

        {myResponses.length > 0 ? (
          <Stack gap="md">
            <SectionHeader title={t('sos.yourActiveResponses')} />
            {myResponses.map((emergency) =>
              renderEmergencyCard(emergency, () => {
                setSelectedEmergency(emergency);
                if (emergency.responseStatus === 'EN_ROUTE') setStatus('en_route');
                else if (emergency.responseStatus === 'ARRIVED') setStatus('arrived');
                else setStatus('responding');
              }),
            )}
          </Stack>
        ) : null}

        <Text variant="caption" tone="tertiary" align="center">
          {t('sos.commitmentNotice')}
        </Text>
      </Stack>
    </ScrollScreen>
  );
}

/** A label and its value on one line, for the request's facts. */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Row gap="lg" align="flex-start" style={{ justifyContent: 'space-between' }}>
      <Text variant="body" tone="secondary" style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant="bodyStrong" align="right" style={{ flex: 1 }}>
        {value}
      </Text>
    </Row>
  );
}

/**
 * Where the donor is in the three steps they own.
 *
 * It stops at "Arrived" on purpose, and the steps after it are not drawn as
 * greyed-out future states: showing "Donated" as a dimmed step would say the
 * donor gets there by continuing to press things on this screen, and they do
 * not. What happens after arrival belongs to the hospital.
 */
function JourneyProgress({ status }: { status: EmergencyStatus }) {
  const { colors } = useDesign();
  const { t } = useTranslation();

  const steps: { key: EmergencyStatus; label: string }[] = [
    { key: 'responding', label: t('sos.responseReadyToGo') },
    { key: 'en_route', label: t('status.response.EN_ROUTE') },
    { key: 'arrived', label: t('status.response.ARRIVED') },
  ];
  const activeIndex = steps.findIndex((step) => step.key === status);

  return (
    <Row gap="sm" accessibilityRole="progressbar" accessibilityLabel={steps[Math.max(activeIndex, 0)]?.label}>
      {steps.map((step, index) => {
        const reached = index <= activeIndex;
        return (
          <View key={step.key} style={{ flex: 1, gap: space.xs }}>
            <View
              style={{
                height: 4,
                borderRadius: radius.full,
                backgroundColor: reached ? colors.rose.base : colors.track,
              }}
            />
            <Text
              variant="caption"
              tone={reached ? 'primary' : 'tertiary'}
              numberOfLines={1}
              style={{ fontSize: 11 }}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </Row>
  );
}
