import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { gpsTrackingService } from '@/services/dataService';
import { safeArray } from '@/utils/helpers';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function TripReplayPage() {
  const [vehicleId, setVehicleId] = useState('');
  const [hours, setHours] = useState(24);
  const [searched, setSearched] = useState({ id: '', hours: 24 });

  const { data: pathData, isLoading } = useQuery({
    queryKey: ['trip-replay', searched.id, searched.hours],
    queryFn: () => gpsTrackingService.getVehiclePath(searched.id, searched.hours),
    enabled: !!searched.id,
    throwOnError: false,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (vehicleId.trim()) setSearched({ id: vehicleId.trim(), hours });
  };

  const pathPoints: [number, number][] = safeArray<any>(pathData?.points ?? pathData?.path ?? []).map((p: any) => [p.lat, p.lng]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Trip Replay</h1>
        <p className="text-gray-500 text-sm mt-1">View historical vehicle path on map</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3 flex-wrap">
        <input
          type="text"
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
          placeholder="Vehicle ID (e.g., VH001)"
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <select
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          className="px-4 py-2 border border-gray-300 rounded-lg"
        >
          <option value={6}>Last 6 hours</option>
          <option value={12}>Last 12 hours</option>
          <option value={24}>Last 24 hours</option>
          <option value={48}>Last 48 hours</option>
          <option value={72}>Last 3 days</option>
          <option value={168}>Last 7 days</option>
        </select>
        <button type="submit" disabled={isLoading} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {isLoading ? 'Loading...' : 'Show Path'}
        </button>
      </form>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <MapContainer center={[11.0168, 76.9558]} zoom={8} style={{ height: '550px', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
          {pathPoints.length > 1 && (
            <>
              <Polyline positions={pathPoints} color="blue" weight={3} opacity={0.7} />
              <Marker position={pathPoints[0]}>
                <Popup>Start Point</Popup>
              </Marker>
              <Marker position={pathPoints[pathPoints.length - 1]}>
                <Popup>End Point</Popup>
              </Marker>
            </>
          )}
        </MapContainer>
      </div>

      {pathData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-gray-500 text-sm">Vehicle</p>
            <p className="text-lg font-semibold">{pathData.vehicle_id}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-gray-500 text-sm">Points</p>
            <p className="text-lg font-semibold">{pathData.count || pathPoints.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-gray-500 text-sm">Time Window</p>
            <p className="text-lg font-semibold">{searched.hours}h</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-gray-500 text-sm">Status</p>
            <p className="text-lg font-semibold text-green-600">Loaded</p>
          </div>
        </div>
      )}
    </div>
  );
}
