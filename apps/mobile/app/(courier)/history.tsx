import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Clock3, Droplet, Package, XCircle } from 'lucide-react-native';
import {
  Badge,
  EmptyState,
  ErrorState,
  ListGroup,
  ListRow,
  ScreenHeader,
  ScrollScreen,
  Skeleton,
  Stack,
  Stat,
  StatRow,
  iconSize,
  useDesign,
  type StatusTone,
} from '../../src/design';
import {
  getCourierShipments,
  getCourierStats,
  type CourierStats,
  type Shipment,
} from '../../src/api/courier';
import { useTranslation } from '../../src/i18n';

const STATUS_TONE: Record<string, StatusTone> = {
  COURIER_ASSIGNED: 'clinical',
  COURIER_ACCEPTED: 'clinical',
  COURIER_DECLINED: 'critical',
  PICKUP_STARTED: 'warning',
  PICKED_UP: 'warning',
  IN_TRANSIT: 'clinical',
  ARRIVED_AT_HOSPITAL: 'warning',
  DELIVERED: 'success',
  FAILED: 'critical',
  CANCELLED: 'critical',
};

export default function CourierHistory() {
  const { t, formatDateTime } = useTranslation();
  const { colors } = useDesign();
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
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const header = (
    <ScreenHeader title={t('courier.historyTitle')} eyebrow={t('courier.historySubtitle')} />
  );

  if (isLoading) {
    return (
      <ScrollScreen header={header}>
        <Stack gap="lg">
          <Skeleton height={96} />
          <Skeleton height={140} />
        </Stack>
      </ScrollScreen>
    );
  }

  return (
    <ScrollScreen
      header={header}
      refreshing={isRefreshing}
      onRefresh={() => {
        setIsRefreshing(true);
        void load();
      }}
    >
      <Stack gap="xl">
        {stats ? (
          <StatRow>
            <Stat
              label={t('courier.statCompleted')}
              value={String(stats.completed)}
              icon={({ size, color }) => <CheckCircle size={size} color={color} />}
              tone="success"
            />
            <Stat
              label={t('courier.statFailed')}
              value={String(stats.failed)}
              icon={({ size, color }) => <XCircle size={size} color={color} />}
              tone={stats.failed > 0 ? 'critical' : undefined}
            />
            <Stat
              label={t('courier.statAvgDeliveryTime')}
              value={
                stats.avgDeliveryTimeMinutes != null
                  ? t('units.minutes', { count: Math.round(stats.avgDeliveryTimeMinutes) })
                  : '—'
              }
              icon={({ size, color }) => <Clock3 size={size} color={color} />}
              tone="clinical"
            />
          </StatRow>
        ) : null}

        {shipments.length === 0 ? (
          loadError ? (
            <ErrorState
              title={t('courier.historyLoadFailed')}
              description={t('common.offline')}
              retryLabel={t('common.retry')}
              onRetry={() => void load()}
            />
          ) : (
            <EmptyState
              title={t('courier.historyEmpty')}
              description={t('courier.historyEmptyHint')}
              icon={({ size, color }) => <Package size={size} color={color} />}
            />
          )
        ) : (
          <ListGroup
            rows={shipments.map((shipment) => (
              <ListRow
                key={shipment.id}
                leading={<Droplet size={iconSize.lg} color={colors.rose.base} />}
                title={shipment.shipmentReference}
                subtitle={`${t('units.bloodUnits', { count: shipment.units?.length ?? 0 })}${
                  shipment.sourceOrganization ? ` · ${shipment.sourceOrganization.name}` : ''
                }${
                  shipment.destinationOrganization
                    ? ` → ${shipment.destinationOrganization.name}`
                    : ''
                } · ${formatDateTime(shipment.createdAt)}`}
                trailing={
                  <Badge
                    label={t(`status.shipment.${shipment.status}`)}
                    tone={STATUS_TONE[shipment.status] ?? 'neutral'}
                  />
                }
              />
            ))}
          />
        )}
      </Stack>
    </ScrollScreen>
  );
}
