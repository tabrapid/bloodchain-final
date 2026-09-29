import { router } from 'expo-router';
import { View } from 'react-native';
import {
  Activity,
  Brain,
  CalendarPlus,
  ChevronRight,
  FileText,
  FlaskConical,
  ShieldCheck,
} from 'lucide-react-native';
import {
  Badge,
  ErrorState,
  EmptyState,
  LinkButton,
  ListGroup,
  ListRow,
  RecordRow,
  Row,
  ScreenTitle,
  ScrollScreen,
  Section,
  SectionError,
  Sections,
  Skeleton,
  SkeletonCard,
  SkeletonRow,
  Surface,
  Text,
  ValueBlock,
  iconSize,
  radius,
  space,
  useDesign,
} from '../../src/design';
import { useTrendSummary, useLatestInsight, useAiEnabled } from '../../src/hooks/useHealth';
import { useDonorLaboratoryResults } from '../../src/hooks/useLaboratory';
import { formatUpdated, isWithinReferenceRange } from '../../src/utils/health';
import { useTranslation } from '../../src/i18n';
import { formatClinicalValue } from '../../src/utils/clinical';

/**
 * What each marker is, in one line of plain language.
 *
 * Catalogue keys rather than sentences, because this map is built at module
 * load where there is no locale; the screen resolves them through `t`. A code
 * with no entry simply shows no description rather than a guess: the screen
 * never invents a meaning for a marker it does not recognise.
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

/**
 * Health, composed for V4: a health-data product, not a dashboard.
 *
 * The order is the order a clinician reads a report: the latest verified
 * figure with its range and date, then every tracked marker as a record
 * (parameter, value, unit, reference, status, date), then what the model
 * said about it -- clearly marked as an explanation, not an opinion that
 * outranks the data -- and finally the published reports themselves.
 *
 * Normal is quiet. A marker within range carries a small green pill and
 * nothing else; a flagged one gets the amber, and it is the only amber on
 * the screen. The eye lands on what needs attention because nothing else
 * asks for it.
 *
 * Three states are told apart and the tests pin them: loading, failed with a
 * retry, and genuinely empty with the one action that fills it.
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

  // Latest known flag and reference range per parameter code.
  const latestByCode = new Map<string, { flag?: string; referenceMin?: number; referenceMax?: number; unit?: string }>();
  publishedResults.forEach((result) => {
    result.items.forEach((item) => {
      const code = item.parameter?.code?.toUpperCase();
      if (code && !latestByCode.has(code)) {
        latestByCode.set(code, {
          flag: item.flag,
          referenceMin: item.referenceMin,
          referenceMax: item.referenceMax,
          unit: item.unit,
        });
      }
    });
  });

  const header = (
    <ScreenTitle
      title={t('health.title')}
      subtitle={t('health.subtitle')}
      action={
        publishedResults.length > 0 ? (
          <Badge
            label={anyFlagged ? t('health.needsReview') : t('health.allNormal')}
            tone={anyFlagged ? 'warning' : 'success'}
            dot
          />
        ) : null
      }
    />
  );

  if (summary.isPending || results.isPending) {
    return (
      <ScrollScreen>
        <Sections>
          {header}
          <Surface>
            <View style={{ gap: space.md }}>
              <Skeleton width="35%" height={11} />
              <Skeleton width="55%" height={36} />
              <Skeleton width="70%" height={12} />
            </View>
          </Surface>
          <View style={{ gap: space.sm }}>
            <Skeleton width="40%" height={18} />
            <Surface level="flat">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </Surface>
          </View>
          <SkeletonCard />
        </Sections>
      </ScrollScreen>
    );
  }

  // Both sources gone means the screen has nothing at all to draw, so it says
  // so once with one retry. One source failing is handled where that section
  // is: the rest of the screen is still true.
  if (summary.isError && results.isError) {
    return (
      <ScrollScreen>
        <Sections>
          {header}
          <ErrorState
            title={t('common.errorTitle')}
            description={t('common.errorBody')}
            retryLabel={t('common.retry')}
            onRetry={onRefresh}
          />
        </Sections>
      </ScrollScreen>
    );
  }

  const parameters = summary.data?.availableParameters ?? [];
  const trend = summary.data?.recentTrend;
  const latestParam = parameters[0];
  const inRange = isWithinReferenceRange(trend);

  const measurementCount = trend ? trend.points.length : (latestParam?.measurementCount ?? 0);
  const updatedLabel = formatUpdated(trend?.latestValueDate ?? latestParam?.latestValueDate, {
    t,
    formatDate,
  });

  if (parameters.length === 0 && publishedResults.length === 0) {
    return (
      <ScrollScreen>
        <Sections>
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
        </Sections>
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
  // The range comes from the published result for THIS parameter, never from
  // the trend summary: the summary's range was observed carrying another
  // parameter's limits, and a headline reading "42 % · 150 000–450 000 %" is a
  // clinical claim the screen cannot stand behind.
  const headlineCode = (trend?.parameterCode ?? latestParam?.code ?? '').toUpperCase();
  const headlineRange = latestByCode.get(headlineCode);
  const referenceText =
    headlineRange?.referenceMin !== undefined && headlineRange?.referenceMax !== undefined
      ? `${formatClinicalValue(headlineRange.referenceMin)}–${formatClinicalValue(
          headlineRange.referenceMax,
          headlineRange.unit ?? headlineUnit,
        )}`
      : null;

  const upcoming = summary.data?.nextUpcomingAppointment
    ? new Date(summary.data.nextUpcomingAppointment)
    : null;

  return (
    <ScrollScreen refreshing={refreshing} onRefresh={onRefresh}>
      <Sections rhythm="major">
        {header}

        {/* ------------------------------------------ the last measurement */}
        {headlineName ? (
          <Surface
            onPress={() => router.push('/health-trends')}
            accessibilityLabel={`${t('health.latestTracked')}: ${headlineName}, ${headlineValue ?? '—'} ${headlineUnit ?? ''}. ${rangeLabel ?? ''} ${t('health.viewTrends')}`}
          >
            <View style={{ gap: space.lg }}>
              <ValueBlock
                label={headlineName}
                value={headlineValue === undefined ? '—' : formatClinicalValue(headlineValue)}
                unit={headlineUnit}
                tone={inRange === false ? 'warning' : undefined}
                trailing={<ChevronRight size={iconSize.md} color={colors.textTertiary} />}
                context={
                  <Text variant="caption" tone="tertiary" numberOfLines={2}>
                    {[
                      updatedLabel,
                      measurementCount ? t('units.measurements', { count: measurementCount }) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                }
              />
              {/* The claim and its evidence on one line: what the laboratory
                  flagged, and the range it was measured against. Neither is
                  stated without the other. */}
              {rangeLabel ? (
                <Row gap="md">
                  <Badge label={rangeLabel} tone={inRange ? 'success' : 'warning'} dot />
                  {referenceText ? (
                    <Text variant="caption" tone="tertiary" numberOfLines={1} style={{ flex: 1 }}>
                      {referenceText}
                    </Text>
                  ) : null}
                </Row>
              ) : null}
            </View>
          </Surface>
        ) : null}

        {/* ------------------------------------------------ the next test */}
        {upcoming ? (
          <Surface level="flat" padded="lg">
            <Row gap="md">
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radius.sm,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.clinical.soft,
                }}
              >
                <FlaskConical size={iconSize.md} color={colors.clinical.base} />
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <Text variant="bodyMedium">{t('laboratory.upcoming')}</Text>
                <Text variant="caption" tone="secondary">
                  {formatDate(upcoming, 'long')}
                </Text>
              </View>
            </Row>
          </Surface>
        ) : null}

        {/* ------------------------------------------------- every marker */}
        {parameters.length > 0 ? (
          <Section
            title={t('health.labMarkers')}
            action={
              <LinkButton
                label={t('health.viewTrends')}
                onPress={() => router.push('/health-trends')}
                icon={({ size, color }) => <ChevronRight size={size} color={color} />}
              />
            }
          >
            <ListGroup
              rows={parameters.slice(0, 6).map((param) => {
                const code = param.code.toUpperCase();
                const latest = latestByCode.get(code);
                const flag = latest?.flag;
                const flagged = Boolean(flag && flag !== 'NORMAL');
                const descriptionKey = MARKER_DESCRIPTION_KEY_BY_CODE[code];
                const reference =
                  latest?.referenceMin !== undefined && latest?.referenceMax !== undefined
                    ? `${formatClinicalValue(latest.referenceMin)}–${formatClinicalValue(latest.referenceMax, latest.unit ?? param.unit)}`
                    : descriptionKey
                      ? t(descriptionKey)
                      : undefined;
                return (
                  <RecordRow
                    key={param.code}
                    parameter={param.name}
                    value={param.latestValue === undefined ? '—' : formatClinicalValue(param.latestValue)}
                    unit={param.unit}
                    reference={reference}
                    status={
                      flag
                        ? {
                            label: flagged ? t('health.needsReview') : t('medical.resultFlags.normal'),
                            tone: flagged ? 'warning' : 'success',
                          }
                        : undefined
                    }
                    meta={formatUpdated(param.latestValueDate, { t, formatDate }) ?? undefined}
                    accessibilityLabel={`${param.name}: ${param.latestValue ?? '—'} ${param.unit ?? ''}. ${
                      flag ? (flagged ? t('health.needsReview') : t('medical.resultFlags.normal')) : ''
                    } ${t('health.viewTrends')}`}
                    onPress={() => router.push({ pathname: '/health-trends', params: { code: param.code } })}
                  />
                );
              })}
            />
          </Section>
        ) : null}

        {/* ------------------------------------------------ what the AI said */}
        {/* When AI is switched off in this deployment the section is not shown
            at all; and the availability answer is awaited rather than assumed,
            so the card is never drawn and then withdrawn. */}
        {aiEnabled.data === true ? (
          <Section title={t('health.aiInsights')}>
            <Surface
              onPress={() => router.push('/insights')}
              accessibilityLabel={`${insight.data?.title ?? t('health.aiInsights')}. ${t('medical.aiSafety.disclaimer')}`}
            >
              <View style={{ gap: space.md }}>
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
                    <Brain size={iconSize.md + 2} color={colors.insight.base} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="title">{insight.data?.title ?? t('health.aiInsights')}</Text>
                    <Text variant="body" tone="secondary" numberOfLines={3}>
                      {insight.data?.summary ?? t('health.aiInsightsHint')}
                    </Text>
                  </View>
                  <ChevronRight size={iconSize.md} color={colors.textTertiary} style={{ marginTop: 2 }} />
                </Row>

                {/* The disclaimer is inside the card, under the sentence it
                    qualifies. */}
                <Row gap="sm" align="flex-start" style={{ paddingTop: space.xs }}>
                  <ShieldCheck size={iconSize.sm} color={colors.textTertiary} style={{ marginTop: 1 }} />
                  <Text variant="caption" tone="tertiary" style={{ flex: 1 }}>
                    {t('medical.aiSafety.disclaimer')}
                  </Text>
                </Row>
              </View>
            </Surface>
          </Section>
        ) : null}

        {/* ------------------------------------------- published results */}
        {publishedResults.length > 0 ? (
          <Section
            title={t('health.labResults')}
            action={
              <LinkButton
                label={t('common.viewAll')}
                onPress={() => router.push('/laboratory')}
                icon={({ size, color }) => <ChevronRight size={size} color={color} />}
              />
            }
          >
            <ListGroup
              rows={publishedResults.slice(0, 3).map((result) => {
                const flagged = result.items.some((item) => item.flag && item.flag !== 'NORMAL');
                return (
                  <ListRow
                    key={result.id}
                    icon={({ size, color }) => <FileText size={size} color={color} />}
                    iconTone={flagged ? 'warning' : undefined}
                    title={result.testType.name}
                    subtitle={
                      result.publishedAt
                        ? formatDate(result.publishedAt, 'medium')
                        : t('health.dateUnknown')
                    }
                    subtitleTrailing={
                      <Badge
                        label={flagged ? t('health.needsReview') : t('medical.resultFlags.normal')}
                        tone={flagged ? 'warning' : 'success'}
                        dot
                      />
                    }
                    onPress={() => router.push('/laboratory')}
                  />
                );
              })}
            />
          </Section>
        ) : (
          <Surface level="flat">
            <Row gap="lg">
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyMedium">{t('laboratory.bookBloodTest')}</Text>
                <Text variant="caption" tone="secondary">
                  {t('laboratory.bookHint')}
                </Text>
              </View>
              <LinkButton
                label={t('laboratory.bookATest')}
                onPress={() => router.push('/(lab-booking)/test-type')}
                icon={({ size, color }) => <CalendarPlus size={size} color={color} />}
              />
            </Row>
          </Surface>
        )}

        {/* A section that failed is said once, where it would have been. */}
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

        <Row gap="sm" style={{ justifyContent: 'center', paddingTop: space.sm }}>
          <ShieldCheck size={iconSize.sm} color={colors.textTertiary} />
          <Text variant="caption" tone="tertiary">
            {t('health.privacyNote')}
          </Text>
        </Row>
      </Sections>
    </ScrollScreen>
  );
}
