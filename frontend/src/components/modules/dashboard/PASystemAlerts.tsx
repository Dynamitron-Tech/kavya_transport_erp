// ============================================================
// PA System Alerts Widget — Unified alert feed
// Auto-generated alerts: expiry, overdue, inactive, approvals
// ============================================================

import {
  Bell, FileText, Truck, Clock, Receipt,
  Loader2, ShieldAlert, UserX,
  Navigation, X
} from 'lucide-react';

interface SystemAlert {
  id: string;
  alert_type: 'document_expiry' | 'trip_overdue' | 'vehicle_inactive' | 'pending_approval' | 'invoice_overdue' | 'maintenance_due' | 'driver_license' | 'general';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  entity_type?: string;
  entity_id?: number;
  entity_label?: string;
  created_at: string;
  is_acknowledged: boolean;
  action_url?: string;
}

interface AlertsData {
  total: number;
  critical: number;
  warning: number;
  info: number;
  alerts: SystemAlert[];
}

interface Props {
  data: AlertsData | undefined;
  isLoading: boolean;
  navigate: (path: string) => void;
  onAcknowledge?: (alertId: string) => void;
}

const ALERT_ICONS: Record<string, React.ReactNode> = {
  document_expiry:  <FileText size={14} />,
  trip_overdue:     <Navigation size={14} />,
  vehicle_inactive: <Truck size={14} />,
  pending_approval: <Clock size={14} />,
  invoice_overdue:  <Receipt size={14} />,
  maintenance_due:  <ShieldAlert size={14} />,
  driver_license:   <UserX size={14} />,
  general:          <Bell size={14} />,
};

const SEVERITY_STYLES = {
  critical: { bg: 'bg-red-50 border-red-200 hover:bg-red-100/70', icon: 'bg-red-100 text-red-500', dot: 'bg-red-500' },
  warning:  { bg: 'bg-amber-50 border-amber-200 hover:bg-amber-100/70', icon: 'bg-amber-100 text-amber-500', dot: 'bg-amber-500' },
  info:     { bg: 'bg-blue-50 border-blue-200 hover:bg-blue-100/70', icon: 'bg-blue-100 text-blue-500', dot: 'bg-blue-500' },
};

export default function PASystemAlerts({ data, isLoading, navigate, onAcknowledge }: Props) {
  const alerts = data || { total: 0, critical: 0, warning: 0, info: 0, alerts: [] };
  const alertsList = alerts?.alerts;
  const safeAlerts = Array.isArray(alertsList) ? alertsList : [];

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">System Alerts</h3>
          {alerts.total > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
              {alerts.total}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Severity badges */}
          {alerts.critical > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
              {alerts.critical} critical
            </span>
          )}
          {alerts.warning > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600">
              {alerts.warning} warning
            </span>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={24} className="animate-spin text-gray-300" />
        </div>
      ) : (safeAlerts ?? []).length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <p className="text-sm">No system alerts</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
          {(safeAlerts ?? []).slice(0, 12).map((alert) => {
            const severity = SEVERITY_STYLES[alert.severity];
            const icon = ALERT_ICONS[alert.alert_type] || ALERT_ICONS.general;

            return (
              <div
                key={alert.id}
                className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${severity.bg} ${
                  alert.is_acknowledged ? 'opacity-60' : ''
                }`}
                onClick={() => {
                  if (alert.action_url) navigate(alert.action_url);
                }}
              >
                {/* Severity dot */}
                <div className="flex flex-col items-center gap-1 pt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${severity.dot} ${!alert.is_acknowledged ? 'animate-pulse' : ''}`} />
                </div>

                {/* Icon */}
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${severity.icon}`}>
                  {icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 leading-snug">{alert.title}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{alert.message}</p>
                  {alert.entity_label && (
                    <p className="text-[10px] text-gray-400 mt-0.5">{alert.entity_label}</p>
                  )}
                </div>

                {/* Time + dismiss */}
                <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                  <span className="text-[10px] text-gray-400 whitespace-nowrap">{formatTime(alert.created_at)}</span>
                  {!alert.is_acknowledged && onAcknowledge && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAcknowledge(alert.id);
                      }}
                      className="p-0.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
                      title="Dismiss"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      {alerts.total > 8 && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-center">
          <button
            onClick={() => navigate('/alerts')}
            className="text-xs text-primary-600 hover:text-primary-700 font-semibold"
          >
            View all {alerts.total} alerts →
          </button>
        </div>
      )}
    </div>
  );
}
