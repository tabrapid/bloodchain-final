import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/stores/auth.store';
import { getPostAuthRoute } from '../src/utils/postAuthRoute';

/**
 * The app's real entry point. Without this, nothing owned the bare `/`
 * route -- (booking)/index.tsx and (onboarding)/index.tsx both mapped to
 * it (Expo Router strips group-folder names from the URL), so cold start
 * landed on whichever one the router happened to resolve first, skipping
 * the welcome/login screen entirely regardless of auth state.
 */
export default function Index() {
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/welcome" />;
  }

  return <Redirect href={getPostAuthRoute(user?.roles ?? [])} />;
}
