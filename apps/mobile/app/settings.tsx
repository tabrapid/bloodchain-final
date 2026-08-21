import { Stack } from 'expo-router';
import { View } from 'react-native';
import { AppText, Card, Screen, SectionHeader } from '../src/components';
import { spacing } from '../src/theme';

export default function Settings() {
  return (
    <Screen>
      <Stack.Screen
        options={{
          title: 'Settings',
          headerShown: true,
          headerStyle: { backgroundColor: '#111A24' },
          headerTintColor: '#F2F5F7',
        }}
      />
      <AppText variant="title">Settings</AppText>
      <SectionHeader>PREFERENCES</SectionHeader>
      <Card>
        <AppText>Theme, language, and notification preferences will be configurable here.</AppText>
      </Card>
      <SectionHeader>PRIVACY</SectionHeader>
      <Card>
        <AppText muted>Manage consent for location sharing and data visibility.</AppText>
      </Card>
    </Screen>
  );
}
