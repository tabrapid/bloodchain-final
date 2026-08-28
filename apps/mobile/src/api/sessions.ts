import { apiRequest } from './client';
import { apiBasePath } from './config';

export interface Session {
  id: string;
  deviceName?: string;
  deviceType?: string;
  ipAddress?: string;
  lastUsedAt?: string;
  createdAt: string;
  expiresAt: string;
}

export async function getSessions(): Promise<Session[]> {
  return apiRequest(`${apiBasePath}/auth/sessions`);
}

export async function revokeSession(sessionId: string): Promise<{ success: boolean }> {
  return apiRequest(`${apiBasePath}/auth/sessions/${sessionId}`, {
    method: 'DELETE',
  });
}

export async function revokeAllSessions(): Promise<{ success: boolean }> {
  return apiRequest(`${apiBasePath}/auth/sessions/revoke-all`, {
    method: 'POST',
  });
}