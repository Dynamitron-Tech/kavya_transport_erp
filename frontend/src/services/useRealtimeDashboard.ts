// useRealtimeDashboard — hook that merges REST data with live WebSocket updates
import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { wsService } from '@/services/websocketService';

/**
 * Subscribes to live WS events and auto-invalidates dashboard/tracking queries.
 * Drop into any page that displays real-time KPIs or tracking data.
 */
export function useRealtimeDashboard() {
  const qc = useQueryClient();
  const unsubscribers = useRef<Array<() => void>>([]);

  const invalidate = useCallback(
    (keys: string[]) => {
      keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
    [qc],
  );

  useEffect(() => {
    unsubscribers.current.push(
      wsService.subscribe('dashboard_update', () => {
        invalidate(['dashboard-overview', 'dashboard-pipeline']);
      }),
      wsService.subscribe('vehicle_tracking', () => {
        invalidate(['fleet-tracking', 'gps-live']);
      }),
      wsService.subscribe('trip_update', () => {
        invalidate(['trips', 'dashboard-overview']);
      }),
      wsService.subscribe('alert', () => {
        invalidate(['alerts', 'fleet-alerts']);
      }),
    );

    return () => {
      unsubscribers.current.forEach((fn) => fn());
      unsubscribers.current = [];
    };
  }, [invalidate]);
}

/**
 * Hook to subscribe to a single vehicle's live tracking and auto-refresh queries.
 */
export function useRealtimeVehicle(vehicleId: number | null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!vehicleId) return;
    wsService.subscribeVehicle(vehicleId);
    const unsub = wsService.subscribe('vehicle_tracking', (msg) => {
      if (msg.vehicle_id === vehicleId) {
        qc.invalidateQueries({ queryKey: ['vehicle', vehicleId] });
      }
    });
    return () => {
      wsService.unsubscribeVehicle(vehicleId);
      unsub();
    };
  }, [vehicleId, qc]);
}

/**
 * Hook to subscribe to a single trip's live updates and auto-refresh queries.
 */
export function useRealtimeTrip(tripId: number | null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!tripId) return;
    wsService.subscribeTrip(tripId);
    const unsub = wsService.subscribe('trip_update', (msg) => {
      if (msg.trip_id === tripId) {
        qc.invalidateQueries({ queryKey: ['trip', tripId] });
      }
    });
    return () => {
      wsService.unsubscribeTrip(tripId);
      unsub();
    };
  }, [tripId, qc]);
}
