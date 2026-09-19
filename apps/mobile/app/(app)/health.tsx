import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { Pressable, TouchableOpacity, View, RefreshControl } from 'react-native';
import {
  Activity,
  Brain,
  ChevronRight,
  Droplet,
  Fingerprint,
  Gauge,
  Layers,
  Percent,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react-native';
import {
  AppText,
  Divider,
  GlassCard,
  GradientCard,
  LoadingState,
  Screen,
  SectionHeader,
  Sparkline,
} from '../../src/components';
import { layout, radius, spacing, useTheme } from '../../src/theme';
import { getTrendSummary, TrendSummary } from '../../src/api/health-trends';
import { getDonorResults, LaboratoryResult } from '../../src/api/laboratory';
import { getAiAvailability, getInsightHistory, AiInsight } from '../../src/api/ai-health';
import { formatUpdated, isWithinReferenceRange } from '../../src/utils/health';
import { useTranslation } from '../../src/i18n';

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
const VITAL_DESCRIPTION_KEY_BY_CODE: Record<string, string> = {
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
  const { t, formatDate } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [summary, setSummary] = useState<TrendSummary | null>(null);
  const [labResults, setLabResults] = useState<LaboratoryResult[]>([]);
  const [latestInsight, setLatestInsight] = useState<AiInsight | null>(null);
  // Whether AI is switched on at all. Undefined while the answer is in flight.
  const [aiEnabled, setAiEnabled] = useState<boolean | undefined>(undefined);

  const loadData = useCallback(async () => {
    try {
      const [trendData, resultsData, insightData, availability] = await Promise.all([
        getTrendSummary(),
        getDonorResults().catch(() => []),
        getInsightHistory({ limit: 1 }).catch(() => ({ insights: [], total: 0 })),
        // A failure is treated as "off": a card that promises AI and cannot
        // deliver it is the thing this check exists to prevent.
        getAiAvailability()
          .then((a) => a.enabled)
          .catch(() => false),
      ]);
      setSummary(trendData);
      setLabResults(resultsData);
      setLatestInsight(insightData.insights[0] ?? null);
      setAiEnabled(availability);
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

  const publishedResults = labResults.filter((r) => r.status === 'PUBLISHED');
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

  if (isLoading) {
    return (
      <Screen>
        <AppText variant="title">{t('health.title')}</AppText>
        <LoadingState />
      </Screen>
    );
  }

  const latestParam = summary?.availableParameters[0];
  const trend = summary?.recentTrend;
  const trendValues = trend?.points.map((p) => p.value) ?? [];

  const inRange = isWithinReferenceRange(trend);

  const measurementCount = trend ? trend.points.length : (latestParam?.measurementCount ?? 0);
  const updatedLabel = formatUpdated(trend?.latestValueDate ?? latestParam?.latestValueDate, {
    t,
    formatDate,
  });

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <AppText style={{ fontSize: 32, fontWeight: '800', letterSpacing: -1, color: colors.text }}>
            {t('health.title')}
          </AppText>
          <AppText muted style={{ fontSize: 14, marginTop: 2 }}>
            {t('health.subtitle')}
          </AppText>
        </View>
        {publishedResults.length > 0 && (
          <StatusPill
            label={anyFlagged ? 'Needs review' : t('health.allNormal')}
            tone={anyFlagged ? 'warning' : 'success'}
          />
        )}
      </View>

      {(trend || latestParam) && (
        <TouchableOpacity
          onPress={() => router.push('/health-trends' as RelativePathString)}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={t('health.a11yLatestMarker')}
          style={{ marginTop: spacing.md }}
        >
          {/* Health's hero is a two-stop rose, distinct from the app's
              rose-to-plum brand hero -- the plum is kept for blood-type
              moments only. */}
          <GradientCard colors={['#D85360', '#C0356B']}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <AppText style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.6, color: 'rgba(255,255,255,0.8)' }}>
                  {t('health.latestTracked')}
                </AppText>
                <AppText style={{ fontSize: 17, fontWeight: '600', color: '#FFFFFF', marginTop: 3 }}>
                  {(trend?.parameterName ?? latestParam?.name)!}
                </AppText>
              </View>
              <Activity size={26} color="#FFFFFF" strokeWidth={2.5} />
            </View>

            {/*
              The figure and its shape on one line. The sparkline used to sit
              in a band below the card with Min and Max captions under it,
              which made the trend a second, smaller chart rather than the
              backdrop to the number it belongs to.
            */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                <AppText style={{ fontSize: 52, lineHeight: 60, fontWeight: '800', letterSpacing: -2.2, color: '#FFFFFF' }}>
                  {trend?.latestValue ?? latestParam?.latestValue ?? '—'}
                </AppText>
                {(trend?.unit ?? latestParam?.unit) && (
                  <AppText style={{ fontSize: 17, fontWeight: '600', color: 'rgba(255,255,255,0.75)' }}>
                    {trend?.unit ?? latestParam?.unit}
                  </AppText>
                )}
              </View>
              {trendValues.length >= 2 && (
                <View style={{ flex: 1, height: 56, justifyContent: 'center' }}>
                  <Sparkline values={trendValues} color="rgba(255,255,255,0.72)" />
                </View>
              )}
            </View>

            {inRange !== null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: inRange ? colors.success : colors.warning,
                  }}
                />
                <AppText style={{ fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.95)' }}>
                  {inRange ? 'Within healthy range' : t('medical.resultFlags.outsideRange')}
                </AppText>
              </View>
            )}

            <AppText style={{ fontSize: 12, color: 'rgba(255,255,255,0.68)', marginTop: 8 }}>
              {[updatedLabel, measurementCount ? `${measurementCount} measurement${measurementCount === 1 ? '' : 's'} tracked` : null]
                .filter(Boolean)
                .join(' · ')}
            </AppText>
          </GradientCard>
        </TouchableOpacity>
      )}

      {summary && summary.availableParameters.length > 0 && (
        <>
          <SectionHeader
            action={{
              label: t('health.viewTrends'),
              onPress: () => router.push('/health-trends' as RelativePathString),
            }}
          >
            {t('health.labMarkers')}
          </SectionHeader>
          <GlassCard style={{ paddingVertical: spacing.sm }}>
            {summary.availableParameters.slice(0, 5).map((param, index) => {
              const code = param.code.toUpperCase();
              const { icon: Icon, color: colorKey } = getVitalIconAndColor(param.code, index);
              const flag = flagByParameterCode.get(code);
              const descriptionKey = VITAL_DESCRIPTION_KEY_BY_CODE[code];
              const description = descriptionKey ? t(descriptionKey) : undefined;
              return (
                <View key={param.code}>
                  {index > 0 && <Divider style={{ marginVertical: spacing.sm }} />}
                  <Pressable
                    onPress={() => router.push('/health-trends' as RelativePathString)}
                    accessibilityRole="button"
                    accessibilityLabel={`${param.name}${param.latestValue !== undefined ? `, ${param.latestValue} ${param.unit ?? ''}` : ''}. Open trends`}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingVertical: 10,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 13,
                        backgroundColor: `${colors[colorKey]}26`,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon size={19} color={colors[colorKey]} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                        {param.name}
                      </AppText>
                      {description && (
                        <AppText muted style={{ fontSize: 12, marginTop: 1 }}>
                          {description}
                        </AppText>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end', maxWidth: 96 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                        <AppText style={{ fontSize: 17, fontWeight: '700', letterSpacing: -0.4 }}>
                          {param.latestValue ?? '—'}
                        </AppText>
                        {param.unit && (
                          <AppText muted style={{ fontSize: 11 }}>
                            {param.unit}
                          </AppText>
                        )}
                      </View>
                    </View>
                    {flag && (
                      <StatusPill
                        label={flag === 'NORMAL' ? t('medical.resultFlags.normal') : t('health.needsReview')}
                        tone={flag === 'NORMAL' ? 'success' : 'warning'}
                        compact
                      />
                    )}
                    <ChevronRight size={16} color={colors.textMuted} />
                  </Pressable>
                </View>
              );
            })}
          </GlassCard>
        </>
      )}

      {/* When AI is switched off in this deployment the card is not shown at
          all. A disabled-looking tile that still navigates to a screen full
          of dead buttons is worse than the section simply not being there. */}
      {aiEnabled !== false && (
      <>
      <SectionHeader>{t('health.aiInsights')}</SectionHeader>
      <TouchableOpacity
        onPress={() => router.push('/insights' as RelativePathString)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t('health.aiInsights')}
      >
        <GlassCard style={{ borderColor: `${colors.ai}55`, backgroundColor: `${colors.ai}14` }}>
          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: radius.md,
                backgroundColor: `${colors.ai}2E`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Brain size={22} color={colors.ai} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>
                {latestInsight?.title ?? t('health.aiInsights')}
              </AppText>
              <AppText muted style={{ fontSize: 14, lineHeight: 20, marginTop: 4 }} numberOfLines={3}>
                {latestInsight?.summary ?? t('health.aiInsightsHint')}
              </AppText>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </View>

          {/* The privacy line lives inside this card rather than in one of its
              own at the foot of the screen: it is a statement about the thing
              reading your results, and it means nothing floating on its own. */}
          <Divider style={{ marginVertical: spacing.md }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <ShieldCheck size={17} color={colors.onMuted.success} />
            <AppText muted style={{ fontSize: 13 }}>
              {t('health.privacyNote')}
            </AppText>
          </View>
        </GlassCard>
      </TouchableOpacity>
      </>
      )}

      {publishedResults.length > 0 && (
        <>
          <SectionHeader
            action={{
              label: t('common.viewAll'),
              onPress: () => router.push('/laboratory' as RelativePathString),
            }}
          >
            {t('health.labResults')}
          </SectionHeader>
          {publishedResults.slice(0, 2).map((result) => {
            const hasFlaggedItem = result.items.some((item) => item.flag && item.flag !== 'NORMAL');
            return (
              <TouchableOpacity
                key={result.id}
                onPress={() => router.push('/laboratory' as RelativePathString)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`${result.testType.name} result`}
              >
                <GlassCard style={{ marginBottom: layout.cardGap }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <AppText style={{ fontSize: 15, fontWeight: '600' }}>
                        {result.testType.name}
                      </AppText>
                      <AppText muted style={{ fontSize: 12, marginTop: 2 }}>
                        {result.publishedAt
                          ? formatDate(result.publishedAt, 'medium')
                          : t('health.dateUnknown')}
                      </AppText>
                    </View>
                    <StatusPill
                      label={hasFlaggedItem ? t('health.needsReview') : t('medical.resultFlags.normal')}
                      tone={hasFlaggedItem ? 'warning' : 'success'}
                      compact
                    />
                    <ChevronRight size={16} color={colors.textMuted} />
                  </View>
                </GlassCard>
              </TouchableOpacity>
            );
          })}
        </>
      )}
    </Screen>
  );
}

/**
 * A dot plus a word, on a tinted pill.
 *
 * The dot is what carries the status at a glance, and the word is what carries
 * it for anyone who cannot separate the greens from the ambers -- neither one
 * alone would do.
 */
function StatusPill({
  label,
  tone,
  compact,
}: {
  label: string;
  tone: 'success' | 'warning';
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const fill = tone === 'success' ? colors.successMuted : colors.warningMuted;
  const text = tone === 'success' ? colors.onMuted.success : colors.onMuted.warning;
  const dot = tone === 'success' ? colors.success : colors.warning;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: compact ? 26 : 34,
        paddingHorizontal: compact ? 9 : 14,
        borderRadius: radius.pill,
        backgroundColor: fill,
        borderWidth: 1,
        borderColor: `${text}33`,
      }}
    >
      <View style={{ width: compact ? 6 : 8, height: compact ? 6 : 8, borderRadius: 4, backgroundColor: dot }} />
      <AppText style={{ fontSize: compact ? 11 : 14, fontWeight: '600', color: text }}>
        {label}
      </AppText>
    </View>
  );
}
