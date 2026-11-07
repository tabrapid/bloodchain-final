import { apiRequest } from './client';
export interface DonorUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  roles: string[];
  emailVerified: boolean;
  phoneVerified: boolean;
}
export const me = () => apiRequest<DonorUser>('/api/v1/auth/me');
export const login = (identifier: string, password: string) =>
  apiRequest('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ [identifier.includes('@') ? 'email' : 'phone']: identifier, password }),
    skipAuth: true,
  });
export const logout = () => apiRequest('/api/v1/auth/logout', { method: 'POST' });
export const authAction = <T = { message: string }>(
  endpoint: string,
  input: Record<string, unknown>,
) =>
  apiRequest<T>(`/api/v1/auth/${endpoint}`, {
    method: 'POST',
    body: JSON.stringify(input),
    skipAuth: true,
  });
