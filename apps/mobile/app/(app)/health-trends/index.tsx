import { useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Activity, Minus, TrendingDown, TrendingUp } from 'lucide-react-native';
import { LineChart } from 'react-native-chart-kit';
import {
  BottomSheet,
  ChartFrame,
  EmptyState,
  ErrorState,
  ListGroup,
  ListRow,
  RecordRow,
  Row,
  ScreenHeader,
  ScrollScreen,
  Section,
  Sections,
  SegmentedControl,
  Skeleton,
  Stack,
  Surface,
  Text,
  ValueBlock,
  Well,
  iconSize,
  radius,
  space,
  useDesign,
} from '../../../src/design';
import { formatClinicalValue } from '../../../src/utils/clinical';
import { ChevronDown } from 'lucide-react-native';
import {
  useAvailableParameters,
  useParameterHistory,
  useParameterTrend,
} from '../../../src/hooks/useHealth';
import { useTranslation } from '../../../src/i18n';

const TIME_RANGES = ['1M', '3M', '6M', '1Y', '2Y', 'ALL'] as const;
type TimeRange = (typeof TIME_RANGES)[number];

/**
 * Health trends, rebuilt for V2.
 *
 * The screen's job is one series at a time, and the changes here are mostly
 * about what it claimed:
 *
 *   "Tap points for details" sat under the chart. Nothing on the chart was
 *   tappable -- there is no point handler, and never was. It is gone; the
 *   measurements behind the line are listed underneath, where they can
 *   actually be read.
 *
 *   `Previous: 13.8 g/dL`, `Latest: 14.2`, `N data points` and the raw
 *   category enum (`HEMATOLOGY`) were English literals on a screen that ships
 *   in three languages. The category has had a catalogue entry since the
 *   medical namespace shipped and nothing was reading it.
 *
 *   A chart is invisible to a screen reader, so the figure, the direction and
 *   the range it covers are stated in words beside it rather than only drawn.
 *
 * The parameter picker was an inline expanding card that pushed the whole page
 * down; it is a sheet. The range chips are a radiogroup rather than six
 * unrelated buttons.
 */
