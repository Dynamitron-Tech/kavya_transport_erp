/**
 * InspectionCoverageGrid — Grid of all vehicles showing last inspection date and overdue status.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface VehicleCoverage {
  vehicle_id: number;
  registration_number: string;
  vehicle_type: string;
  last_inspection: string | null;
  days_since_inspection: number | null;
  overdue: boolean;
  due_soon: boolean;
}

export default function InspectionCoverageGrid() {
  const { data, isLoading } = useQuery({
    queryKey: ['tyre-inspection-coverage'],
    queryFn: async () => {
      const res = await api.get('/tyre/analytics/inspection-coverage');
      return (res as any)?.data || res;
    },
    refetchInterval: 60000,
  });

  const items: VehicleCoverage[] = data?.items || [];
  const overdueCount = data?.overdue_count || 0;
  const dueSoonCount = data?.due_soon_count || 0;
  const interval = data?.inspection_interval_days || 7;

  if (isLoading) return <div className="text-sm text-gray-400 animate-pulse">Loading coverage...</div>;

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex gap-3 flex-wrap text-sm">
        <span className="flex items-center gap-1 text-red-600 font-medium">
          <AlertTriangle className="w-4 h-4" /> {overdueCount} Overdue
        </span>
        <span className="flex items-center gap-1 text-amber-600 font-medium">
          <Clock className="w-4 h-4" /> {dueSoonCount} Due Soon
        </span>
        <span className="flex items-center gap-1 text-green-600 font-medium">
          <CheckCircle className="w-4 h-4" /> {items.length - overdueCount - dueSoonCount} On Schedule
        </span>
        <span className="text-gray-400 ml-auto">Interval: {interval} days</span>
      </div>

      {/* Vehicle grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
        {items.map(v => {
          const bgColor = v.overdue ? 'bg-red-50 border-red-200' :
            v.due_soon ? 'bg-amber-50 border-amber-200' :
            v.last_inspection ? 'bg-green-50 border-green-200' :
            'bg-gray-50 border-gray-200';

          const textColor = v.overdue ? 'text-red-700' :
            v.due_soon ? 'text-amber-700' :
            v.last_inspection ? 'text-green-700' : 'text-gray-500';

          const statusLabel = v.overdue ? 'Overdue' :
            v.due_soon ? 'Due soon' :
            v.last_inspection ? `${v.days_since_inspection}d ago` : 'Never';

          return (
            <div key={v.vehicle_id} className={`border rounded-lg p-2.5 ${bgColor}`}>
              <p className="font-bold text-sm text-gray-900 truncate">{v.registration_number}</p>
              <p className="text-xs text-gray-500">{v.vehicle_type}</p>
              <p className={`text-xs font-semibold mt-1 ${textColor}`}>{statusLabel}</p>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="col-span-full text-center text-sm text-gray-400 py-6">No vehicles found</div>
        )}
      </div>
    </div>
  );
}
