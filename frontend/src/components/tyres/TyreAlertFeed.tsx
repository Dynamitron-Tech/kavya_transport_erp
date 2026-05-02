/**
 * TyreAlertFeed — Unified alert list showing field + sensor alerts.
 * Used in TPMS and TyreTracker dashboards.
 */
import React from 'react';
import { AlertTriangle, AlertOctagon, CheckCircle, Eye } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

export interface AlertItem {
  id: number;
  vehicle_id: number;
  vehicle_number: string;
  position: string;
  alert_type: string;
  severity: string;
  current_value?: number | null;
  threshold_value?: number | null;
  status: string;
  source?: string;
  created_at?: string;
  acknowledged_by?: number | null;
}

interface Props {
  alerts: AlertItem[];
  onRefresh?: () => void;
  maxItems?: number;
  showSource?: boolean;
}

const ALERT_TYPE_LABELS: Record<string, string> = {
  LOW_PSI: 'Low Pressure',
  CRITICAL_PSI: 'Critical Pressure',
  HIGH_TEMP: 'High Temperature',
  LOW_TREAD: 'Low Tread Depth',
  WORN: 'Tyre Worn',
  DAMAGED: 'Tyre Damaged',
  OVERDUE_INSPECTION: 'Overdue Inspection',
  ROTATION_DUE: 'Rotation Due',
};

function timeAgo(iso?: string) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function TyreAlertFeed({ alerts, onRefresh, maxItems = 20, showSource = true }: Props) {
  const { hasRole } = useAuthStore();
  const isAdmin = hasRole('admin');
  const isFM = hasRole('fleet_manager') || isAdmin;
  const qc = useQueryClient();

  const acknowledgeMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/tyre/field-alerts/${id}/acknowledge`, {}),
    onSuccess: () => {
      toast.success('Alert acknowledged');
      qc.invalidateQueries({ queryKey: ['tyre-field-alerts'] });
      onRefresh?.();
    },
    onError: () => toast.error('Failed to acknowledge'),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/tyre/field-alerts/${id}/resolve`, {}),
    onSuccess: () => {
      toast.success('Alert resolved');
      qc.invalidateQueries({ queryKey: ['tyre-field-alerts'] });
      onRefresh?.();
    },
    onError: () => toast.error('Failed to resolve'),
  });

  const visible = alerts.slice(0, maxItems);

  if (!visible.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-gray-400">
        <CheckCircle className="w-8 h-8 text-green-400" />
        <p className="text-sm">No active alerts</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {visible.map(alert => {
        const isCritical = alert.severity === 'CRITICAL';
        return (
          <div
            key={alert.id}
            className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border transition ${
              isCritical ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
            }`}
          >
            {/* Severity icon */}
            <div className="mt-0.5 flex-shrink-0">
              {isCritical
                ? <AlertOctagon className="w-4 h-4 text-red-600" />
                : <AlertTriangle className="w-4 h-4 text-amber-600" />}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                  isCritical ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {isCritical ? 'CRITICAL' : 'WARNING'}
                </span>
                {showSource && alert.source && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                    {alert.source === 'field' ? 'Field' : 'Sensor'}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">
                {alert.vehicle_number} — {alert.position}
              </p>
              <p className="text-xs text-gray-600">
                {ALERT_TYPE_LABELS[alert.alert_type] || alert.alert_type}
                {alert.current_value !== null && alert.current_value !== undefined
                  ? ` (${alert.current_value})`
                  : ''}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{timeAgo(alert.created_at)}</p>
            </div>

            {/* Actions */}
            {alert.status === 'OPEN' && isFM && (
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => acknowledgeMutation.mutate(alert.id)}
                  disabled={acknowledgeMutation.isPending}
                  className="px-2 py-1 text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 rounded font-medium transition"
                >
                  <Eye className="w-3 h-3 inline mr-0.5" />Ack
                </button>
              </div>
            )}
            {alert.status === 'ACKNOWLEDGED' && isAdmin && (
              <button
                onClick={() => resolveMutation.mutate(alert.id)}
                disabled={resolveMutation.isPending}
                className="px-2 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-800 rounded font-medium transition"
              >
                <CheckCircle className="w-3 h-3 inline mr-0.5" />Resolve
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
