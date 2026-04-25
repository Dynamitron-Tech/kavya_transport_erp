import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, Truck, WifiOff, Clock } from 'lucide-react';
import { KPICard, StatusBadge } from '@/components/common/Modal';
import { fleetService } from '@/services/dataService';
import type { FleetTrackingVehicle } from '@/types';

// Fix Leaflet marker icons in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const createColorIcon = (color: string) =>
  new L.DivIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

const iconMap: Record<string, L.DivIcon> = {
  moving: createColorIcon('#22c55e'),
  stopped: createColorIcon('#3b82f6'),
  idle: createColorIcon('#f59e0b'),
  offline: createColorIcon('#9ca3af'),
};

function FlyToVehicle({ vehicle }: { vehicle: FleetTrackingVehicle | null }) {
  const map = useMap();
  if (vehicle && vehicle.lat && vehicle.lng) {
    map.flyTo([vehicle.lat, vehicle.lng], 12, { duration: 0.8 });
  }
  return null;
}

export default function FleetTrackingPage() {
  const [selectedVehicle, setSelectedVehicle] = useState<FleetTrackingVehicle | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const { data } = useQuery({
    queryKey: ['fleet-live-tracking'],
    queryFn: fleetService.getLiveTracking,
    refetchInterval: 10000, // refresh every 10s for real-time feel
  });

  const vehicles: FleetTrackingVehicle[] = data?.vehicles || [];
  const summary = data?.summary || { total: 0, moving: 0, stopped: 0, idle: 0, offline: 0 };

  const filteredVehicles = statusFilter
    ? vehicles.filter(v => v.status === statusFilter)
    : vehicles;

  const mapCenter = useMemo<[number, number]>(() => {
    const withCoords = vehicles.filter(v => v.lat && v.lng);
    if (withCoords.length === 0) return [11.0, 78.0]; // Tamil Nadu default
    const avgLat = withCoords.reduce((s, v) => s + v.lat, 0) / withCoords.length;
    const avgLng = withCoords.reduce((s, v) => s + v.lng, 0) / withCoords.length;
    return [avgLat, avgLng];
  }, [vehicles]);

  const statusIcon = (status: string) => {
    switch (status) {
      case 'moving': return <Navigation className="w-4 h-4 text-green-500" />;
      case 'stopped': return <MapPin className="w-4 h-4 text-blue-500" />;
      case 'idle': return <Clock className="w-4 h-4 text-amber-500" />;
      default: return <WifiOff className="w-4 h-4 text-gray-400" />;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'moving': return 'bg-green-500';
      case 'stopped': return 'bg-blue-500';
      case 'idle': return 'bg-amber-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Live Fleet Tracking</h1>
        <p className="page-subtitle">Real-time GPS tracking of all fleet vehicles</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPICard title="Total" value={summary.total} icon={<Truck className="w-5 h-5" />} color="blue" />
        <KPICard title="Moving" value={summary.moving} icon={<Navigation className="w-5 h-5" />} color="green" />
        <KPICard title="Stopped" value={summary.stopped} icon={<MapPin className="w-5 h-5" />} color="purple" />
        <KPICard title="Idle" value={summary.idle} icon={<Clock className="w-5 h-5" />} color="amber" />
        <KPICard title="Offline" value={summary.offline} icon={<WifiOff className="w-5 h-5" />} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vehicle List Panel */}
        <div className="card lg:col-span-1 max-h-[600px] flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <select
              className="input w-full text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Vehicles ({vehicles.length})</option>
              <option value="moving">Moving ({vehicles.filter(v => v.status === 'moving').length})</option>
              <option value="stopped">Stopped ({vehicles.filter(v => v.status === 'stopped').length})</option>
              <option value="idle">Idle ({vehicles.filter(v => v.status === 'idle').length})</option>
              <option value="offline">Offline ({vehicles.filter(v => v.status === 'offline').length})</option>
            </select>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {filteredVehicles.map((v) => (
              <div
                key={v.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedVehicle?.id === v.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => setSelectedVehicle(v)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {statusIcon(v.status)}
                    <span className="font-medium text-sm text-gray-900">{v.registration_number}</span>
                  </div>
                  <span className="text-xs text-gray-500">{v.speed > 0 ? `${v.speed} km/h` : '—'}</span>
                </div>
                {v.driver && (
                  <p className="text-xs text-gray-500 mt-1 ml-6">{v.driver}</p>
                )}
                {v.route && (
                  <p className="text-xs text-blue-600 mt-0.5 ml-6">{v.route}</p>
                )}
              </div>
            ))}
            {filteredVehicles.length === 0 && (
              <p className="text-center text-gray-400 py-8 text-sm">No vehicles match filter</p>
            )}
          </div>
        </div>

        {/* Live Map */}
        <div className="card lg:col-span-2">
          <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: '520px' }}>
            <MapContainer center={mapCenter} zoom={7} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
              <FlyToVehicle vehicle={selectedVehicle} />
              {filteredVehicles.map((v) => {
                if (!v.lat || !v.lng) return null;
                return (
                  <Marker
                    key={v.id}
                    position={[v.lat, v.lng]}
                    icon={iconMap[v.status] || iconMap.offline}
                    eventHandlers={{ click: () => setSelectedVehicle(v) }}
                  >
                    <Popup>
                      <div className="text-sm space-y-1 min-w-[160px]">
                        <p className="font-bold text-gray-900">{v.registration_number}</p>
                        {v.driver && <p className="text-gray-600">🚗 {v.driver}</p>}
                        <p>Speed: {v.speed} km/h</p>
                        {v.route && <p className="text-blue-600">{v.route}</p>}
                        <p className="text-xs text-gray-400 capitalize">{v.status}</p>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>

          {/* Vehicle detail strip below map */}
          {selectedVehicle && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${statusColor(selectedVehicle.status)}`} />
                  <div>
                    <span className="font-semibold text-gray-900">{selectedVehicle.registration_number}</span>
                    <span className="text-sm text-gray-500 ml-2">{selectedVehicle.driver || 'No driver'}</span>
                  </div>
                </div>
                <StatusBadge status={selectedVehicle.status} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                <div><span className="text-gray-500">Speed:</span> <strong>{selectedVehicle.speed} km/h</strong></div>
                <div><span className="text-gray-500">Heading:</span> <strong>{selectedVehicle.heading}°</strong></div>
                <div><span className="text-gray-500">Trip:</span> <strong>{selectedVehicle.trip || '—'}</strong></div>
                <div><span className="text-gray-500">Route:</span> <strong>{selectedVehicle.route || '—'}</strong></div>
                <div><span className="text-gray-500">Coords:</span> <strong>{Number(selectedVehicle.lat).toFixed(4)}, {Number(selectedVehicle.lng).toFixed(4)}</strong></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
