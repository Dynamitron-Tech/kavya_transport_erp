/**
 * FleetDriverAttendancePage — Fleet Manager view of all drivers with status
 * Mirrors the app's FleetAttendanceDriversScreen
 * Shows: searchable driver list with name, phone, employee code, status badge, assigned vehicle
 * Tap → navigate to /fleet/drivers/:id (existing driver profile)
 * API: GET /fleet/drivers?limit=200 → data: [...]
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Users, Search, X, Truck, ChevronRight, RefreshCw, XCircle } from 'lucide-react';
import api from '@/services/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Driver {
  id: number;
  name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  employee_code?: string;
  employee_id?: string;
  status?: string;
  vehicle_registration?: string;
  assigned_vehicle?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function driverName(d: Driver): string {
  if (d.name) return d.name;
  if (d.first_name || d.last_name) return `${d.first_name ?? ''} ${d.last_name ?? ''}`.trim();
  return `Driver-${d.id}`;
}

function initials(name: string): string {
  return name.trim().split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase() || '?';
}

type StatusKey = 'AVAILABLE' | 'ON_TRIP' | 'OFF_DUTY';

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  AVAILABLE: { label: 'Available', bg: 'bg-green-50', text: 'text-green-700' },
  ON_TRIP:   { label: 'On Trip',   bg: 'bg-blue-50',  text: 'text-blue-700' },
  OFF_DUTY:  { label: 'Off Duty',  bg: 'bg-gray-100', text: 'text-gray-500' },
};

function statusConfig(status?: string) {
  return STATUS_CONFIG[(status ?? '').toUpperCase()] ?? { label: status ?? 'Unknown', bg: 'bg-gray-100', text: 'text-gray-500' };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FleetDriverAttendancePage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['fleet-driver-attendance-list'],
    queryFn: async () => {
      const res = await api.get('/fleet/drivers', { params: { limit: 200 } });
      const payload = (res as any)?.data ?? res;
      if (Array.isArray(payload)) return payload as Driver[];
      if (Array.isArray(payload?.items)) return payload.items as Driver[];
      return [] as Driver[];
    },
  });

  const drivers: Driver[] = data ?? [];

  const q = search.toLowerCase();
  const filtered = q
    ? drivers.filter(d => {
        const name = driverName(d).toLowerCase();
        const phone = (d.phone ?? '').toLowerCase();
        const emp = (d.employee_code ?? d.employee_id ?? '').toLowerCase();
        return name.includes(q) || phone.includes(q) || emp.includes(q);
      })
    : drivers;

  // Summary counts
  const available = drivers.filter(d => (d.status ?? '').toUpperCase() === 'AVAILABLE').length;
  const onTrip    = drivers.filter(d => (d.status ?? '').toUpperCase() === 'ON_TRIP').length;
  const offDuty   = drivers.filter(d => !['AVAILABLE', 'ON_TRIP'].includes((d.status ?? '').toUpperCase())).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Driver Attendance</h1>
        <p className="text-sm text-gray-500 mt-1">All drivers — current status and assignment</p>
      </div>

      {/* Summary cards */}
      {!isLoading && !isError && (
        <div className="grid grid-cols-3 gap-4">
          <SummaryCard label="Available" count={available} color="text-green-600" bg="bg-green-50" />
          <SummaryCard label="On Trip"   count={onTrip}    color="text-blue-600"  bg="bg-blue-50"  />
          <SummaryCard label="Off Duty"  count={offDuty}   color="text-gray-500"  bg="bg-gray-100" />
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input
          type="text"
          placeholder="Search by name, phone or employee code…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading && <LoadingSkeleton />}

      {isError && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-gray-400">
          <XCircle size={48} className="text-red-400" />
          <p className="text-base font-medium text-red-500">Failed to load drivers</p>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
          <Users size={48} />
          <p className="text-base font-medium">
            {search ? 'No drivers match your search' : 'No drivers found'}
          </p>
        </div>
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map(d => {
            const name = driverName(d);
            const sc = statusConfig(d.status);
            const vehicle = d.vehicle_registration ?? d.assigned_vehicle;
            const emp = d.employee_code ?? d.employee_id;

            return (
              <button
                key={d.id}
                onClick={() => navigate(`/fleet/drivers/${d.id}`)}
                className="w-full bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-4 hover:border-orange-300 hover:shadow-sm transition-all text-left"
              >
                {/* Avatar */}
                <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 text-sm font-bold text-indigo-600">
                  {initials(name)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{d.phone ?? '—'}</p>
                  {emp && <p className="text-xs text-gray-400 mt-0.5">{emp}</p>}
                  {vehicle && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                      <Truck size={11} />
                      <span>{vehicle}</span>
                    </div>
                  )}
                </div>

                {/* Status badge */}
                <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${sc.bg} ${sc.text}`}>
                  {sc.label}
                </span>

                <ChevronRight size={16} className="text-gray-400 shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, count, color, bg }: { label: string; count: number; color: string; bg: string }) {
  return (
    <div className={`${bg} rounded-2xl p-4 text-center`}>
      <p className={`text-2xl font-bold ${color}`}>{count}</p>
      <p className="text-xs text-gray-500 mt-1 font-medium">{label}</p>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-4 animate-pulse">
          <div className="w-11 h-11 rounded-xl bg-gray-200 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/3" />
            <div className="h-3 bg-gray-200 rounded w-1/4" />
          </div>
          <div className="w-16 h-6 bg-gray-200 rounded-full" />
        </div>
      ))}
    </div>
  );
}
