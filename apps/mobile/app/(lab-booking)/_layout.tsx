import { Stack } from 'expo-router';

/**
 * The laboratory booking wizard, separate from `(booking)`.
 *
 * A blood test is booked against a *test type* at a *laboratory*, through
 * `POST /laboratory-appointments`. The generic wizard books a slot at an
 * organization through `POST /appointments`, whose DTO has no test type at
 * all -- which is why every test booked through it arrived at the blood
 * centre with no panel on it. Rather than bend the donation wizard into
 * carrying a field it has no step for, this is its own five-step flow; the
 * donation wizard is untouched.
 */
export default function LabBookingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Matches `(booking)`: the navigator's own theme background is opaque
        // white by default and would cover the app's backdrop.
        contentStyle: { backgroundColor: 'transparent' },
        animation: 'slide_from_right',
      }}
    />
  );
}
