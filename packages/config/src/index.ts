export const appConfig = {
  name: 'DONOR',
  apiVersion: 'v1',
  apiBasePath: '/api/v1',
} as const;

export function apiBaseUrl(): string {
  if (typeof process !== 'undefined' && process.env.API_URL) {
    return process.env.API_URL;
  }
  return 'http://localhost:3001';
}

export function webBaseUrl(): string {
  if (typeof process !== 'undefined' && process.env.WEB_URL) {
    return process.env.WEB_URL;
  }
  return 'http://localhost:3000';
}
