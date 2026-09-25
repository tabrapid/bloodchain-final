import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Check } from 'lucide-react-native';
import {
  Badge,
  Banner,
  Button,
  ListGroup,
  ListRow,
  ScrollScreen,
  Skeleton,
  Stack,
  Text,
  ValueText,
  iconSize,
  radius,
  space,
  useDesign,
} from '../../src/design';
import { useDonorLaboratoryAppointment } from '../../src/hooks/useLaboratory';
import { useTranslation } from '../../src/i18n';

/**
 * The booked appointment as the server stored it, read back by id.
 *
 * Reading it back rather than rendering the mutation's response is what makes
 * this a receipt: the test type shown here is the one persisted on the
 * appointment, which is the same row the laboratory's console reads.
 */
export default function LabBookingConfirmation() {
  const { t, formatDate, formatTime } = useTranslation();
  const { colors } = useDesign();
  const params = useLocalSearchParams<{ appointmentId: string }>();
  const { data: appointment, isPending } = useDonorLaboratoryAppointment(params.appointmentId);

  return (
    <ScrollScreen>
      <Stack gap="xl">
        <Stack gap="lg" style={{ alignItems: 'center', paddingTop: space.xxl }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.success.soft,
            }}
          >
            <Check size={iconSize.xl} color={colors.success.base} strokeWidth={2.5} />
          </View>
          <Stack gap="sm" style={{ alignItems: 'center' }}>
            <Text variant="h1" align="center" accessibilityRole="alert">
              {t('labBooking.confirmedTitle')}
            </Text>
            <Text variant="body" tone="secondary" align="center">
              {t('labBooking.confirmedBody')}
            </Text>
          </Stack>
        </Stack>

        {isPending ? (
          <Stack gap="md">
            <Skeleton height={64} />
            <Skeleton height={56} />
          </Stack>
        ) : appointment ? (
          <Stack gap="md">
            <Stack gap="xs" style={{ alignItems: 'center' }}>
              <Text variant="overline" tone="tertiary" caps>
                {t('booking.referenceNumber')}
              </Text>
              <ValueText variant="h1" selectable>
                {appointment.referenceNumber}
              </ValueText>
            </Stack>

            <ListGroup
              rows={[
                ...(appointment.testType
                  ? [
                      <ListRow
                        key="test"
                        title={t('labBooking.testType')}
                        value={appointment.testType.name}
                      />,
                    ]
                  : []),
                <ListRow
                  key="org"
                  title={t('table.organization')}
                  value={appointment.organization.name}
                />,
                <ListRow
                  key="date"
                  title={t('table.date')}
                  value={formatDate(appointment.scheduledStart, 'medium')}
                />,
                <ListRow
                  key="time"
                  title={t('table.time')}
                  value={`${formatTime(appointment.scheduledStart)} – ${formatTime(
                    appointment.scheduledEnd,
                  )}`}
                />,
                <ListRow
                  key="status"
                  title={t('table.status')}
                  trailing={
                    <Badge
                      label={t(`status.appointment.${appointment.status}`)}
                      tone={appointment.status === 'CONFIRMED' ? 'success' : 'warning'}
                    />
                  }
                />,
              ]}
            />
          </Stack>
        ) : null}

        <Banner tone="clinical" title={t('labBooking.arriveEarly')} />

        <Stack gap="md">
          <Button
            label={t('labBooking.viewMyTests')}
            onPress={() => router.replace('/(app)/laboratory')}
          />
          <Button
            label={t('booking.backToApp')}
            variant="secondary"
            onPress={() => router.replace('/(app)/home')}
          />
        </Stack>
      </Stack>
    </ScrollScreen>
  );
}
