// Action Center — Project Associate Dashboard
// "My Action Required" — operational control panel

import { useState } from 'react';
import {
  FileText, Shield, Upload, XCircle, CreditCard,
  ChevronRight, AlertCircle, ChevronDown, ChevronUp,
  Zap
} from 'lucide-react';

interface ActionItem {
  id: number;
  type: string;
  title: string;
  count: number;
  priority: string;
  description: string;
  items: any[];
}

interface Props {
  data: { actions: ActionItem[] } | undefined;
  isLoading: boolean;
  navigate: (path: string) => void;
}

const actionIcons: Record<string, React.ReactNode> = {
  create_lr: <FileText size={20} className="text-emerald-600" />,
  generate_eway: <Shield size={20} className="text-amber-600" />,
  upload_documents: <Upload size={20} className="text-cyan-600" />,
  close_trip: <XCircle size={20} className="text-rose-600" />,
  banking_entry: <CreditCard size={20} className="text-purple-600" />,
};

const actionColors: Record<string, string> = {
  create_lr: 'border-emerald-200 bg-emerald-50',
  generate_eway: 'border-amber-200 bg-amber-50',
  upload_documents: 'border-cyan-200 bg-cyan-50',
  close_trip: 'border-rose-200 bg-rose-50',
  banking_entry: 'border-purple-200 bg-purple-50',
};

const priorityBadge: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-gray-100 text-gray-600',
};

function ActionSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-16 bg-gray-100 rounded-xl" />
      ))}
    </div>
  );
}

export default function PAActionCenter({ data, isLoading, navigate }: Props) {
  const [expandedAction, setExpandedAction] = useState<number | null>(null);

  const totalActions = data?.actions?.reduce((sum, a) => sum + a.count, 0) || 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-50 rounded-xl">
            <Zap size={20} className="text-red-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-lg">My Action Required</h3>
            <p className="text-sm text-gray-500">{totalActions} items need your attention</p>
          </div>
        </div>
        {totalActions > 0 && (
          <span className="bg-red-100 text-red-700 text-sm font-bold px-3 py-1 rounded-full">
            {totalActions}
          </span>
        )}
      </div>

      {/* Action Items */}
      <div className="p-4 space-y-3">
        {isLoading ? (
          <ActionSkeleton />
        ) : (
          data?.actions?.map((action) => (
            <div
              key={action.id}
              className={`rounded-xl border transition-all duration-200 ${actionColors[action.type] || 'border-gray-200 bg-gray-50'}`}
            >
              {/* Action Header */}
              <button
                onClick={() => setExpandedAction(expandedAction === action.id ? null : action.id)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {actionIcons[action.type] || <AlertCircle size={20} className="text-gray-500" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{action.count} {action.title}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${priorityBadge[action.priority]}`}>
                        {action.priority}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{action.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-gray-900">{action.count}</span>
                  {expandedAction === action.id ? (
                    <ChevronUp size={18} className="text-gray-400" />
                  ) : (
                    <ChevronDown size={18} className="text-gray-400" />
                  )}
                </div>
              </button>

              {/* Expanded Details */}
              {expandedAction === action.id && action.items.length > 0 && (
                <div className="px-4 pb-4 border-t border-gray-200/60">
                  <div className="space-y-2 mt-3">
                    {action.items.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100 hover:border-gray-300 cursor-pointer transition-colors group"
                        onClick={() => {
                          if (item.job_number) navigate(`/jobs`);
                          else if (item.trip_number) navigate(`/trips`);
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">
                              {item.job_number || item.trip_number}
                            </span>
                            {item.client && (
                              <span className="text-xs text-gray-400">• {item.client}</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">
                            {item.origin && item.destination
                              ? `${item.origin} → ${item.destination}`
                              : item.document_type
                              ? `Document: ${item.document_type}`
                              : item.vehicle
                              ? `${item.vehicle} • ${item.driver}`
                              : item.amount
                              ? `₹${Number(item.amount ?? 0).toLocaleString('en-IN')}`
                              : ''}
                          </p>
                        </div>
                        <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-600 transition-colors" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
