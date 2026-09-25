import { useLocalSearchParams, router } from 'expo-router';
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
  SectionError,
} from '../../src/design';
import { useAppointment } from '../../src/hooks/useAppointments';
import { useTranslation } from '../../src/i18n';

/**
 * The end of the wizard.
 *
 * Dates and times used to be formatted with `toLocaleDateString('en-US')` and
 * a 12-hour clock, regardless of the donor's language -- and against the
 * product's own rule that Uzbekistan reads a 24-hour clock in all three.
 *
 * The one thing on this screen the donor may need at the door is the reference
 * number, so it is the largest thing on it and it is selectable.
 */
export default function BookingConfirmation() {
  const { t, formatDate, formatTime } = useTranslation();
  const { colors } = useDesign();
  const params = useLocalSearchParams<{ appointmentId: string; rescheduled?: string }>();
  const { data: appointment, isPending, refetch } = useAppointment(params.appointmentId);
  const isRescheduled = params.rescheduled === '1';

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
              {isRescheduled ? t('booking.rescheduledTitle') : t('booking.confirmedTitle')}
            </Text>
            <Text variant="body" tone="secondary" align="center">
              {isRescheduled ? t('booking.rescheduledBody') : t('booking.confirmedBody')}
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
                <ListRow
                  key="type"
                  title={t('table.type')}
                  value={t(`appointmentTypes.${appointment.appointmentType}`)}
                />,
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
        ) : (
          // Same as the laboratory receipt: the appointment was booked, and
          // reading it back can still fail. A green tick over an empty card
          // with no reference number is the one thing this screen must not be.
          <SectionError
            message={t('booking.detailsFailed')}
            retryLabel={t('common.retry')}
            onRetry={() => void refetch()}
          />
        )}

        <Banner tone="clinical" title={t('booking.arriveEarly')} />

        <Stack gap="md">
          <Button
            label={t('booking.viewCalendar')}
            onPress={() => router.replace('/(app)/calendar')}
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
