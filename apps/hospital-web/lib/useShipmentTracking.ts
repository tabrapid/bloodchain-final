'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface ShipmentState {
  shipmentId: string;
  status?: string;
  reference?: string;
  courierName?: string;
}

export interface CourierLocationUpdate {
  shipmentId: string;
  courierId: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  recordedAt: string;
}

export interface ShipmentStatusUpdate {
  shipmentId: string;
  status: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Subscribes to realtime shipment status/location updates for a single
 * shipment via the ShipmentGateway websocket - the same pattern
 * useEmergencyTracking.ts already uses for SOS donor tracking. Replaces
 * polling/manual-refresh with a live subscription; the shipment detail
 * page still does its initial REST fetch for everything this socket
 * doesn't carry (units, timeline, addresses).
 */
export function useShipmentTracking(shipmentId: string | null) {
  const [shipmentState, setShipmentState] = useState<ShipmentState | null>(null);
  const [courierLocation, setCourierLocation] = useState<CourierLocationUpdate | null>(null);
  const [statusUpdate, setStatusUpdate] = useState<ShipmentStatusUpdate | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('donor_access_token') : null;
    if (!token || !shipmentId) return;

    const socket = io(`${API_BASE_URL}/shipments`, {
      auth: { token },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join', { shipmentId });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('shipment_state', (payload: ShipmentState) => setShipmentState(payload));
    socket.on('courier_location', (payload: CourierLocationUpdate) => setCourierLocation(payload));
    socket.on('shipment_status_changed', (payload: ShipmentStatusUpdate) => setStatusUpdate(payload));

    return () => {
      socket.emit('leave', { shipmentId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [shipmentId]);

  return { shipmentState, courierLocation, statusUpdate, connected };
}
