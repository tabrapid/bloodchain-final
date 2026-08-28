import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { AlertTriangle, CheckCircle, Clock3, Droplet, Package, XCircle } from 'lucide-react-native';
import { AppButton, AppText, Badge, Card, EmptyState, LoadingState, Screen, StatCard } from '../../src/components';
import { colors, spacing } from '../../src/theme';
import { getCourierShipments, getCourierStats, type CourierStats, type Shipment } from '../../src/api/courier';

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
        <AppText variant="title" style={{ marginBottom: spacing.lg }}>History</AppText>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <AppText variant="title" style={{ marginBottom: spacing.md }}>History</AppText>
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
            <StatCard label="Completed" value={String(stats.completed)} icon={CheckCircle} variant="success" style={{ flex: 1, minWidth: 140 }} />
            <StatCard label="Failed" value={String(stats.failed)} icon={XCircle} variant={stats.failed > 0 ? 'danger' : 'default'} style={{ flex: 1, minWidth: 140 }} />
            <StatCard
              label="Avg. Delivery Time"
              value={stats.avgDeliveryTimeMinutes != null ? `${Math.round(stats.avgDeliveryTimeMinutes)} min` : '—'}
              icon={Clock3}
              variant="secondary"
              style={{ flex: 1, minWidth: 140 }}
            />
            <StatCard label="Total Deliveries" value={String(stats.total)} icon={Package} style={{ flex: 1, minWidth: 140 }} />
          </View>
        )}

        {shipments.length === 0 ? (
          loadError ? (
            <>
              <EmptyState
                icon={AlertTriangle}
                title="Couldn't load your history"
                description="Something went wrong reaching the server. Check your connection and try again."
              />
              <AppButton variant="secondary" onPress={load} style={{ marginTop: spacing.md }}>
                Retry
              </AppButton>
            </>
          ) : (
            <EmptyState icon={Package} title="No deliveries yet" description="Completed and past deliveries will appear here." />
          )
        ) : (
          shipments.map((shipment) => (
            <Card key={shipment.id} style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                <AppText variant="heading">{shipment.shipmentReference}</AppText>
                <Badge variant={STATUS_VARIANT[shipment.status] || 'default'}>
                  {shipment.status.replace(/_/g, ' ')}
                </Badge>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs }}>
                <Droplet size={14} color={colors.textMuted} />
                <AppText muted style={{ fontSize: 13 }}>
                  {shipment.units?.length ?? 0} unit{(shipment.units?.length ?? 0) !== 1 ? 's' : ''}
                  {shipment.sourceOrganization && ` · from ${shipment.sourceOrganization.name}`}
                  {shipment.destinationOrganization && ` · to ${shipment.destinationOrganization.name}`}
                </AppText>
              </View>
              <AppText muted style={{ fontSize: 12 }}>
                {new Date(shipment.createdAt).toLocaleString()}
              </AppText>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
