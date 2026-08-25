import { Tabs } from 'expo-router';
import { Clock3, Truck, UserRound } from 'lucide-react-native';
import { colors } from '../../src/theme';

export default function CourierLayout() {
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
        name="active"
        options={{ title: 'Active', tabBarIcon: ({ color }) => <Truck color={color} /> }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: 'History', tabBarIcon: ({ color }) => <Clock3 color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <UserRound color={color} /> }}
      />
    </Tabs>
  );
}
