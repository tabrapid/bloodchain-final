import { router } from 'expo-router';
import { View } from 'react-native';
import { Activity } from 'lucide-react-native';
import { AppButton, AppText, Screen } from '../../src/components';
import { spacing, useTheme } from '../../src/theme';

export default function Welcome() {
  const { colors } = useTheme();
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            backgroundColor: colors.primaryMuted,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.xl,
          }}
        >
          <Activity size={32} color={colors.onMuted.primary} />
        </View>
        <AppText variant="display">Care that moves{`\n`}with you.</AppText>
        <AppText muted style={{ marginTop: spacing.md, lineHeight: 23 }}>
          DONOR gives you a clearer, more confident way to stay connected to your health journey.
        </AppText>
        <View style={{ marginTop: spacing['2xl'] }}>
          <AppButton onPress={() => router.push('/(auth)/login')}>Sign in</AppButton>
          <AppButton
            variant="ghost"
            onPress={() => router.push('/(auth)/register')}
            style={{ marginTop: spacing.md }}
          >
            Create an account
          </AppButton>
        </View>
      </View>
    </Screen>
  );
}
