// ============================================================
// PA Fleet Status Widget — Vehicle-centric monitoring
// Shows: Available, On Trip, Maintenance, Inactive counts
// With clickable donut + vehicle mini-list
// ============================================================

import { Truck, MapPin, Wrench, Ban, ChevronRight, Loader2 } from 'lucide-react';

interface FleetVehicle {
  id: number;
  registration_number: string;
  status: string;
  driver_name?: string;
  trip_number?: string;
  current_location?: string;
  last_updated?: string;
}

interface FleetData {
  available: number;
  on_trip: number;
  maintenance: number;
  inactive: number;
  total: number;
  recent_vehicles: FleetVehicle[];
}

interface Props {
  data: FleetData | undefined;
  isLoading: boolean;
  navigate: (path: string) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  available:   { label: 'Available',   color: '#10b981', bg: 'bg-emerald-50 text-emerald-700', icon: <Truck size={14} /> },
  on_trip:     { label: 'On Trip',     color: '#2563eb', bg: 'bg-blue-50 text-blue-700',       icon: <MapPin size={14} /> },
  maintenance: { label: 'Maintenance', color: '#f59e0b', bg: 'bg-amber-50 text-amber-700',     icon: <Wrench size={14} /> },
  inactive:    { label: 'Inactive',    color: '#94a3b8', bg: 'bg-gray-100 text-gray-600',      icon: <Ban size={14} /> },
};

export default function PAFleetStatus({ data, isLoading, navigate }: Props) {
  const fleet = data || { available: 0, on_trip: 0, maintenance: 0, inactive: 0, total: 0, recent_vehicles: [] };
  const vehicles = (fleet as any)?.recent_vehicles;
  const drivers = (fleet as any)?.drivers;
  const safeVehicles = Array.isArray(vehicles) ? vehicles : [];
  const safeDrivers = Array.isArray(drivers) ? drivers : [];
  const segments = [
    { key: 'available',   value: fleet.available },
    { key: 'on_trip',     value: fleet.on_trip },
    { key: 'maintenance', value: fleet.maintenance },
    { key: 'inactive',    value: fleet.inactive },
  ];

  const total = fleet.total || segments.reduce((a, b) => a + b.value, 0) || 1;

  // SVG donut
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let cumulativePercent = 0;

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Fleet Status</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">{fleet.total} total vehicles</p>
        </div>
        <button
          onClick={() => navigate('/vehicles')}
          className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
        >
          View all <ChevronRight size={12} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={24} className="animate-spin text-gray-300" />
        </div>
      ) : (safeVehicles ?? []).length === 0 && (safeDrivers ?? []).length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <p className="text-sm">No fleet data available</p>
        </div>
      ) : (
        <>
          {/* Donut + Legend */}
          <div className="flex items-center gap-6">
            {/* SVG Donut */}
            <div className="relative flex-shrink-0">
              <svg width="130" height="130" viewBox="0 0 130 130">
                {segments.map((seg) => {
                  const percent = seg.value / total;
                  const strokeDasharray = `${circumference * percent} ${circumference * (1 - percent)}`;
                  const strokeDashoffset = -circumference * cumulativePercent;
                  cumulativePercent += percent;
                  const cfg = STATUS_CONFIG[seg.key];
                  return (
                    <circle
                      key={seg.key}
                      cx="65" cy="65" r={radius}
                      fill="none" stroke={cfg.color} strokeWidth="14"
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      transform="rotate(-90 65 65)"
                      className="transition-all duration-700"
                    />
                  );
                })}
                {/* Center text */}
                <text x="65" y="60" textAnchor="middle" className="fill-gray-900 text-2xl font-bold" fontSize="26">{fleet.total}</text>
                <text x="65" y="78" textAnchor="middle" className="fill-gray-400 text-[10px]" fontSize="10">Vehicles</text>
              </svg>
            </div>

            {/* Legend */}
            <div className="flex-1 space-y-2.5">
              {segments.map((seg) => {
                const cfg = STATUS_CONFIG[seg.key];
                return (
                  <button
                    key={seg.key}
                    onClick={() => navigate(`/vehicles?status=${seg.key}`)}
                    className="flex items-center gap-2.5 w-full text-left group"
                  >
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
                    <span className="text-xs text-gray-600 group-hover:text-gray-900 transition-colors flex-1">{cfg.label}</span>
                    <span className="text-sm font-bold text-gray-800">{seg.value}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recent vehicles mini-list */}
          {(safeVehicles ?? []).length > 0 && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Recent Activity</p>
              <div className="space-y-1.5">
                {(safeVehicles ?? []).slice(0, 4).map((v) => {
                  const cfg = STATUS_CONFIG[v.status] || STATUS_CONFIG.inactive;
                  return (
                    <div
                      key={v.id}
                      onClick={() => navigate(`/vehicles/${v.id}`)}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Truck size={13} className="text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{v.registration_number}</p>
                        <p className="text-[10px] text-gray-400 truncate">
                          {v.driver_name || v.current_location || 'No driver assigned'}
                        </p>
                      </div>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.bg}`}>
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
