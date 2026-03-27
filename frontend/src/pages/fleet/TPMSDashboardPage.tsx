import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CircleDot, AlertTriangle, Truck, Thermometer,
  Gauge, Search, ChevronRight, Activity, Shield,
} from 'lucide-react';
import { KPICard, LoadingSpinner, TabPills } from '@/components/common/Modal';
import { tpmsService, vehicleService } from '@/services/dataService';
import type { TPMSVehicleDashboard, TPMSFleetHealth, TPMSAlert, TPMSWheel, TPMSReading } from '@/types';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

export default function TPMSDashboardPage() {
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [selectedTyreId, setSelectedTyreId] = useState<number | null>(null);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [tab, setTab] = useState<'overview' | 'vehicle' | 'alerts'>('overview');

  // Fleet health
  const { data: fleetHealth, isLoading: loadingFleet } = useQuery<TPMSFleetHealth>({
    queryKey: ['tpms-fleet-health'],
    queryFn: tpmsService.getFleetHealth,
  });

  // Alerts
  const { data: alerts } = useQuery<TPMSAlert[]>({
    queryKey: ['tpms-alerts'],
    queryFn: () => tpmsService.getAlerts({ hours: 48, limit: 50 }),
  });

  // Vehicle list for selector
  const { data: vehiclesData } = useQuery({
    queryKey: ['vehicles-list'],
    queryFn: () => vehicleService.list({ limit: 200 }),
  });

  // Vehicle TPMS dashboard
  const { data: vehicleDash } = useQuery<TPMSVehicleDashboard>({
    queryKey: ['tpms-vehicle', selectedVehicleId],
    queryFn: () => tpmsService.getVehicleDashboard(selectedVehicleId!),
    enabled: !!selectedVehicleId,
  });

  // Tyre reading history
  const { data: readingHistory } = useQuery<TPMSReading[]>({
    queryKey: ['tpms-history', selectedTyreId],
    queryFn: () => tpmsService.getReadingHistory(selectedTyreId!, { hours: 168 }),
    enabled: !!selectedTyreId,
  });

  const vehicles = Array.isArray(vehiclesData)
    ? vehiclesData
    : (vehiclesData as any)?.items || [];
  const filteredVehicles = vehicles.filter((v: any) =>
    v.registration_number?.toLowerCase().includes(vehicleSearch.toLowerCase())
  );
  const alertList = Array.isArray(alerts) ? alerts : [];

  if (loadingFleet) {
    return <div className="flex justify-center py-20"><LoadingSpinner /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">TPMS Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Tyre Pressure Monitoring System — Real-time sensor data</p>
        </div>
        <TabPills
          tabs={[
            { key: 'overview', label: 'Fleet Overview' },
            { key: 'vehicle', label: 'Vehicle View' },
            { key: 'alerts', label: `Alerts (${alertList.length})` },
          ]}
          activeTab={tab}
          onChange={(key: string) => setTab(key as 'overview' | 'vehicle' | 'alerts')}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard title="Total Tyres" value={fleetHealth?.total_tyres ?? 0} icon={<CircleDot className="w-5 h-5" />} color="bg-blue-100 text-blue-600" />
        <KPICard title="OK" value={fleetHealth?.ok ?? 0} icon={<Shield className="w-5 h-5" />} color="bg-green-100 text-green-600" />
        <KPICard title="Warning" value={fleetHealth?.warning ?? 0} icon={<AlertTriangle className="w-5 h-5" />} color="bg-yellow-100 text-yellow-600" />
        <KPICard title="Critical" value={fleetHealth?.critical ?? 0} icon={<AlertTriangle className="w-5 h-5" />} color="bg-red-100 text-red-600" />
        <KPICard title="No Sensor" value={fleetHealth?.no_sensor ?? 0} icon={<CircleDot className="w-5 h-5" />} color="bg-gray-100 text-gray-500" />
      </div>

      {/* Tab Content */}
      {tab === 'overview' && <FleetOverviewTab fleetHealth={fleetHealth} alertList={alertList} />}
      {tab === 'vehicle' && (
        <VehicleViewTab
          vehicles={filteredVehicles}
          vehicleSearch={vehicleSearch}
          setVehicleSearch={setVehicleSearch}
          selectedVehicleId={selectedVehicleId}
          setSelectedVehicleId={(id: number) => { setSelectedVehicleId(id); setSelectedTyreId(null); }}
          vehicleDash={vehicleDash}
          selectedTyreId={selectedTyreId}
          setSelectedTyreId={setSelectedTyreId}
          readingHistory={readingHistory}
        />
      )}
      {tab === 'alerts' && <AlertsTab alertList={alertList} />}
    </div>
  );
}

