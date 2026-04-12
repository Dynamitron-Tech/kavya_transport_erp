/**
 * TyreTrackerPage — Full tyre management with 5 sub-screens
 *  [Tyre Tracker] [Vehicles] [Retreading] [In Stock] [Buy Tyres]
 */
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  CircleDot, Truck, AlertTriangle, Search, ChevronRight,
  Package, ShoppingCart, RotateCw,
  RefreshCw, X,
  Activity, MapPin, PlayCircle, Settings,
} from 'lucide-react';
import SimulationPanel from '@/components/tyres/SimulationPanel';
import InspectionCoverageGrid from '@/components/tyres/InspectionCoverageGrid';
import DriverComplianceTable from '@/components/tyres/DriverComplianceTable';
import ReplacementForecastTable from '@/components/tyres/ReplacementForecastTable';
import TyreAlertFeed from '@/components/tyres/TyreAlertFeed';
import { LoadingSpinner } from '@/components/common/Modal';
import { tyreTrackerService, tpmsService, vehicleService } from '@/services/dataService';
import VehicleTyreDiagram, { tyreLifeColor, getPSIStatus, layoutForVehicleType, mapDbPositions, type VehicleLayout } from '@/components/fleet/VehicleTyreDiagram';
import { useLiveTyreData, useGlobalTyreAlerts, type ConnectionStatus } from '@/hooks/useLiveTyreData';
import { tyreWS } from '@/services/tyreWebSocket';
import type {
  TyreLifeSummary, TyreAlertItem, TyreStockItem, TyreRetreadItem,
  TyreCatalogueItem, TyreCompareItem, TPMSReading,
} from '@/types';

const TYRE_TAB_KEYS = ['tracker', 'vehicles', 'retreading', 'stock', 'buy', 'simulate', 'settings'] as const;
type TyreTab = typeof TYRE_TAB_KEYS[number];

