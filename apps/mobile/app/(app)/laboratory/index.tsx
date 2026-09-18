import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, RefreshControl, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Activity, Beaker, Calendar, ChevronRight, Clock, FlaskConical, TestTube2 } from 'lucide-react-native';
import { AppText, Card, GlassCard, LoadingState, Screen, ScreenHeader, SectionHeader, StatCard } from '../../../src/components';
import { layout, spacing, useTheme } from '../../../src/theme';
import { useTranslation } from '../../../src/i18n';
import {
  getDonorAppointments,
  getDonorResults,
  LaboratoryAppointment,
  LaboratoryResult,
} from '../../../src/api/laboratory';

export default function LaboratoryScreen() {
  const { t, formatDate, formatTime } = useTranslation();
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [appointments, setAppointments] = useState<LaboratoryAppointment[]>([]);
  const [results, setResults] = useState<LaboratoryResult[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [appts, res] = await Promise.all([
        getDonorAppointments(),
        getDonorResults(),
      ]);
      setAppointments(appts);
      setResults(res);
      setLoadError(false);
    } catch (err) {
      console.error('Failed to load laboratory data:', err);
      setLoadError(true);
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

  const upcomingAppointments = appointments.filter(
    (a) => !['COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESULT_PUBLISHED'].includes(a.status)
  );

  const publishedResults = results.filter((r) => r.status === 'PUBLISHED');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
      case 'CONFIRMED':
        return { bg: colors.secondaryMuted, text: colors.onMuted.secondary };
      case 'CHECKED_IN':
      case 'IN_PROGRESS':
        return { bg: colors.warningMuted, text: colors.onMuted.warning };
      case 'RESULT_PENDING':
        return { bg: colors.warningMuted, text: colors.onMuted.warning };
      case 'RESULT_PUBLISHED':
        return { bg: colors.successMuted, text: colors.onMuted.success };
      default:
        return { bg: colors.surfaceElevated, text: colors.textMuted };
    }
  };

  if (isLoading) {
    return (
      <Screen>
        <ScreenHeader title={t('laboratory.title')} />
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title={t('laboratory.title')} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg }}>
          <StatCard
            label={t('laboratory.upcoming')}
            value={upcomingAppointments.length.toString()}
            icon={Calendar}
            variant={upcomingAppointments.length > 0 ? 'secondary' : 'default'}
            style={{ flex: 1 }}
          />
          <StatCard
            label={t('laboratory.results')}
            value={publishedResults.length.toString()}
            icon={TestTube2}
            variant={publishedResults.length > 0 ? 'success' : 'default'}
            style={{ flex: 1 }}
          />
        </View>

        <SectionHeader>{t('laboratory.bookATest')}</SectionHeader>
        <TouchableOpacity
          onPress={() => router.push('/(lab-booking)/test-type')}
          activeOpacity={0.8}
        >
          <Card style={{ marginBottom: layout.cardGap }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
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
                <AppText variant="heading">{t('laboratory.bookBloodTest')}</AppText>
                <AppText muted style={{ fontSize: 13 }}>
                  {t('laboratory.bookHint')}
                </AppText>
              </View>
              <ChevronRight size={20} color={colors.textMuted} />
            </View>
          </Card>
        </TouchableOpacity>

        {upcomingAppointments.length > 0 && (
          <>
            <SectionHeader>{t('laboratory.upcomingAppointments')}</SectionHeader>
            {upcomingAppointments.slice(0, 3).map((appointment) => (
              <TouchableOpacity
                key={appointment.id}
                onPress={() => router.push(`/appointment/${appointment.id}`)}
                activeOpacity={0.8}
              >
              <Card style={{ marginBottom: layout.cardGap }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      backgroundColor: getStatusColor(appointment.status).bg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Activity size={20} color={getStatusColor(appointment.status).text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <AppText variant="heading">
                        {appointment.testType?.name ?? appointment.organization.name}
                      </AppText>
                    </View>
                    {appointment.testType ? (
                      <AppText muted style={{ fontSize: 13 }}>
                        {appointment.organization.name}
                      </AppText>
                    ) : null}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs }}>
                      <Clock size={12} color={colors.textMuted} />
                      <AppText muted style={{ fontSize: 13 }}>
                        {formatDate(appointment.scheduledStart, 'medium')} ·{' '}
                        {formatTime(appointment.scheduledStart)}
                      </AppText>
                    </View>
                    <View
                      style={{
                        marginTop: spacing.sm,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: 2,
                        borderRadius: 4,
                        backgroundColor: getStatusColor(appointment.status).bg,
                        alignSelf: 'flex-start',
                      }}
                    >
                      <AppText
                        style={{
                          fontSize: 11,
                          fontWeight: '600',
                          color: getStatusColor(appointment.status).text,
                        }}
                      >
                        {t(`status.appointment.${appointment.status}`)}
                      </AppText>
                    </View>
                  </View>
                </View>
              </Card>
              </TouchableOpacity>
            ))}
          </>
        )}

        {publishedResults.length > 0 && (
          <>
            <SectionHeader>{t('laboratory.recentResults')}</SectionHeader>
            {publishedResults.slice(0, 3).map((result) => (
              <Card key={result.id} style={{ marginBottom: layout.cardGap }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
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
                    <Beaker size={20} color={colors.onMuted.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="heading">{result.testType.name}</AppText>
                    <AppText muted style={{ fontSize: 13 }}>
                      {result.laboratory.name}
                    </AppText>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs }}>
                      <Calendar size={12} color={colors.textMuted} />
                      <AppText muted style={{ fontSize: 12 }}>
                        {result.publishedAt
                          ? formatDate(result.publishedAt)
                          : t('laboratory.dateUnknown')}
                      </AppText>
                    </View>
                    <View style={{ marginTop: spacing.sm }}>
                      <AppText muted style={{ fontSize: 12 }}>
                        {t('units.parametersTested', { count: result.items.length })}
                      </AppText>
                    </View>
                  </View>
                  <ChevronRight size={20} color={colors.textMuted} />
                </View>
              </Card>
            ))}
          </>
        )}

        {loadError && upcomingAppointments.length === 0 && publishedResults.length === 0 ? (
          <GlassCard>
            <View style={{ alignItems: 'center', padding: spacing.lg }}>
              <AppText variant="heading" style={{ textAlign: 'center' }}>
                {t('laboratory.loadFailed')}
              </AppText>
              <AppText muted style={{ marginTop: spacing.sm, textAlign: 'center' }}>
                {t('laboratory.loadFailedHint')}
              </AppText>
            </View>
          </GlassCard>
        ) : (
          upcomingAppointments.length === 0 &&
          publishedResults.length === 0 && (
            <>
              <SectionHeader>{t('laboratory.getStarted')}</SectionHeader>
              <GlassCard>
                <View style={{ alignItems: 'center', padding: spacing.lg }}>
                  <FlaskConical size={48} color={colors.secondary} />
                  <AppText variant="heading" style={{ marginTop: spacing.md, textAlign: 'center' }}>
                    {t('laboratory.empty')}
                  </AppText>
                  <AppText muted style={{ marginTop: spacing.sm, textAlign: 'center' }}>
                    {t('laboratory.emptyHint')}
                  </AppText>
                </View>
              </GlassCard>
            </>
          )
        )}
      </ScrollView>
    </Screen>
  );
}
