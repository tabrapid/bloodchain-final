import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, View } from 'react-native';
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
  KeyValueRow,
  LoadingSection,
  PermissionExplainer,
  Row,
  ScreenHeader,
  ScrollScreen,
  SectionHeader,
  Stack,
  Surface,
  Text,
  Timeline,
  ValueText,
  iconSize,
  radius,
  space,
  useDesign,
} from '../src/design';
import { LocationMap, type MapMarkerPoint } from '../src/components/map/LocationMap';
import { useTranslation } from '../src/i18n';
import type { TranslateFn } from '@bloodchain/i18n';
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
function timeLeftLabel(requiredBefore: string | undefined, t: TranslateFn): string | null {
  if (!requiredBefore) return null;
  const minutes = Math.round((new Date(requiredBefore).getTime() - Date.now()) / 60000);
  if (Number.isNaN(minutes)) return null;
  if (minutes <= 0) return t('sos.overdue');
  if (minutes < 60) return t('sos.timeLeftMinutes', { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 48) return t('sos.timeLeftHours', { count: hours });
  return t('sos.timeLeftDays', { count: Math.round(hours / 24) });
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
/**
 * The sign to print after a blood group, and nothing when the factor is not
 * one of the two.
 *
 * The list card asked for three cases and the detail screen asked for two, so
 * a request whose rhFactor was neither POSITIVE nor NEGATIVE read "AB" on the
 * card and "AB-" one tap later -- a different blood type, on the screen where
 * that matters most.
 */
function rhSign(rhFactor: string | undefined): string {
  if (rhFactor === 'POSITIVE') return '+';
  if (rhFactor === 'NEGATIVE') return '-';
  return '';
}

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
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Load, without blanking what is already on screen.
   *
   * `setStatus('loading')` swapped the whole screen for a centred spinner --
   * and every action calls this afterwards, so a donor who pressed "I have
   * arrived" watched the journey, the hospital card and the map disappear and
   * come back. Only the first load has nothing to keep; a refresh keeps it and
   * says so through the pull-to-refresh spinner instead.
   */
  const loadEmergencies = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') setStatus('loading');
      else setRefreshing(true);
      try {
        const response: DonorEmergenciesResponse = await getDonorEmergencies();
        setEmergencies(response.active);
        setMyResponses(response.myResponses);
        setStatus('idle');
      } catch (err: any) {
        setError(err.message || t('sos.loadFailed'));
        // A refresh that fails leaves what was already there, with the failure
        // said in a banner; only a first load has nothing to fall back to.
        if (mode === 'initial') setStatus('error');
      } finally {
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadEmergencies('initial');
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
      await loadEmergencies('refresh');
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
      await loadEmergencies('refresh');
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
      await loadEmergencies('refresh');
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
      await loadEmergencies('refresh');
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
      await loadEmergencies('refresh');
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
    // Three of the eight EmergencyMatchStatus members used to be translated and
    // the rest fell through to `return emergency.matchStatus`, which put
    // DECLINED, EXPIRED, CANCELLED or NO_RESPONSE on the glass in the
    // database's own words. The catalogue carries all eight now.
    if (emergency.matchStatus) {
      switch (emergency.matchStatus) {
        case 'MATCHED':
          return t('sos.matchNew');
        case 'NOTIFIED':
          return t('sos.matchNotified');
        case 'VIEWED':
          return t('sos.matchViewed');
        default:
          return t(`status.match.${emergency.matchStatus}`);
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
    const rh = rhSign(emergency.rhFactor);
    const deadline = timeLeftLabel(emergency.requiredBefore, t);
    const accent = isCritical ? colors.critical : colors.rose;

    return (
      <Surface
        key={emergency.id}
        onPress={onPress}
        accessibilityLabel={`${emergency.emergencyReference}. ${emergency.bloodType}${rh}. ${emergency.hospital.name}. ${statusLabel(emergency)}`}
        {...(isCritical ? { tone: 'critical' as const } : {})}
        padded={false}
      >
        <View style={{ padding: space.lg, gap: space.md }}>
          {/* Blood type, urgency and time: the three facts a donor decides on,
              in the first line, at the largest sizes on the card. */}
          <Row gap="md" align="flex-start">
            <View
              style={{
                minWidth: 72,
                paddingHorizontal: space.md,
                paddingVertical: space.sm,
                borderRadius: radius.md,
                alignItems: 'center',
                backgroundColor: accent.soft,
              }}
            >
              <ValueText variant="h1" style={{ color: accent.text }}>
                {emergency.bloodType}
                {rh}
              </ValueText>
              <Text variant="overline" tone="tertiary" caps>
                {t('home.bloodTypeLabel')}
              </Text>
            </View>
            <View style={{ flex: 1, gap: space.xs }}>
              <Row gap="sm" style={{ flexWrap: 'wrap' }}>
                <Badge
                  label={t(`status.urgency.${emergency.urgencyLevel?.toUpperCase()}`)}
                  tone={isCritical ? 'critical' : 'warning'}
                  emphasis={isCritical ? 'solid' : 'soft'}
                  icon={({ size, color }) => <AlertTriangle size={size} color={color} />}
                />
                {deadline ? (
                  <Badge
                    label={deadline}
                    tone={isCritical ? 'critical' : 'neutral'}
                    icon={({ size, color }) => <Clock size={size} color={color} />}
                  />
                ) : null}
              </Row>
              <Text variant="title" numberOfLines={2}>
                {emergency.hospital.name}
              </Text>
              <Text variant="caption" tone="secondary">
                {t('units.unitsNeeded', { count: emergency.unitsRequired })}
                {emergency.donationLocation ? ` · ${emergency.donationLocation}` : ''}
              </Text>
            </View>
          </Row>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
            paddingHorizontal: space.lg,
            paddingVertical: space.md,
            backgroundColor: isCritical ? 'rgba(255,255,255,0.05)' : colors.surfaceRaised,
          }}
        >
          <Text variant="label" tone={isCritical ? 'critical' : 'clinical'} style={{ flex: 1 }}>
            {statusLabel(emergency)}
          </Text>
          <Text variant="caption" tone="tertiary">
            {emergency.emergencyReference}
          </Text>
        </View>
      </Surface>
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
    const rh = rhSign(selectedEmergency.rhFactor);

    return (
      <ScrollScreen header={<ScreenHeader title={t('sos.details')} onBack={() => setStatus('idle')} backLabel={t('common.a11yGoBack')} />}>
        <Stack gap="xl">
          <EmergencyBanner
            title={selectedEmergency.emergencyReference}
            description={t('sos.compatible', { bloodType: `${selectedEmergency.bloodType}${rh}` })}
            icon={({ size, color }) => <AlertTriangle size={size} color={color} />}
          />

          <Surface padded="lg">
            <View style={{ gap: 0 }}>
              <KeyValueRow
                label={t('sos.bloodTypeNeeded')}
                value={`${selectedEmergency.bloodType}${rh}`}
                valueTone="rose"
              />
              <View style={{ height: 1, backgroundColor: colors.divider }} />
              <KeyValueRow label={t('sos.unitsRequired')} value={String(selectedEmergency.unitsRequired)} />
              <View style={{ height: 1, backgroundColor: colors.divider }} />
              <KeyValueRow label={t('table.hospital')} value={selectedEmergency.hospital.name} multiline />
              {selectedEmergency.donationLocation ? (
                <>
                  <View style={{ height: 1, backgroundColor: colors.divider }} />
                  <KeyValueRow label={t('table.location')} value={selectedEmergency.donationLocation} multiline />
                </>
              ) : null}
              {selectedEmergency.description ? (
                <>
                  <View style={{ height: 1, backgroundColor: colors.divider }} />
                  <KeyValueRow label={t('sos.description')} value={selectedEmergency.description} multiline />
                </>
              ) : null}
            </View>
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
            {/* The destination first, then where the donor is on the way to it.
                Hospital, blood type and location dominate; the journey is a
                timeline of the three states the donor owns. */}
            <Surface tone="rose" corner="xl">
              <View style={{ gap: space.lg }}>
                <Row gap="lg" align="flex-start">
                  <View style={{ flex: 1, gap: space.xs }}>
                    <Text variant="overline" tone="tertiary" caps>
                      {t('table.hospital')}
                    </Text>
                    <Text variant="h2">{selectedEmergency.hospital.name}</Text>
                    {selectedEmergency.donationLocation ? (
                      <Row gap="xs" align="flex-start">
                        <MapPin size={iconSize.sm} color={colors.textSecondary} style={{ marginTop: 3 }} />
                        <Text variant="body" tone="secondary" style={{ flex: 1 }}>
                          {selectedEmergency.donationLocation}
                        </Text>
                      </Row>
                    ) : null}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    <ValueText variant="h1" style={{ color: colors.rose.text }}>
                      {selectedEmergency.bloodType}
                      {rhSign(selectedEmergency.rhFactor)}
                    </ValueText>
                    <Text variant="caption" tone="tertiary">
                      {t('units.unitsNeeded', { count: selectedEmergency.unitsRequired })}
                    </Text>
                  </View>
                </Row>
                <JourneyProgress status={status} />
              </View>
            </Surface>

            <Banner
              tone="success"
              title={t('sos.responseAccepted')}
              description={t('sos.responseAcceptedBody')}
              icon={({ size, color }) => <CheckCircle size={size} color={color} />}
            />

            {/*
              Declining is not a decision a donor is held to.

              The explainer opens once, and the only banner offering a way back
              was gated on 'blocked' -- the state where the operating system
              refused. A donor who pressed "Not now" saw nothing afterwards and
              had no way to change their mind for the rest of the journey. Now
              both states say what is happening and offer the route back: the
              app's own sheet when the app is what said no, the operating
              system's settings when it was.
            */}
            {status === 'en_route' && locationConsent === 'declined' ? (
              <Banner
                tone="warning"
                title={t('sos.locationDeclinedTitle')}
                description={t('sos.locationDeclinedBody')}
                icon={({ size, color }) => <MapPin size={size} color={color} />}
                action={
                  <Button
                    label={t('sos.locationAllow')}
                    variant="secondary"
                    size="md"
                    block={false}
                    onPress={() => setExplainerVisible(true)}
                  />
                }
              />
            ) : null}

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
      refreshing={refreshing}
      onRefresh={() => void loadEmergencies('refresh')}
    >
      <Stack gap="xl">
        {actionError ? <Banner tone="critical" title={actionError} /> : null}

        {emergencies.length > 0 ? (
          <Stack gap="md">
            {/*
              Only when there is a second group to tell this one apart from.

              The header already says "2 active requests near you" in its
              eyebrow; a section header underneath reading "Active emergency
              requests near you" put the same sentence on the screen twice, in
              two stacked lines of capitals, whenever the donor had no
              responses of their own -- which is the ordinary case.
            */}
            {myResponses.length > 0 ? <SectionHeader title={t('sos.activeNearYou')} /> : null}
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

/**
 * Where the donor is in the three steps they own.
 *
 * It stops at "Arrived" on purpose, and the steps after it are not drawn as
 * greyed-out future states: showing "Donated" as a dimmed step would say the
 * donor gets there by continuing to press things on this screen, and they do
 * not. What happens after arrival belongs to the hospital.
 */
function JourneyProgress({ status }: { status: EmergencyStatus }) {
  const { t } = useTranslation();

  const steps: { key: EmergencyStatus; label: string }[] = [
    { key: 'responding', label: t('sos.responseReadyToGo') },
    { key: 'en_route', label: t('status.response.EN_ROUTE') },
    { key: 'arrived', label: t('status.response.ARRIVED') },
  ];
  const activeIndex = Math.max(
    0,
    steps.findIndex((step) => step.key === status),
  );

  return (
    <Timeline
      steps={steps.map((step) => ({ label: step.label }))}
      current={activeIndex}
      tone="rose"
    />
  );
}
