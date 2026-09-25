import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import {
  Activity,
  Brain,
  ChevronRight,
  Droplet,
  FileText,
  Fingerprint,
  Gauge,
  Layers,
  Percent,
  ShieldCheck,
} from 'lucide-react-native';
import {
  Badge,
  ErrorState,
  EmptyState,
  LinkButton,
  ListGroup,
  ListRow,
  Row,
  ScrollScreen,
  SectionHeader,
  SectionError,
  Skeleton,
  SkeletonRow,
  Sparkline,
  Stack,
  Surface,
  Text,
  ValueText,
  iconSize,
  radius,
  space,
  useDesign,
  type AccentName,
} from '../../src/design';
import { LucideIcon } from '../../src/types/icons';
import { useTrendSummary, useLatestInsight, useAiEnabled } from '../../src/hooks/useHealth';
import { useDonorLaboratoryResults } from '../../src/hooks/useLaboratory';
import { formatUpdated, isWithinReferenceRange } from '../../src/utils/health';
import { useTranslation } from '../../src/i18n';

// Keyed by the real lab-parameter code (see apps/api/prisma/seed.ts's
// TestParameter records) so each marker gets the icon that actually matches
// what it measures, instead of cycling icons by list position -- which is how
// hemoglobin ended up with a "wind" icon and platelets a "thermometer".
const MARKER_ICON_BY_CODE: Record<string, { icon: LucideIcon; tone: AccentName }> = {
  HEMOGLOBIN: { icon: Droplet, tone: 'rose' },
  HEMATOCRIT: { icon: Percent, tone: 'clinical' },
  RBC: { icon: Activity, tone: 'rose' },
  WBC: { icon: ShieldCheck, tone: 'success' },
  PLATELETS: { icon: Layers, tone: 'warning' },
  FERRITIN: { icon: Gauge, tone: 'insight' },
  FERRITIN_LEVEL: { icon: Gauge, tone: 'insight' },
  BLOOD_GROUP: { icon: Fingerprint, tone: 'clinical' },
  ABO: { icon: Fingerprint, tone: 'clinical' },
  RH_FACTOR: { icon: Fingerprint, tone: 'clinical' },
};

/**
 * What each marker is, in one line of plain language.
 *
 * Catalogue keys rather than sentences, because this map is built at module
 * load where there is no locale; the screen resolves them through `t`. A code
 * with no entry simply shows no description rather than a guess: the screen
 * never invents a meaning for a marker it does not recognise.
 *
 * Every value here is clinically sensitive and lives in the medical namespace,
 * so a reviewer finds all of them in one place.
 */
const MARKER_DESCRIPTION_KEY_BY_CODE: Record<string, string> = {
  HEMOGLOBIN: 'medical.markers.hemoglobinNote',
  HEMATOCRIT: 'medical.markers.hematocritNote',
  RBC: 'medical.markers.redBloodCellsNote',
  WBC: 'medical.markers.whiteBloodCellsNote',
  PLATELETS: 'medical.markers.plateletsNote',
  FERRITIN: 'medical.markers.ferritinNote',
  FERRITIN_LEVEL: 'medical.markers.ferritinNote',
  BLOOD_GROUP: 'medical.markers.bloodGroupNote',
  ABO: 'medical.markers.bloodGroupNote',
  RH_FACTOR: 'medical.markers.rhFactorNote',
};

const FALLBACK_TONES: AccentName[] = ['rose', 'clinical', 'warning', 'insight', 'success'];

function markerVisual(code: string, index: number): { icon: LucideIcon; tone: AccentName } {
  return (
    MARKER_ICON_BY_CODE[code.toUpperCase()] ?? {
      icon: Activity,
      tone: FALLBACK_TONES[index % FALLBACK_TONES.length]!,
    }
  );
}

