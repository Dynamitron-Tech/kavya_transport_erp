/**
 * DriverTyreHistoryPage — Driver's past inspection readings grouped by date.
 * Route: /driver/tyre-history
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { ArrowLeft, ChevronDown, ChevronUp, Gauge, Ruler } from 'lucide-react';

interface ReadingRow {
  id: number;
  vehicle_id: number;
  registration_number: string;
  position: string;
  psi: number | null;
  tread_depth_mm: number | null;
  condition: string;
  temperature_c: number | null;
  notes: string | null;
  odometer_at_reading: number | null;
  created_at: string;
}

function groupByDate(readings: ReadingRow[]): Map<string, ReadingRow[]> {
  const map = new Map<string, ReadingRow[]>();
  readings.forEach(r => {
    const day = r.created_at ? r.created_at.slice(0, 10) : 'Unknown';
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(r);
  });
  return map;
}

const conditionColors: Record<string, string> = {
  GOOD: 'bg-green-100 text-green-700',
  AVERAGE: 'bg-amber-100 text-amber-700',
  WORN: 'bg-orange-100 text-orange-700',
  DAMAGED: 'bg-red-100 text-red-700',
};

export default function DriverTyreHistoryPage() {
  const { user } = useAuthStore();
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['driver-tyre-readings', user?.id],
    queryFn: async () => {
      const res = await api.get('/tyre/readings', { params: { driver_id: user?.id, limit: 100 } });
      return (res as any)?.data?.items || (res as any)?.items || [];
    },
    enabled: !!user?.id,
  });

  const readings: ReadingRow[] = data || [];
  const grouped = groupByDate(readings);
  const sortedDates = Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a));

  const toggleDate = (date: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return d; }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Link to="/driver/tyre" className="p-1.5 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-base font-bold text-gray-900">Inspection History</h1>
          <p className="text-xs text-gray-500">{readings.length} total readings</p>
        </div>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl h-14 animate-pulse" />
            ))}
          </div>
        ) : sortedDates.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">No inspections yet.</p>
            <Link to="/driver/tyre" className="text-blue-600 text-sm mt-2 inline-block">Start inspecting →</Link>
          </div>
        ) : (
          sortedDates.map(date => {
            const dayReadings = grouped.get(date)!;
            const isExpanded = expandedDates.has(date);
            const vehicles = [...new Set(dayReadings.map(r => r.registration_number))];

            return (
              <div key={date} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                  onClick={() => toggleDate(date)}
                >
                  <div className="text-left">
                    <p className="font-semibold text-sm text-gray-900">{formatDate(date)}</p>
                    <p className="text-xs text-gray-500">
                      {dayReadings.length} reading{dayReadings.length > 1 ? 's' : ''} · {vehicles.join(', ')}
                    </p>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 divide-y divide-gray-100">
                    {dayReadings.map(r => (
                      <div key={r.id} className="px-4 py-3 flex items-start gap-3">
                        <div className="w-12 text-center">
                          <p className="text-xs font-bold uppercase text-gray-700">{r.position}</p>
                          <p className="text-xs text-gray-400">{r.registration_number}</p>
                        </div>
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center gap-3 flex-wrap">
                            {r.psi !== null && (
                              <span className="flex items-center gap-1 text-xs text-gray-600">
                                <Gauge className="w-3 h-3" /> {r.psi} PSI
                              </span>
                            )}
                            {r.tread_depth_mm !== null && (
                              <span className="flex items-center gap-1 text-xs text-gray-600">
                                <Ruler className="w-3 h-3" /> {r.tread_depth_mm} mm
                              </span>
                            )}
                            {r.temperature_c !== null && (
                              <span className="text-xs text-gray-600">🌡 {r.temperature_c}°C</span>
                            )}
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${conditionColors[r.condition] || 'bg-gray-100 text-gray-600'}`}>
                              {r.condition}
                            </span>
                          </div>
                          {r.notes && <p className="text-xs text-gray-500 italic">"{r.notes}"</p>}
                          {r.odometer_at_reading && (
                            <p className="text-xs text-gray-400">ODO: {r.odometer_at_reading.toLocaleString()} km</p>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 whitespace-nowrap">
                          {r.created_at ? new Date(r.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
