/**
 * DriverComplianceTable — Ranked table of drivers by inspection compliance.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { BadgeCheck, AlertTriangle } from 'lucide-react';

interface DriverRow {
  driver_id: number;
  driver_name: string;
  readings_last_30_days: number;
  expected_readings: number;
  compliance_pct: number;
  last_inspection: string | null;
}

export default function DriverComplianceTable() {
  const { data, isLoading } = useQuery({
    queryKey: ['tyre-driver-compliance'],
    queryFn: async () => {
      const res = await api.get('/tyre/analytics/driver-compliance');
      return (res as any)?.data || res;
    },
    refetchInterval: 120000,
  });

  const rows: DriverRow[] = data?.drivers || [];

  if (isLoading) return <div className="text-sm text-gray-400 animate-pulse">Loading compliance data...</div>;
  if (!rows.length) return <div className="text-sm text-gray-400 py-4 text-center">No driver data available.</div>;

  return (
    <div className="overflow-auto rounded-lg border border-gray-200">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-gray-600 font-semibold text-xs uppercase tracking-wide">
          <tr>
            <th className="px-4 py-2 text-left">#</th>
            <th className="px-4 py-2 text-left">Driver</th>
            <th className="px-4 py-2 text-right">Inspections</th>
            <th className="px-4 py-2 text-right">Compliance</th>
            <th className="px-4 py-2 text-right">Last Inspection</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, idx) => {
            const pct = row.compliance_pct;
            const barColor = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
            const textColor = pct >= 80 ? 'text-green-700' : pct >= 50 ? 'text-amber-700' : 'text-red-600';

            let lastInspLabel = '—';
            if (row.last_inspection) {
              const days = Math.floor((Date.now() - new Date(row.last_inspection).getTime()) / 86400000);
              lastInspLabel = days === 0 ? 'Today' : `${days}d ago`;
            }

            return (
              <tr key={row.driver_id} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-400">{idx + 1}</td>
                <td className="px-4 py-2 font-medium text-gray-900">
                  {row.compliance_pct >= 80
                    ? <BadgeCheck className="w-4 h-4 inline mr-1 text-green-500" />
                    : <AlertTriangle className="w-4 h-4 inline mr-1 text-amber-500" />
                  }
                  {row.driver_name}
                </td>
                <td className="px-4 py-2 text-right text-gray-600">
                  {row.readings_last_30_days} / {row.expected_readings}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${barColor}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <span className={`font-bold ${textColor} w-10 text-right`}>{pct}%</span>
                  </div>
                </td>
                <td className="px-4 py-2 text-right text-gray-500">
                  {lastInspLabel}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
