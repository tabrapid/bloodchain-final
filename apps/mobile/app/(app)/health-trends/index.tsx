import { useCallback, useEffect, useState } from 'react';
import { View, TouchableOpacity, RefreshControl } from 'react-native';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  Calendar,
  Activity,
  FlaskConical,
} from 'lucide-react-native';
import { LineChart } from 'react-native-chart-kit';
import { AppButton, AppText, Card, GlassCard, LoadingState, Screen, ScreenHeader, SectionHeader } from '../../../src/components';
import { layout, spacing, useTheme } from '../../../src/theme';
import { useTranslation } from '../../../src/i18n';
import {
  getTrendSummary,
  getAvailableParameters,
  getParameterTrend,
  getParameterHistory,
  AvailableParameter,
  TrendData,
  TrendHistoryResponse,
} from '../../../src/api/health-trends';

const TIME_RANGES = ['1M', '3M', '6M', '1Y', '2Y', 'ALL'] as const;

export default function HealthTrendsScreen() {
  const { t, formatDate } = useTranslation();
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getTrendSummary>> | null>(null);
  const [availableParams, setAvailableParams] = useState<AvailableParameter[]>([]);
  const [selectedParam, setSelectedParam] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<string>('1Y');
  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [history, setHistory] = useState<TrendHistoryResponse | null>(null);
  const [showParamSelector, setShowParamSelector] = useState(false);
  // The chart is a fixed-pixel canvas, so it has to be told how wide its
  // card actually is. Measuring beats deriving it from `Dimensions` minus a
  // guessed stack of paddings -- that guess was 48px too narrow, which is
  // why the plot sat off-centre inside its card.
  const [chartWidth, setChartWidth] = useState(0);

  const loadSummary = useCallback(async () => {
    try {
      const [sum, params] = await Promise.all([
        getTrendSummary(selectedRange),
        getAvailableParameters(),
      ]);
      setSummary(sum);
      setAvailableParams(params);
      if (params.length > 0 && !selectedParam && params[0]) {
        setSelectedParam(params[0].code);
      }
      setLoadError(false);
    } catch (err) {
      console.error('Failed to load trend summary:', err);
      setLoadError(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedRange, selectedParam]);

  const loadTrendData = useCallback(async () => {
    if (!selectedParam) return;
    try {
      const [trend, hist] = await Promise.all([
        getParameterTrend(selectedParam, { range: selectedRange }),
        getParameterHistory(selectedParam, 10, 0),
      ]);
      setTrendData(trend);
      setHistory(hist);
    } catch (err) {
      console.error('Failed to load trend data:', err);
    }
  }, [selectedParam, selectedRange]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadTrendData();
  }, [loadTrendData]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadSummary();
    loadTrendData();
  }, [loadSummary, loadTrendData]);

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'INCREASING':
        return <TrendingUp size={16} color={colors.warning} />;
      case 'DECREASING':
        return <TrendingDown size={16} color={colors.danger} />;
      case 'STABLE':
        return <Minus size={16} color={colors.success} />;
      default:
        return <Activity size={16} color={colors.textMuted} />;
    }
  };

  const getTrendLabel = (trend: string) =>
    trend === 'INCREASING' || trend === 'DECREASING' || trend === 'STABLE'
      ? t(`medical.trendDirection.${trend}`)
      : t('medical.trendDirection.INSUFFICIENT_DATA');

  const formatChange = (change?: number, percent?: number) => {
    if (change === undefined) return null;
    const sign = change >= 0 ? '+' : '';
    const pctStr = percent !== undefined ? ` (${sign}${percent.toFixed(1)}%)` : '';
    return `${sign}${change.toFixed(2)}${pctStr}`;
  };

  const formatPointDate = (dateStr?: string) =>
    dateStr ? formatDate(dateStr, 'medium') : t('common.unknown');

  const chartData = trendData?.points && trendData.points.length > 0
    ? {
        labels: trendData.points.map((p) => {
          const date = new Date(p.date);
          return `${date.getMonth() + 1}/${date.getDate()}`;
        }).filter((_, i, arr) => i === 0 || i === arr.length - 1 || arr.length <= 7 || i % Math.ceil(arr.length / 5) === 0),
        datasets: [
          {
            data: trendData.points.map((p) => p.value),
            color: () => colors.primary,
            strokeWidth: 2,
          },
        ],
      }
    : null;

  const chartOptions = {
    backgroundColor: colors.surfaceSolid,
    backgroundGradientFrom: colors.surfaceSolid,
    backgroundGradientTo: colors.surfaceSolid,
    decimalPlaces: 1,
    color: () => colors.primary,
    labelColor: () => colors.textMuted,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: colors.primary,
    },
  };

  if (isLoading) {
    return (
      <Screen>
        <ScreenHeader title={t('healthTrends.title')} />
        <LoadingState />
      </Screen>
    );
  }

  if (!summary || availableParams.length === 0) {
    return (
      <Screen>
        <ScreenHeader title={t('healthTrends.title')} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
          <FlaskConical size={64} color={colors.textMuted} />
          <AppText variant="heading" style={{ marginTop: spacing.lg, textAlign: 'center' }}>
            {loadError ? t('healthTrends.loadFailed') : t('healthTrends.empty')}
          </AppText>
          <AppText muted style={{ marginTop: spacing.sm, textAlign: 'center' }}>
            {loadError
              ? t('common.offline')
              : t('healthTrends.emptyHint')}
          </AppText>
          {loadError && (
            <AppButton
              variant="secondary"
              onPress={() => {
                setIsLoading(true);
                loadSummary();
              }}
              style={{ marginTop: spacing.lg }}
            >
              {t('common.retry')}
            </AppButton>
          )}
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <ScreenHeader title={t('healthTrends.title')} />
      <AppText muted style={{ marginBottom: spacing.lg }}>
        {t('healthTrends.subtitle')}
      </AppText>

      <SectionHeader>{t('healthTrends.parameter')}</SectionHeader>
      <TouchableOpacity
        onPress={() => setShowParamSelector(!showParamSelector)}
        style={{
          backgroundColor: colors.surface,
          borderRadius: 12,
          padding: spacing.md,
          marginBottom: spacing.lg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <View>
          <AppText variant="heading">
            {trendData?.parameterName || availableParams.find((p) => p.code === selectedParam)?.name || t('healthTrends.selectParameter')}
          </AppText>
          {selectedParam && availableParams.find((p) => p.code === selectedParam) && (
            <AppText muted style={{ fontSize: 13 }}>
              {availableParams.find((p) => p.code === selectedParam)?.category} •{' '}
              {t('units.measurements', {
                count: availableParams.find((p) => p.code === selectedParam)?.measurementCount ?? 0,
              })}
            </AppText>
          )}
        </View>
        {/* The array form, not the CSS string: this is an `Svg`, and
            react-native-svg parses `transform` with an SVG transform-list
            parser that rejects `rotate(180deg)` outright -- which is the
            "Expected transform functions but \"r\" found" the screen threw on
            every render. */}
        <ChevronDown
          size={20}
          color={colors.textMuted}
          style={{ transform: [{ rotate: showParamSelector ? '180deg' : '0deg' }] }}
        />
      </TouchableOpacity>

      {showParamSelector && (
        <Card style={{ marginBottom: layout.cardGap }}>
          {availableParams.map((param) => (
            <TouchableOpacity
              key={param.code}
              onPress={() => {
                setSelectedParam(param.code);
                setShowParamSelector(false);
              }}
              style={{
                padding: spacing.md,
                borderRadius: 8,
                backgroundColor: param.code === selectedParam ? colors.primaryMuted : 'transparent',
              }}
            >
              <AppText variant="heading" style={{ color: param.code === selectedParam ? colors.onMuted.primary : colors.text }}>
                {param.name}
              </AppText>
              <AppText muted style={{ fontSize: 12 }}>
                {param.category} • {t('units.measurements', { count: param.measurementCount })}
                {param.latestValue !== undefined ? ` • Latest: ${param.latestValue} ${param.unit || ''}` : ''}
              </AppText>
            </TouchableOpacity>
          ))}
        </Card>
      )}

      <SectionHeader>{t('healthTrends.timeRange')}</SectionHeader>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
        {TIME_RANGES.map((range) => (
          <TouchableOpacity
            key={range}
            onPress={() => setSelectedRange(range)}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: 20,
              backgroundColor: selectedRange === range ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor: selectedRange === range ? colors.primary : colors.border,
            }}
          >
            <AppText
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: selectedRange === range ? colors.text : colors.textMuted,
              }}
            >
              {range}
            </AppText>
          </TouchableOpacity>
        ))}
      </View>

      {trendData && trendData.points.length > 0 ? (
        <>
          <SectionHeader>{t('medical.reference.currentValue')}</SectionHeader>
          <Card style={{ marginBottom: layout.cardGap }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
                  <AppText variant="display" style={{ fontSize: 36 }}>
                    {trendData.latestValue}
                  </AppText>
                  <AppText muted>{trendData.unit}</AppText>
                </View>
                <AppText muted style={{ fontSize: 13, marginTop: spacing.xs }}>
                  {formatPointDate(trendData.latestValueDate)}
                  {trendData.latestValueLaboratory ? ` • ${trendData.latestValueLaboratory}` : ''}
                </AppText>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  {getTrendIcon(trendData.trend)}
                  <AppText muted style={{ fontSize: 13 }}>
                    {getTrendLabel(trendData.trend)}
                  </AppText>
                </View>
                {trendData.absoluteChange !== undefined && (
                  <AppText
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      marginTop: spacing.xs,
                      color: trendData.absoluteChange >= 0 ? colors.warning : colors.danger,
                    }}
                  >
                    {formatChange(trendData.absoluteChange, trendData.percentageChange)}
                  </AppText>
                )}
                {trendData.previousValue !== undefined && (
                  <AppText muted style={{ fontSize: 12, marginTop: spacing.xs }}>
                    Previous: {trendData.previousValue} {trendData.unit}
                  </AppText>
                )}
              </View>
            </View>
          </Card>

          <SectionHeader>{t('medical.reference.referenceRange')}</SectionHeader>
          <GlassCard style={{ marginBottom: layout.cardGap }}>
            {trendData.hasReferenceRange && trendData.referenceMin !== undefined && trendData.referenceMax !== undefined ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: colors.successMuted,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Activity size={20} color={colors.onMuted.success} />
                </View>
                <View>
                  <AppText variant="heading">
                    {trendData.referenceMin} – {trendData.referenceMax} {trendData.unit}
                  </AppText>
                  <AppText muted style={{ fontSize: 12 }}>
                    {t('healthTrends.referenceFromLab')}
                  </AppText>
                </View>
              </View>
            ) : (
              <AppText muted>{t('medical.reference.referenceUnavailable')}</AppText>
            )}
          </GlassCard>

          <SectionHeader>{t('healthTrends.trendChart')}</SectionHeader>
          <Card
            style={{ marginBottom: layout.cardGap, padding: 0, overflow: 'hidden' }}
            onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}
          >
            {chartData && chartWidth > 0 && (
              <LineChart
                data={chartData}
                width={chartWidth}
                height={220}
                chartConfig={{
                  ...chartOptions,
                  propsForBackgroundLines: {
                    strokeDasharray: '',
                    stroke: colors.border,
                    strokeWidth: 0.5,
                  },
                }}
                bezier
                style={{
                  marginVertical: spacing.sm,
                  borderRadius: 16,
                }}
                withInnerLines={true}
                withOuterLines={false}
                withVerticalLines={false}
                withHorizontalLines={true}
                withVerticalLabels={true}
                withHorizontalLabels={true}
                fromZero={false}
              />
            )}
            <View style={{ padding: spacing.md }}>
              <AppText muted style={{ fontSize: 12 }}>
                {trendData.points.length} data points • Tap points for details
              </AppText>
            </View>
          </Card>

          <SectionHeader>{t('healthTrends.history')}</SectionHeader>
          {history && history.history.length > 0 ? (
            history.history.map((item, index) => (
              <Card key={item.resultId || index} style={{ marginBottom: spacing.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <AppText variant="heading">{item.value} {item.unit}</AppText>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}>
                      <Calendar size={12} color={colors.textMuted} />
                      <AppText muted style={{ fontSize: 12 }}>{formatPointDate(item.date)}</AppText>
                      {item.laboratoryName && (
                        <>
                          <AppText muted>•</AppText>
                          <AppText muted style={{ fontSize: 12 }}>{item.laboratoryName}</AppText>
                        </>
                      )}
                    </View>
                  </View>
                  {item.flag && item.flag !== 'NORMAL' && (
                    <View
                      style={{
                        paddingHorizontal: spacing.sm,
                        paddingVertical: 2,
                        borderRadius: 4,
                        backgroundColor: colors.warningMuted,
                      }}
                    >
                      <AppText style={{ fontSize: 11, color: colors.onMuted.warning }}>
                        {t(`medical.resultFlagsByCode.${item.flag}`)}
                      </AppText>
                    </View>
                  )}
                </View>
              </Card>
            ))
          ) : (
            <GlassCard>
              <AppText muted style={{ textAlign: 'center' }}>
                {t('healthTrends.singleResultHint')}
              </AppText>
            </GlassCard>
          )}
        </>
      ) : (
        <GlassCard>
          <View style={{ alignItems: 'center', padding: spacing.xl }}>
            <Activity size={48} color={colors.textMuted} />
            <AppText variant="heading" style={{ marginTop: spacing.md, textAlign: 'center' }}>
              {t('healthTrends.singleResult')}
            </AppText>
            <AppText muted style={{ marginTop: spacing.sm, textAlign: 'center' }}>
              {t('healthTrends.singleResultHint')}
            </AppText>
          </View>
        </GlassCard>
      )}
    </Screen>
  );
}
