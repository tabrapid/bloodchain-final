import { ReactNode, useState } from 'react';
import { router } from 'expo-router';
import { LayoutChangeEvent, Linking, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight } from 'lucide-react-native';
import { AppButton, AppText, BrandMark, HeroWave } from '../../src/components';
import { spacing, useTheme } from '../../src/theme';

/**
 * The wordmark, in one place. Changing what the welcome screen calls the
 * product means changing these two lines and nothing else.
 */
const WORDMARK = 'Bloodchainga';
const TAGLINE = 'PEOPLE SAVE LIVES';

/**
 * Point these at the published legal pages and the two phrases below become
 * links. Until then they are emphasised but inert: the app has no Terms screen
 * and its `privacy` route is the signed-in location-consent settings, not a
 * policy document -- so linking either one from here would send a visitor who
 * has no account into the auth guard.
 */
const TERMS_URL: string | null = null;
const PRIVACY_URL: string | null = null;

/**
 * Everything below the wave's crest sits on brand colour rather than on the
 * app's dark ground, so it uses white at fixed alphas. The theme's on-dark
 * text tokens are tuned for a near-black background and go muddy over rose.
 */
const ON_WAVE_PRIMARY = '#FFFFFF';
const ON_WAVE_SECONDARY = 'rgba(255,255,255,0.80)';
const ON_WAVE_TERTIARY = 'rgba(255,255,255,0.68)';

/**
 * The headline is the only thing on the screen sized per device: it has to
 * hold two lines, and 36pt on a 360pt phone does not.
 */
function headlineSize(width: number) {
  if (width >= 414) return 36;
  if (width >= 360) return 34;
  return 32;
}

export default function Welcome() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [heroHeight, setHeroHeight] = useState(0);

  /**
   * The band is sized from the hero block it has to sit behind, measured, plus
   * the run-up the curve needs above the headline. Deriving it from a fraction
   * of the window instead put the crest through the middle of the headline on
   * short phones and left it stranded below the text on tall ones.
   */
  const waveHeight = heroHeight > 0 ? heroHeight + 104 : Math.round(height * 0.5);

  const onHeroLayout = (event: LayoutChangeEvent) => {
    setHeroHeight(event.nativeEvent.layout.height);
  };

  return (
    <View style={{ flex: 1 }}>
      <HeroWave height={waveHeight} />

      <View
        style={{
          flex: 1,
          paddingTop: insets.top + spacing.lg,
          // Clear of the home indicator, with room to spare -- the legal line
          // used to sit directly on it.
          paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm,
        }}
      >
        {/*
          The brand block is centred in whatever the hero block leaves rather
          than pinned under the status bar. That splits the empty space above
          and below it instead of collecting it all into one hole in the middle
          of the screen, and it keeps the mark clear of the notch on every
          device without a hardcoded offset.
        */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <BrandMark size={84} />
          <AppText
            maxFontSizeMultiplier={1.3}
            style={{
              marginTop: spacing.md,
              fontSize: 30,
              fontWeight: '800',
              letterSpacing: -0.6,
              color: colors.text,
            }}
          >
            {WORDMARK}
          </AppText>
          <AppText
            muted
            maxFontSizeMultiplier={1.3}
            style={{ marginTop: 8, fontSize: 11, fontWeight: '600', letterSpacing: 4.4 }}
          >
            {TAGLINE}
          </AppText>
        </View>

        <View onLayout={onHeroLayout} style={{ paddingHorizontal: spacing.lg }}>
          <AppText
            maxFontSizeMultiplier={1.3}
            style={{
              fontSize: headlineSize(width),
              lineHeight: Math.round(headlineSize(width) * 1.18),
              fontWeight: '700',
              letterSpacing: -0.8,
              color: ON_WAVE_PRIMARY,
            }}
          >
            A stronger tomorrow, together.
          </AppText>

          <AppText
            maxFontSizeMultiplier={1.4}
            style={{
              marginTop: 14,
              fontSize: 15,
              lineHeight: 23,
              color: ON_WAVE_SECONDARY,
            }}
          >
            Connect. Donate. Make an impact. Every drop counts.
          </AppText>

          <AppButton
            gradient
            // The brand's own three-stop gradient, not the two-stop CTA blend.
            gradientColors={colors.heroGradient}
            trailingIcon={ArrowRight}
            onPress={() => router.push('/(auth)/register')}
            accessibilityRole="button"
            accessibilityLabel="Create Bloodchainga account"
            style={{ height: 54, marginTop: 30 }}
          >
            Create Account
          </AppButton>

          {/*
            A dark glass plate with a light hairline, not the variant's default
            rose-on-tint. Over the wave that default is rose text on a warm
            translucent surface -- the two lowest-contrast things on the screen
            stacked on each other -- and it read as a second primary button
            rather than the quieter of the two.
          */}
          <AppButton
            variant="secondary"
            textColor={ON_WAVE_PRIMARY}
            onPress={() => router.push('/(auth)/login')}
            accessibilityRole="button"
            accessibilityLabel="Sign in to Bloodchainga"
            style={{
              height: 54,
              marginTop: 12,
              backgroundColor: 'rgba(7,11,18,0.45)',
              borderColor: 'rgba(255,255,255,0.26)',
            }}
          >
            Sign In
          </AppButton>

          <AppText
            maxFontSizeMultiplier={1.4}
            style={{
              marginTop: 22,
              fontSize: 12,
              lineHeight: 18,
              textAlign: 'center',
              color: ON_WAVE_TERTIARY,
            }}
          >
            By continuing, you agree to our <LegalLink url={TERMS_URL}>Terms of Service</LegalLink>{' '}
            and <LegalLink url={PRIVACY_URL}>Privacy Policy</LegalLink>.
          </AppText>
        </View>
      </View>
    </View>
  );
}

/**
 * Underlined either way, so the phrase reads as the named document rather than
 * as running text -- but only pressable once there is somewhere for it to go.
 */
function LegalLink({ url, children }: { url: string | null; children: ReactNode }) {
  const style = {
    fontSize: 12,
    lineHeight: 18,
    color: ON_WAVE_PRIMARY,
    textDecorationLine: 'underline' as const,
  };

  if (!url) {
    return <AppText style={style}>{children}</AppText>;
  }

  return (
    <AppText
      accessibilityRole="link"
      onPress={() => Linking.openURL(url)}
      style={style}
    >
      {children}
    </AppText>
  );
}
