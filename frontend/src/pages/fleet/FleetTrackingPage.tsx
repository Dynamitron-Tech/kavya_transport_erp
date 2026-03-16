import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Navigation, Truck, WifiOff, Clock } from 'lucide-react';
import { KPICard, StatusBadge } from '@/components/common/Modal';
import { fleetService } from '@/services/dataService';
import type { FleetTrackingVehicle } from '@/types';

export default function FleetTrackingPage() {
  const [selectedVehicle, setSelectedVehicle] = useState<FleetTrackingVehicle | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const { data } = useQuery({
    queryKey: ['fleet-live-tracking'],
    queryFn: fleetService.getLiveTracking,
    refetchInterval: 30000, // refresh every 30s
  });

  const vehicles: FleetTrackingVehicle[] = data?.vehicles || [];
  const summary = data?.summary || { total: 0, moving: 0, stopped: 0, idle: 0, offline: 0 };

  const filteredVehicles = statusFilter
    ? vehicles.filter(v => v.status === statusFilter)
    : vehicles;

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

        {/* Map Placeholder / Vehicle Details */}
        <div className="card lg:col-span-2">
          {selectedVehicle ? (
            <div className="space-y-6">
              {/* Vehicle Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${statusColor(selectedVehicle.status)}`} />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{selectedVehicle.registration_number}</h3>
                    <p className="text-sm text-gray-500">{selectedVehicle.driver || 'No driver assigned'}</p>
                  </div>
                </div>
                <StatusBadge status={selectedVehicle.status} />
              </div>

              {/* Map Placeholder */}
              <div className="bg-gray-100 rounded-xl h-64 flex items-center justify-center border-2 border-dashed border-gray-300">
                <div className="text-center">
                  <MapPin className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 font-medium">Live Map View</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Lat: {Number(selectedVehicle.lat ?? 0).toFixed(4)}, Lng: {Number(selectedVehicle.lng ?? 0).toFixed(4)}
                  </p>
                  <p className="text-xs text-gray-400">(Map integration available with Google Maps / Leaflet)</p>
                </div>
              </div>

              {/* Vehicle Details Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Speed</p>
                  <p className="text-lg font-semibold">{selectedVehicle.speed} km/h</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Heading</p>
                  <p className="text-lg font-semibold">{selectedVehicle.heading}°</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Trip</p>
                  <p className="text-lg font-semibold">{selectedVehicle.trip || '—'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">ETA</p>
                  <p className="text-lg font-semibold">
                    {selectedVehicle.eta ? new Date(selectedVehicle.eta).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </p>
                </div>
              </div>

              {selectedVehicle.route && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600 font-medium">Route</p>
                  <p className="text-sm text-blue-800">{selectedVehicle.route}</p>
                </div>
              )}

              <div className="text-xs text-gray-400 text-right">
                Last updated: {new DateNumber((selectedVehicle.last_update) ?? 0).toLocaleString('en-IN')}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Select a vehicle to view live tracking details</p>
                <p className="text-xs text-gray-400 mt-1">Click on any vehicle from the list</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
