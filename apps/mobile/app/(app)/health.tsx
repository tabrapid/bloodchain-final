import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { TouchableOpacity, View, RefreshControl, ScrollView } from 'react-native';
import { Activity, Brain, ChevronRight, FlaskConical, TrendingUp } from 'lucide-react-native';
import { AppText, Card, GlassCard, LoadingState, Screen, SectionHeader, StatCard } from '../../src/components';
import { spacing, useTheme } from '../../src/theme';
import { getTrendSummary, TrendSummary } from '../../src/api/health-trends';

export default function Health() {
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [summary, setSummary] = useState<TrendSummary | null>(null);

  const loadData = useCallback(async () => {
    try {
      const data = await getTrendSummary();
      setSummary(data);
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
        <AppText muted style={{ marginTop: spacing.sm }}>
          A calm view of your health journey.
        </AppText>

        <SectionHeader>OVERVIEW</SectionHeader>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <StatCard
            label="Blood tests"
            value={summary?.totalTests?.toString() || '0'}
            note={summary?.lastTestDate
              ? `Last: ${new Date(summary.lastTestDate).toLocaleDateString()}`
              : 'No tests'}
            icon={FlaskConical}
            variant={summary?.totalTests && summary.totalTests > 0 ? 'secondary' : 'default'}
            style={{ flex: 1 }}
          />
          <StatCard
            label="Trends"
            value={summary?.totalParameters?.toString() || '0'}
            note={latestParam ? latestParam.name : 'No trends'}
            icon={TrendingUp}
            variant={summary?.totalParameters && summary.totalParameters > 0 ? 'success' : 'default'}
            style={{ flex: 1 }}
          />
        </View>

        <SectionHeader>TRENDS</SectionHeader>
        <TouchableOpacity onPress={() => router.push('/health-trends' as RelativePathString)}>
          <Card>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                marginBottom: spacing.md,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: colors.successMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TrendingUp size={24} color={colors.onMuted.success} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="heading">View Health Trends</AppText>
                <AppText muted style={{ fontSize: 13 }}>
                  Track your laboratory results over time
                </AppText>
              </View>
              <ChevronRight size={20} color={colors.textMuted} />
            </View>
            {latestParam && (
              <View
                style={{
                  padding: spacing.md,
                  backgroundColor: colors.surface,
                  borderRadius: 8,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <AppText muted style={{ fontSize: 12 }}>Latest tracked</AppText>
                    <AppText variant="heading">{latestParam.name}</AppText>
                    <AppText muted style={{ fontSize: 12 }}>
                      {latestParam.latestValue} {latestParam.unit} • {latestParam.measurementCount} measurements
                    </AppText>
                  </View>
                  <AppText
                    style={{
                      fontSize: 20,
                      fontWeight: '600',
                      color: colors.primary,
                    }}
                  >
                    {latestParam.latestValue}
                  </AppText>
                </View>
              </View>
            )}
          </Card>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/laboratory' as RelativePathString)}>
          <Card style={{ marginTop: spacing.md }}>
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

        <TouchableOpacity onPress={() => router.push('/insights' as RelativePathString)}>
          <Card style={{ marginTop: spacing.md }}>
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
                  backgroundColor: colors.aiMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Brain size={24} color={colors.onMuted.ai} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="heading">AI Insights</AppText>
                <AppText muted style={{ fontSize: 13 }}>
                  Get AI-powered explanations of your results
                </AppText>
              </View>
              <ChevronRight size={20} color={colors.textMuted} />
            </View>
          </Card>
        </TouchableOpacity>

        <SectionHeader>ACTIVITY</SectionHeader>
        <GlassCard>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Activity size={22} color={colors.success} />
            <AppText>Your health data is private and secure.</AppText>
          </View>
        </GlassCard>
      </ScrollView>
    </Screen>
  );
}
