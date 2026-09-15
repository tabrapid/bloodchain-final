import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { AlertTriangle, CheckCircle, Clock3, Droplet, Package, XCircle } from 'lucide-react-native';
import { AppButton, AppHeader, AppText, Badge, Card, EmptyState, LoadingState, Screen, StatCard } from '../../src/components';
import { layout, spacing, useTheme } from '../../src/theme';
import { getCourierShipments, getCourierStats, type CourierStats, type Shipment } from '../../src/api/courier';
import { useTranslation } from '../../src/i18n';

const STATUS_VARIANT: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger'> = {
  COURIER_ASSIGNED: 'secondary',
  COURIER_ACCEPTED: 'secondary',
  COURIER_DECLINED: 'danger',
  PICKUP_STARTED: 'warning',
  PICKED_UP: 'warning',
  IN_TRANSIT: 'primary',
  ARRIVED_AT_HOSPITAL: 'warning',
  DELIVERED: 'success',
  FAILED: 'danger',
  CANCELLED: 'danger',
};

export default function CourierHistory() {
  const { t, formatDateTime } = useTranslation();
  const { colors } = useTheme();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [stats, setStats] = useState<CourierStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    try {
      const [shipmentsRes, statsRes] = await Promise.all([
        getCourierShipments({ limit: 50 }),
        getCourierStats(),
      ]);
      setShipments(shipmentsRes.data);
      setStats(statsRes);
      setLoadError(false);
    } catch (err) {
      console.error('Failed to load courier history:', err);
      setLoadError(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading) {
    return (
      <Screen>
        <AppHeader title={t('courier.historyTitle')} subtitle={t('courier.historySubtitle')} />
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <AppHeader title={t('courier.historyTitle')} subtitle={t('courier.historySubtitle')} />
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {stats && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.lg }}>
            <StatCard label={t('courier.statCompleted')} value={String(stats.completed)} icon={CheckCircle} variant="success" style={{ flex: 1, minWidth: 140 }} />
            <StatCard label={t('courier.statFailed')} value={String(stats.failed)} icon={XCircle} variant={stats.failed > 0 ? 'danger' : 'default'} style={{ flex: 1, minWidth: 140 }} />
            <StatCard
              label={t('courier.statAvgDeliveryTime')}
              value={
                stats.avgDeliveryTimeMinutes != null
                  ? t('units.minutes', { count: Math.round(stats.avgDeliveryTimeMinutes) })
                  : '—'
              }
              icon={Clock3}
              variant="secondary"
              style={{ flex: 1, minWidth: 140 }}
            />
            <StatCard label={t('courier.statTotal')} value={String(stats.total)} icon={Package} style={{ flex: 1, minWidth: 140 }} />
          </View>
        )}

        {shipments.length === 0 ? (
          loadError ? (
            <>
              <EmptyState
                icon={AlertTriangle}
                title={t('courier.historyLoadFailed')}
                description={t('common.offline')}
              />
              <AppButton variant="secondary" onPress={load} style={{ marginTop: spacing.md }}>
                {t('common.retry')}
              </AppButton>
            </>
          ) : (
            <EmptyState
              icon={Package}
              title={t('courier.historyEmpty')}
              description={t('courier.historyEmptyHint')}
            />
          )
        ) : (
          shipments.map((shipment) => (
            <Card key={shipment.id} style={{ marginBottom: layout.cardGap }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                <AppText variant="heading">{shipment.shipmentReference}</AppText>
                <Badge variant={STATUS_VARIANT[shipment.status] || 'default'}>
                  {t(`status.shipment.${shipment.status}`)}
                </Badge>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs }}>
                <Droplet size={14} color={colors.textMuted} />
                <AppText muted style={{ fontSize: 13 }}>
                  {t('units.bloodUnits', { count: shipment.units?.length ?? 0 })}
                  {shipment.sourceOrganization && ` · ${shipment.sourceOrganization.name}`}
                  {shipment.destinationOrganization && ` → ${shipment.destinationOrganization.name}`}
                </AppText>
              </View>
              <AppText muted style={{ fontSize: 12 }}>
                {formatDateTime(shipment.createdAt)}
              </AppText>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
