import { router } from 'expo-router';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Droplet } from 'lucide-react-native';
import { AppButton, AppText, Screen } from '../../src/components';
import { spacing, translucentElevation, useTheme } from '../../src/theme';

export default function Welcome() {
  const { colors } = useTheme();
  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {/* The mark sits on its own rose glow, with a lit top edge — the same
            two cues every hero surface in the design carries. */}
        <View
          style={{
            borderRadius: 26,
            marginBottom: 36,
            shadowColor: colors.primary,
            shadowOpacity: 0.45,
            shadowRadius: 48,
            shadowOffset: { width: 0, height: 16 },
            elevation: translucentElevation(16),
          }}
        >
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
              overflow: 'hidden',
            }}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.25)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '44%' }}
              pointerEvents="none"
            />
            <Droplet size={42} color="#FFFFFF" fill="#FFFFFF" />
          </LinearGradient>
        </View>
        <AppText
          style={{
            fontSize: 13,
            fontWeight: '700',
            letterSpacing: 4.16,
            color: colors.textMuted,
            marginBottom: 20,
          }}
        >
          DONOR
        </AppText>
        <AppText
          style={{
            fontSize: 38,
            fontWeight: '800',
            lineHeight: 42,
            letterSpacing: -1.14,
            color: colors.text,
            textAlign: 'center',
            maxWidth: 280,
          }}
        >
          Care that moves with you.
        </AppText>
        <AppText
          muted
          style={{
            fontSize: 15,
            lineHeight: 24,
            letterSpacing: -0.15,
            textAlign: 'center',
            maxWidth: 280,
            marginTop: spacing.md,
          }}
        >
          Track your donations, monitor your health, and connect with your community — all in one
          place.
        </AppText>
        <View style={{ marginTop: 56, width: '100%', maxWidth: 320, gap: 12 }}>
          <AppButton onPress={() => router.push('/(auth)/login')}>Sign in</AppButton>
          <AppButton variant="ghost" onPress={() => router.push('/(auth)/register')}>
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
