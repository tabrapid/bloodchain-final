import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSessions, revokeSession, revokeAllSessions } from '../api/sessions';
import type { Session } from '../api/sessions';

export function useSessions() {
  return useQuery<Session[]>({
    queryKey: ['sessions'],
    queryFn: getSessions,
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => revokeSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

export function useRevokeAllSessions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: revokeAllSessions,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}