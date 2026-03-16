import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { gpsTrackingService } from '@/services/dataService';
import { safeArray } from '@/utils/helpers';
import { useState } from 'react';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function GPSLiveMapPage() {
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [pathHours, setPathHours] = useState(24);

  const { data: positionsData } = useQuery({
    queryKey: ['gps-positions'],
    queryFn: () => gpsTrackingService.getLivePositions(),
    refetchInterval: 15000,
    throwOnError: false,
  });

  const { data: pathData } = useQuery({
    queryKey: ['gps-path', selectedVehicle, pathHours],
    queryFn: () => gpsTrackingService.getVehiclePath(selectedVehicle!, pathHours),
    enabled: !!selectedVehicle,
    throwOnError: false,
  });

  const vehicles = safeArray<any>(positionsData?.vehicles ?? positionsData);
  const pathPoints: [number, number][] = safeArray<any>(pathData?.path ?? []).map((p: any) => [p.lat, p.lng]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">GPS Live Map</h1>
          <p className="text-gray-500 text-sm mt-1">Real-time GPS positions — refreshes every 15 seconds</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{vehicles.length} vehicles</span>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Map */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <MapContainer center={[11.0168, 76.9558]} zoom={8} style={{ height: '600px', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
            {vehicles.map((v: any) => {
              const lat = Number(v.lat ?? v.latitude);
              const lng = Number(v.lng ?? v.longitude);
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
              return (
                <Marker key={v.vehicle_id} position={[lat, lng]} eventHandlers={{ click: () => setSelectedVehicle(v.vehicle_id) }}>
                  <Popup>
                    <div className="text-sm space-y-1">
                      <p className="font-bold">{v.reg_number || v.vehicle_id}</p>
                      <p>Speed: {v.speed || 0} km/h</p>
                      <p>Ignition: {v.ignition ? '🟢' : '🔴'}</p>
                      <p className="text-xs text-gray-400">{v.timestamp ? new Date(v.timestamp).toLocaleString() : '-'}</p>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
            {pathPoints.length > 1 && (
              <Polyline positions={pathPoints} color="blue" weight={3} opacity={0.7} />
            )}
          </MapContainer>
        </div>

        {/* Sidebar */}
        <div className="w-72 bg-white rounded-xl border border-gray-200 p-4 h-[600px] overflow-y-auto">
          <h3 className="font-semibold mb-3">Vehicles</h3>
          {selectedVehicle && (
            <div className="mb-3 flex items-center gap-2">
              <label className="text-xs text-gray-500">Path:</label>
              <select
                value={pathHours}
                onChange={(e) => setPathHours(Number(e.target.value))}
                className="text-xs border rounded px-2 py-1"
              >
                <option value={6}>6h</option>
                <option value={12}>12h</option>
                <option value={24}>24h</option>
                <option value={48}>48h</option>
              </select>
              <button onClick={() => setSelectedVehicle(null)} className="text-xs text-gray-400 hover:text-red-500 ml-auto">Clear</button>
            </div>
          )}
          <div className="space-y-2">
            {vehicles.map((v: any) => (
              <div
                key={v.vehicle_id}
                onClick={() => setSelectedVehicle(v.vehicle_id)}
                className={`p-3 rounded-lg cursor-pointer border transition-colors ${selectedVehicle === v.vehicle_id ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:bg-gray-50'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{v.reg_number || v.vehicle_id}</span>
                  <span className={`w-2 h-2 rounded-full ${(v.speed || 0) > 0 ? 'bg-green-500' : 'bg-red-400'}`} />
                </div>
                <p className="text-xs text-gray-500 mt-1">{v.speed || 0} km/h • {v.ignition ? 'ON' : 'OFF'}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
