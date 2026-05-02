import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Bell, Shield, MapPin, Fuel, Wrench, FileWarning,
  Navigation, Clock, CheckCircle, Filter
} from 'lucide-react';
import { KPICard, StatusBadge } from '@/components/common/Modal';
import { fleetService } from '@/services/dataService';
import type { FleetAlert } from '@/types';
import { safeArray } from '@/utils/helpers';

export default function FleetAlertsPage() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['fleet-alerts', typeFilter, severityFilter],
    queryFn: () => fleetService.getAlerts({
      alert_type: typeFilter || undefined,
      severity: severityFilter || undefined,
    }),
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (alertId: string) => fleetService.acknowledgeAlert(alertId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fleet-alerts'] }),
  });

  const alerts: FleetAlert[] = safeArray(data);
  const summary = {
    critical: alerts.filter(a => a.severity === 'critical').length,
    warning: alerts.filter(a => a.severity === 'warning').length,
    info: alerts.filter(a => a.severity === 'info').length,
  };

  const alertIcon = (type: string) => {
    switch (type) {
      case 'overspeed': return <Navigation className="w-5 h-5" />;
      case 'geofence': return <MapPin className="w-5 h-5" />;
      case 'idle_engine': return <Clock className="w-5 h-5" />;
      case 'fuel_drop': return <Fuel className="w-5 h-5" />;
      case 'maintenance_due': return <Wrench className="w-5 h-5" />;
      case 'document_expiry': return <FileWarning className="w-5 h-5" />;
      case 'harsh_braking': return <AlertTriangle className="w-5 h-5" />;
      default: return <Bell className="w-5 h-5" />;
    }
  };

  const severityConfig = (severity: string) => {
    switch (severity) {
      case 'critical': return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: 'text-red-500' };
      case 'warning': return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: 'text-amber-500' };
      default: return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: 'text-blue-500' };
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Alerts Center</h1>
        <p className="page-subtitle">Monitor and manage all fleet alerts — speed, geofence, fuel, maintenance, documents</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard title="Total Alerts" value={data?.total || 0} icon={<Bell className="w-5 h-5" />} color="blue" />
        <KPICard title="Critical" value={summary.critical} icon={<AlertTriangle className="w-5 h-5" />} color="red" />
        <KPICard title="Warnings" value={summary.warning} icon={<Shield className="w-5 h-5" />} color="amber" />
        <KPICard title="Info" value={summary.info} icon={<Bell className="w-5 h-5" />} color="cyan" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-gray-400" />
        <select className="input w-44" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          <option value="overspeed">Overspeed</option>
          <option value="geofence">Geofence</option>
          <option value="idle_engine">Idle Engine</option>
          <option value="fuel_drop">Fuel Drop</option>
          <option value="maintenance_due">Maintenance Due</option>
          <option value="document_expiry">Document Expiry</option>
          <option value="harsh_braking">Harsh Braking</option>
        </select>
        <select className="input w-36" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
          <option value="">All Severity</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
      </div>

      {/* Alert Cards */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-3" />
            <p className="text-gray-500">No alerts match your filters</p>
          </div>
        ) : (
          alerts.map((alert) => {
            const config = severityConfig(alert.severity);
            return (
              <div
                key={alert.id}
                className={`p-4 rounded-xl border ${config.border} ${config.bg} ${alert.acknowledged ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg bg-white shadow-sm ${config.icon}`}>
                    {alertIcon(alert.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className={`font-medium ${config.text}`}>{alert.title}</h4>
                      <StatusBadge status={alert.severity} />
                      {alert.acknowledged && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Acknowledged
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700">{alert.message}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
                      {alert.vehicle && <span className="flex items-center gap-1"><Navigation className="w-3 h-3" />{alert.vehicle}</span>}
                      {alert.driver && <span className="flex items-center gap-1"><Shield className="w-3 h-3" />{alert.driver}</span>}
                      {alert.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{alert.location}</span>}
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(alert.created_at)}</span>
                    </div>
                  </div>
                  {!alert.acknowledged && (
                    <button
                      onClick={() => acknowledgeMutation.mutate(alert.id)}
                      className="btn-secondary text-xs px-3 py-1.5 shrink-0"
                      disabled={acknowledgeMutation.isPending}
                    >
                      Acknowledge
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
