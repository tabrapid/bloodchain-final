import Constants from 'expo-constants';

/**
 * The published policy pages, if this build was given them.
 *
 * `EXPO_PUBLIC_PRIVACY_POLICY_URL` and `EXPO_PUBLIC_TERMS_URL` reach the app
 * through `extra` (see app-config.ts). Absent, the rows that would open them
 * say "not yet published" rather than pointing at a page that does not exist.
 */
export function policyLinks(): { privacyPolicyUrl: string | null; termsUrl: string | null } {
  const extra = (Constants.expoConfig?.extra ?? {}) as { privacyPolicyUrl?: string; termsUrl?: string };
  return {
    privacyPolicyUrl: extra.privacyPolicyUrl ?? null,
    termsUrl: extra.termsUrl ?? null,
  };
}
