import { router } from 'expo-router';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Droplet } from 'lucide-react-native';
import { AppButton, AppText, Screen } from '../../src/components';
import { spacing, useTheme } from '../../src/theme';

export default function Welcome() {
  const { colors } = useTheme();
  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <LinearGradient
          colors={colors.heroGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 88,
            height: 88,
            borderRadius: 26,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.xl,
          }}
        >
          <Droplet size={42} color="#FFFFFF" fill="#FFFFFF" />
        </LinearGradient>
        <AppText
          style={{
            fontSize: 13,
            fontWeight: '700',
            letterSpacing: 4,
            color: colors.textMuted,
            marginBottom: spacing.md,
          }}
        >
          DONOR
        </AppText>
        <AppText variant="display" style={{ textAlign: 'center' }}>
          Care that moves{`\n`}with you.
        </AppText>
        <AppText muted style={{ marginTop: spacing.md, lineHeight: 23, textAlign: 'center' }}>
          Track your donations, monitor your health, and connect with your community — all in one
          place.
        </AppText>
        <View style={{ marginTop: spacing['2xl'], width: '100%' }}>
          <AppButton onPress={() => router.push('/(auth)/login')}>Sign in</AppButton>
          <AppButton
            variant="ghost"
            onPress={() => router.push('/(auth)/register')}
            style={{ marginTop: spacing.md }}
          >
            Create an account
          </AppButton>
        </View>
        <AppText
          muted
          style={{
            marginTop: spacing.xl,
            fontSize: 11,
            textAlign: 'center',
            opacity: 0.7,
            lineHeight: 16,
          }}
        >
          By continuing you agree to our Terms of Service and Privacy Policy
        </AppText>
      </View>
    </Screen>
  );
}
