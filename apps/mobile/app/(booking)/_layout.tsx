import { Stack } from 'expo-router';

export default function BookingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Every navigator scene paints React Navigation's *own* theme
        // background, which defaults to white -- and the app never gives it a
        // theme. That used to be invisible because each `Screen` painted an
        // opaque gradient over it; now the backdrop lives at the root and the
        // screens are transparent, so this has to be transparent too or the
        // navigator's white covers the backdrop on every screen.
        contentStyle: { backgroundColor: 'transparent' },
        animation: 'slide_from_right',
      }}
    />
  );
}
