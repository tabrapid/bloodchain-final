import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Activity, Minus, TrendingDown, TrendingUp } from 'lucide-react-native';
import { LineChart } from 'react-native-chart-kit';
import {
  Badge,
  BottomSheet,
  EmptyState,
  ErrorState,
  ListGroup,
  ListRow,
  OptionGrid,
  Row,
  ScreenHeader,
  ScrollScreen,
  SectionHeader,
  Skeleton,
  Stack,
  Surface,
  Text,
  ValueText,
  Well,
  iconSize,
  radius,
  space,
  useDesign,
} from '../../../src/design';
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

  const [selectedParam, setSelectedParam] = useState<string | null>(null);
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

  const available = parameters.data ?? [];

  useEffect(() => {
    if (!selectedParam && available.length > 0) {
      setSelectedParam(available[0]!.code);
    }
  }, [available, selectedParam]);

  const header = <ScreenHeader title={t('healthTrends.title')} />;

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

  const chartData =
    points.length > 1
      ? {
          labels: points
            .map((p) => {
              const date = new Date(p.date);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            })
            .filter(
              (_, i, arr) =>
                i === 0 || i === arr.length - 1 || arr.length <= 7 || i % Math.ceil(arr.length / 5) === 0,
            ),
          datasets: [{ data: points.map((p) => p.value), color: () => colors.rose.base, strokeWidth: 2 }],
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
      <Stack gap="xl">
        <Text variant="body" tone="secondary">
          {t('healthTrends.subtitle')}
        </Text>

        <Stack gap="md">
          <SectionHeader title={t('healthTrends.parameter')} />
          <Surface
            onPress={() => setPicking(true)}
            accessibilityLabel={`${t('healthTrends.parameter')}: ${
              parameter?.name ?? t('healthTrends.selectParameter')
            }`}
          >
            <Row gap="md">
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong">
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
              <Text variant="caption" tone="tertiary">
                ▾
              </Text>
            </Row>
          </Surface>
        </Stack>

        <Stack gap="md">
          <SectionHeader title={t('healthTrends.timeRange')} />
          <OptionGrid
            accessibilityLabel={t('healthTrends.timeRange')}
            columns={3}
            value={range}
            onChange={(value) => setRange(value as TimeRange)}
            options={TIME_RANGES.map((value) => ({ value, label: value }))}
          />
        </Stack>

        {trend.isPending ? (
          <Skeleton height={200} />
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
          <Stack gap="xl">
            {/* ------------------------------------------- where it stands */}
            <Surface>
              <Stack gap="md">
                <Row gap="lg" align="flex-start">
                  <View style={{ gap: 2 }}>
                    <Row gap="xs" align="baseline">
                      <ValueText variant="display">{data.latestValue}</ValueText>
                      {data.unit ? (
                        <Text variant="h3" tone="secondary">
                          {data.unit}
                        </Text>
                      ) : null}
                    </Row>
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
                  </View>
                  <View style={{ flex: 1, alignItems: 'flex-end', gap: space.xs }}>
                    <Row gap="xs">
                      {directionIcon}
                      <Text variant="caption" tone="secondary">
                        {t(directionKey)}
                      </Text>
                    </Row>
                    {change ? (
                      <Text variant="label" tone="secondary">
                        {change}
                      </Text>
                    ) : null}
                    {data.previousValue !== undefined ? (
                      <Text variant="caption" tone="tertiary">
                        {t('healthTrends.previousValue', {
                          value: `${data.previousValue}${data.unit ? ` ${data.unit}` : ''}`,
                        })}
                      </Text>
                    ) : null}
                  </View>
                </Row>

                {/* The reference range is the laboratory's, stated as theirs.
                    Without one the screen says so rather than implying the
                    value is fine. */}
                <Well>
                  {data.hasReferenceRange &&
                  data.referenceMin !== undefined &&
                  data.referenceMax !== undefined ? (
                    <Stack gap="xs">
                      <Text variant="label">
                        {`${t('medical.reference.referenceRange')}: ${data.referenceMin} – ${
                          data.referenceMax
                        }${data.unit ? ` ${data.unit}` : ''}`}
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
              </Stack>
            </Surface>

            {/* ------------------------------------------------- the shape */}
            <Stack gap="md">
              <SectionHeader title={t('healthTrends.trendChart')} />
              <Surface
                padded={false}
                style={{ overflow: 'hidden' }}
                onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}
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
                >
                  {chartData && chartWidth > 0 ? (
                    <LineChart
                      data={chartData}
                      width={chartWidth}
                      height={220}
                      chartConfig={{
                        backgroundColor: colors.surface,
                        backgroundGradientFrom: colors.surface,
                        backgroundGradientTo: colors.surface,
                        decimalPlaces: 1,
                        color: () => colors.rose.base,
                        labelColor: () => colors.textTertiary,
                        style: { borderRadius: radius.md },
                        propsForDots: { r: '3', strokeWidth: '2', stroke: colors.rose.base },
                        propsForBackgroundLines: {
                          strokeDasharray: '',
                          stroke: colors.divider,
                          strokeWidth: 0.5,
                        },
                      }}
                      bezier
                      withInnerLines
                      withOuterLines={false}
                      withVerticalLines={false}
                      withHorizontalLines
                      style={{ marginVertical: space.sm, borderRadius: radius.md }}
                    />
                  ) : null}
                </View>
                <View style={{ padding: space.lg, paddingTop: 0 }}>
                  <Text variant="caption" tone="tertiary">
                    {t('units.measurements', { count: points.length })}
                  </Text>
                </View>
              </Surface>
            </Stack>

            {/* ------------------------------------------ the measurements */}
            <Stack gap="md">
              <SectionHeader title={t('healthTrends.history')} />
              {history.isPending ? (
                <Skeleton height={64} />
              ) : history.data && history.data.history.length > 0 ? (
                <ListGroup
                  rows={history.data.history.map((item, index) => (
                    <ListRow
                      key={item.resultId || index}
                      title={`${item.value}${item.unit ? ` ${item.unit}` : ''}`}
                      subtitle={[
                        item.date ? formatDate(item.date, 'medium') : t('common.unknown'),
                        item.laboratoryName,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                      trailing={
                        item.flag && item.flag !== 'NORMAL' ? (
                          <Badge
                            label={t(`medical.resultFlagsByCode.${item.flag}`)}
                            tone="warning"
                          />
                        ) : undefined
                      }
                    />
                  ))}
                />
              ) : (
                <Text variant="caption" tone="tertiary">
                  {t('healthTrends.singleResultHint')}
                </Text>
              )}
            </Stack>
          </Stack>
        )}
      </Stack>

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
