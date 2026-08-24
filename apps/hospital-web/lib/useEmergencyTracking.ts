'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface DonorLocationUpdate {
  emergencyRequestId: string;
  responseId: string;
  donorId: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  recordedAt: string;
}

export interface ResponseStatusUpdate {
  emergencyRequestId: string;
  responseId: string;
  donorId: string;
  status: string;
  timestamp: string;
}

/**
 * Subscribes to realtime donor location/status updates for the given
 * emergency request IDs via the EmergencyGateway websocket. Returns the
 * latest known location per emergency request.
 */
export function useEmergencyTracking(emergencyRequestIds: string[]) {
  const [locations, setLocations] = useState<Record<string, DonorLocationUpdate>>({});
  const [statusUpdates, setStatusUpdates] = useState<Record<string, ResponseStatusUpdate>>({});
  const socketRef = useRef<Socket | null>(null);
  const joinedRooms = useRef<Set<string>>(new Set());

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('donor_access_token') : null;
    if (!token || emergencyRequestIds.length === 0) return;

    if (!socketRef.current) {
      socketRef.current = io(`${API_BASE_URL}/emergency`, {
        auth: { token },
        transports: ['websocket'],
      });

      socketRef.current.on('donor_location', (payload: DonorLocationUpdate) => {
        setLocations((prev) => ({ ...prev, [payload.emergencyRequestId]: payload }));
      });

      socketRef.current.on('response_status_changed', (payload: ResponseStatusUpdate) => {
        setStatusUpdates((prev) => ({ ...prev, [payload.emergencyRequestId]: payload }));
      });
    }

    const socket = socketRef.current;
    for (const id of emergencyRequestIds) {
      if (!joinedRooms.current.has(id)) {
        socket.emit('join', { emergencyRequestId: id });
        joinedRooms.current.add(id);
      }
    }

    return () => {
      for (const id of emergencyRequestIds) {
        socket.emit('leave', { emergencyRequestId: id });
        joinedRooms.current.delete(id);
      }
    };
  }, [emergencyRequestIds.join(',')]);

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  return { locations, statusUpdates };
}
