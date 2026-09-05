import { Tabs } from 'expo-router';
import { Clock3, Truck, UserRound } from 'lucide-react-native';
import { GlassTabBar } from '../../src/components/GlassTabBar';

export default function CourierLayout() {
  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // Every navigator scene paints React Navigation's *own* theme
        // background, which defaults to white -- and the app never gives it a
        // theme. That used to be invisible because each `Screen` painted an
        // opaque gradient over it; now the backdrop lives at the root and the
        // screens are transparent, so this has to be transparent too or the
        // navigator's white covers the backdrop on every screen.
        sceneStyle: { backgroundColor: 'transparent' },
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