/* ── Fleet Overview ────────────────────────────────── */

function FleetOverviewTab({
  fleetHealth,
  alertList,
}: {
  fleetHealth?: TPMSFleetHealth;
  alertList: TPMSAlert[];
}) {
  const total = fleetHealth?.total_tyres ?? 1;
  const segments = [
    { label: 'OK', count: fleetHealth?.ok ?? 0, color: 'bg-green-500', textColor: 'text-green-700' },
    { label: 'Warning', count: fleetHealth?.warning ?? 0, color: 'bg-yellow-500', textColor: 'text-yellow-700' },
    { label: 'Critical', count: fleetHealth?.critical ?? 0, color: 'bg-red-500', textColor: 'text-red-700' },
    { label: 'No Sensor', count: fleetHealth?.no_sensor ?? 0, color: 'bg-gray-400', textColor: 'text-gray-600' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Health Distribution */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Tyre Health Distribution</h3>
        <div className="flex h-6 rounded-full overflow-hidden mb-4">
          {segments.map(s => (
            s.count > 0 && (
              <div
                key={s.label}
                className={`${s.color} transition-all`}
                style={{ width: `${(s.count / total) * 100}%` }}
              />
            )
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {segments.map(s => (
            <div key={s.label} className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${s.color}`} />
              <span className="text-sm text-gray-600">{s.label}</span>
              <span className={`ml-auto text-sm font-semibold ${s.textColor}`}>{s.count}</span>
              <span className="text-xs text-gray-400">({total > 0 ? Math.round((s.count / total) * 100) : 0}%)</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Recent Alerts</h3>
          <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-bold">{alertList.length}</span>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {alertList.slice(0, 8).map((a, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                a.alert_type?.includes('critical') ? 'bg-red-50 text-red-500' : 'bg-yellow-50 text-yellow-500'
              }`}>
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{a.registration_number} — {a.position}</p>
                <p className="text-xs text-gray-500">{a.alert_type?.replace(/_/g, ' ')} • {a.psi} PSI</p>
              </div>
              <span className="text-[11px] text-gray-400 whitespace-nowrap">
                {new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
          {alertList.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-6">No alerts in last 48 hours</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Vehicle View ──────────────────────────────────── */

function VehicleViewTab({
  vehicles,
  vehicleSearch,
  setVehicleSearch,
  selectedVehicleId,
  setSelectedVehicleId,
  vehicleDash,
  selectedTyreId,
  setSelectedTyreId,
  readingHistory,
}: {
  vehicles: any[];
  vehicleSearch: string;
  setVehicleSearch: (s: string) => void;
  selectedVehicleId: number | null;
  setSelectedVehicleId: (id: number) => void;
  vehicleDash?: TPMSVehicleDashboard;
  selectedTyreId: number | null;
  setSelectedTyreId: (id: number | null) => void;
  readingHistory?: TPMSReading[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Vehicle Selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            placeholder="Search vehicles..."
            value={vehicleSearch}
            onChange={e => setVehicleSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {vehicles.slice(0, 30).map((v: any) => (
            <button
              key={v.id}
              onClick={() => setSelectedVehicleId(v.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition flex items-center gap-2 ${
                selectedVehicleId === v.id ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              <Truck className="w-4 h-4 flex-shrink-0" />
              {v.registration_number}
              <ChevronRight className="w-3 h-3 ml-auto text-gray-300" />
            </button>
          ))}
          {vehicles.length === 0 && <p className="text-center text-sm text-gray-400 py-4">No vehicles found</p>}
        </div>
      </div>

      {/* Wheel Diagram */}
      <div className="lg:col-span-2 space-y-4">
        {vehicleDash ? (
          <>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Truck className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">{vehicleDash.registration_number}</h3>
                <span className="text-xs text-gray-400">{vehicleDash.wheels.length} tyres with sensors</span>
              </div>
              <WheelDiagram
                wheels={vehicleDash.wheels}
                selectedTyreId={selectedTyreId}
                onSelect={setSelectedTyreId}
              />
            </div>

            {/* Reading History Chart */}
            {selectedTyreId && readingHistory && readingHistory.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Pressure History — {vehicleDash.wheels.find(w => w.tyre_id === selectedTyreId)?.position}
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={readingHistory.map(r => ({
                    ...r,
                    time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                    <Tooltip />
                    <Line type="monotone" dataKey="psi" name="PSI" stroke="#2563eb" strokeWidth={2} dot={false} />
                    {readingHistory.some(r => r.temperature_c !== null) && (
                      <Line type="monotone" dataKey="temperature_c" name="Temp °C" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <CircleDot className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Select a vehicle to view TPMS data</p>
            <p className="text-sm text-gray-400 mt-1">Choose from the list on the left</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Wheel Diagram ─────────────────────────────── */

function WheelDiagram({
  wheels,
  selectedTyreId,
  onSelect,
}: {
  wheels: TPMSWheel[];
  selectedTyreId: number | null;
  onSelect: (id: number | null) => void;
}) {
  const allPositions = wheels.sort((a, b) => a.position.localeCompare(b.position));

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {allPositions.map(w => {
        const colorMap = {
          ok: 'border-green-300 bg-green-50',
          warning: 'border-yellow-300 bg-yellow-50',
          critical: 'border-red-300 bg-red-50',
        };
        const textMap = {
          ok: 'text-green-700',
          warning: 'text-yellow-700',
          critical: 'text-red-700',
        };
        const isSelected = selectedTyreId === w.tyre_id;
        return (
          <button
            key={w.tyre_id}
            onClick={() => onSelect(isSelected ? null : w.tyre_id)}
            className={`p-3 rounded-xl border-2 text-left transition ${colorMap[w.status]} ${isSelected ? 'ring-2 ring-blue-500 shadow-md' : 'hover:shadow-sm'}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-gray-900">{w.position}</span>
              <div className={`w-2.5 h-2.5 rounded-full ${w.status === 'ok' ? 'bg-green-500' : w.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'}`} />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-1">
                <Gauge className="w-3 h-3 text-gray-400" />
                <span className={`text-sm font-bold ${textMap[w.status]}`}>
                  {w.psi !== null ? `${w.psi} PSI` : '—'}
                </span>
              </div>
              {w.temperature_c !== null && (
                <div className="flex items-center gap-1">
                  <Thermometer className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-600">{w.temperature_c}°C</span>
                </div>
              )}
              {w.tread_depth_mm !== null && (
                <div className="flex items-center gap-1">
                  <Activity className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-600">{w.tread_depth_mm}mm tread</span>
                </div>
              )}
            </div>
            {w.brand && <p className="text-[10px] text-gray-400 mt-1 truncate">{w.brand} {w.size}</p>}
          </button>
        );
      })}
      {wheels.length === 0 && (
        <div className="col-span-full text-center py-8 text-sm text-gray-400">
          No tyres with TPMS sensors found for this vehicle
        </div>
      )}
    </div>
  );
}

/* ── Alerts Tab ────────────────────────────────── */

function AlertsTab({ alertList }: { alertList: TPMSAlert[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">TPMS Alerts — Last 48 Hours</h3>
      </div>
      <div className="divide-y divide-gray-50">
        {alertList.map((a, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              a.alert_type?.includes('critical') ? 'bg-red-50 text-red-500' :
              a.alert_type?.includes('temp') ? 'bg-orange-50 text-orange-500' :
              'bg-yellow-50 text-yellow-500'
            }`}>
              {a.alert_type?.includes('temp') ? <Thermometer className="w-5 h-5" /> : <Gauge className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{a.registration_number} — Position {a.position}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {a.alert_type?.replace(/_/g, ' ')} • PSI: {a.psi}
                {a.temperature_c != null && ` • Temp: ${a.temperature_c}°C`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">{new Date(a.timestamp).toLocaleDateString()}</p>
              <p className="text-xs text-gray-400">{new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              a.alert_type?.includes('critical') ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
            }`}>
              {a.alert_type?.includes('critical') ? 'Critical' : 'Warning'}
            </span>
          </div>
        ))}
        {alertList.length === 0 && (
          <div className="text-center py-12 text-sm text-gray-400">
            <Shield className="w-10 h-10 mx-auto text-green-300 mb-2" />
            No alerts in last 48 hours — all tyres healthy
          </div>
        )}
      </div>
    </div>
  );
}
