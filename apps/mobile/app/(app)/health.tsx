import { View } from 'react-native';
import { Activity, Brain, FlaskConical, TrendingUp } from 'lucide-react-native';
import { AppText, Card, GlassCard, Screen, SectionHeader, StatCard } from '../../src/components';
import { colors, spacing, typography } from '../../src/theme';

export default function Health() {
  return (
    <Screen>
      <AppText variant="title">Health</AppText>
      <AppText muted style={{ marginTop: spacing.sm }}>
        A calm view of your health journey.
      </AppText>

      <SectionHeader>OVERVIEW</SectionHeader>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <StatCard
          label="Blood tests"
          value="—"
          note="No tests"
          icon={FlaskConical}
          variant="secondary"
          style={{ flex: 1 }}
        />
        <StatCard
          label="Trends"
          value="—"
          note="No trends"
          icon={TrendingUp}
          variant="success"
          style={{ flex: 1 }}
        />
      </View>

      <SectionHeader>EXPLORE</SectionHeader>
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
              width: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: '#10202A',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FlaskConical size={20} color={colors.secondary} />
          </View>
          <AppText variant="heading">Blood tests</AppText>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: '#1A1730',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Brain size={20} color={colors.ai} />
          </View>
          <AppText variant="heading" style={{ color: colors.ai }}>
            Insights and AI explanations
          </AppText>
        </View>
      </Card>

      <SectionHeader>ACTIVITY</SectionHeader>
      <GlassCard>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Activity size={22} color={colors.success} />
          <AppText>Your health data is private and secure.</AppText>
        </View>
      </GlassCard>
    </Screen>
  );
}
