// Recent Activity Feed — Project Associate Dashboard
// Timeline-style feed showing recent actions across jobs, LRs, trips, documents

import { formatDistanceToNow } from 'date-fns';
import {
  FileText, Truck, Package, Upload, CreditCard,
  ChevronRight, AlertCircle, CheckCircle2, MapPin, Activity
} from 'lucide-react';

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  user: string;
  entity_id?: string;
  entity_type?: string;
}

interface Props {
  data: { activities: ActivityItem[] } | undefined;
  isLoading: boolean;
  navigate: (path: string) => void;
}

const activityConfig: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  lr_created: {
    icon: <FileText size={14} />,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  trip_assigned: {
    icon: <Truck size={14} />,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  eway_generated: {
    icon: <Package size={14} />,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  document_uploaded: {
    icon: <Upload size={14} />,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
  },
  payment_received: {
    icon: <CreditCard size={14} />,
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
  job_created: {
    icon: <Package size={14} />,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  approval_pending: {
    icon: <AlertCircle size={14} />,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
  },
  trip_completed: {
    icon: <CheckCircle2 size={14} />,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  location_update: {
    icon: <MapPin size={14} />,
    color: 'text-rose-600',
    bg: 'bg-rose-50',
  },
};

const defaultConfig = {
  icon: <Activity size={14} />,
  color: 'text-gray-600',
  bg: 'bg-gray-50',
};

function formatTime(timestamp: string): string {
  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  } catch {
    return timestamp;
  }
}

function ActivitySkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <div className="w-8 h-8 bg-gray-200 rounded-full flex-shrink-0" />
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PARecentActivity({ data, isLoading, navigate }: Props) {
  const activities = data?.activities || [];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900 text-lg">Recent Activity</h3>
          <p className="text-sm text-gray-500">Latest updates across your tasks</p>
        </div>
        <button
          onClick={() => navigate('/reports')}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
        >
          Full Log <ChevronRight size={16} />
        </button>
      </div>

      {/* Activity Timeline */}
      <div className="px-6 py-4 max-h-[400px] overflow-y-auto scrollbar-thin">
        {isLoading ? (
          <ActivitySkeleton />
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Activity size={32} className="mb-2" />
            <p className="text-sm">No recent activity</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-4 bottom-4 w-px bg-gray-100" />

            <div className="space-y-1">
              {activities.map((activity) => {
                const config = activityConfig[activity.type] || defaultConfig;
                return (
                  <div
                    key={activity.id}
                    className="relative flex gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer group"
                    onClick={() => {
                      if (activity.entity_type === 'job') navigate('/jobs');
                      else if (activity.entity_type === 'trip') navigate('/trips');
                      else if (activity.entity_type === 'lr') navigate('/lr');
                    }}
                  >
                    {/* Icon */}
                    <div
                      className={`relative z-10 w-8 h-8 rounded-full ${config.bg} ${config.color} flex items-center justify-center flex-shrink-0 ring-2 ring-white`}
                    >
                      {config.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900 leading-tight">
                          {activity.title}
                        </p>
                        <span className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0">
                          {formatTime(activity.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                        {activity.description}
                      </p>
                      {activity.user && (
                        <p className="text-[11px] text-gray-400 mt-1">by {activity.user}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
