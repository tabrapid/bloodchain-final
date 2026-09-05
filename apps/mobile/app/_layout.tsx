import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryProvider } from '../src/providers/QueryProvider';
import { ThemeProvider, useTheme } from '../src/theme';
import { AppBackground } from '../src/components/AppBackground';
import { useAuthBootstrap } from '../src/hooks/useAuth';
import { usePushNotifications } from '../src/hooks/usePushNotifications';
import { useAuthStore } from '../src/stores/auth.store';
import { ActivityIndicator, View } from 'react-native';

function AppContent() {
  useAuthBootstrap();
  usePushNotifications();
  const isLoading = useAuthStore((s) => s.isLoading);
  const { colors, isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* The backdrop lives here, above the navigator, so it is already
          painted before any screen's glass mounts -- see AppBackground. Every
          screen renders transparent on top of it. */}
      <AppBackground>
        {isLoading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
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
      <SafeAreaProvider>
        <QueryProvider>
          <AppContent />
        </QueryProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
