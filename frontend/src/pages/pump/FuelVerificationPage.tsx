import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, AlertTriangle, XCircle, Fuel, RefreshCw, Filter } from 'lucide-react';
import { fuelPumpService } from '@/services/fuelPumpService';

type VerificationStatus = 'MATCHED' | 'MISMATCH' | 'PUMP_ONLY' | 'DRIVER_ONLY';

interface VerificationRecord {
  issue_id: number | null;
  vehicle_id: number;
  registration_number: string | null;
  issue_date: string;
  quantity_litres: number | null;
  pump_amount: number | null;
  driver_amount: number | null;
  variance_pct: number | null;
  status: VerificationStatus;
  is_flagged: boolean;
  receipt_number: string | null;
}

const STATUS_CONFIG: Record<VerificationStatus, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  MATCHED: {
    label: 'Matched',
    bg: 'bg-green-100',
    text: 'text-green-700',
    icon: <CheckCircle size={14} />,
  },
  MISMATCH: {
    label: 'Mismatch',
    bg: 'bg-red-100',
    text: 'text-red-700',
    icon: <XCircle size={14} />,
  },
  PUMP_ONLY: {
    label: 'Pump Only',
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    icon: <AlertTriangle size={14} />,
  },
  DRIVER_ONLY: {
    label: 'Driver Only',
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    icon: <AlertTriangle size={14} />,
  },
};

export default function FuelVerificationPage() {
  const [days, setDays] = useState(30);
  const [filterStatus, setFilterStatus] = useState<string>('');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['fuel-verification', days],
    queryFn: () => fuelPumpService.getVerification(days),
  });

  const records: VerificationRecord[] = data?.data || [];

  const filtered = filterStatus
    ? records.filter((r) => r.status === filterStatus)
    : records;

  const counts = {
    MATCHED: records.filter((r) => r.status === 'MATCHED').length,
    MISMATCH: records.filter((r) => r.status === 'MISMATCH').length,
    PUMP_ONLY: records.filter((r) => r.status === 'PUMP_ONLY').length,
    DRIVER_ONLY: records.filter((r) => r.status === 'DRIVER_ONLY').length,
  };

  const totalVariance = records
    .filter((r) => r.status === 'MISMATCH' && r.pump_amount && r.driver_amount)
    .reduce((sum, r) => sum + Math.abs((r.pump_amount ?? 0) - (r.driver_amount ?? 0)), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Fuel size={24} className="text-amber-500" />
            Fuel Audit &amp; Verification
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Cross-verify depot fuel issues against driver expense claims
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {([
          { key: 'MATCHED', label: 'Matched', color: 'green' },
          { key: 'MISMATCH', label: 'Mismatch', color: 'red' },
          { key: 'PUMP_ONLY', label: 'Pump Only', color: 'amber' },
          { key: 'DRIVER_ONLY', label: 'Driver Only', color: 'blue' },
        ] as const).map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => setFilterStatus(filterStatus === key ? '' : key)}
            className={`bg-white rounded-xl border-2 p-4 text-left transition ${
              filterStatus === key ? `border-${color}-400` : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className={`text-2xl font-bold text-${color}-600`}>{counts[key]}</div>
            <div className="text-sm text-gray-600 mt-1">{label}</div>
            {key === 'MISMATCH' && totalVariance > 0 && (
              <div className="text-xs text-red-500 mt-0.5">
                ₹{totalVariance.toLocaleString('en-IN', { maximumFractionDigits: 0 })} variance
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Active filter badge */}
      {filterStatus && (
        <div className="flex items-center gap-2 text-sm">
          <Filter size={14} className="text-gray-500" />
          <span className="text-gray-600">Filtering by:</span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[filterStatus as VerificationStatus].bg} ${STATUS_CONFIG[filterStatus as VerificationStatus].text}`}>
            {STATUS_CONFIG[filterStatus as VerificationStatus].icon}
            {STATUS_CONFIG[filterStatus as VerificationStatus].label}
          </span>
          <button onClick={() => setFilterStatus('')} className="text-gray-400 hover:text-gray-600 text-xs underline">
            Clear
          </button>
        </div>
      )}

      {/* Verification Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            Fuel Records — {filtered.length} entries
          </h2>
          <span className="text-xs text-gray-400">
            {filterStatus ? `Filtered from ${records.length} total` : `Last ${days} days`}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Vehicle</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Qty (L)</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Pump ₹</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Driver ₹</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Variance</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    Loading verification data…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    {filterStatus ? 'No records match this filter' : 'No fuel records found for this period'}
                  </td>
                </tr>
              ) : (
                filtered.map((rec, idx) => {
                  const cfg = STATUS_CONFIG[rec.status];
                  return (
                    <tr
                      key={rec.issue_id ?? `driver-${idx}`}
                      className={`hover:bg-gray-50 ${rec.is_flagged ? 'bg-red-50' : ''}`}
                    >
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                        {new Date(rec.issue_date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">
                          {rec.registration_number ?? `Vehicle #${rec.vehicle_id}`}
                        </span>
                        {rec.is_flagged && (
                          <span className="ml-1 text-xs text-red-500">⚠ flagged</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {rec.quantity_litres != null ? `${rec.quantity_litres.toFixed(1)}L` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {rec.pump_amount != null
                          ? `₹${rec.pump_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {rec.driver_amount != null
                          ? `₹${rec.driver_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {rec.variance_pct != null ? (
                          <span
                            className={`font-medium ${
                              rec.variance_pct <= 5
                                ? 'text-green-600'
                                : rec.variance_pct <= 10
                                ? 'text-amber-600'
                                : 'text-red-600'
                            }`}
                          >
                            {rec.variance_pct.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}
                        >
                          {cfg.icon}
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {rec.receipt_number ?? '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            Matched: pump &amp; driver amounts within 10%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            Mismatch: amounts differ &gt;10%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
            Pump Only: driver did not submit expense
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
            Driver Only: no depot fuel issue found
          </span>
        </div>
      </div>
    </div>
  );
}
