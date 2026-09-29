import { ReactNode } from 'react';
import { router } from 'expo-router';
import { Linking, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight } from 'lucide-react-native';
import { BrandMark } from '../../src/components/BrandMark';
import { Button, Text, fonts, layout, space, useDesign } from '../../src/design';
import { BRAND_NAME, BRAND_TAGLINE } from '../../src/brand';
import { useTranslation } from '../../src/i18n';

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
 * The headline is the one thing on the screen sized per device: it has to hold
 * two lines, and the largest size does not fit a 360pt phone.
 */
function headlineSize(width: number) {
  if (width >= 414) return 38;
  if (width >= 360) return 34;
  return 30;
}

/**
 * The first screen.
 *
 * One hero moment: the brand's deep rose-plum, fading from the top of the
 * screen into the page, with the mark sitting in it. The gradient is the
 * same one the identity hero uses inside the app, so the first screen and
 * the home screen are visibly the same product. Below it, the headline in
 * the display face, two actions and the legal line.
 *
 * It deliberately does not scroll: no carousel, no dots, nothing to swipe.
 * Phone-first is the primary action, because the number is the one thing a
 * donor here knows about themselves without looking it up.
 */
export default function Welcome() {
  const { t } = useTranslation();
  const { colors } = useDesign();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const compact = height < 700;
  const size = headlineSize(width);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        pointerEvents="none"
        colors={[colors.heroGradient[0], colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: Math.min(height * 0.5, 440) }}
      />

      <View
        style={{
          flex: 1,
          paddingTop: insets.top + space.xl,
          paddingBottom: Math.max(insets.bottom, space.lg) + space.sm,
          paddingHorizontal: layout.gutter,
          width: '100%',
          maxWidth: layout.maxContentWidth,
          alignSelf: 'center',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <BrandMark size={compact ? 40 : 44} />
          <View style={{ gap: 0 }}>
            <Text variant="h3" maxFontSizeMultiplier={1.3}>
              {BRAND_NAME}
            </Text>
            <Text variant="overline" tone="tertiary" caps maxFontSizeMultiplier={1.3}>
              {BRAND_TAGLINE}
            </Text>
          </View>
        </View>

        {/* The slack collects here, so the headline and the actions read as
            one block anchored to the thumb. */}
        <View style={{ flex: 1, minHeight: space.xl }} />

        <View style={{ gap: compact ? space.xl : space.xxl }}>
          <View style={{ gap: space.md }}>
            <Text
              variant="display"
              maxFontSizeMultiplier={1.3}
              style={{ fontSize: size, lineHeight: Math.round(size * 1.12), letterSpacing: -size * 0.03 }}
            >
              {t('auth.welcome.headline')}
            </Text>
            <Text variant="body" tone="secondary" maxFontSizeMultiplier={1.4} style={{ maxWidth: '92%' }}>
              {t('auth.welcome.subheadline')}
            </Text>
          </View>

          <View style={{ gap: space.md }}>
            <Button
              label={t('auth.welcome.createAccount')}
              accessibilityLabel={t('auth.welcome.a11yCreateAccount')}
              onPress={() => router.push('/(auth)/phone')}
              icon={({ size: iconSize, color }) => <ArrowRight size={iconSize} color={color} />}
            />
            <Button
              label={t('auth.welcome.signIn')}
              accessibilityLabel={t('auth.welcome.a11ySignIn')}
              variant="secondary"
              onPress={() => router.push('/(auth)/login')}
            />
          </View>

          <Text
            variant="caption"
            tone="tertiary"
            align="center"
            maxFontSizeMultiplier={1.4}
            style={{ maxWidth: 300, alignSelf: 'center' }}
          >
            {t('auth.welcome.legalPrefix')} <LegalLink url={TERMS_URL}>{t('auth.welcome.terms')}</LegalLink>{' '}
            {t('auth.welcome.and')} <LegalLink url={PRIVACY_URL}>{t('auth.welcome.privacy')}</LegalLink>.
          </Text>
        </View>
      </View>
    </View>
  );
}

/**
 * The phrase is lifted out of the sentence by weight alone until it has
 * somewhere to go. An underline in running text is a promise of a tap, and
 * these two do not respond to one yet.
 */
function LegalLink({ url, children }: { url: string | null; children: ReactNode }) {
  const { colors } = useDesign();

  if (!url) {
    return (
      <Text variant="caption" style={{ color: colors.textSecondary, fontFamily: fonts.semibold }}>
        {children}
      </Text>
    );
  }

  return (
    <Text
      variant="caption"
      accessibilityRole="link"
      onPress={() => Linking.openURL(url)}
      style={{ color: colors.clinical.text, fontFamily: fonts.semibold, textDecorationLine: 'underline' }}
    >
      {children}
    </Text>
  );
}
