import { ReactNode } from 'react';
import { router } from 'expo-router';
import { Linking, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight } from 'lucide-react-native';
import { BrandMark } from '../../src/components/BrandMark';
import { Button, Stack, Text, fonts, space, useDesign } from '../../src/design';
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
  if (width >= 414) return 34;
  if (width >= 360) return 30;
  return 27;
}

/**
 * The first screen, rebuilt for V2.
 *
 * What went, and why. It used to be a full-bleed rose-to-violet band with a
 * curved crest, sized at runtime from the measured height of the text block so
 * the curve landed above the headline on every device. It was the most
 * technically careful thing in the app and it was also the loudest: a brand
 * gradient across two thirds of the first screen, with white text on it, and a
 * secondary button that had to be tuned to a translucent film because nothing
 * else stayed legible over colour.
 *
 * The brief for V2 is calm, precise and adult, and it says in as many words:
 * no excessive gradients, restrained rose. So the band is gone. What is left
 * is the mark, two lines of type, two actions and the legal line, on the flat
 * ground the rest of the app uses -- and the only colour on the screen is the
 * primary button, which is the thing a visitor is here to press.
 *
 * Everything the old screen had learned is kept: no carousel dots for a screen
 * that does not scroll, phone-first as the primary action, the legal phrases
 * inert until they have somewhere to go, and per-device sizing for a headline
 * that wraps to two lines.
 */
export default function Welcome() {
  const { t } = useTranslation();
  const { colors } = useDesign();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  /**
   * Short phones get a smaller mark and tighter gaps. The brand block, the
   * text and the actions add up to more than a 568pt screen at full size, and
   * this screen deliberately does not scroll.
   */
  const compact = height < 700;
  const size = headlineSize(width);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top + space.xl,
        paddingBottom: Math.max(insets.bottom, space.lg) + space.sm,
        paddingHorizontal: space.lg,
      }}
    >
      {/*
        The slack collects above the brand rather than around it. Centring the
        brand in the leftover space splits that slack in two and leaves the
        mark floating between two empty halves; sitting it above the text block
        makes mark, name and headline read as one group and the rest as
        headroom.
      */}
      <View style={{ flex: 1, minHeight: space.xl }} />

      <View style={{ alignItems: 'flex-start', marginBottom: compact ? space.xl : space.xxl }}>
        <BrandMark size={compact ? 56 : 64} />
        <Text variant="h2" style={{ marginTop: space.md }} maxFontSizeMultiplier={1.3}>
          {BRAND_NAME}
        </Text>
        <Text variant="overline" tone="tertiary" caps maxFontSizeMultiplier={1.3}>
          {BRAND_TAGLINE}
        </Text>
      </View>

      <Stack gap="xxl">
        <View style={{ gap: space.md }}>
          <Text
            variant="display"
            maxFontSizeMultiplier={1.3}
            style={{
              fontSize: size,
              // Tight, because the copy breaks at its comma into a long line
              // and a short one. Nothing in React Native balances a wrap, so
              // the two lines are pulled together into one mass instead, which
              // is what stops the short line reading as left over.
              lineHeight: Math.round(size * 1.15),
            }}
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
            // Phone-first: the number is the one thing a donor here knows
            // about themselves without looking it up. Email sign-up is still
            // reachable from the next screen.
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
          style={{
            // Narrower than the buttons on purpose: at full width the sentence
            // breaks after "Privacy", leaving "Policy." alone on a line.
            maxWidth: 300,
            alignSelf: 'center',
          }}
        >
          {t('auth.welcome.legalPrefix')} <LegalLink url={TERMS_URL}>{t('auth.welcome.terms')}</LegalLink>{' '}
          {t('auth.welcome.and')} <LegalLink url={PRIVACY_URL}>{t('auth.welcome.privacy')}</LegalLink>.
        </Text>
      </Stack>
    </View>
  );
}

/**
 * The phrase is lifted out of the sentence by weight alone until it has
 * somewhere to go. Underlining it first was worse than leaving it plain: an
 * underline in running text is a promise of a tap, and these two do not
 * respond to one yet. The underline comes back with the URL.
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
