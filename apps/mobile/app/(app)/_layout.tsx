// `Tabs` from the package root is deprecated at SDK 56 in favour of this
// subpath, which is also where the bottom-tab types and the tab-bar height
// contexts now live: expo-router 56 vendors React Navigation instead of
// peering on it.
import { Tabs } from 'expo-router/js-tabs';
import { CalendarDays, Droplet, HeartPulse, Home, UserRound, Users } from 'lucide-react-native';
import { GlassTabBar } from '../../src/components/GlassTabBar';
import { useTranslation } from '../../src/i18n';

export default function AppLayout() {
  const { t } = useTranslation();

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
        // The pill positions itself (see GlassTabBar): a navigator given a
        // custom `tabBar` never applies `tabBarStyle`.
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: t('nav.home'), tabBarIcon: ({ color }) => <Home color={color} /> }}
      />
      <Tabs.Screen
        name="health"
        options={{ title: t('nav.health'), tabBarIcon: ({ color }) => <HeartPulse color={color} /> }}
      />
      <Tabs.Screen
        name="donate"
        options={{ title: t('nav.donate'), tabBarIcon: ({ color }) => <Droplet color={color} /> }}
      />
      {/*
        `community/index`, not `community`. Without a `community/_layout.tsx`
        the router flattens the folder and names the route after the file, so
        the short name matched nothing: the navigator warned, and the Community
        tab simply never appeared in the bar -- while the real route sat below
        with `href: null`, hidden.
      */}
      <Tabs.Screen
        name="community/index"
        options={{ title: t('nav.community'), tabBarIcon: ({ color }) => <Users color={color} /> }}
      />
      <Tabs.Screen
        name="calendar"
        options={{ title: t('nav.calendar'), tabBarIcon: ({ color }) => <CalendarDays color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('nav.profile'), tabBarIcon: ({ color }) => <UserRound color={color} /> }}
      />

      {/*
        Routes below are pushed to directly (router.push) and must stay out
        of the tab bar. Each `name` has to match the exact route Expo Router
        derives from the file tree (e.g. `community/index.tsx` registers as
        "community/index", not "community") -- getting this wrong doesn't
        break navigation (push still works), but Tabs logs a "No route
        named ... exists in nested children" warning for every mismatch,
        one per screen, on every load.
      */}
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="privacy" options={{ href: null }} />
      <Tabs.Screen name="security" options={{ href: null }} />
      <Tabs.Screen name="appointment/[id]" options={{ href: null }} />
      <Tabs.Screen name="campaigns/index" options={{ href: null }} />
      <Tabs.Screen name="challenges/index" options={{ href: null }} />
      <Tabs.Screen name="donations/index" options={{ href: null }} />
      <Tabs.Screen name="donations/[id]" options={{ href: null }} />
      <Tabs.Screen name="education/index" options={{ href: null }} />
      <Tabs.Screen name="gamification/index" options={{ href: null }} />
      <Tabs.Screen name="gamification/achievements/index" options={{ href: null }} />
      <Tabs.Screen name="gamification/badges/index" options={{ href: null }} />
      <Tabs.Screen name="gamification/leaderboard/index" options={{ href: null }} />
      <Tabs.Screen name="health-trends/index" options={{ href: null }} />
      <Tabs.Screen name="insights/index" options={{ href: null }} />
      <Tabs.Screen name="laboratory/index" options={{ href: null }} />
      <Tabs.Screen name="profile/donor" options={{ href: null }} />
      <Tabs.Screen name="profile/edit" options={{ href: null }} />
    </Tabs>
  );
}
