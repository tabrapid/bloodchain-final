import Constants from 'expo-constants';

export const apiBaseUrl =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  process.env.EXPO_PUBLIC_API_URL ??
  'http://localhost:3001';

export const apiBasePath = '/api/v1';
