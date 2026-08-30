import { Tabs } from 'expo-router';
import { Clock3, Truck, UserRound } from 'lucide-react-native';
import { GlassTabBar } from '../../src/components/GlassTabBar';

export default function CourierLayout() {
  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
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
