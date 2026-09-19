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
  /**
   * True for the device this list is being read on.
   *
   * Decided by the server from the access token's session id, not guessed in
   * the app: without it the list offers a "revoke" on every row and none of
   * them says which one signs you out of the device in your hand.
   */
  isCurrent?: boolean;
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