export default function TyreTrackerPage() {
  const [activeTab, setActiveTab] = useState<TyreTab>('tracker');

  // Connect WS on mount (use token from localStorage)
  useEffect(() => {
    const token = localStorage.getItem('access_token') || localStorage.getItem('token') || '';
    if (token) tyreWS.connect(token);
    return () => { /* keep connection alive across tab switches */ };
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tyre Management</h1>
          <p className="text-sm text-gray-500">Complete tyre lifecycle, TPMS monitoring &amp; stock management</p>
        </div>
      </div>

      {/* Top tab pills */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
        {([
          { key: 'tracker', label: 'Tyre Tracker', icon: <Activity className="w-4 h-4" /> },
          { key: 'vehicles', label: 'Vehicles', icon: <Truck className="w-4 h-4" /> },
          { key: 'retreading', label: 'Retreading', icon: <RotateCw className="w-4 h-4" /> },
          { key: 'stock', label: 'In Stock', icon: <Package className="w-4 h-4" /> },
          { key: 'buy', label: 'Buy Tyres', icon: <ShoppingCart className="w-4 h-4" /> },
          { key: 'simulate', label: 'Simulate', icon: <PlayCircle className="w-4 h-4" /> },
          { key: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
        ] as { key: TyreTab; label: string; icon: React.ReactNode }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              activeTab === t.key
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'tracker' && <TyreTrackerTab />}
      {activeTab === 'vehicles' && <VehiclesTab />}
      {activeTab === 'retreading' && <RetreadingTab />}
      {activeTab === 'stock' && <InStockTab />}
      {activeTab === 'buy' && <BuyTyresTab />}
      {activeTab === 'simulate' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Wear Simulation</h2>
            <p className="text-sm text-gray-500">Simulate tyre wear across distance, load, road and climate conditions.</p>
          </div>
          <SimulationPanel />
        </div>
      )}
      {activeTab === 'settings' && <TyreSettingsTab />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SCREEN 1 — TYRE TRACKER (Real-Time Dashboard)
   ═══════════════════════════════════════════════════════════ */

function TyreTrackerTab() {
  const { data: lifeSummary, isLoading } = useQuery<TyreLifeSummary>({
    queryKey: ['tyre-life-summary'],
    queryFn: tyreTrackerService.getLifeSummary,
    refetchInterval: 30000,
  });

  const { data: inspectionData } = useQuery({
    queryKey: ['tyre-inspection-needed'],
    queryFn: tyreTrackerService.getInspectionNeeded,
  });

  const { data: alertsData } = useQuery<TyreAlertItem[]>({
    queryKey: ['tyre-alerts'],
    queryFn: () => tyreTrackerService.getAlerts('active'),
    refetchInterval: 30000,
  });

  const { data: compareData } = useQuery<TyreCompareItem[]>({
    queryKey: ['tyre-compare'],
    queryFn: tyreTrackerService.getCompare,
  });

  const globalAlerts = useGlobalTyreAlerts();
  const allAlerts = useMemo(() => {
    const api = Array.isArray(alertsData) ? alertsData : [];
    return [...globalAlerts, ...api].slice(0, 20);
  }, [alertsData, globalAlerts]);

  const status = lifeSummary?.status_counts;
  const inspection = (inspectionData as any) || { count: 0 };

  if (isLoading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;

  const buckets = lifeSummary?.buckets || {};
  const bucketConfig = [
    { key: '90-100', label: '90 - 100%', color: '#4CAF50' },
    { key: '70-90', label: '70 - 90%', color: '#8BC34A' },
    { key: '50-70', label: '50 - 70%', color: '#CDDC39' },
    { key: '30-50', label: '30 - 50%', color: '#FFC107' },
    { key: '10-30', label: '10 - 30%', color: '#FF9800' },
    { key: '0-10', label: '0 - 10%', color: '#F44336' },
  ];

  return (
    <div className="space-y-6">
      {/* Live Status Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatusCard label="Normal" value={status?.normal ?? 0} color="bg-green-100 text-green-700" dot="bg-green-500" />
        <StatusCard label="Low PSI" value={status?.low_psi ?? 0} color="bg-yellow-100 text-yellow-700" dot="bg-yellow-500" />
        <StatusCard label="Critical" value={status?.critical ?? 0} color="bg-red-100 text-red-700" dot="bg-red-500" />
        <StatusCard label="Active Alerts" value={status?.alerts ?? 0} color="bg-orange-100 text-orange-700" dot="bg-orange-500" />
      </div>

      {/* Tyre Life Grid */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Tyre Life Distribution</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {bucketConfig.map(b => (
            <div
              key={b.key}
              className="rounded-xl p-4 text-white cursor-pointer hover:shadow-lg transition-shadow"
              style={{ backgroundColor: b.color }}
            >
              <p className="text-xs font-medium opacity-90">Tyre Life</p>
              <p className="text-lg font-bold">{b.label}</p>
              <p className="text-sm font-semibold opacity-90">{buckets[b.key] || 0} Tyre(s)</p>
            </div>
          ))}
        </div>
      </div>

      {/* Inspection Banner + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inspection Banner */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Inspection / Rotation
            </h3>
            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {inspection.count}
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-3">Assets that need to be inspected immediately</p>
          {(inspection.items || []).slice(0, 5).map((item: any) => (
            <div key={item.id} className="flex items-center gap-2 py-2 border-b border-gray-50 last:border-0">
              <CircleDot className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium">{item.vehicle_number} — {item.position}</span>
              <span className="text-xs text-gray-400 ml-auto">{item.condition}</span>
            </div>
          ))}
          {inspection.count === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">All tyres healthy</p>
          )}
        </div>

        {/* Real-Time Alerts Feed */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Real-Time Alerts</h3>
            <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {allAlerts.length}
            </span>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {allAlerts.map((a, i) => (
              <div key={a.id || i} className="flex items-start gap-3 px-2 py-2.5 rounded-lg hover:bg-gray-50 transition">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                  a.alert_type?.includes('critical') ? 'bg-red-500' :
                  a.alert_type?.includes('temp') ? 'bg-orange-500' : 'bg-yellow-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">
                    {a.vehicle_number || `Vehicle #${a.vehicle_id}`} — Tyre {a.position}
                  </p>
                  <p className="text-xs text-gray-500">
                    {a.alert_type?.replace(/_/g, ' ')} {a.psi ? `• PSI: ${a.psi}` : ''}
                  </p>
                </div>
                <span className="text-[10px] text-gray-400 whitespace-nowrap">
                  {a.timestamp ? timeAgo(a.timestamp) : ''}
                </span>
              </div>
            ))}
            {allAlerts.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-8">No active alerts</p>
            )}
          </div>
        </div>
      </div>

      {/* Compare Tyres */}
      {Array.isArray(compareData) && compareData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Compare Tyres</h3>
          <p className="text-sm text-gray-500 mb-3">By brand — cost per KM comparison</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {compareData.slice(0, 5).map(c => (
              <div key={c.brand} className="border border-gray-200 rounded-xl p-4 text-center hover:shadow-sm transition">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{c.brand}</p>
                <p className="text-lg font-bold text-gray-900 mt-1">₹{c.cost_per_km.toFixed(2)}</p>
                <p className="text-xs text-gray-500">per KM</p>
                <p className="text-xs text-gray-400 mt-1">{c.count} tyres • {(c.total_km / 1000).toFixed(0)}K km</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inspection Coverage */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Inspection Coverage</h3>
        <InspectionCoverageGrid />
      </div>

      {/* Driver Compliance */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Driver Inspection Compliance</h3>
        <DriverComplianceTable />
      </div>

      {/* Replacement Forecast */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Replacement Forecast</h3>
        <ReplacementForecastTable />
      </div>

      {/* Field Alert Feed */}
      <FieldAlertSection />
    </div>
  );
}

function StatusCard({ label, value, color, dot }: { label: string; value: number; color: string; dot: string }) {
  return (
    <div className={`rounded-xl px-4 py-3 ${color}`}>
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold mt-1">{value} <span className="text-xs font-normal opacity-70">tyre(s)</span></p>
    </div>
  );
}

/* Field alert section using TyreAlertFeed */
function FieldAlertSection() {
  const { data, refetch } = useQuery({
    queryKey: ['field-alerts-tracker'],
    queryFn: async () => {
      const res = await (await import('@/services/api')).default.get('/tyre/field-alerts', { params: { limit: 20 } });
      return (res as any)?.data?.items || (res as any)?.items || [];
    },
    refetchInterval: 60000,
  });
  const alerts = (data || []).map((a: any) => ({
    id: a.id,
    vehicle_reg: a.registration_number,
    position: a.position,
    alert_type: a.alert_type,
    severity: a.severity,
    status: a.status,
    current_value: a.current_value,
    source: a.source || 'field',
    created_at: a.created_at,
  }));
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Field Inspection Alerts</h3>
      <TyreAlertFeed alerts={alerts} onRefresh={refetch} />
    </div>
  );
}

/* Settings tab — threshold configuration */
function TyreSettingsTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['tyre-thresholds'],
    queryFn: async () => {
      const res = await (await import('@/services/api')).default.get('/tyre/thresholds');
      const d = (res as any)?.data;
      return d?.items?.find((i: any) => i.is_fleet_default) || d?.items?.[0] || null;
    },
  });

  // Populate form when data loads
  if (data && !form) setForm({ ...data });

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const apiMod = (await import('@/services/api')).default;
      if (form.id) {
        await apiMod.put(`/tyre/thresholds/${form.id}`, form);
      } else {
        await apiMod.post('/tyre/thresholds', form);
      }
      queryClient.invalidateQueries({ queryKey: ['tyre-thresholds'] });
      toast.success('Thresholds saved!');
    } catch { toast.error('Failed to save thresholds'); }
    finally { setSaving(false); }
  };

  if (isLoading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;

  const field = (label: string, key: string, unit: string, step = 1) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
        <input
          type="number"
          className="flex-1 px-3 py-2 text-sm focus:outline-none"
          value={form?.[key] ?? ''}
          step={step}
          onChange={e => setForm((f: any) => ({ ...f, [key]: Number(e.target.value) }))}
        />
        <span className="px-3 text-xs text-gray-400 bg-gray-50 border-l border-gray-300">{unit}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Fleet Threshold Settings</h2>
        <p className="text-sm text-gray-500">Default alert thresholds applied to all vehicles (vehicle-specific overrides take priority).</p>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h3 className="font-semibold text-gray-800">Pressure</h3>
        <div className="grid grid-cols-2 gap-4">
          {field('Minimum PSI', 'min_psi', 'PSI')}
          {field('Critical PSI', 'critical_psi', 'PSI')}
        </div>
        <h3 className="font-semibold text-gray-800 pt-2">Tread Depth</h3>
        <div className="grid grid-cols-2 gap-4">
          {field('Minimum Tread', 'min_tread_mm', 'mm', 0.1)}
          {field('Worn Threshold', 'worn_tread_mm', 'mm', 0.1)}
        </div>
        <h3 className="font-semibold text-gray-800 pt-2">Schedule</h3>
        <div className="grid grid-cols-2 gap-4">
          {field('Inspection Interval', 'inspection_interval_days', 'days')}
          {field('Rotation Interval', 'rotation_interval_km', 'km', 500)}
        </div>
        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={saving || !form}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium"
          >
            {saving ? 'Saving…' : 'Save Thresholds'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SCREEN 2 — VEHICLES (Asset List with Live Status)
   ═══════════════════════════════════════════════════════════ */

function VehiclesTab() {
  const [search, setSearch] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);

  const { data: vehiclesData, isLoading } = useQuery({
    queryKey: ['vehicles-tyre-list'],
    queryFn: () => vehicleService.list({ limit: 200 }),
  });

  const vehicles = useMemo(() => {
    const raw = vehiclesData as any;
    const list = Array.isArray(raw) ? raw : (raw?.data || raw?.items || []);
    if (!search) return list;
    return list.filter((v: any) =>
      v.registration_number?.toLowerCase().includes(search.toLowerCase())
    );
  }, [vehiclesData, search]);

  // Get tyres for selected vehicle
  const { data: vehicleTyresData } = useQuery({
    queryKey: ['vehicle-tyres', selectedVehicleId],
    queryFn: () => tyreTrackerService.getVehicleTyres(selectedVehicleId!),
    enabled: !!selectedVehicleId,
  });

  // TPMS data from existing endpoint
  const { data: tpmsDash } = useQuery({
    queryKey: ['tpms-vehicle-dash', selectedVehicleId],
    queryFn: () => tpmsService.getVehicleDashboard(selectedVehicleId!),
    enabled: !!selectedVehicleId,
  });

  // Live data hook
  const { tyreMap: liveTyreMap, lastUpdate, connectionStatus } = useLiveTyreData(selectedVehicleId);

  // Selected tyre reading history
  const selectedTyre = useMemo(() => {
    if (!selectedPosition || !vehicleTyresData) return null;
    const items = (vehicleTyresData as any)?.items || [];
    return items.find((t: any) => t.position === selectedPosition || t.axle_position === selectedPosition);
  }, [selectedPosition, vehicleTyresData]);

  const { data: historyData } = useQuery<TPMSReading[]>({
    queryKey: ['tpms-history', selectedTyre?.id],
    queryFn: () => tpmsService.getReadingHistory(selectedTyre.id, { hours: 2 }),
    enabled: !!selectedTyre?.id,
  });

  // Merge API tyre data + live WS data
  const mergedTyreMap = useMemo(() => {
    const map = new Map<string, any>();
    // From API
    const items = (vehicleTyresData as any)?.items || [];
    for (const t of items) {
      const pos = t.position || t.axle_position;
      map.set(pos, {
        id: t.id,
        position: pos,
        serial_number: t.serial_number,
        brand: t.brand,
        model: t.model || t.size,
        size: t.size,
        life_percent: estimateLife(t),
        psi: t.last_psi || 0,
        target_psi: 80,
        temperature: t.last_temperature_c || 0,
        km_run: t.km_run || 0,
        fitted_date: t.installed_date || t.purchase_date,
        has_sensor: !!t.sensor_id,
        alert: null,
        vehicle_id: t.vehicle_id,
        condition: t.condition || null,
        tread_depth_mm: t.tread_depth_mm ?? null,
      });
    }
    // From TPMS dashboard
    const wheels = (tpmsDash as any)?.wheels || [];
    for (const w of wheels) {
      const existing = map.get(w.position) || {};
      map.set(w.position, {
        ...existing,
        position: w.position,
        psi: w.psi ?? existing.psi ?? 0,
        temperature: w.temperature_c ?? existing.temperature ?? 0,
        has_sensor: true,
        id: w.tyre_id || existing.id,
      });
    }
    // From live WebSocket
    liveTyreMap.forEach((live, pos) => {
      const existing = map.get(pos) || {};
      map.set(pos, { ...existing, ...live });
    });
    return map;
  }, [vehicleTyresData, tpmsDash, liveTyreMap]);

  const selectedVehicle = vehicles.find((v: any) => v.id === selectedVehicleId);

  // Map DB position codes (FL, RL1…) → diagram codes (1L0, 2L0…)
  const diagramTyreMap = useMemo(() => mapDbPositions(mergedTyreMap), [mergedTyreMap]);

  // Determine vehicle layout from vehicle_type (with tyre count fallback)
  const vehicleLayout: VehicleLayout = useMemo(() => {
    return layoutForVehicleType(
      selectedVehicle?.vehicle_type || '',
      diagramTyreMap.size || (tpmsDash as any)?.num_tyres || 0,
    );
  }, [selectedVehicle?.vehicle_type, diagramTyreMap.size, tpmsDash]);

  if (isLoading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;

  // If a vehicle is selected, show Asset View
  if (selectedVehicleId && selectedVehicle) {
    return (
      <AssetView
        vehicle={selectedVehicle}
        vehicleLayout={vehicleLayout}
        mergedTyreMap={diagramTyreMap}
        selectedPosition={selectedPosition}
        setSelectedPosition={setSelectedPosition}
        connectionStatus={connectionStatus}
        lastUpdate={lastUpdate}
        historyData={historyData}
        onBack={() => { setSelectedVehicleId(null); setSelectedPosition(null); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        <input
          placeholder="Search by registration..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      {/* Vehicle cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {vehicles.slice(0, 50).map((v: any) => (
          <button
            key={v.id}
            onClick={() => setSelectedVehicleId(v.id)}
            className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:shadow-md transition group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition" />
                <span className="font-bold text-gray-900">{v.registration_number}</span>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
            </div>
            <div className="text-xs text-gray-500 space-y-0.5">
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span>{v.current_location || v.branch_name || 'Unknown'}</span>
              </div>
              <div>Type: {v.vehicle_type || 'TRUCK'}</div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-green-600 font-medium">View Tyres</span>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </div>
          </button>
        ))}
      </div>
      {vehicles.length === 0 && (
        <p className="text-center text-gray-400 py-12">No vehicles found</p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SCREEN 2b — ASSET VIEW (Live Vehicle Tyre Diagram)
   ═══════════════════════════════════════════════════════════ */

function AssetView({
  vehicle,
  vehicleLayout,
  mergedTyreMap,
  selectedPosition,
  setSelectedPosition,
  connectionStatus,
  lastUpdate,
  historyData,
  onBack,
}: {
  vehicle: any;
  vehicleLayout: VehicleLayout;
  mergedTyreMap: Map<string, any>;
  selectedPosition: string | null;
  setSelectedPosition: (p: string | null) => void;
  connectionStatus: ConnectionStatus;
  lastUpdate: Date;
  historyData?: TPMSReading[];
  onBack: () => void;
}) {
  const selectedTyreData = selectedPosition ? mergedTyreMap.get(selectedPosition) : null;

  // Compute stats from merged tyre map
  const stats = useMemo(() => {
    let total = 0, healthy = 0, warnings = 0, critical = 0;
    mergedTyreMap.forEach((t) => {
      total++;
      const life = t.life_percent ?? 100;
      if (t.alert === 'critical_pressure' || t.alert === 'critical' || life < 30) critical++;
      else if (t.alert || life < 50) warnings++;
      else healthy++;
    });
    return { total, healthy, warnings, critical };
  }, [mergedTyreMap]);

  // Ticking live counter
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
            <ChevronRight className="w-5 h-5 text-gray-400 rotate-180" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-gray-900">{vehicle.registration_number}</h2>
              <ConnectionBadge status={connectionStatus} />
              <span className="text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                {(vehicle.vehicle_type || 'TRUCK').toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500 mt-0.5 flex-wrap">
              <span>Odometer: {Number(vehicle.current_odometer || 0).toLocaleString('en-IN')} km</span>
              <span>Location: {vehicle.current_location || vehicle.branch_name || '—'}</span>
              <span>Updated: {secondsAgo(lastUpdate)}</span>
            </div>
            {/* Fleet health mini bar */}
            {stats.total > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] text-gray-400 shrink-0">Fleet health:</span>
                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden flex">
                  <div className="h-full bg-green-500 transition-all"
                    style={{ width: `${(stats.healthy / stats.total) * 100}%` }} />
                  <div className="h-full bg-amber-400 transition-all"
                    style={{ width: `${(stats.warnings / stats.total) * 100}%` }} />
                  <div className="h-full bg-red-500 transition-all"
                    style={{ width: `${(stats.critical / stats.total) * 100}%` }} />
                </div>
                <span className="text-[10px] text-gray-400 shrink-0">
                  {stats.healthy}✓ {stats.warnings}△ {stats.critical}✕
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SVG Diagram + Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* SVG Diagram */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-6">
          <VehicleTyreDiagram
            vehicleType={vehicleLayout}
            tyres={mergedTyreMap}
            onTyreClick={pos => setSelectedPosition(pos === selectedPosition ? null : pos)}
            selectedPosition={selectedPosition}
          />
          <div className="mt-4 flex flex-wrap gap-3 justify-center text-[10px]">
            <Legend color="#22c55e" label="Good" />
            <Legend color="#eab308" label="Average" />
            <Legend color="#f97316" label="Worn/Low PSI" />
            <Legend color="#ef4444" label="Damaged/Critical" />
            <Legend color="#9ca3af" label="No data" />
          </div>
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-2">
          {selectedTyreData ? (
            <TyreDetailPanel
              tyre={selectedTyreData}
              position={selectedPosition!}
              historyData={historyData}
              onClose={() => setSelectedPosition(null)}
            />
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center h-full flex flex-col items-center justify-center">
              <CircleDot className="w-10 h-10 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">Click a tyre to view details</p>
              <p className="text-xs text-gray-400 mt-1">
                Showing {mergedTyreMap.size} tyre(s) on this vehicle
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total tyres', value: stats.total, color: 'text-gray-900' },
          { label: 'Healthy', value: stats.healthy, color: 'text-green-600' },
          { label: 'Warnings', value: stats.warnings, color: 'text-amber-600' },
          { label: 'Critical', value: stats.critical, color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TyreDetailPanel({
  tyre, position, historyData, onClose,
}: {
  tyre: any;
  position: string;
  historyData?: TPMSReading[];
  onClose: () => void;
}) {
  const psi = tyre.psi || 0;
  const targetPsi = tyre.target_psi || 80;
  const psiStatus = getPSIStatus(psi, targetPsi);
  const life = tyre.life_percent ?? 100;
  const treadMm = tyre.tread_depth_mm ?? null;
  const condition = tyre.condition ? String(tyre.condition).toUpperCase() : null;

  const conditionStyle = condition === 'DAMAGED' || condition === 'WORN'
    ? 'bg-red-50 text-red-700'
    : condition === 'AVERAGE' ? 'bg-amber-50 text-amber-700'
    : 'bg-green-50 text-green-700';

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-y-auto max-h-[82vh]">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-lg font-bold text-gray-900">Position {position}</span>
          {condition && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${conditionStyle}`}>
              {condition}
            </span>
          )}
          {tyre.has_sensor && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">SENSOR</span>
          )}
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X className="w-4 h-4" /></button>
      </div>

      {/* PSI Gauge */}
      <div className="p-4 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pressure</p>
        <div className="flex items-center gap-4">
          <PsiGauge psi={psi} target={targetPsi} />
          <div>
            <p className="text-2xl font-bold" style={{ color: psiStatus.color }}>
              {psi > 0 ? psi.toFixed(0) : '—'}
            </p>
            <p className="text-xs text-gray-400">PSI</p>
            <p className="text-xs mt-1 font-semibold" style={{ color: psiStatus.color }}>
              {psi > 0 ? psiStatus.label : 'No reading'}
            </p>
            <p className="text-xs text-gray-400">Target: {targetPsi} PSI</p>
          </div>
        </div>
      </div>

      {/* Tread depth + Life */}
      <div className="p-4 border-b border-gray-100">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tread Depth</p>
            <TreadBar mm={treadMm} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Life Remaining</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 flex flex-col gap-0.5">
                {[80, 60, 40, 20, 0].map(thresh => (
                  <div key={thresh} className="h-2 rounded-sm"
                    style={{ backgroundColor: life > thresh ? tyreLifeColor(life) : '#e5e7eb' }} />
                ))}
              </div>
              <span className="text-sm font-bold" style={{ color: tyreLifeColor(life) }}>
                {life.toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 space-y-2 text-sm border-b border-gray-100">
        <InfoRow label="Serial No" value={tyre.serial_number || '—'} />
        <InfoRow label="Brand" value={tyre.brand || '—'} />
        <InfoRow label="Size" value={tyre.size || tyre.model || '—'} />
        <InfoRow label="KMs Run" value={`${Number(tyre.km_run || 0).toLocaleString('en-IN')} km`} />
        <InfoRow label="Fitted On" value={tyre.fitted_date ? new Date(tyre.fitted_date).toLocaleDateString('en-IN') : '—'} />
        {(tyre.temperature || 0) > 0 && (
          <InfoRow
            label="Temperature"
            value={`${tyre.temperature.toFixed(0)}°C${tyre.temperature > 85 ? ' ⚠️' : ''}`}
          />
        )}
      </div>

      {/* PSI Sparkline */}
      {historyData && historyData.length >= 2 && (
        <div className="p-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">PSI History</p>
          <PsiSparkline data={historyData} />
        </div>
      )}

      {/* Action buttons */}
      <div className="p-4 flex flex-wrap gap-2">
        <ActionBtn icon={<RefreshCw className="w-3.5 h-3.5" />} label="Log Reading" />
        <ActionBtn icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Flag Inspection" />
        <ActionBtn icon={<Activity className="w-3.5 h-3.5" />} label="View History" />
        <ActionBtn icon={<RotateCw className="w-3.5 h-3.5" />} label="Retread" />
      </div>
    </div>
  );
}

/* ── PSI semicircle gauge (inline SVG) ────────────────── */
function PsiGauge({ psi, target }: { psi: number; target: number }) {
  const MAX = 160;
  const cx = 65, cy = 60, r = 50;

  function arc(fromP: number, toP: number): string {
    const a1 = (1 - fromP / MAX) * Math.PI;
    const a2 = (1 - toP / MAX) * Math.PI;
    const x1 = +(cx + r * Math.cos(a1)).toFixed(2);
    const y1 = +(cy - r * Math.sin(a1)).toFixed(2);
    const x2 = +(cx + r * Math.cos(a2)).toFixed(2);
    const y2 = +(cy - r * Math.sin(a2)).toFixed(2);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 0 ${x2} ${y2}`;
  }

  const clamped = Math.min(Math.max(psi, 0), MAX);
  const na = (1 - clamped / MAX) * Math.PI;
  const nLen = r - 10;
  const nx = +(cx + nLen * Math.cos(na)).toFixed(2);
  const ny = +(cy - nLen * Math.sin(na)).toFixed(2);

  // Target tick
  const ta = (1 - target / MAX) * Math.PI;
  const tx1 = +(cx + (r - 13) * Math.cos(ta)).toFixed(2);
  const ty1 = +(cy - (r - 13) * Math.sin(ta)).toFixed(2);
  const tx2 = +(cx + (r + 1) * Math.cos(ta)).toFixed(2);
  const ty2 = +(cy - (r + 1) * Math.sin(ta)).toFixed(2);

  return (
    <svg viewBox={`0 0 ${cx * 2} ${cy + 14}`} className="w-28 flex-shrink-0">
      <path d={arc(0, MAX)} fill="none" stroke="#e5e7eb" strokeWidth={11} />
      <path d={arc(0, 60)} fill="none" stroke="#dc2626" strokeWidth={11} />
      <path d={arc(60, 80)} fill="none" stroke="#f97316" strokeWidth={11} />
      <path d={arc(80, 120)} fill="none" stroke="#22c55e" strokeWidth={11} />
      <path d={arc(120, 140)} fill="none" stroke="#f97316" strokeWidth={11} />
      <path d={arc(140, MAX)} fill="none" stroke="#dc2626" strokeWidth={11} />
      {/* Target tick */}
      <line x1={tx1} y1={ty1} x2={tx2} y2={ty2} stroke="#111827" strokeWidth={2} />
      {/* Needle */}
      {psi > 0 && (
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#111827" strokeWidth={2.5} strokeLinecap="round" />
      )}
      <circle cx={cx} cy={cy} r={4} fill="#111827" />
    </svg>
  );
}

/* ── Tread depth 5-segment visual ─────────────────────── */
function TreadBar({ mm }: { mm: number | null }) {
  if (mm === null || mm === undefined) {
    return <p className="text-xs text-gray-400 mt-2">No reading</p>;
  }
  const segs = [
    { label: '>8mm', min: 8, color: '#22c55e' },
    { label: '6mm', min: 6, color: '#84cc16' },
    { label: '4mm', min: 4, color: '#eab308' },
    { label: '2.5mm', min: 2.5, color: '#f97316' },
    { label: '1.6mm', min: 0, color: '#ef4444' },
  ];
  const activeColor = segs.find(s => mm >= s.min)?.color ?? '#ef4444';
  return (
    <div>
      {segs.map((seg, i) => (
        <div key={i} className="flex items-center gap-1.5 mb-0.5">
          <div className="h-3 w-full rounded-sm" style={{
            backgroundColor: mm >= seg.min ? activeColor : '#e5e7eb',
          }} />
          <span className="text-[9px] text-gray-400 w-9 shrink-0">{seg.label}</span>
        </div>
      ))}
      <p className="text-xs font-bold mt-1" style={{ color: activeColor }}>{mm.toFixed(1)} mm</p>
    </div>
  );
}

/* ── Inline SVG PSI sparkline ─────────────────────────── */
function PsiSparkline({ data }: { data: { psi?: number; timestamp?: string }[] }) {
  const pts = data.slice(-7).filter(r => (r as any).psi > 0);
  if (pts.length < 2) return null;
  const vals = pts.map(r => (r as any).psi as number);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const W = 200, H = 44;
  const toXY = (v: number, i: number) => {
    const x = +(i / (vals.length - 1) * W).toFixed(1);
    const y = +(maxV === minV ? H / 2 : H - 4 - (v - minV) / (maxV - minV) * (H - 8)).toFixed(1);
    return { x, y };
  };
  const points = vals.map((v, i) => { const { x, y } = toXY(v, i); return `${x},${y}`; }).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
        <polyline points={points} fill="none" stroke="#2563eb" strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round" />
        {vals.map((v, i) => {
          const { x, y } = toXY(v, i);
          return <circle key={i} cx={x} cy={y} r={2.5} fill="#2563eb" />;
        })}
      </svg>
      <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
        {pts.slice(0, 2).map((r, i) => (
          <span key={i}>{r.timestamp ? new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
        ))}
        {pts.length > 2 && <span className="text-center flex-1">···</span>}
        {pts.length >= 2 && (
          <span>{pts[pts.length - 1].timestamp ? new Date(pts[pts.length - 1].timestamp!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}

function ActionBtn({ icon, label, color = 'gray' }: { icon: React.ReactNode; label: string; color?: string }) {
  return (
    <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition
      ${color === 'red' ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
      {icon} {label}
    </button>
  );
}

function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  const config = {
    live: { color: 'bg-green-500', text: 'LIVE', textColor: 'text-green-700', bg: 'bg-green-50' },
    offline: { color: 'bg-gray-400', text: 'OFFLINE', textColor: 'text-gray-600', bg: 'bg-gray-100' },
    reconnecting: { color: 'bg-yellow-500', text: 'RECONNECTING', textColor: 'text-yellow-700', bg: 'bg-yellow-50' },
  }[status];

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${config.bg} ${config.textColor}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.color}`}>
        {status === 'live' && <span className={`block w-1.5 h-1.5 rounded-full ${config.color} animate-ping`} />}
      </span>
      {config.text}
    </span>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
      <span className="text-gray-500">{label}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SCREEN 3 — RETREADING
   ═══════════════════════════════════════════════════════════ */

const RETREAD_STATUS_CONFIG: Record<string, { label: string; bg: string; col: string; dot: string; step: number }> = {
  SENT:        { label: 'Sent',        bg: 'bg-blue-50',   col: 'text-blue-700',   dot: '#378ADD', step: 1 },
  IN_PROGRESS: { label: 'In progress', bg: 'bg-amber-50',  col: 'text-amber-700',  dot: '#EF9F27', step: 2 },
  READY:       { label: 'Ready',       bg: 'bg-emerald-50', col: 'text-emerald-700', dot: '#1D9E75', step: 3 },
  RETURNED:    { label: 'Returned',    bg: 'bg-gray-100',  col: 'text-gray-600',   dot: '#639922', step: 4 },
};

const RETREAD_STEPS = ['Sent', 'In progress', 'Ready', 'Returned'] as const;
const RETREAD_ORDER = ['SENT', 'IN_PROGRESS', 'READY', 'RETURNED'] as const;

function getNextRetreadStatus(current: string): string | null {
  const i = RETREAD_ORDER.indexOf(current as any);
  return i >= 0 && i < RETREAD_ORDER.length - 1 ? RETREAD_ORDER[i + 1] : null;
}

function RetreadingTab() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>('all');
  const [showAddForm, setShowAddForm] = useState(false);

  const { data, isLoading } = useQuery<TyreRetreadItem[]>({
    queryKey: ['tyre-retreading'],
    queryFn: tyreTrackerService.getRetreading,
  });

  const items = Array.isArray(data) ? data : [];

  // Stats
  const stats = useMemo(() => {
    let total = 0, sent = 0, in_progress = 0, ready = 0, returned = 0;
    items.forEach(r => {
      total++;
      if (r.status === 'SENT') sent++;
      else if (r.status === 'IN_PROGRESS') in_progress++;
      else if (r.status === 'READY') ready++;
      else if (r.status === 'RETURNED') returned++;
    });
    return { total, sent, in_progress, ready, returned };
  }, [items]);

  // Filtered items
  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter(r => r.status === filter);
  }, [items, filter]);

  // Update status mutation
  const statusMutation = useMutation({
    mutationFn: ({ tyreId, status }: { tyreId: number; status: string }) =>
      tyreTrackerService.updateRetreadStatus(tyreId, status.toLowerCase()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tyre-retreading'] }),
  });

  // Overdue check — if last_retread_date + 14 days < today
  const isOverdue = (item: TyreRetreadItem) => {
    if (item.status === 'RETURNED' || !item.last_retread_date) return false;
    const sentDate = new Date(item.last_retread_date);
    const dueDate = new Date(sentDate);
    dueDate.setDate(dueDate.getDate() + 14);
    return dueDate < new Date();
  };

  if (isLoading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-medium text-gray-900">Retreading</h3>
          <p className="text-sm text-gray-500 mt-0.5">Track tyres sent for retreading and manage returns</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#185FA5] text-white hover:opacity-90 transition"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><line x1="7" y1="2" x2="7" y2="12" stroke="white" strokeWidth="1.8" strokeLinecap="round" /><line x1="2" y1="7" x2="12" y2="7" stroke="white" strokeWidth="1.8" strokeLinecap="round" /></svg>
          Add retread
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-[11px] text-gray-500 mb-1">Total</div>
          <div className="text-2xl font-medium text-gray-900">{stats.total}</div>
        </div>
        <div className="rounded-lg p-3 text-center" style={{ background: '#FAEEDA' }}>
          <div className="text-[11px]" style={{ color: '#854F0B' }}>In progress</div>
          <div className="text-2xl font-medium" style={{ color: '#633806' }}>{stats.in_progress}</div>
        </div>
        <div className="rounded-lg p-3 text-center" style={{ background: '#E1F5EE' }}>
          <div className="text-[11px]" style={{ color: '#0F6E56' }}>Ready</div>
          <div className="text-2xl font-medium" style={{ color: '#085041' }}>{stats.ready}</div>
        </div>
        <div className="rounded-lg p-3 text-center" style={{ background: '#E6F1FB' }}>
          <div className="text-[11px]" style={{ color: '#185FA5' }}>Returned</div>
          <div className="text-2xl font-medium" style={{ color: '#0C447C' }}>{stats.returned}</div>
        </div>
      </div>

      {/* Filter buttons */}
      <div className="flex gap-1.5 flex-wrap">
        {[
          { key: 'all', label: `All (${stats.total})` },
          { key: 'SENT', label: `Sent (${stats.sent})` },
          { key: 'IN_PROGRESS', label: `In progress (${stats.in_progress})` },
          { key: 'READY', label: `Ready (${stats.ready})` },
          { key: 'RETURNED', label: `Returned (${stats.returned})` },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-md text-xs border transition ${
              filter === f.key
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-white text-gray-500 border-gray-200 hover:text-gray-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {filtered.map(item => {
          const sc = RETREAD_STATUS_CONFIG[item.status] || RETREAD_STATUS_CONFIG.RETURNED;
          const overdue = isOverdue(item);
          const nextStatus = getNextRetreadStatus(item.status);
          const nextLabel = nextStatus ? RETREAD_STATUS_CONFIG[nextStatus]?.label : null;

          return (
            <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition">
              {/* Top row */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[15px] font-medium text-gray-900">{item.serial_number}</span>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full ${sc.bg} ${sc.col}`}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc.dot }} />
                      {sc.label}
                    </span>
                    {overdue && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-red-50 text-red-600">
                        Overdue
                      </span>
                    )}
                  </div>
                  <div className="text-[13px] text-gray-500">{item.brand} &nbsp;|&nbsp; {item.size}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">Vehicle</div>
                  <div className="text-[13px] font-medium text-gray-900">{item.vehicle_number}</div>
                  <div className="text-xs text-gray-400">Pos: {item.position}</div>
                </div>
              </div>

              {/* Progress stepper */}
              <div className="flex items-center gap-0 my-3">
                {RETREAD_STEPS.map((stepLabel, i) => {
                  const curStep = sc.step;
                  const done = i + 1 < curStep;
                  const active = i + 1 === curStep;
                  const dotBg = done ? '#4CAF50' : active ? sc.dot : '#e5e7eb';
                  const lineBg = done ? '#4CAF50' : '#e5e7eb';

                  return (
                    <div key={stepLabel} className="flex items-center flex-1 flex-col gap-1">
                      <div className="flex items-center w-full">
                        {i > 0 && <div className="flex-1 h-0.5" style={{ background: lineBg }} />}
                        <div
                          className="w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: dotBg }}
                        >
                          {done ? (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <polyline points="2,5 4,7 8,3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : (
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: active ? 'white' : '#d1d5db' }} />
                          )}
                        </div>
                        {i < 3 && <div className="flex-1 h-0.5" style={{ background: done ? '#4CAF50' : '#e5e7eb' }} />}
                      </div>
                      <span className={`text-[10px] whitespace-nowrap ${active ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                        {stepLabel}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Info row */}
              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100">
                <div>
                  <div className="text-[11px] text-gray-400">Sent</div>
                  <div className="text-xs font-medium">
                    {item.last_retread_date ? new Date(item.last_retread_date).toLocaleDateString('en-IN') : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-400">Retread #</div>
                  <div className="text-xs font-medium">{item.retread_count}/{item.max_retreads}</div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-400">Vendor</div>
                  <div className="text-xs font-medium truncate">{item.vendor || '—'}</div>
                </div>
              </div>

              {/* Notes */}
              {item.notes && (
                <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-md px-2.5 py-1.5">{item.notes}</div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 mt-3">
                {nextStatus && (
                  <button
                    onClick={() => statusMutation.mutate({ tyreId: item.id, status: nextStatus })}
                    disabled={statusMutation.isPending}
                    className="px-3 py-1.5 rounded-md text-xs border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
                  >
                    Mark as {nextLabel}
                  </button>
                )}
                {item.status === 'RETURNED' && (
                  <button className="px-3 py-1.5 rounded-md text-xs bg-[#185FA5] text-white hover:opacity-90 transition">
                    Fit to vehicle
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <RotateCw className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p>No records found{filter !== 'all' ? ' for this filter' : ''}</p>
          </div>
        )}
      </div>

      {/* Add Retread Modal */}
      {showAddForm && <AddRetreadModal onClose={() => setShowAddForm(false)} />}
    </div>
  );
}

/* ── Add Retread Modal ─────────────────────────────── */

function AddRetreadModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    serial: '', brand: '', vehicle: '', position: '', vendor: '',
    date_sent: new Date().toISOString().split('T')[0],
    expected_return: '',
  });

  const set = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const submitMutation = useMutation({
    mutationFn: async () => {
      // For now, just invalidate to refetch — the backend submitRetread endpoint can be used
      // when a real tyre ID is selected. Placeholder: calls retreading list refresh.
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tyre-retreading'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35" onClick={onClose}>
      <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-medium text-gray-900">Add retread entry</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>
        <div className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tyre serial number</label>
            <input
              className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm focus:border-[#185FA5] outline-none"
              value={form.serial} onChange={e => set('serial', e.target.value)}
              placeholder="e.g. AP001234"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Brand</label>
              <input
                className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm focus:border-[#185FA5] outline-none"
                value={form.brand} onChange={e => set('brand', e.target.value)}
                placeholder="Apollo, MRF…"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Vehicle registration</label>
              <input
                className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm focus:border-[#185FA5] outline-none"
                value={form.vehicle} onChange={e => set('vehicle', e.target.value)}
                placeholder="TN22LM4567"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tyre position</label>
              <input
                className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm focus:border-[#185FA5] outline-none"
                value={form.position} onChange={e => set('position', e.target.value)}
                placeholder="e.g. RL1"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Retread vendor</label>
              <input
                className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm focus:border-[#185FA5] outline-none"
                value={form.vendor} onChange={e => set('vendor', e.target.value)}
                placeholder="Vendor name"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date sent</label>
              <input
                type="date"
                className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm focus:border-[#185FA5] outline-none"
                value={form.date_sent} onChange={e => set('date_sent', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Expected return</label>
              <input
                type="date"
                className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm focus:border-[#185FA5] outline-none"
                value={form.expected_return} onChange={e => set('expected_return', e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={() => submitMutation.mutate()}
              disabled={!form.serial || submitMutation.isPending}
              className="flex-1 py-2 rounded-lg bg-[#185FA5] text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              Add entry
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SCREEN 4 — IN STOCK
   ═══════════════════════════════════════════════════════════ */

function InStockTab() {
  const [stockType, setStockType] = useState<'new' | 'retreaded' | 'removed'>('new');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery<{ items: TyreStockItem[]; counts: Record<string, number> }>({
    queryKey: ['tyre-stock', stockType, search],
    queryFn: () => tyreTrackerService.getStock({ type: stockType, search: search || undefined }),
  });

  const items = data?.items || [];
  const counts = data?.counts || { new: 0, retreaded: 0, removed: 0 };

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-2">
        {(['new', 'retreaded', 'removed'] as const).map(t => (
          <button
            key={t}
            onClick={() => setStockType(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              stockType === t
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)} ({counts[t] || 0})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        <input
          placeholder="Search by serial or brand..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 hover:shadow-sm transition">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
                <CircleDot className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-gray-900">{item.serial_number}</span>
                  {item.brand && <span className="text-xs text-gray-400">{item.brand}</span>}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {item.size} • {item.condition} • {item.km_run.toLocaleString('en-IN')} km
                </p>
              </div>
              <div className="text-right text-xs text-gray-500">
                <p>{item.vehicle_number}</p>
                <p>₹{item.purchase_cost.toLocaleString('en-IN')}</p>
              </div>
              <CircleDot className="w-4 h-4 text-gray-300 flex-shrink-0" />
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Package className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p>No tyres in {stockType} stock</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SCREEN 5 — BUY TYRES
   ═══════════════════════════════════════════════════════════ */

const BRANDS = ['Apollo', 'Michelin', 'MRF', 'Ceat', 'JK', 'Bridgestone'];

function BuyTyresTab() {
  const [brand, setBrand] = useState('Apollo');

  const { data, isLoading } = useQuery<TyreCatalogueItem[]>({
    queryKey: ['tyre-catalogue', brand],
    queryFn: () => tyreTrackerService.getCatalogue(brand),
  });

  const items = Array.isArray(data) ? data : [];

  return (
    <div className="space-y-4">
      {/* Brand tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {BRANDS.map(b => (
          <button
            key={b}
            onClick={() => setBrand(b)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              brand === b
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map(item => (
            <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4 text-center hover:shadow-md transition">
              <div className="w-24 h-24 mx-auto mb-3 bg-gray-50 rounded-xl flex items-center justify-center">
                <CircleDot className="w-12 h-12 text-gray-300" />
              </div>
              <p className="font-semibold text-gray-900 text-sm">{item.model}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.sizes.length} Size(s) available</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{item.category}</p>
              <button className="mt-3 text-xs font-bold text-purple-700 hover:text-purple-900 uppercase tracking-wide">
                Contact Us
              </button>
            </div>
          ))}
        </div>
      )}
      {!isLoading && items.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <ShoppingCart className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p>No tyres found for {brand}</p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Utility helpers
   ═══════════════════════════════════════════════════════════ */

function estimateLife(tyre: any): number {
  const maxKm = 100000;
  const km = Number(tyre.km_run || 0);
  let life = Math.max(0, Math.min(100, 100 - (km / maxKm * 100)));
  const cond = String(tyre.condition || 'good').toLowerCase();
  if (cond === 'worn' || cond === 'replaced') life = Math.min(life, 15);
  else if (cond === 'average') life = Math.min(life, 55);
  return life;
}

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function secondsAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  return `${Math.floor(diff / 60)}m ago`;
}
