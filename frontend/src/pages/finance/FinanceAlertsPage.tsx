import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { financeService } from '@/services/dataService';
import { safeArray } from '@/utils/helpers';
import { Bell, CheckCircle, Eye, AlertTriangle, XCircle, Info } from 'lucide-react';

export default function FinanceAlertsPage() {
  const qc = useQueryClient();
  const [severityFilter, setSeverityFilter] = useState('');
  const [readFilter, setReadFilter] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['finance-alerts', severityFilter, readFilter],
    queryFn: () => financeService.listFinanceAlerts({
      severity: severityFilter || undefined,
      is_read: readFilter === '' ? undefined : readFilter === 'true',
    } as any),
    refetchInterval: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => financeService.markAlertRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finance-alerts'] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (id: number) => financeService.resolveAlert(id),
    onSuccess: () => {
      toast.success('Alert resolved');
      qc.invalidateQueries({ queryKey: ['finance-alerts'] });
    },
  });

  const responseData = (data as any)?.data ?? data;
  const alerts = safeArray(responseData?.items ?? responseData);
  const unreadCount = responseData?.unread_count ?? 0;

  const severityIcon: Record<string, React.ReactNode> = {
    CRITICAL: <XCircle className="w-5 h-5 text-red-500" />,
    WARNING: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    INFO: <Info className="w-5 h-5 text-blue-500" />,
  };

  const severityBg: Record<string, string> = {
    CRITICAL: 'border-l-4 border-l-red-500 bg-red-50',
    WARNING: 'border-l-4 border-l-amber-500 bg-amber-50',
    INFO: 'border-l-4 border-l-blue-500 bg-blue-50',
  };

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Finance Alerts</h1>
          <p className="page-subtitle">
            Overdue invoices, payment reminders, low balances, and compliance alerts
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                {unreadCount} unread
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select className="input-field w-40" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
          <option value="">All Severity</option>
          <option value="CRITICAL">Critical</option>
          <option value="WARNING">Warning</option>
          <option value="INFO">Info</option>
        </select>
        <select className="input-field w-40" value={readFilter} onChange={(e) => setReadFilter(e.target.value)}>
          <option value="">All</option>
          <option value="false">Unread</option>
          <option value="true">Read</option>
        </select>
      </div>

      {/* Alert Cards */}
      <div className="space-y-3">
        {alerts.map((alert: any) => (
          <div
            key={alert.id}
            className={`card p-4 ${severityBg[alert.severity] || 'bg-white'} ${!alert.is_read ? 'shadow-md' : 'opacity-80'}`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">{severityIcon[alert.severity] || <Bell className="w-5 h-5 text-gray-400" />}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className={`text-sm font-semibold ${!alert.is_read ? 'text-gray-900' : 'text-gray-600'}`}>
                    {alert.title}
                  </h3>
                  <span className="text-xs text-gray-400">{alert.alert_type}</span>
                </div>
                {alert.message && (
                  <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                )}
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                  {alert.amount && <span>₹{Number(alert.amount).toLocaleString('en-IN')}</span>}
                  {alert.reference_type && <span>{alert.reference_type} #{alert.reference_id}</span>}
                  <span>{new Date(alert.created_at).toLocaleString('en-IN')}</span>
                </div>
              </div>
              <div className="flex gap-1">
                {!alert.is_read && (
                  <button
                    className="btn-icon text-blue-500"
                    title="Mark as read"
                    onClick={() => markReadMutation.mutate(alert.id)}
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                )}
                <button
                  className="btn-icon text-green-500"
                  title="Resolve"
                  onClick={() => resolveMutation.mutate(alert.id)}
                >
                  <CheckCircle className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {alerts.length === 0 && (
          <div className="card p-12 text-center text-gray-400">
            <Bell className="w-12 h-12 mx-auto mb-4" />
            <p>{isLoading ? 'Loading alerts...' : 'No active alerts'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
