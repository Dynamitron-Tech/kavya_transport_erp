import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '@/services/api';

// ── Types ────────────────────────────────────────────────────────────────────

type TruckStatus = 'running' | 'on_break' | 'offline';

interface TruckLocation {
  vehicleId: string;
  registrationNo: string;
  lat: number;
  lng: number;
  speed: number;
  ignitionOn: boolean;
  lastPingStr: string | null;
  driverName: string | null;
  tripId: string | null;
  tripOrigin: string | null;
  tripDestination: string | null;
  odometerKm: number;
  status: TruckStatus;
  minutesSinceLastPing: number;
}

// ── Status logic ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<TruckStatus, string> = {
  running: '#10B981',
  on_break: '#F59E0B',
  offline: '#6B7280',
};

const STATUS_LABELS: Record<TruckStatus, string> = {
  running: 'Running',
  on_break: 'On Break',
  offline: 'Offline',
};

function parsePingTime(raw: string | null): Date | null {
  if (!raw) return null;
  // Handle Python datetime string: "2026-03-23 12:30:00.123456" → ISO
  const normalized = raw.replace(' ', 'T').split('.')[0];
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

function deriveStatus(speed: number, _ignitionOn: boolean, lastPingStr: string | null): TruckStatus {
  const lastPing = parsePingTime(lastPingStr);
  if (!lastPing) return 'offline';
  const minutesAgo = (Date.now() - lastPing.getTime()) / 60000;
  if (minutesAgo > 5) return 'offline';
  if (speed > 5) return 'running';
  return 'on_break';
}

function normalizeVehicles(raw: any[]): TruckLocation[] {
  return raw
    .map((v, i) => {
      const lat = Number(v.latitude ?? v.lat ?? 0);
      const lng = Number(v.longitude ?? v.lng ?? 0);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
      const speed = Number(v.speed ?? v.speed_kmph ?? v.current_speed ?? 0);
      const lastPingStr: string | null = v.last_update ?? v.timestamp ?? null;
      const lastPing = parsePingTime(lastPingStr);
      const minutesSinceLastPing = lastPing
        ? Math.floor((Date.now() - lastPing.getTime()) / 60000)
        : 999;
      return {
        vehicleId: String(v.vehicle_id ?? v.trip_id ?? i),
        registrationNo: v.registration_number ?? v.rc_number ?? v.vehicle_registration ?? 'Unknown',
        lat,
        lng,
        speed,
        ignitionOn: Boolean(v.ignition_on),
        lastPingStr,
        driverName: v.driver_name ?? null,
        tripId: v.trip_id ?? null,
        tripOrigin: v.origin ?? v.trip_origin ?? null,
        tripDestination: v.destination ?? v.trip_destination ?? null,
        odometerKm: Number(v.odometer ?? 0),
        status: deriveStatus(speed, Boolean(v.ignition_on), lastPingStr),
        minutesSinceLastPing,
      } as TruckLocation;
    })
    .filter(Boolean) as TruckLocation[];
}

// ── Custom truck marker icon ─────────────────────────────────────────────────

function createTruckIcon(status: TruckStatus, regNo: string): L.DivIcon {
  const color = STATUS_COLORS[status];
  const shortReg = regNo.length > 10 ? regNo.slice(-8) : regNo;
  return L.divIcon({
    html: `
      <div style="
        width:38px;height:38px;background:${color};border-radius:50%;
        border:2.5px solid white;display:flex;align-items:center;
        justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.45);cursor:pointer;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
          <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34
            3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4z"/>
        </svg>
      </div>
      <div style="
        font-size:9px;text-align:center;color:${color};margin-top:2px;
        font-weight:700;max-width:60px;overflow:hidden;text-overflow:ellipsis;
        white-space:nowrap;text-shadow:0 1px 2px rgba(255,255,255,0.9);
      ">${shortReg}</div>
    `,
    iconSize: [38, 54],
    iconAnchor: [19, 54],
    className: '',
  });
}

// ── Map helpers (must be inside MapContainer) ────────────────────────────────

function AutoFitBounds({ trucks }: { trucks: TruckLocation[] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || trucks.length === 0) return;
    const coords: [number, number][] = trucks.map(t => [t.lat, t.lng]);
    map.fitBounds(coords, { padding: [50, 50], maxZoom: 13 });
    fitted.current = true;
  }, [trucks.length === 0 ? 0 : 1]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function PanToSelected({ truck }: { truck: TruckLocation | null }) {
  const map = useMap();
  const prevId = useRef<string | null>(null);
  useEffect(() => {
    if (!truck || truck.vehicleId === prevId.current) return;
    prevId.current = truck.vehicleId;
    map.setView([truck.lat, truck.lng], Math.max(map.getZoom(), 13), { animate: true });
  }, [truck?.vehicleId]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// ── Vehicle list card ────────────────────────────────────────────────────────

function TruckCard({
  truck,
  isSelected,
  onClick,
}: {
  truck: TruckLocation;
  isSelected: boolean;
  onClick: () => void;
}) {
  const color = STATUS_COLORS[truck.status];
  const label = STATUS_LABELS[truck.status];
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
        isSelected
          ? 'bg-primary-50 border border-primary-300'
          : 'bg-gray-50 border border-transparent hover:bg-gray-100'
      }`}
    >
      {/* Status dot + icon */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: color }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
          <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3
            3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4z" />
        </svg>
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm text-gray-900 truncate">{truck.registrationNo}</p>
          <span
            className="text-xs font-medium ml-1 flex-shrink-0"
            style={{ color }}
          >
            {truck.status === 'offline'
              ? `${truck.minutesSinceLastPing}m ago`
              : `${truck.speed.toFixed(0)} km/h`}
          </span>
        </div>
        {truck.driverName && (
          <p className="text-xs text-gray-500 truncate">{truck.driverName}</p>
        )}
        {truck.tripOrigin && truck.tripDestination && (
          <p className="text-xs text-gray-400 truncate">
            {truck.tripOrigin} → {truck.tripDestination}
          </p>
        )}
        {!truck.driverName && !truck.tripOrigin && (
          <p className="text-xs text-gray-400">{label}</p>
        )}
      </div>
    </div>
  );
}

// ── Vehicle detail panel ─────────────────────────────────────────────────────

function TruckDetail({ truck, onBack }: { truck: TruckLocation; onBack: () => void }) {
  const color = STATUS_COLORS[truck.status];
  const label = STATUS_LABELS[truck.status];
  const mapsUrl = `https://maps.google.com/?q=${truck.lat},${truck.lng}`;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 mb-3 transition-colors"
        >
          ← Back to list
        </button>
        <div className="flex items-start gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: color }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3
                3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-base leading-tight">
              {truck.registrationNo}
            </h3>
            {truck.driverName && (
              <p className="text-sm text-gray-600 mt-0.5">{truck.driverName}</p>
            )}
          </div>
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {label.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 p-4 border-b border-gray-100">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">Speed</p>
          <p className="text-sm font-bold text-gray-900">{truck.speed.toFixed(0)} km/h</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">Last Updated</p>
          <p className="text-sm font-bold text-gray-900">
            {truck.minutesSinceLastPing <= 0
              ? 'Just now'
              : `${truck.minutesSinceLastPing}m ago`}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">Odometer</p>
          <p className="text-sm font-bold text-gray-900">
            {truck.odometerKm > 0 ? `${truck.odometerKm.toLocaleString('en-IN')} km` : '—'}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">Ignition</p>
          <p className="text-sm font-bold" style={{ color: truck.ignitionOn ? '#10B981' : '#EF4444' }}>
            {truck.ignitionOn ? 'ON' : 'OFF'}
          </p>
        </div>
      </div>

      {/* Trip info */}
      {truck.tripOrigin && truck.tripDestination && (
        <div className="p-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Active Trip</p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm font-medium text-gray-900">
              {truck.tripOrigin} → {truck.tripDestination}
            </p>
            {truck.tripId && (
              <p className="text-xs text-gray-500 mt-1">Trip #{truck.tripId}</p>
            )}
          </div>
        </div>
      )}

      {/* Location */}
      <div className="p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Location</p>
        <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between gap-2">
          <p className="text-xs font-mono text-gray-700">
            {truck.lat.toFixed(5)}°N, {truck.lng.toFixed(5)}°E
          </p>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-600 hover:underline flex-shrink-0"
          >
            Maps ↗
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function LiveTrackingPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TruckStatus>('all');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const { data: rawData, isLoading, refetch } = useQuery({
    queryKey: ['tracking-live'],
    queryFn: () => api.get<any>('/tracking/live'),
    refetchInterval: 30000,
    throwOnError: false,
  });

  // Refetch timestamp
  const handleRefetch = useCallback(async () => {
    await refetch();
    setLastRefresh(new Date());
  }, [refetch]);

  const allTrucks = normalizeVehicles(
    Array.isArray((rawData as any)?.data)
      ? (rawData as any).data
      : Array.isArray(rawData)
      ? (rawData as any)
      : []
  );

  const running = allTrucks.filter(t => t.status === 'running').length;
  const onBreak = allTrucks.filter(t => t.status === 'on_break').length;
  const offline = allTrucks.filter(t => t.status === 'offline').length;

  const filtered = allTrucks.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        t.registrationNo.toLowerCase().includes(q) ||
        (t.driverName?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  const selected = allTrucks.find(t => t.vehicleId === selectedId) ?? null;

  const handleSelectTruck = useCallback((truck: TruckLocation) => {
    setSelectedId(truck.vehicleId);
    setStatusFilter('all');
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Live Tracking</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-time vehicle locations · Tamil Nadu Fleet · refreshes every 30s
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Summary chips */}
          <div className="hidden sm:flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-full font-medium">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              {running} Running
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              {onBreak} On Break
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full font-medium">
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              {offline} Offline
            </span>
          </div>
          <button
            onClick={handleRefetch}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            ↻ Refresh
          </button>
          <span className="text-xs text-gray-400 hidden md:block">
            {lastRefresh.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* ── Main Body: Map + Panel ───────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── MAP (65%) ──────────────────────────────────────── */}
        <div className="flex-1 relative">
          {isLoading && allTrucks.length === 0 && (
            <div className="absolute inset-0 z-[1000] bg-white/80 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                <p className="text-sm text-gray-500">Loading vehicle locations…</p>
              </div>
            </div>
          )}
          <MapContainer
            center={[11.1271, 78.6569]}
            zoom={8}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              maxZoom={19}
            />
            <AutoFitBounds trucks={allTrucks} />
            <PanToSelected truck={selected} />
            <MarkerClusterGroup
              chunkedLoading
              maxClusterRadius={60}
              showCoverageOnHover={false}
            >
              {filtered.map(truck => (
                <Marker
                  key={truck.vehicleId}
                  position={[truck.lat, truck.lng]}
                  icon={createTruckIcon(truck.status, truck.registrationNo)}
                  eventHandlers={{
                    click: () => handleSelectTruck(truck),
                  }}
                />
              ))}
            </MarkerClusterGroup>
          </MapContainer>
        </div>

        {/* ── RIGHT PANEL (35%) ──────────────────────────────── */}
        <div className="w-80 xl:w-[360px] flex flex-col border-l border-gray-200 bg-white overflow-hidden flex-shrink-0">
          {selected ? (
            <TruckDetail truck={selected} onBack={() => setSelectedId(null)} />
          ) : (
            <>
              {/* Search */}
              <div className="p-3 border-b border-gray-100">
                <input
                  type="text"
                  placeholder="Search by reg. no. or driver…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Filter chips */}
              <div className="flex gap-1.5 px-3 py-2 border-b border-gray-100 overflow-x-auto">
                {(
                  [
                    { key: 'all', label: `All ${allTrucks.length}`, color: 'gray' },
                    { key: 'running', label: `${running} Running`, color: 'green' },
                    { key: 'on_break', label: `${onBreak} On Break`, color: 'amber' },
                    { key: 'offline', label: `${offline} Offline`, color: 'gray' },
                  ] as const
                ).map(f => (
                  <button
                    key={f.key}
                    onClick={() =>
                      setStatusFilter(f.key as 'all' | TruckStatus)
                    }
                    className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      statusFilter === f.key
                        ? f.color === 'green'
                          ? 'bg-green-500 text-white'
                          : f.color === 'amber'
                          ? 'bg-amber-500 text-white'
                          : 'bg-gray-700 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Vehicle list */}
              <div className="flex-1 overflow-y-auto">
                {isLoading && allTrucks.length === 0 ? (
                  <div className="p-3 space-y-2">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                    <svg
                      className="w-10 h-10 mb-3 opacity-40"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11..."
                      />
                    </svg>
                    <p className="text-sm">No trucks found</p>
                    <p className="text-xs mt-1">Try a different filter</p>
                  </div>
                ) : (
                  <div className="p-3 space-y-2">
                    {filtered.map(truck => (
                      <TruckCard
                        key={truck.vehicleId}
                        truck={truck}
                        isSelected={selectedId === truck.vehicleId}
                        onClick={() => handleSelectTruck(truck)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
