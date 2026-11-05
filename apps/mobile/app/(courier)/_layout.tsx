// `Tabs` from the package root is deprecated at SDK 56 in favour of this
// subpath, which is also where the bottom-tab types and the tab-bar height
// contexts now live: expo-router 56 vendors React Navigation instead of
// peering on it.
import { Tabs } from 'expo-router/js-tabs';
import { Clock3, Truck, UserRound } from 'lucide-react-native';
import { TabBar } from '../../src/design';
import { useTranslation } from '../../src/i18n';

export default function CourierLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
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
        options={{ title: t('courier.tabActive'), tabBarIcon: ({ color }) => <Truck color={color} /> }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: t('courier.tabHistory'), tabBarIcon: ({ color }) => <Clock3 color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('courier.tabProfile'), tabBarIcon: ({ color }) => <UserRound color={color} /> }}
      />
    </Tabs>
  );
}
