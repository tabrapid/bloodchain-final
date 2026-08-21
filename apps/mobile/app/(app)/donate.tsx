import { View } from 'react-native';
import { CalendarPlus, Clock, HeartHandshake, History } from 'lucide-react-native';
import { AppButton, AppText, Card, Screen, SectionHeader } from '../../src/components';
import { colors, spacing, typography } from '../../src/theme';

export default function Donate() {
  return (
    <Screen>
      <AppText variant="title">Donate</AppText>
      <AppText muted style={{ marginTop: spacing.sm }}>
        Make an impact, on your terms.
      </AppText>

      <Card style={{ marginTop: spacing.xl, borderColor: '#5B3038' }}>
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
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: '#26191F',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CalendarPlus size={22} color={colors.primary} />
          </View>
          <AppText variant="heading">Book a donation</AppText>
        </View>
        <AppText muted style={{ marginBottom: spacing.md }}>
          Appointments will become available once your profile is connected.
        </AppText>
        <AppButton size="small" disabled>
          Coming soon
        </AppButton>
      </Card>

      <SectionHeader>YOUR JOURNEY</SectionHeader>
      <Card>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            marginBottom: spacing.md,
          }}
        >
          <History size={22} color={colors.secondary} />
          <AppText variant="heading">Donation history</AppText>
        </View>
        <AppText muted>No history connected</AppText>
      </Card>

      <SectionHeader>EMERGENCY REQUESTS</SectionHeader>
      <Card style={{ borderColor: '#5B3038' }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            marginBottom: spacing.md,
          }}
        >
          <HeartHandshake size={22} color={colors.danger} />
          <AppText variant="heading" style={{ color: colors.danger }}>
            Respond to SOS
          </AppText>
        </View>
        <AppText muted>Compatible donor matching is staged for a future phase.</AppText>
      </Card>
    </Screen>
  );
}
