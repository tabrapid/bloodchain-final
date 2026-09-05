import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { TouchableOpacity, View, RefreshControl, ScrollView } from 'react-native';
import {
  Activity,
  Brain,
  ChevronRight,
  Droplet,
  Fingerprint,
  FlaskConical,
  Gauge,
  Layers,
  Percent,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react-native';
import { AppText, Card, Divider, GlassCard, GradientCard, LoadingState, OverviewStat, Screen, SectionHeader, Sparkline } from '../../src/components';
import { spacing, typography, useTheme } from '../../src/theme';
import { getTrendSummary, TrendSummary } from '../../src/api/health-trends';
import { getDonorResults, LaboratoryResult } from '../../src/api/laboratory';
import { getInsightHistory, AiInsight } from '../../src/api/ai-health';

type VitalColorKey = 'primary' | 'secondary' | 'warning' | 'ai' | 'success';

// Keyed by the real lab-parameter code (see apps/api/prisma/seed.ts's
// TestParameter records) so each vital gets the icon that actually matches
// what it measures, instead of cycling icons by list position -- which is
// how hemoglobin ended up with a "wind" icon and platelets a "thermometer".
const VITAL_ICON_BY_CODE: Record<string, { icon: LucideIcon; color: VitalColorKey }> = {
  HEMOGLOBIN: { icon: Droplet, color: 'primary' },
  HEMATOCRIT: { icon: Percent, color: 'secondary' },
  RBC: { icon: Activity, color: 'primary' },
  WBC: { icon: ShieldCheck, color: 'success' },
  PLATELETS: { icon: Layers, color: 'warning' },
  FERRITIN: { icon: Gauge, color: 'ai' },
  FERRITIN_LEVEL: { icon: Gauge, color: 'ai' },
  BLOOD_GROUP: { icon: Fingerprint, color: 'secondary' },
  ABO: { icon: Fingerprint, color: 'secondary' },
  RH_FACTOR: { icon: Fingerprint, color: 'secondary' },
};

const VITAL_FALLBACK_ORDER: VitalColorKey[] = ['primary', 'secondary', 'warning', 'ai', 'success'];

function getVitalIconAndColor(
  code: string,
  index: number,
): { icon: LucideIcon; color: VitalColorKey } {
  return VITAL_ICON_BY_CODE[code.toUpperCase()] ?? {
    icon: Activity,
    color: VITAL_FALLBACK_ORDER[index % VITAL_FALLBACK_ORDER.length]!,
  };
}

export default function Health() {
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [summary, setSummary] = useState<TrendSummary | null>(null);
  const [labResults, setLabResults] = useState<LaboratoryResult[]>([]);
  const [latestInsight, setLatestInsight] = useState<AiInsight | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [trendData, resultsData, insightData] = await Promise.all([
        getTrendSummary(),
        getDonorResults().catch(() => []),
        getInsightHistory({ limit: 1 }).catch(() => ({ insights: [], total: 0 })),
      ]);
      setSummary(trendData);
      setLabResults(resultsData);
      setLatestInsight(insightData.insights[0] ?? null);
    } catch (err) {
      console.error('Failed to load health summary:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadData();
  }, [loadData]);

  if (isLoading) {
    return (
      <Screen>
        <AppText variant="title">Health</AppText>
        <LoadingState />
      </Screen>
    );
  }

  const latestParam = summary?.availableParameters[0];
  const trend = summary?.recentTrend;
  const trendValues = trend?.points.map((p) => p.value) ?? [];
  const trendMin = trendValues.length ? Math.min(...trendValues) : undefined;
  const trendMax = trendValues.length ? Math.max(...trendValues) : undefined;
  const TrendIcon = trend?.trend === 'INCREASING' ? TrendingUp : trend?.trend === 'DECREASING' ? TrendingDown : undefined;

  return (
    <Screen>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <AppText variant="title">Health</AppText>
        <AppText muted style={{ fontSize: 13, marginTop: 2 }}>
          Your vitals overview
        </AppText>

        {(trend || latestParam) && (
          <TouchableOpacity
            onPress={() => router.push('/health-trends' as RelativePathString)}
            activeOpacity={0.9}
            style={{ marginTop: spacing.lg }}
          >
            <GradientCard colors={colors.heroGradient}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <AppText style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: 'rgba(255,255,255,0.8)' }}>
                    LATEST TRACKED
                  </AppText>
                  <AppText style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF', marginTop: 2 }}>
                    {(trend?.parameterName ?? latestParam?.name)!}
                  </AppText>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: spacing.xs }}>
                    <AppText style={{ ...typography.numeric, fontSize: 44, color: '#FFFFFF' }}>
                      {trend?.latestValue ?? latestParam?.latestValue ?? '—'}
                    </AppText>
                    {(trend?.unit ?? latestParam?.unit) && (
                      <AppText style={{ fontSize: 16, color: 'rgba(255,255,255,0.75)' }}>
                        {trend?.unit ?? latestParam?.unit}
                      </AppText>
                    )}
                  </View>
                  <AppText style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
                    {trend ? `${trend.points.length} measurement${trend.points.length !== 1 ? 's' : ''}` : `${latestParam?.measurementCount} measurement${latestParam?.measurementCount !== 1 ? 's' : ''}`}
                  </AppText>
                </View>
                <View style={{ alignItems: 'flex-end', gap: spacing.sm }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      backgroundColor: 'rgba(255,255,255,0.15)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Activity size={22} color="#FFFFFF" />
                  </View>
                  {TrendIcon && trend?.percentageChange != null && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <TrendIcon size={13} color="rgba(255,255,255,0.85)" />
                      <AppText style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
                        {Math.abs(trend.percentageChange).toFixed(1)}%
                      </AppText>
                    </View>
                  )}
                </View>
              </View>

              {trendValues.length >= 2 && (
                <>
                  <View style={{ marginTop: spacing.md }}>
                    <Sparkline values={trendValues} color="rgba(255,255,255,0.55)" />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs }}>
                    <AppText style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>Min {trendMin}</AppText>
                    <AppText style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>Max {trendMax}</AppText>
                  </View>
                </>
              )}

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md }}>
                <AppText style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
                  Track your laboratory results over time
                </AppText>
                <ChevronRight size={18} color="rgba(255,255,255,0.85)" />
              </View>
            </GradientCard>
          </TouchableOpacity>
        )}

        <SectionHeader>OVERVIEW</SectionHeader>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <OverviewStat
            icon={FlaskConical}
            color="secondary"
            value={summary?.totalTests ?? 0}
            label="Blood tests"
            style={{ flex: 1 }}
          />
          <OverviewStat
            icon={TrendingUp}
            color="success"
            value={summary?.totalParameters ?? 0}
            label="Trends tracked"
            style={{ flex: 1 }}
          />
        </View>

        {summary && summary.availableParameters.length > 0 && (
          <>
            <SectionHeader action={{ label: 'Trends', onPress: () => router.push('/health-trends' as RelativePathString) }}>
              VITALS
            </SectionHeader>
            <GlassCard style={{ paddingVertical: spacing.sm }}>
              {summary.availableParameters.slice(0, 5).map((param, index) => {
                const { icon: Icon, color: colorKey } = getVitalIconAndColor(param.code, index);
                return (
                  <View key={param.code}>
                    {index > 0 && <Divider style={{ marginVertical: spacing.sm }} />}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          backgroundColor: colors[`${colorKey}Muted`],
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon size={16} color={colors.onMuted[colorKey]} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <AppText muted style={{ fontSize: 12 }}>
                          {param.name}
                        </AppText>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: 1 }}>
                          <AppText variant="heading" style={{ fontSize: 19 }}>
                            {param.latestValue ?? '—'}
                          </AppText>
                          {param.unit && (
                            <AppText muted style={{ fontSize: 12 }}>
                              {param.unit}
                            </AppText>
                          )}
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </GlassCard>
          </>
        )}

        <SectionHeader>BLOOD TESTS</SectionHeader>
        <TouchableOpacity onPress={() => router.push('/laboratory' as RelativePathString)}>
          <Card>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: colors.secondaryMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FlaskConical size={24} color={colors.onMuted.secondary} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="heading">Blood Tests</AppText>
                <AppText muted style={{ fontSize: 13 }}>
                  Book appointments and view results
                </AppText>
              </View>
              <ChevronRight size={20} color={colors.textMuted} />
            </View>
          </Card>
        </TouchableOpacity>

        <SectionHeader action={{ label: 'View all', onPress: () => router.push('/insights' as RelativePathString) }}>
          AI INSIGHTS
        </SectionHeader>
        <TouchableOpacity onPress={() => router.push('/insights' as RelativePathString)} activeOpacity={0.8}>
          <GlassCard style={{ borderColor: colors.aiMuted }}>
            <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: colors.aiMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Brain size={16} color={colors.onMuted.ai} />
              </View>
              <View style={{ flex: 1 }}>
                {latestInsight ? (
                  <>
                    <AppText style={{ fontSize: 13, fontWeight: '600', color: colors.ai, marginBottom: spacing.xs }}>
                      {latestInsight.title}
                    </AppText>
                    <AppText style={{ fontSize: 13, lineHeight: 18 }} numberOfLines={3}>
                      {latestInsight.summary}
                    </AppText>
                  </>
                ) : (
                  <>
                    <AppText variant="heading">AI Insights</AppText>
                    <AppText muted style={{ fontSize: 13, marginTop: 2 }}>
                      Get AI-powered explanations of your results
                    </AppText>
                  </>
                )}
              </View>
            </View>
          </GlassCard>
        </TouchableOpacity>

        {labResults.filter((r) => r.status === 'PUBLISHED').length > 0 && (
          <>
            <SectionHeader action={{ label: 'View all', onPress: () => router.push('/laboratory' as RelativePathString) }}>
              LAB RESULTS
            </SectionHeader>
            {labResults
              .filter((r) => r.status === 'PUBLISHED')
              .slice(0, 2)
              .map((result) => {
                const hasFlaggedItem = result.items.some((item) => item.flag && item.flag !== 'NORMAL');
                return (
                  <TouchableOpacity
                    key={result.id}
                    onPress={() => router.push('/laboratory' as RelativePathString)}
                    activeOpacity={0.8}
                  >
                    <GlassCard style={{ padding: spacing.md, marginBottom: spacing.sm }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flex: 1 }}>
                          <AppText style={{ fontSize: 14, fontWeight: '500' }}>{result.testType.name}</AppText>
                          <AppText muted style={{ fontSize: 12, marginTop: 2 }}>
                            {result.publishedAt ? new Date(result.publishedAt).toLocaleDateString() : 'Date unknown'}
                          </AppText>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                          <View
                            style={{
                              paddingHorizontal: spacing.sm,
                              paddingVertical: 2,
                              borderRadius: 4,
                              backgroundColor: hasFlaggedItem ? colors.warningMuted : colors.successMuted,
                            }}
                          >
                            <AppText
                              style={{
                                fontSize: 11,
                                fontWeight: '600',
                                color: hasFlaggedItem ? colors.onMuted.warning : colors.onMuted.success,
                              }}
                            >
                              {hasFlaggedItem ? 'Review' : 'Normal'}
                            </AppText>
                          </View>
                          <ChevronRight size={14} color={colors.textMuted} />
                        </View>
                      </View>
                    </GlassCard>
                  </TouchableOpacity>
                );
              })}
          </>
        )}

        <GlassCard style={{ marginTop: spacing.lg, paddingVertical: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <ShieldCheck size={16} color={colors.onMuted.success} />
            <AppText muted style={{ fontSize: 12 }}>
              Your health data is private and secure.
            </AppText>
          </View>
        </GlassCard>
      </ScrollView>
    </Screen>
  );
}
