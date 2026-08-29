import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryProvider } from '../src/providers/QueryProvider';
import { colors } from '../src/theme';
import { useAuthBootstrap } from '../src/hooks/useAuth';
import { usePushNotifications } from '../src/hooks/usePushNotifications';
import { useAuthStore } from '../src/stores/auth.store';
import { ActivityIndicator, View } from 'react-native';

function AppContent() {
  useAuthBootstrap();
  usePushNotifications();
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryProvider>
        <StatusBar style="light" />
        <AppContent />
      </QueryProvider>
    </SafeAreaProvider>
  );
}
