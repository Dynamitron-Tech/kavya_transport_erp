/**
 * ReplacementForecastTable — Predicted tyre replacement dates, sorted by urgency.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { AlertTriangle, Info } from 'lucide-react';

interface ForecastRow {
  tyre_id: number;
  registration_number: string;
  position: string;
  current_tread_mm: number;
  predicted_replacement_date: string | null;
  days_remaining: number | null;
  km_remaining: number | null;
  reason: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
}

export default function ReplacementForecastTable() {
  const [days, setDays] = useState(90);

  const { data, isLoading } = useQuery({
    queryKey: ['tyre-predictions', days],
    queryFn: async () => {
      const res = await api.get('/tyre/analytics/predictions', { params: { days } });
      return (res as any)?.data || res;
    },
    refetchInterval: 300000,
  });

  const rows: ForecastRow[] = data?.predictions || [];

  const urgencyStyle: Record<string, string> = {
    critical: 'bg-red-100 text-red-700 font-bold',
    high: 'bg-orange-100 text-orange-700 font-semibold',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-green-100 text-green-700',
  };

  if (isLoading) return <div className="text-sm text-gray-400 animate-pulse">Loading forecast...</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-500 flex items-center gap-1">
          <Info className="w-4 h-4" /> Forecast window:
        </p>
        <div className="flex gap-2">
          {[30, 60, 90, 180].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`text-xs px-3 py-1 rounded-full border transition ${
                days === d
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'text-gray-600 border-gray-300 hover:border-blue-400'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-sm text-gray-400 text-center py-6">
          No replacements predicted in the next {days} days.
        </div>
      ) : (
        <div className="overflow-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide font-semibold">
              <tr>
                <th className="px-4 py-2 text-left">Vehicle</th>
                <th className="px-4 py-2 text-left">Position</th>
                <th className="px-4 py-2 text-right">Tread (mm)</th>
                <th className="px-4 py-2 text-right">Days Left</th>
                <th className="px-4 py-2 text-right">KM Left</th>
                <th className="px-4 py-2 text-left">Reason</th>
                <th className="px-4 py-2 text-center">Urgency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(row => (
                <tr key={row.tyre_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{row.registration_number}</td>
                  <td className="px-4 py-2 text-gray-600 uppercase text-xs">{row.position}</td>
                  <td className="px-4 py-2 text-right text-gray-700">
                    {row.current_tread_mm != null ? Number(row.current_tread_mm).toFixed(1) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700">
                    {row.days_remaining !== null ? `${row.days_remaining}d` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700">
                    {row.km_remaining !== null ? `${row.km_remaining.toLocaleString()} km` : '—'}
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs max-w-[160px] truncate" title={row.reason}>
                    {row.reason}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${urgencyStyle[row.urgency] || ''}`}>
                      {row.urgency === 'critical' && <AlertTriangle className="inline w-3 h-3 mr-0.5" />}
                      {row.urgency}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
