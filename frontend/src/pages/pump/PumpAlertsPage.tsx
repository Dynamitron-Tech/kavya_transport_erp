import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { fuelPumpService } from '@/services/fuelPumpService';

export default function PumpAlertsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [resolving, setResolving] = useState<number | null>(null);
  const [resolution, setResolution] = useState({ status: 'resolved', resolution_notes: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['fuel-alerts', page, statusFilter],
    queryFn: () => fuelPumpService.getAlerts({ page, limit: 20, ...(statusFilter ? { status: statusFilter } : {}) }),
  });

  const alerts = data?.data || [];
  const pagination = data?.pagination;

  const resolveMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => fuelPumpService.resolveAlert(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['pump-dashboard'] });
      toast.success('Alert updated');
      setResolving(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to resolve alert');
    },
  });

  const severityColors: Record<string, string> = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200',
  };

  const statusColors: Record<string, string> = {
    open: 'bg-red-100 text-red-700',
    investigating: 'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-orange-100 text-orange-700',
    false_alarm: 'bg-gray-100 text-gray-700',
    resolved: 'bg-green-100 text-green-700',
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Fuel Theft Alerts</h1>
        <p className="text-sm text-gray-500">Anomaly detection and investigation</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="confirmed">Confirmed</option>
          <option value="false_alarm">False Alarm</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center text-gray-400 py-8">Loading...</div>
        ) : alerts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <CheckCircle className="mx-auto text-green-400 mb-3" size={48} />
            <p className="text-gray-500">No alerts found</p>
          </div>
        ) : (
          alerts.map((alert: any) => (
            <div
              key={alert.id}
              className={`rounded-xl border p-4 ${severityColors[alert.severity] || 'bg-gray-50 border-gray-200'}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <AlertTriangle className={alert.severity === 'critical' ? 'text-red-600' : 'text-yellow-600'} size={20} />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">{alert.alert_type.replace('_', ' ')}</span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[alert.status] || ''}`}>
                        {alert.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{alert.description}</p>
                    <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                      <span>Vehicle: {alert.vehicle_registration || `#${alert.vehicle_id}`}</span>
                      {alert.driver_name && <span>Driver: {alert.driver_name}</span>}
                      {alert.expected_litres && <span>Expected: {Number(alert.expected_litres).toFixed(1)}L</span>}
                      {alert.actual_litres && <span>Actual: {Number(alert.actual_litres).toFixed(1)}L</span>}
                      {alert.deviation_pct && <span>Deviation: {Number(alert.deviation_pct).toFixed(1)}%</span>}
                      <span>{new Date(alert.created_at).toLocaleDateString('en-IN')}</span>
                    </div>

                    {alert.resolution_notes && (
                      <div className="mt-2 text-xs text-gray-600 bg-white/50 rounded p-2">
                        Resolution: {alert.resolution_notes}
                      </div>
                    )}
                  </div>
                </div>

                {alert.status === 'open' || alert.status === 'investigating' ? (
                  <button
                    onClick={() => {
                      setResolving(alert.id);
                      setResolution({ status: 'resolved', resolution_notes: '' });
                    }}
                    className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-1"
                  >
                    <Eye size={14} /> Resolve
                  </button>
                ) : null}
              </div>

              {/* Resolve Form */}
              {resolving === alert.id && (
                <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200 space-y-3">
                  <div className="flex gap-3">
                    <select
                      value={resolution.status}
                      onChange={(e) => setResolution({ ...resolution, status: e.target.value })}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="resolved">Resolved</option>
                      <option value="confirmed">Confirmed Theft</option>
                      <option value="false_alarm">False Alarm</option>
                      <option value="investigating">Under Investigation</option>
                    </select>
                    <input
                      type="text"
                      value={resolution.resolution_notes}
                      onChange={(e) => setResolution({ ...resolution, resolution_notes: e.target.value })}
                      placeholder="Resolution notes..."
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setResolving(null)}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => resolveMutation.mutate({ id: alert.id, data: resolution })}
                      disabled={resolveMutation.isPending}
                      className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs hover:bg-primary-700 disabled:opacity-50"
                    >
                      {resolveMutation.isPending ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Page {pagination.page} of {pagination.pages}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded disabled:opacity-50">Previous</button>
            <button disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