export default function HealthTrendsScreen() {
  const { t, formatDate } = useTranslation();
  const { colors } = useDesign();

  // Health's marker rows pass the marker they name. Without this the screen
  // always opened on whichever parameter came back first, so four of the five
  // rows opened something other than the one that was tapped.
  const { code: requestedCode } = useLocalSearchParams<{ code?: string }>();
  const [selectedParam, setSelectedParam] = useState<string | null>(requestedCode ?? null);
  const [range, setRange] = useState<TimeRange>('1Y');
  const [picking, setPicking] = useState(false);
  // The chart is a fixed-pixel canvas, so it has to be told how wide its
  // card actually is. Measuring beats deriving it from `Dimensions` minus a
  // guessed stack of paddings -- that guess was 48px too narrow, which is
  // why the plot sat off-centre inside its card.
  const [chartWidth, setChartWidth] = useState(0);

  const parameters = useAvailableParameters();
  const trend = useParameterTrend(selectedParam, range);
  const history = useParameterHistory(selectedParam, 10);

  const available = useMemo(() => parameters.data ?? [], [parameters.data]);

  useEffect(() => {
    if (!selectedParam && available.length > 0) {
      setSelectedParam(available[0]!.code);
    }
  }, [available, selectedParam]);

  const header = (
    <ScreenHeader
      title={t('healthTrends.title')}
      size="large"
      onBack={() => router.back()}
      backLabel={t('common.a11yGoBack')}
    />
  );

  if (parameters.isPending) {
    return (
      <ScrollScreen header={header}>
        <Stack gap="lg">
          <Skeleton height={56} />
          <Skeleton height={44} />
          <Skeleton height={220} />
        </Stack>
      </ScrollScreen>
    );
  }

  if (parameters.isError) {
    return (
      <ScrollScreen header={header}>
        <ErrorState
          title={t('healthTrends.loadFailed')}
          description={t('common.offline')}
          retryLabel={t('common.retry')}
          onRetry={() => void parameters.refetch()}
        />
      </ScrollScreen>
    );
  }

  if (available.length === 0) {
    return (
      <ScrollScreen header={header}>
        <EmptyState
          title={t('healthTrends.empty')}
          description={t('healthTrends.emptyHint')}
          icon={({ size, color }) => <Activity size={size} color={color} />}
        />
      </ScrollScreen>
    );
  }

  const parameter = available.find((p) => p.code === selectedParam);
  const data = trend.data ?? null;
  const points = data?.points ?? [];

  const directionKey =
    data && ['INCREASING', 'DECREASING', 'STABLE'].includes(data.trend)
      ? `medical.trendDirection.${data.trend}`
      : 'medical.trendDirection.INSUFFICIENT_DATA';

  const directionIcon =
    data?.trend === 'INCREASING' ? (
      <TrendingUp size={iconSize.sm} color={colors.warning.base} />
    ) : data?.trend === 'DECREASING' ? (
      <TrendingDown size={iconSize.sm} color={colors.clinical.base} />
    ) : data?.trend === 'STABLE' ? (
      <Minus size={iconSize.sm} color={colors.success.base} />
    ) : (
      <Activity size={iconSize.sm} color={colors.textTertiary} />
    );

  const change =
    data?.absoluteChange === undefined
      ? null
      : `${data.absoluteChange >= 0 ? '+' : ''}${data.absoluteChange.toFixed(2)}${
          data.percentageChange !== undefined
            ? ` (${data.percentageChange >= 0 ? '+' : ''}${data.percentageChange.toFixed(1)}%)`
            : ''
        }`;

  /**
   * Whether the reference range can be drawn, not merely printed.
   *
   * It was stated in words below the chart and left off the chart itself, so a
   * donor could read "reference range: 13.5 - 17.5" and then look at a line
   * with no idea which part of it was inside that. Two flat dashed series put
   * the range where the eye already is.
   */
  const band =
    data?.hasReferenceRange && data.referenceMin !== undefined && data.referenceMax !== undefined
      ? { min: data.referenceMin, max: data.referenceMax }
      : null;

  const chartData =
    points.length > 1
      ? {
          /**
           * One label per point, blanked rather than dropped.
           *
           * The previous version built a label for every measurement and then
           * `filter`ed the array down to five. chart-kit spreads whatever
           * labels it is given evenly across the full width, so five labels
           * over twenty points do not land on the points they name -- the
           * x-axis read "3/14" under a measurement taken in April. On a
           * clinical chart a mislabelled date is not a cosmetic problem: it is
           * the axis telling the donor something untrue. Keeping the array 1:1
           * and emptying the entries we do not want shown keeps every
           * remaining label over its own measurement.
           */
          labels: points.map((p, i, arr) => {
            const show =
              i === 0 || i === arr.length - 1 || arr.length <= 7 || i % Math.ceil(arr.length / 5) === 0;
            if (!show) return '';
            const date = new Date(p.date);
            return `${date.getMonth() + 1}/${date.getDate()}`;
          }),
          datasets: [
            {
              data: points.map((p) => p.value),
              // Clinical blue, not rose. Rose is this app's alarm colour, and a
              // trend line drawn in it reports every value as a concern --
              // including the ones the laboratory called normal.
              color: () => colors.clinical.base,
              strokeWidth: 2,
            },
            ...(band
              ? [
                  {
                    data: points.map(() => band.min),
                    color: () => colors.textTertiary,
                    strokeWidth: 1,
                    withDots: false,
                    strokeDashArray: [4, 4],
                  },
                  {
                    data: points.map(() => band.max),
                    color: () => colors.textTertiary,
                    strokeWidth: 1,
                    withDots: false,
                    strokeDashArray: [4, 4],
                  },
                ]
              : []),
          ],
        }
      : null;

  return (
    <ScrollScreen
      header={header}
      refreshing={trend.isRefetching}
      onRefresh={() => {
        void parameters.refetch();
        void trend.refetch();
        void history.refetch();
      }}
    >
      <Sections rhythm="major">
        {/* The parameter picker and the range: the two controls, side by
            side at the top, so the chart under them is what the screen is. */}
        <Stack gap="md">
          <Surface
            level="flat"
            padded="lg"
            onPress={() => setPicking(true)}
            accessibilityLabel={`${t('healthTrends.parameter')}: ${
              parameter?.name ?? t('healthTrends.selectParameter')
            }`}
          >
            <Row gap="md">
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="overline" tone="tertiary" caps>
                  {t('healthTrends.parameter')}
                </Text>
                <Text variant="title">
                  {data?.parameterName ?? parameter?.name ?? t('healthTrends.selectParameter')}
                </Text>
                {parameter ? (
                  <Text variant="caption" tone="tertiary">
                    {`${t(`medical.testCategories.${parameter.category}`)} · ${t(
                      'units.measurements',
                      { count: parameter.measurementCount },
                    )}`}
                  </Text>
                ) : null}
              </View>
              <ChevronDown size={iconSize.md} color={colors.textTertiary} />
            </Row>
          </Surface>

          <SegmentedControl
            accessibilityLabel={t('healthTrends.timeRange')}
            value={range}
            onChange={(value) => setRange(value as TimeRange)}
            options={TIME_RANGES.map((value) => ({ value, label: value }))}
          />
        </Stack>

        {trend.isPending ? (
          <Skeleton height={220} corner="lg" />
        ) : trend.isError ? (
          <ErrorState
            title={t('healthTrends.loadFailed')}
            description={t('common.offline')}
            retryLabel={t('common.retry')}
            onRetry={() => void trend.refetch()}
          />
        ) : !data || points.length === 0 ? (
          <EmptyState
            title={t('healthTrends.singleResult')}
            description={t('healthTrends.singleResultHint')}
            icon={({ size, color }) => <Activity size={size} color={color} />}
          />
        ) : (
          <>
            {/* ------------------------------------------- where it stands */}
            <Surface>
              <View style={{ gap: space.lg }}>
                <ValueBlock
                  label={data.parameterName}
                  value={formatClinicalValue(data.latestValue)}
                  unit={data.unit}
                  context={
                    <Text variant="caption" tone="tertiary">
                      {[
                        data.latestValueDate
                          ? formatDate(data.latestValueDate, 'medium')
                          : t('common.unknown'),
                        data.latestValueLaboratory,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  }
                  trailing={
                    <View style={{ alignItems: 'flex-end', gap: space.xs }}>
                      <Row gap="xs">
                        {directionIcon}
                        <Text variant="label" tone="secondary">
                          {t(directionKey)}
                        </Text>
                      </Row>
                      {change ? (
                        <Text variant="caption" tone="tertiary" style={{ fontVariant: ['tabular-nums'] }}>
                          {change}
                        </Text>
                      ) : null}
                      {data.previousValue !== undefined ? (
                        <Text variant="caption" tone="tertiary">
                          {t('healthTrends.previousValue', {
                            value: `${formatClinicalValue(data.previousValue)}${data.unit ? ` ${data.unit}` : ''}`,
                          })}
                        </Text>
                      ) : null}
                    </View>
                  }
                />

                {/* The reference range is the laboratory's, stated as theirs.
                    Without one the screen says so rather than implying the
                    value is fine. */}
                <Well>
                  {data.hasReferenceRange &&
                  data.referenceMin !== undefined &&
                  data.referenceMax !== undefined ? (
                    <Stack gap="xs">
                      <Text variant="label">
                        {`${t('medical.reference.referenceRange')}: ${formatClinicalValue(data.referenceMin)} – ${formatClinicalValue(
                          data.referenceMax,
                        )}${data.unit ? ` ${data.unit}` : ''}`}
                      </Text>
                      <Text variant="caption" tone="tertiary">
                        {t('healthTrends.referenceFromLab')}
                      </Text>
                    </Stack>
                  ) : (
                    <Text variant="caption" tone="tertiary">
                      {t('medical.reference.referenceUnavailable')}
                    </Text>
                  )}
                </Well>
              </View>
            </Surface>

            {/* ------------------------------------------------- the shape */}
            <View onLayout={(event) => setChartWidth(event.nativeEvent.layout.width - space.lg * 2)}>
              <ChartFrame
                title={t('healthTrends.trendChart')}
                unit={data.unit}
                period={
                  points.length > 1
                    ? `${formatDate(points[0]!.date, 'medium')} – ${formatDate(points[points.length - 1]!.date, 'medium')}`
                    : undefined
                }
                legend={[
                  { label: data.parameterName, tone: 'clinical' },
                  ...(band ? [{ label: t('medical.reference.referenceRange'), tone: 'reference' as const }] : []),
                ]}
                footnote={t('units.measurements', { count: points.length })}
              >
                {/* A chart says nothing to a screen reader, so the series is
                    described in words and the drawing itself is hidden from
                    assistive technology rather than announced as a picture of
                    numbers. */}
                <View
                  accessible
                  accessibilityRole="image"
                  accessibilityLabel={t('healthTrends.chartSummary', {
                    parameter: data.parameterName,
                    count: points.length,
                    direction: t(directionKey),
                  })}
                  style={{ marginHorizontal: -space.sm }}
                >
                  {chartData && chartWidth > 0 ? (
                    <LineChart
                      data={chartData}
                      width={chartWidth + space.sm * 2}
                      height={220}
                      chartConfig={{
                        backgroundColor: colors.surface,
                        backgroundGradientFrom: colors.surface,
                        backgroundGradientTo: colors.surface,
                        decimalPlaces: 1,
                        color: () => colors.clinical.base,
                        labelColor: () => colors.textTertiary,
                        style: { borderRadius: radius.md },
                        propsForDots: { r: '3', strokeWidth: '2', stroke: colors.clinical.base },
                        propsForBackgroundLines: {
                          strokeDasharray: '',
                          stroke: colors.divider,
                          strokeWidth: 0.5,
                        },
                        propsForLabels: { fontSize: 11 },
                      }}
                      /*
                        `bezier` is deliberately absent. A smoothed curve
                        between two measurements draws a value at every pixel
                        between them and overshoots. Straight segments claim
                        only what the laboratory reported.
                      */
                      withInnerLines
                      withOuterLines={false}
                      withVerticalLines={false}
                      withHorizontalLines
                      style={{ marginVertical: space.xs, borderRadius: radius.md }}
                    />
                  ) : null}
                </View>
              </ChartFrame>
            </View>

            {/* ------------------------------------------ the measurements */}
            <Section title={t('healthTrends.history')}>
              {history.isPending ? (
                <Skeleton height={64} />
              ) : history.data && history.data.history.length > 0 ? (
                <ListGroup
                  rows={history.data.history.map((item, index) => (
                    <RecordRow
                      key={item.resultId || index}
                      parameter={item.date ? formatDate(item.date, 'medium') : t('common.unknown')}
                      reference={item.laboratoryName}
                      value={formatClinicalValue(item.value)}
                      unit={item.unit}
                      status={
                        item.flag && item.flag !== 'NORMAL'
                          ? { label: t(`medical.resultFlagsByCode.${item.flag}`), tone: 'warning' }
                          : undefined
                      }
                    />
                  ))}
                />
              ) : (
                <Text variant="caption" tone="tertiary">
                  {t('healthTrends.singleResultHint')}
                </Text>
              )}
            </Section>
          </>
        )}
      </Sections>

      <BottomSheet
        visible={picking}
        onClose={() => setPicking(false)}
        title={t('healthTrends.selectParameter')}
        closeLabel={t('common.close')}
      >
        <ListGroup
          rows={available.map((param) => (
            <ListRow
              key={param.code}
              title={param.name}
              subtitle={`${t(`medical.testCategories.${param.category}`)} · ${t(
                'units.measurements',
                { count: param.measurementCount },
              )}`}
              value={
                param.latestValue !== undefined
                  ? `${param.latestValue}${param.unit ? ` ${param.unit}` : ''}`
                  : undefined
              }
              onPress={() => {
                setSelectedParam(param.code);
                setPicking(false);
              }}
            />
          ))}
        />
      </BottomSheet>
    </ScrollScreen>
  );
}
