// ============================================================
// PA Trip Workflow Widget — Status-driven trip pipeline
// Shows trips in each workflow stage with counts
// Dispatched → In Transit → Completed → Closed
// ============================================================

import {
  Navigation, Send, Truck, CheckCircle, Lock,
  ChevronRight, Loader2, AlertTriangle
} from 'lucide-react';

interface TripStage {
  status: string;
  label: string;
  count: number;
  trips: TripSummary[];
}

interface TripSummary {
  id: number;
  trip_number: string;
  origin: string;
  destination: string;
  vehicle_number?: string;
  driver_name?: string;
  status: string;
  planned_start?: string;
  is_overdue?: boolean;
}

interface TripWorkflowData {
  stages: TripStage[];
  total_active: number;
  overdue_count: number;
}

interface Props {
  data: TripWorkflowData | undefined;
  isLoading: boolean;
  navigate: (path: string) => void;
}

const DEFAULT_STAGES: TripStage[] = [
  { status: 'draft', label: 'Draft', count: 0, trips: [] },
  { status: 'approved', label: 'Approved', count: 0, trips: [] },
  { status: 'dispatched', label: 'Dispatched', count: 0, trips: [] },
  { status: 'in_transit', label: 'In Transit', count: 0, trips: [] },
  { status: 'completed', label: 'Completed', count: 0, trips: [] },
  { status: 'closed', label: 'Closed', count: 0, trips: [] },
];

const STAGE_LABELS: Record<string, string> = {
  draft: 'Draft',
  approved: 'Approved',
  dispatched: 'Dispatched',
  in_transit: 'In Transit',
  completed: 'Completed',
  closed: 'Closed',
};

const normalizeWorkflow = (data: unknown): TripWorkflowData => {
  // Backend fallback currently returns an array of {status, count}; normalize that into stages.
  if (Array.isArray(data)) {
    const countByStatus = new Map<string, number>();
    for (const row of data) {
      const status = typeof row?.status === 'string' ? row.status : '';
      const count = typeof row?.count === 'number' ? row.count : Number(row?.count ?? 0);
      if (status) {
        countByStatus.set(status, Number.isFinite(count) ? count : 0);
      }
    }

    const stages = DEFAULT_STAGES.map((stage) => ({
      ...stage,
      label: STAGE_LABELS[stage.status] ?? stage.label,
      count: countByStatus.get(stage.status) ?? 0,
      trips: [],
    }));

    const total_active = stages
      .filter((stage) => ['approved', 'dispatched', 'in_transit'].includes(stage.status))
      .reduce((sum, stage) => sum + stage.count, 0);

    return { stages, total_active, overdue_count: 0 };
  }

  const safe = (data ?? {}) as Partial<TripWorkflowData>;
  const stages = Array.isArray(safe.stages)
    ? safe.stages.map((stage) => ({
      status: stage?.status ?? 'draft',
      label: stage?.label ?? STAGE_LABELS[stage?.status ?? ''] ?? 'Stage',
      count: typeof stage?.count === 'number' ? stage.count : Number(stage?.count ?? 0),
      trips: Array.isArray(stage?.trips) ? stage.trips : [],
    }))
    : DEFAULT_STAGES;

  return {
    stages,
    total_active: typeof safe.total_active === 'number' ? safe.total_active : 0,
    overdue_count: typeof safe.overdue_count === 'number' ? safe.overdue_count : 0,
  };
};

const STAGE_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string; ring: string }> = {
  draft:       { icon: <Navigation size={16} />,  color: 'text-gray-500',    bg: 'bg-gray-50',     ring: 'ring-gray-200' },
  approved:    { icon: <CheckCircle size={16} />,  color: 'text-blue-600',    bg: 'bg-blue-50',     ring: 'ring-blue-200' },
  dispatched:  { icon: <Send size={16} />,         color: 'text-purple-600',  bg: 'bg-purple-50',   ring: 'ring-purple-200' },
  in_transit:  { icon: <Truck size={16} />,        color: 'text-indigo-600',  bg: 'bg-indigo-50',   ring: 'ring-indigo-200' },
  completed:   { icon: <CheckCircle size={16} />,  color: 'text-emerald-600', bg: 'bg-emerald-50',  ring: 'ring-emerald-200' },
  closed:      { icon: <Lock size={16} />,         color: 'text-gray-600',    bg: 'bg-gray-100',    ring: 'ring-gray-300' },
};

export default function PATripWorkflow({ data, isLoading, navigate }: Props) {
  const workflow = normalizeWorkflow(data);

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900">Trip Workflow Pipeline</h3>
          {workflow.overdue_count > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
              <AlertTriangle size={10} /> {workflow.overdue_count} overdue
            </span>
          )}
        </div>
        <button
          onClick={() => navigate('/trips')}
          className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
        >
          Manage Trips <ChevronRight size={12} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 size={24} className="animate-spin text-gray-300" />
        </div>
      ) : (
        <>
          {/* Stage pipeline — horizontal */}
          <div className="flex items-stretch gap-1 mb-5 overflow-x-auto pb-1">
            {workflow.stages.map((stage, idx) => {
              const cfg = STAGE_CONFIG[stage.status] || STAGE_CONFIG.draft;
              return (
                <button
                  key={stage.status}
                  onClick={() => navigate(`/trips?status=${stage.status}`)}
                  className={`flex-1 min-w-[100px] text-center p-3 rounded-xl ${cfg.bg} border border-transparent hover:border-gray-200 transition-all group relative`}
                >
                  <div className={`w-8 h-8 rounded-lg mx-auto flex items-center justify-center ${cfg.color} mb-1.5`}>
                    {cfg.icon}
                  </div>
                  <p className="text-xl font-bold text-gray-900">{stage.count}</p>
                  <p className="text-[10px] text-gray-500 font-medium mt-0.5">{stage.label}</p>

                  {/* Arrow connector */}
                  {idx < workflow.stages.length - 1 && (
                    <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 text-gray-300 z-10">
                      <ChevronRight size={14} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active trips mini-list (in_transit + dispatched) */}
          {(() => {
            const activeTrips = workflow.stages
              .filter(s => ['dispatched', 'in_transit'].includes(s.status))
              .flatMap(s => s.trips)
              .slice(0, 5);

            if (activeTrips.length === 0) return null;

            return (
              <div className="border-t border-gray-100 pt-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Active Trips</p>
                <div className="space-y-1.5">
                  {activeTrips.map((trip) => (
                    <div
                      key={trip.id}
                      onClick={() => navigate(`/trips/${trip.id}`)}
                      className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group"
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        trip.is_overdue ? 'bg-red-50' : 'bg-blue-50'
                      }`}>
                        {trip.is_overdue
                          ? <AlertTriangle size={13} className="text-red-500" />
                          : <Truck size={13} className="text-blue-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-gray-800">{trip.trip_number}</p>
                          {trip.is_overdue && (
                            <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-red-100 text-red-600">OVERDUE</span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 truncate">
                          {trip.origin} → {trip.destination}
                          {trip.vehicle_number && ` • ${trip.vehicle_number}`}
                        </p>
                      </div>
                      <ChevronRight size={12} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
