import { useState } from 'react';
import { router } from 'expo-router';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight } from 'lucide-react-native';
import { AppButton, AppText, BrandMark, HeroWave } from '../../src/components';
import { spacing, useTheme } from '../../src/theme';

/**
 * The wordmark, in one place. The product is named in `app.json` as DONOR;
 * changing what the welcome screen says means changing these two lines and
 * nothing else.
 */
const WORDMARK = 'DONOR';
const TAGLINE = 'PEOPLE SAVE LIVES';

/**
 * Three slides, each naming something the app actually does -- emergency
 * matching, and the health record behind it -- rather than three restatements
 * of "donate blood". The pitch is the part a first-time visitor reads; it
 * should say what they get.
 */
const SLIDES = [
  {
    title: 'A stronger tomorrow, together.',
    body: 'Connect. Donate. Make an impact. Every drop counts.',
  },
  {
    title: 'Every request finds a donor.',
    body: 'Get alerted the moment someone near you needs your blood type.',
  },
  {
    title: 'Your health, in your hands.',
    body: 'Lab results, donation history and eligibility — all in one place.',
  },
];

export default function Welcome() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [slide, setSlide] = useState(0);

  // The band covers a little over half the screen, which is what puts the
  // headline on colour and the mark on the dark backdrop above it.
  const waveHeight = Math.round(height * 0.58);

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setSlide(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  return (
    <View style={{ flex: 1 }}>
      <HeroWave height={waveHeight} />

      <View
        style={{
          flex: 1,
          paddingTop: insets.top + spacing.xl,
          paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm,
        }}
      >
        <View style={{ alignItems: 'center' }}>
          <BrandMark size={92} />
          <AppText
            style={{
              marginTop: spacing.md,
              fontSize: 34,
              fontWeight: '800',
              letterSpacing: -0.9,
              color: colors.text,
            }}
          >
            {WORDMARK}
          </AppText>
          <AppText
            muted
            style={{ marginTop: 6, fontSize: 11, fontWeight: '600', letterSpacing: 5.2 }}
          >
            {TAGLINE}
          </AppText>
        </View>

        {/*
          The pitch is a pager rather than a single block of copy: three claims
          stacked vertically is a wall nobody reads, and one claim alone
          undersells an app that does emergency matching *and* health records.
          The dots below are bound to the real scroll offset -- they are an
          indicator, not decoration.
        */}
        <FlatList
          data={SLIDES}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          keyExtractor={(item) => item.title}
          style={{ flexGrow: 0, marginTop: 'auto' }}
          renderItem={({ item }) => (
            <View style={{ width, paddingHorizontal: spacing.lg }}>
              <AppText
                style={{
                  fontSize: 32,
                  lineHeight: 38,
                  fontWeight: '800',
                  letterSpacing: -1,
                  color: '#FFFFFF',
                }}
              >
                {item.title}
              </AppText>
              <AppText
                style={{
                  marginTop: spacing.sm,
                  fontSize: 15,
                  lineHeight: 23,
                  color: 'rgba(255,255,255,0.82)',
                }}
              >
                {item.body}
              </AppText>
            </View>
          )}
        />

        <View style={{ flexDirection: 'row', gap: 6, marginTop: spacing.md, paddingHorizontal: spacing.lg }}>
          {SLIDES.map((item, index) => (
            <View
              key={item.title}
              style={{
                width: index === slide ? 20 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor:
                  index === slide ? '#FFFFFF' : 'rgba(255,255,255,0.35)',
              }}
            />
          ))}
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: 12 }}>
          <AppButton
            gradient
            trailingIcon={ArrowRight}
            onPress={() => router.push('/(auth)/register')}
          >
            Create Account
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/(auth)/login')}>
            Sign In
          </AppButton>
          <AppText
            style={{
              marginTop: spacing.xs,
              fontSize: 11,
              lineHeight: 16,
              textAlign: 'center',
              color: 'rgba(255,255,255,0.6)',
            }}
          >
            By continuing you agree to our Terms of Service and Privacy Policy
          </AppText>
        </View>
      </View>
    </View>
  );
}
