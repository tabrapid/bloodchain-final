import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, RefreshControl, TouchableOpacity } from 'react-native';
import { router, Stack } from 'expo-router';
import { Activity, Beaker, Calendar, ChevronRight, Clock, FlaskConical, TestTube2 } from 'lucide-react-native';
import { AppText, Card, GlassCard, LoadingState, Screen, SectionHeader, StatCard } from '../../../src/components';
import { spacing, useTheme } from '../../../src/theme';
import {
  getDonorAppointments,
  getDonorResults,
  getTestTypes,
  LaboratoryAppointment,
  LaboratoryResult,
  TestType,
} from '../../../src/api/laboratory';

export default function LaboratoryScreen() {
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [appointments, setAppointments] = useState<LaboratoryAppointment[]>([]);
  const [results, setResults] = useState<LaboratoryResult[]>([]);
  const [testTypes, setTestTypes] = useState<TestType[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [appts, res, tests] = await Promise.all([
        getDonorAppointments(),
        getDonorResults(),
        getTestTypes(),
      ]);
      setAppointments(appts);
      setResults(res);
      setTestTypes(tests);
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
        <Stack.Screen options={{ title: 'Blood Tests' }} />
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Blood Tests' }} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg }}
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
            label="Upcoming"
            value={upcomingAppointments.length.toString()}
            icon={Calendar}
            variant={upcomingAppointments.length > 0 ? 'secondary' : 'default'}
            style={{ flex: 1 }}
          />
          <StatCard
            label="Results"
            value={publishedResults.length.toString()}
            icon={TestTube2}
            variant={publishedResults.length > 0 ? 'success' : 'default'}
            style={{ flex: 1 }}
          />
        </View>

        <SectionHeader>BOOK A TEST</SectionHeader>
        <TouchableOpacity
          onPress={() =>
            router.push({ pathname: '/(booking)/organizations', params: { type: 'BLOOD_TEST' } })
          }
          activeOpacity={0.8}
        >
          <Card style={{ marginBottom: spacing.lg }}>
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
                <AppText variant="heading">Book Blood Test</AppText>
                <AppText muted style={{ fontSize: 13 }}>
                  Schedule a laboratory appointment
                </AppText>
              </View>
              <ChevronRight size={20} color={colors.textMuted} />
            </View>
          </Card>
        </TouchableOpacity>

        {upcomingAppointments.length > 0 && (
          <>
            <SectionHeader>UPCOMING APPOINTMENTS</SectionHeader>
            {upcomingAppointments.slice(0, 3).map((appointment) => (
              <TouchableOpacity
                key={appointment.id}
                onPress={() => router.push(`/appointment/${appointment.id}`)}
                activeOpacity={0.8}
              >
              <Card style={{ marginBottom: spacing.md }}>
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
                      <AppText variant="heading">{appointment.organization.name}</AppText>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs }}>
                      <Clock size={12} color={colors.textMuted} />
                      <AppText muted style={{ fontSize: 13 }}>
                        {new Date(appointment.scheduledStart).toLocaleDateString()} at{' '}
                        {new Date(appointment.scheduledStart).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
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
                        {appointment.status.replace('_', ' ')}
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
            <SectionHeader>RECENT RESULTS</SectionHeader>
            {publishedResults.slice(0, 3).map((result) => (
              <Card key={result.id} style={{ marginBottom: spacing.md }}>
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
                          ? new Date(result.publishedAt).toLocaleDateString()
                          : 'Date unknown'}
                      </AppText>
                    </View>
                    <View style={{ marginTop: spacing.sm }}>
                      <AppText muted style={{ fontSize: 12 }}>
                        {result.items.length} parameter{result.items.length !== 1 ? 's' : ''} tested
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
                Couldn't load your lab data
              </AppText>
              <AppText muted style={{ marginTop: spacing.sm, textAlign: 'center' }}>
                Pull down to refresh and try again.
              </AppText>
            </View>
          </GlassCard>
        ) : (
          upcomingAppointments.length === 0 &&
          publishedResults.length === 0 && (
            <>
              <SectionHeader>GET STARTED</SectionHeader>
              <GlassCard>
                <View style={{ alignItems: 'center', padding: spacing.lg }}>
                  <FlaskConical size={48} color={colors.secondary} />
                  <AppText variant="heading" style={{ marginTop: spacing.md, textAlign: 'center' }}>
                    No tests yet
                  </AppText>
                  <AppText muted style={{ marginTop: spacing.sm, textAlign: 'center' }}>
                    Book your first blood test to start tracking your health markers.
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
