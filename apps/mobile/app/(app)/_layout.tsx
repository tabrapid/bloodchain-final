import { Tabs } from 'expo-router';
import { CalendarDays, Droplet, HeartPulse, Home, UserRound, Users } from 'lucide-react-native';
import { GlassTabBar } from '../../src/components/GlassTabBar';

export default function AppLayout() {
  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // The tab bar is a floating glass pill, so it has to sit *over* the
        // screen rather than in a strip below it. Without `position:
        // 'absolute'` the navigator reserves a band at the bottom and shortens
        // every screen to fit -- the pill then has nothing behind it to blur
        // and reads as a docked slab instead of glass floating over content.
        // `Screen` pads its scroll content by the bar's height so nothing ends
        // up stranded underneath it.
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
        },
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
        name="community"
        options={{ title: 'Community', tabBarIcon: ({ color }) => <Users color={color} /> }}
      />
      <Tabs.Screen
        name="calendar"
        options={{ title: 'Calendar', tabBarIcon: ({ color }) => <CalendarDays color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <UserRound color={color} /> }}
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
      <Tabs.Screen name="community/index" options={{ href: null }} />
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
