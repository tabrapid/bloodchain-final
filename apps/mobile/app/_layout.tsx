import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryProvider } from '../src/providers/QueryProvider';
import { ThemeProvider } from '../src/theme';
import { LocaleProvider } from '../src/i18n';
import { AppBackground } from '../src/components/AppBackground';
import { useAuthBootstrap } from '../src/hooks/useAuth';
import { usePushNotifications } from '../src/hooks/usePushNotifications';
import { useAuthStore } from '../src/stores/auth.store';
import { useAppFonts } from '../src/design/fonts';
import { useDesign } from '../src/design';
import { ActivityIndicator, View } from 'react-native';

function AppContent() {
  useAuthBootstrap();
  usePushNotifications();
  const isLoading = useAuthStore((s) => s.isLoading);
  const { colors, isDark } = useDesign();
  const fontsReady = useAppFonts();

  // Held on the background colour until Inter is in memory.
  //
  // Rendering text in the system face and swapping it a frame later is not a
  // neutral choice: every line re-measures, so the layout visibly jumps, and on
  // a cold start that jump is the first thing a donor sees. A beat of the app's
  // own background is calmer and reads as deliberate. There is no spinner here
  // for the same reason -- font loading is fast enough that a spinner would
  // flash rather than inform.
  if (!fontsReady) {
    return (
      <>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={{ flex: 1, backgroundColor: colors.background }} />
      </>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* The backdrop lives here, above the navigator, so it is already
          painted before any screen's glass mounts -- see AppBackground. Every
          screen renders transparent on top of it. */}
      <AppBackground>
        {isLoading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.rose.base} />
          </View>
        ) : (
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
        )}
      </AppBackground>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      {/* Above the navigator, so a language change re-renders every screen
          without remounting the query client or touching stored tokens. */}
      <LocaleProvider>
        <SafeAreaProvider>
          <QueryProvider>
            <AppContent />
          </QueryProvider>
        </SafeAreaProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}
