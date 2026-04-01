/**
 * useLiveTyreData — React hook for real-time tyre updates via WebSocket
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { tyreWS } from '@/services/tyreWebSocket';
import type { TyreData, TyreAlertItem } from '@/types';

export type ConnectionStatus = 'live' | 'offline' | 'reconnecting';

export function useLiveTyreData(vehicleId: number | null) {
  const [tyreMap, setTyreMap] = useState<Map<string, Partial<TyreData>>>(new Map());
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('offline');
  const [alerts, setAlerts] = useState<TyreAlertItem[]>([]);
  const debounceRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const debouncedUpdate = useCallback((position: string, updater: (prev: Map<string, Partial<TyreData>>) => Map<string, Partial<TyreData>>) => {
    const existing = debounceRef.current.get(position);
    if (existing) clearTimeout(existing);
    debounceRef.current.set(position, setTimeout(() => {
      setTyreMap(updater);
      setLastUpdate(new Date());
      debounceRef.current.delete(position);
    }, 500));
  }, []);

  useEffect(() => {
    if (!vehicleId) return;

    tyreWS.subscribeVehicleTyres(vehicleId);

    const unsubConnection = tyreWS.on('connection', (data: any) => {
      setConnectionStatus(data.status === 'connected' ? 'live' : 'offline');
    });

    const unsubPressure = tyreWS.on('tyre_pressure_update', (data: any) => {
      if (data.vehicle_id !== vehicleId) return;
      debouncedUpdate(data.position, prev => {
        const next = new Map(prev);
        const existing = next.get(data.position) || {};
        next.set(data.position, {
          ...existing,
          psi: data.psi,
          temperature: data.temperature,
          position: data.position,
        });
        return next;
      });
    });

    const unsubAlert = tyreWS.on('tyre_alert', (data: any) => {
      if (data.vehicle_id !== vehicleId) return;
      setTyreMap(prev => {
        const next = new Map(prev);
        const existing = next.get(data.position) || {};
        next.set(data.position, {
          ...existing,
          alert: data.alert_type,
          psi: data.value,
          position: data.position,
        });
        return next;
      });
      setAlerts(prev => [{
        id: Date.now(),
        vehicle_id: data.vehicle_id,
        vehicle_number: '',
        serial_number: '',
        position: data.position,
        psi: data.value,
        temperature: 0,
        alert_type: data.alert_type,
        timestamp: data.timestamp || new Date().toISOString(),
      }, ...prev].slice(0, 50));
      setLastUpdate(new Date());
    });

    const unsubLife = tyreWS.on('tyre_life_update', (data: any) => {
      if (data.vehicle_id !== vehicleId) return;
      debouncedUpdate(data.position, prev => {
        const next = new Map(prev);
        const existing = next.get(data.position) || {};
        next.set(data.position, {
          ...existing,
          life_percent: data.life_percent,
          km_run: data.km_run,
          position: data.position,
        });
        return next;
      });
    });

    setConnectionStatus(tyreWS.connected ? 'live' : 'offline');

    return () => {
      unsubConnection();
      unsubPressure();
      unsubAlert();
      unsubLife();
      tyreWS.unsubscribeVehicleTyres(vehicleId);
      debounceRef.current.forEach(t => clearTimeout(t));
      debounceRef.current.clear();
    };
  }, [vehicleId, debouncedUpdate]);

  return { tyreMap, lastUpdate, connectionStatus, alerts };
}

/**
 * useGlobalTyreAlerts — Subscribe to all tyre alerts (for dashboard)
 */
export function useGlobalTyreAlerts() {
  const [alerts, setAlerts] = useState<TyreAlertItem[]>([]);

  useEffect(() => {
    tyreWS.subscribeAlerts();

    const unsub = tyreWS.on('tyre_alert', (data: any) => {
      setAlerts(prev => [{
        id: Date.now(),
        vehicle_id: data.vehicle_id,
        vehicle_number: data.vehicle_number || '',
        serial_number: '',
        position: data.position,
        psi: data.value || 0,
        temperature: 0,
        alert_type: data.alert_type,
        timestamp: data.timestamp || new Date().toISOString(),
      }, ...prev].slice(0, 100));
    });

    return () => { unsub(); };
  }, []);

  return alerts;
}
