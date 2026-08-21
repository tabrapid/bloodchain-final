import { Stack } from 'expo-router';
import { View } from 'react-native';
import { Activity, AlertTriangle } from 'lucide-react-native';
import { AppButton, AppText, Card, Screen } from '../src/components';
import { colors, spacing, typography } from '../src/theme';

export default function SosScreen() {
  return (
    <Screen>
      <Stack.Screen
        options={{
          title: 'Emergency SOS',
          headerShown: true,
          headerStyle: { backgroundColor: '#26191F' },
          headerTintColor: '#D85360',
        }}
      />
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Card
          style={{ borderColor: '#5B3038', alignItems: 'center', paddingVertical: spacing['2xl'] }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: '#5B3038',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing.lg,
            }}
          >
            <AlertTriangle size={36} color={colors.danger} />
          </View>
          <AppText variant="heading" style={{ color: colors.danger, textAlign: 'center' }}>
            Emergency SOS
          </AppText>
          <AppText muted style={{ textAlign: 'center', marginVertical: spacing.md }}>
            Real-time emergency blood requests and donor matching are not active yet. This screen is
            a foundation placeholder.
          </AppText>
          <AppButton variant="danger" disabled>
            SOS not enabled
          </AppButton>
        </Card>
      </View>
    </Screen>
  );
}
