import { Stack } from 'expo-router';
import { EmptyState, Screen } from '../src/components';

export default function NotificationsScreen() {
  return (
    <Screen>
      <Stack.Screen
        options={{
          title: 'Notifications',
          headerShown: true,
          headerStyle: { backgroundColor: '#111A24' },
          headerTintColor: '#F2F5F7',
        }}
      />
      <EmptyState
        title="No notifications"
        description="Push notifications and reminders will appear here when enabled."
      />
    </Screen>
  );
}
