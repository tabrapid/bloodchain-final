import { router } from 'expo-router';
import { View } from 'react-native';
import { Activity } from 'lucide-react-native';
import { AppButton, AppText, Screen } from '../../src/components';
import { colors, spacing, typography } from '../../src/theme';

export default function Welcome() {
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            backgroundColor: `${colors.primary}18`,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.xl,
          }}
        >
          <Activity size={32} color={colors.primary} />
        </View>
        <AppText variant="display">Care that moves{`\n`}with you.</AppText>
        <AppText muted style={{ marginTop: spacing.md, lineHeight: 23 }}>
          DONOR gives you a clearer, more confident way to stay connected to your health journey.
        </AppText>
        <View style={{ marginTop: spacing['2xl'] }}>
          <AppButton onPress={() => router.push('/(auth)/login')}>Continue</AppButton>
        </View>
      </View>
    </Screen>
  );
}
