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
          All the slack collects here, above the brand. Centring the brand in
          the leftover space instead split that slack in two and left a visible
          gap between the wordmark and the wave -- the brand floated between
          two empty halves rather than belonging to anything. Sitting a fixed
          56pt above the crest, the mark, the wordmark and the band read as one
          group, and what is left over reads as headroom.
        */}
        <View style={{ flex: 1 }} />
        <View style={{ alignItems: 'center', marginBottom: 56 }}>
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
              // Tight, because the copy breaks at its comma into a long line
              // and a short one. Nothing in React Native balances a wrap, so
              // the two lines are pulled together into a single mass instead,
              // which is what stops the short line reading as left over.
              lineHeight: Math.round(headlineSize(width) * 1.14),
              fontWeight: '700',
              letterSpacing: -1.1,
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
              // Stops the sentence running the full width into the right
              // margin, which it did by a hair on a 390pt screen.
              maxWidth: '92%',
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
            // The variant's 0.4 glow is tuned for the app's dark ground; on
            // colour it haloes.
            style={{ height: 54, marginTop: 30, shadowOpacity: 0.22 }}
          >
            Create Account
          </AppButton>

          {/*
            Glass, not a hole. The variant's default is rose text on a warm
            translucent tint, which over the wave stacks the two lowest
            contrasts on the screen on each other; a dark plate fixed that and
            overshot, reading as a disabled control cut out of the band. A
            light film with a visible hairline sits where it should: clearly
            secondary, clearly still a button.
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
              backgroundColor: 'rgba(255,255,255,0.13)',
              borderColor: 'rgba(255,255,255,0.34)',
            }}
          >
            Sign In
          </AppButton>

          <AppText
            maxFontSizeMultiplier={1.4}
            style={{
              marginTop: 22,
              // Narrower than the buttons on purpose: at full width the
              // sentence broke after "Privacy", leaving "Policy." alone on the
              // second line. Given a measure it breaks near its middle.
              maxWidth: 300,
              alignSelf: 'center',
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
 * The phrase is lifted out of the sentence by colour alone until it has
 * somewhere to go. Underlining it first was worse than leaving it plain: an
 * underline in running text is a promise of a tap, and these two do not
 * respond to one yet. The underline comes back with the URL.
 */
function LegalLink({ url, children }: { url: string | null; children: ReactNode }) {
  const style = {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.92)',
  };

  if (!url) {
    return <AppText style={style}>{children}</AppText>;
  }

  return (
    <AppText
      accessibilityRole="link"
      onPress={() => Linking.openURL(url)}
      style={{ ...style, textDecorationLine: 'underline' }}
    >
      {children}
    </AppText>
  );
}
