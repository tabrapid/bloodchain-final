import { Tabs } from 'expo-router';
import { CalendarDays, Droplet, HeartPulse, Home, UserRound } from 'lucide-react-native';
import { colors } from '../../src/theme';

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: 'Home', tabBarIcon: ({ color }) => <Home color={color} /> }}
      />
      <Tabs.Screen
        name="health"
        options={{ title: 'Health', tabBarIcon: ({ color }) => <HeartPulse color={color} /> }}
      />
      <Tabs.Screen
        name="donate"
        options={{ title: 'Donate', tabBarIcon: ({ color }) => <Droplet color={color} /> }}
      />
      <Tabs.Screen
        name="calendar"
        options={{ title: 'Calendar', tabBarIcon: ({ color }) => <CalendarDays color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <UserRound color={color} /> }}
      />
    </Tabs>
  );
}