/**
 * Health, rebuilt for V2.
 *
 * The screen answers three questions in order: what was measured last, what
 * else is tracked, and what has been published. V1 answered the first with a
 * full-bleed two-stop rose gradient carrying a 52pt number, a sparkline in
 * translucent white and four lines of caption -- a card the eye reads as an
 * advertisement rather than a measurement. It is a plain surface now, and the
 * number is the only large thing on it.
 *
 * Three things this screen must not do, and did:
 *
 *   It finished loading into nothing when the request failed. `Promise.all`
 *   inside a `useEffect`, a `console.error` on rejection, then a render with
 *   no data and no explanation. Loading, loaded-and-empty and failed are three
 *   separate states here and the last one has a retry on it.
 *
 *   It shipped English into a Uzbek and Russian app: 'Needs review', 'Within
 *   healthy range' and `${n} measurement${n === 1 ? '' : 's'} tracked` were
 *   string literals. All three are catalogue keys now, and the last is a real
 *   plural rule rather than an English -s.
 *
 *   It put an AI-written sentence on a health screen with nothing saying what
 *   it was. The insight now carries the standing disclaimer -- informational,
 *   drawn from the donor's own recorded data, not a diagnosis -- in the card,
 *   not on the screen behind it.
 */
export default function Health() {
  const { colors } = useDesign();
  const { t, formatDate } = useTranslation();

  const summary = useTrendSummary();
  const results = useDonorLaboratoryResults();
  const insight = useLatestInsight();
  const aiEnabled = useAiEnabled();

  const refreshing =
    summary.isRefetching || results.isRefetching || insight.isRefetching || aiEnabled.isRefetching;

  const onRefresh = () => {
    summary.refetch();
    results.refetch();
    insight.refetch();
    aiEnabled.refetch();
  };

  const publishedResults = (results.data ?? []).filter((r) => r.status === 'PUBLISHED');
  const anyFlagged = publishedResults.some((r) =>
    r.items.some((item) => item.flag && item.flag !== 'NORMAL'),
  );

  // Latest known flag per parameter code, so a marker row can carry the same
  // Normal/Review badge the reference puts there.
  const flagByParameterCode = new Map<string, string>();
  publishedResults.forEach((result) => {
    result.items.forEach((item) => {
      const code = item.parameter?.code?.toUpperCase();
      if (code && !flagByParameterCode.has(code)) {
        flagByParameterCode.set(code, item.flag);
      }
    });
  });

  const header = (
    <Row align="flex-start" gap="md" style={{ paddingTop: space.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="h1">{t('health.title')}</Text>
        <Text variant="body" tone="secondary">
          {t('health.subtitle')}
        </Text>
      </View>
      {publishedResults.length > 0 ? (
        <Badge
          label={anyFlagged ? t('health.needsReview') : t('health.allNormal')}
          tone={anyFlagged ? 'warning' : 'success'}
        />
      ) : null}
    </Row>
  );

  if (summary.isPending || results.isPending) {
    return (
      <ScrollScreen>
        <Stack gap="xl">
          {header}
          <Surface>
            <Stack gap="md">
              <Skeleton width="45%" height={12} />
              <Skeleton width="60%" height={40} />
              <Skeleton height={44} corner="sm" />
            </Stack>
          </Surface>
          <Surface>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </Surface>
        </Stack>
      </ScrollScreen>
    );
  }

  // Both sources gone means the screen has nothing at all to draw, so it says
  // so once with one retry. One source failing is handled where that section
  // is: the rest of the screen is still true.
  if (summary.isError && results.isError) {
    return (
      <ScrollScreen>
        <Stack gap="xl">
          {header}
          <ErrorState
            title={t('common.errorTitle')}
            description={t('common.errorBody')}
            retryLabel={t('common.retry')}
            onRetry={onRefresh}
          />
        </Stack>
      </ScrollScreen>
    );
  }

  const parameters = summary.data?.availableParameters ?? [];
  const trend = summary.data?.recentTrend;
  const latestParam = parameters[0];
  const trendValues = trend?.points.map((p) => p.value) ?? [];
  const inRange = isWithinReferenceRange(trend);

  const measurementCount = trend ? trend.points.length : (latestParam?.measurementCount ?? 0);
  const updatedLabel = formatUpdated(trend?.latestValueDate ?? latestParam?.latestValueDate, {
    t,
    formatDate,
  });

  if (parameters.length === 0 && publishedResults.length === 0) {
    return (
      <ScrollScreen>
        <Stack gap="xl">
          {header}
          <EmptyState
            title={t('health.noDataTitle')}
            description={t('health.noDataBody')}
            icon={({ size, color }) => <Activity size={size} color={color} />}
            action={{
              label: t('laboratory.bookBloodTest'),
              onPress: () => router.push('/(lab-booking)/test-type'),
            }}
          />
        </Stack>
      </ScrollScreen>
    );
  }

  const headlineName = trend?.parameterName ?? latestParam?.name;
  const headlineValue = trend?.latestValue ?? latestParam?.latestValue;
  const headlineUnit = trend?.unit ?? latestParam?.unit;
  const rangeLabel =
    inRange === null
      ? null
      : inRange
        ? t('medical.resultFlags.withinRange')
        : t('medical.resultFlags.outsideRange');

  return (
    <ScrollScreen refreshing={refreshing} onRefresh={onRefresh}>
      <Stack gap="xl">
        {header}

        {/* ------------------------------------------ the last measurement */}
        {headlineName ? (
          <Pressable
            onPress={() => router.push('/health-trends')}
            accessibilityRole="button"
            accessibilityLabel={`${t('health.latestTracked')}: ${headlineName}, ${headlineValue ?? '—'} ${headlineUnit ?? ''}. ${rangeLabel ?? ''} ${t('health.viewTrends')}`}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <Surface>
              <Stack gap="md">
                <Row gap="md" align="flex-start">
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="overline" tone="tertiary" caps>
                      {t('health.latestTracked')}
                    </Text>
                    <Text variant="h3">{headlineName}</Text>
                  </View>
                  <ChevronRight size={iconSize.md} color={colors.textTertiary} />
                </Row>

                <Row gap="lg" align="flex-end">
                  <Row gap="xs" align="baseline">
                    <ValueText variant="display">{headlineValue ?? '—'}</ValueText>
                    {headlineUnit ? (
                      <Text variant="h3" tone="secondary">
                        {headlineUnit}
                      </Text>
                    ) : null}
                  </Row>
                  {trendValues.length >= 2 ? (
                    <Sparkline
                      values={trendValues}
                      tone={inRange === false ? 'warning' : 'rose'}
                      // The drawing is decorative on its own; what it means is
                      // the count and the range badge beside it, so that is
                      // what gets announced.
                      accessibilityLabel={t('health.trendOfMeasurements', {
                        count: measurementCount,
                      })}
                      style={{ flex: 1 }}
                    />
                  ) : null}
                </Row>

                {/* The claim and the evidence for it on the same line: what
                    the laboratory flagged, and when it was measured. Neither
                    is stated without the other. */}
                <Row gap="md">
                  {rangeLabel ? (
                    <Badge label={rangeLabel} tone={inRange ? 'success' : 'warning'} />
                  ) : null}
                  <Text variant="caption" tone="tertiary" style={{ flex: 1 }} numberOfLines={2}>
                    {[updatedLabel, measurementCount ? t('units.measurements', { count: measurementCount }) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </Row>
              </Stack>
            </Surface>
          </Pressable>
        ) : null}

        {/* ------------------------------------------------- every marker */}
        {parameters.length > 0 ? (
          <Stack gap="md">
            <SectionHeader
              title={t('health.labMarkers')}
              action={
                <LinkButton
                  label={t('health.viewTrends')}
                  onPress={() => router.push('/health-trends')}
                />
              }
            />
            <ListGroup
              rows={parameters.slice(0, 5).map((param, index) => {
                const code = param.code.toUpperCase();
                const { icon: Icon } = markerVisual(param.code, index);
                const flag = flagByParameterCode.get(code);
                const descriptionKey = MARKER_DESCRIPTION_KEY_BY_CODE[code];
                const measurement =
                  param.latestValue !== undefined
                    ? `${param.latestValue}${param.unit ? ` ${param.unit}` : ''}`
                    : '—';
                return (
                  <ListRow
                    key={param.code}
                    // The glyph is not a status.
                    //
                    // `markerVisual` picks a tone from the marker's identity --
                    // platelets amber, red cells rose -- and the row also
                    // carries a status badge, so an amber icon sat beside a
                    // green "Normal" and the two contradicted each other. One
                    // neutral colour for every marker; the badge says the state.
                    leading={<Icon size={iconSize.lg} color={colors.textSecondary} />}
                    title={param.name}
                    // Five things competed for one 52pt line -- icon, title,
                    // two-line plain-language note, value with unit, and a
                    // badge -- and the only flexible column was the title, so
                    // "Red blood cells" rendered as "Red Bloo…" in English
                    // before Russian or Uzbek made it worse. The measurement
                    // reads on the subtitle line, which returns that width.
                    subtitle={
                      descriptionKey ? `${measurement} · ${t(descriptionKey)}` : measurement
                    }
                    trailing={
                      flag ? (
                        <Badge
                          label={
                            flag === 'NORMAL'
                              ? t('medical.resultFlags.normal')
                              : t('health.needsReview')
                          }
                          tone={flag === 'NORMAL' ? 'success' : 'warning'}
                        />
                      ) : undefined
                    }
                    accessibilityLabel={`${param.name}: ${param.latestValue ?? '—'} ${param.unit ?? ''}. ${t('health.viewTrends')}`}
                    // With the marker, not just to the screen: all five rows
                    // used to open Health trends on whichever parameter it
                    // happened to default to, so four of five opened something
                    // other than the row that was tapped.
                    onPress={() => router.push({ pathname: '/health-trends', params: { code: param.code } })}
                  />
                );
              })}
            />
          </Stack>
        ) : null}

        {/* ------------------------------------------------ what the AI said */}
        {/* When AI is switched off in this deployment the section is not shown
            at all. A disabled-looking tile that still navigates to a screen
            full of dead buttons is worse than the section not being there. */}
        {/*
          `undefined !== false`, so while the availability request was in flight
          the AI card was drawn and then withdrawn a moment later on any
          deployment with AI switched off -- a feature offered and taken away
          in the same second. Wait for the answer.
        */}
        {aiEnabled.data === true ? (
          <Stack gap="md">
            <SectionHeader title={t('health.aiInsights')} />
            <Pressable
              onPress={() => router.push('/insights')}
              accessibilityRole="button"
              accessibilityLabel={`${insight.data?.title ?? t('health.aiInsights')}. ${t('medical.aiSafety.disclaimer')}`}
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <Surface>
                <Stack gap="md">
                  <Row gap="md" align="flex-start">
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: radius.sm,
                        backgroundColor: colors.insight.soft,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Brain size={iconSize.md} color={colors.insight.base} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="bodyStrong">
                        {insight.data?.title ?? t('health.aiInsights')}
                      </Text>
                      <Text variant="caption" tone="secondary" numberOfLines={3}>
                        {insight.data?.summary ?? t('health.aiInsightsHint')}
                      </Text>
                    </View>
                    <ChevronRight size={iconSize.md} color={colors.textTertiary} />
                  </Row>

                  {/* The disclaimer is inside the card, under the sentence it
                      qualifies. On the screen behind it, it qualifies nothing:
                      a donor reads the insight and stops. */}
                  <Row gap="sm" align="flex-start">
                    <ShieldCheck size={iconSize.sm} color={colors.textTertiary} />
                    <Text variant="caption" tone="tertiary" style={{ flex: 1 }}>
                      {t('medical.aiSafety.disclaimer')}
                    </Text>
                  </Row>
                </Stack>
              </Surface>
            </Pressable>
          </Stack>
        ) : null}

        {/* ------------------------------------------- published results */}
        {publishedResults.length > 0 ? (
          <Stack gap="md">
            <SectionHeader
              title={t('health.labResults')}
              action={<LinkButton label={t('common.viewAll')} onPress={() => router.push('/laboratory')} />}
            />
            <ListGroup
              rows={publishedResults.slice(0, 3).map((result) => {
                const flagged = result.items.some((item) => item.flag && item.flag !== 'NORMAL');
                return (
                  <ListRow
                    key={result.id}
                    leading={<FileText size={iconSize.lg} color={colors.textSecondary} />}
                    title={result.testType.name}
                    subtitle={
                      result.publishedAt
                        ? formatDate(result.publishedAt, 'medium')
                        : t('health.dateUnknown')
                    }
                    trailing={
                      <Badge
                        label={
                          flagged ? t('health.needsReview') : t('medical.resultFlags.normal')
                        }
                        tone={flagged ? 'warning' : 'success'}
                      />
                    }
                    onPress={() => router.push('/laboratory')}
                  />
                );
              })}
            />
          </Stack>
        ) : null}

        {/* A section that failed is said once, where it would have been --
            not as a screen-wide error that hides the parts that loaded. */}
        {summary.isError ? (
          <SectionError
            message={t('common.errorBody')}
            retryLabel={t('common.retry')}
            onRetry={() => void summary.refetch()}
          />
        ) : null}
        {results.isError ? (
          <SectionError
            message={t('common.errorBody')}
            retryLabel={t('common.retry')}
            onRetry={() => void results.refetch()}
          />
        ) : null}
      </Stack>
    </ScrollScreen>
  );
}

