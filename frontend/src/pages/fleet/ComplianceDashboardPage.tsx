import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield, AlertTriangle, CheckCircle, Clock, FileWarning,
  Activity, Truck, User, Filter, ChevronDown, ChevronUp,
  Eye, XCircle, Zap, Bell, BarChart3
} from 'lucide-react';
import { KPICard, Modal, EmptyState, LoadingSpinner, TabPills } from '@/components/common/Modal';
import { complianceService } from '@/services/dataService';
import type { ComplianceAlertRecord, DriverEvent, AuditNote, ComplianceAlertSummary } from '@/types';
import { safeArray } from '@/utils/helpers';

const SEVERITY_CONFIG: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: 'text-red-500' },
  high: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', icon: 'text-orange-500' },
  medium: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: 'text-amber-500' },
  low: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: 'text-blue-500' },
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  harsh_brake: 'Harsh Braking',
  harsh_accel: 'Harsh Acceleration',
  overspeed: 'Overspeed',
  night_driving: 'Night Driving',
  excessive_idle: 'Excessive Idle',
  geofence_breach: 'Geofence Breach',
  unauthorized_halt: 'Unauthorized Halt',
  sos: 'SOS Emergency',
};

const EVENT_TYPE_ICONS: Record<string, typeof AlertTriangle> = {
  harsh_brake: Zap,
  harsh_accel: Activity,
  overspeed: AlertTriangle,
  night_driving: Clock,
  excessive_idle: Clock,
  geofence_breach: Shield,
  unauthorized_halt: XCircle,
  sos: Bell,
};

export default function ComplianceDashboardPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('alerts');
  const [severityFilter, setSeverityFilter] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [resolvedFilter, setResolvedFilter] = useState<string>('false');
  const [expandedAlertId, setExpandedAlertId] = useState<number | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  // Queries
  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: ['compliance-alerts', severityFilter, resolvedFilter],
    queryFn: () => complianceService.listAlerts({
      ...(severityFilter ? { severity: severityFilter } : {}),
      ...(resolvedFilter !== '' ? { resolved: resolvedFilter } : {}),
      page_size: 50,
    }),
    enabled: activeTab === 'alerts',
  });

  const { data: summary } = useQuery<ComplianceAlertSummary>({
    queryKey: ['compliance-alert-summary'],
    queryFn: () => complianceService.getAlertSummary(),
  });

  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ['driver-events', eventTypeFilter],
    queryFn: () => complianceService.listEvents({
      ...(eventTypeFilter ? { event_type: eventTypeFilter } : {}),
      page_size: 50,
    }),
    enabled: activeTab === 'events',
  });

  const { data: ais140Report, isLoading: ais140Loading } = useQuery({
    queryKey: ['ais140-report'],
    queryFn: () => complianceService.getFleetComplianceReport(),
    enabled: activeTab === 'ais140',
  });

  const { data: auditNotesData, isLoading: auditLoading } = useQuery({
    queryKey: ['audit-notes'],
    queryFn: () => complianceService.listAuditNotes({ page_size: 50 }),
    enabled: activeTab === 'audit',
  });

  // Mutations
  const resolveAlertMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) => complianceService.resolveAlert(id, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compliance-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['compliance-alert-summary'] });
      setResolvingId(null);
      setResolveNotes('');
    },
  });

  const resolveNoteMutation = useMutation({
    mutationFn: (id: number) => complianceService.resolveAuditNote(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['audit-notes'] }),
  });

  const alerts: ComplianceAlertRecord[] = safeArray(alertsData);
  const events: DriverEvent[] = safeArray(eventsData);
  const auditNotes: AuditNote[] = safeArray(auditNotesData);

  const tabs = [
    { key: 'alerts', label: `Alerts${summary ? ` (${summary.total})` : ''}` },
    { key: 'events', label: 'Driver Events' },
    { key: 'ais140', label: 'AIS-140 Compliance' },
    { key: 'audit', label: 'Audit Notes' },
  ];

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
        <h1 className="page-title">Compliance Dashboard</h1>
        <p className="page-subtitle">
          AIS-140 compliance, alerts, driver safety events, and audit trail
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <KPICard title="Critical" value={summary?.critical ?? 0} icon={<AlertTriangle className="w-5 h-5" />} color="red" />
        <KPICard title="High" value={summary?.high ?? 0} icon={<FileWarning className="w-5 h-5" />} color="orange" />
        <KPICard title="Medium" value={summary?.medium ?? 0} icon={<Shield className="w-5 h-5" />} color="amber" />
        <KPICard title="Low" value={summary?.low ?? 0} icon={<Eye className="w-5 h-5" />} color="blue" />
        <KPICard title="Total Open" value={summary?.total ?? 0} icon={<Bell className="w-5 h-5" />} color="purple" />
      </div>

      {/* Tabs */}
      <TabPills tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* ---- ALERTS TAB ---- */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-gray-400" />
            <select className="input w-40" value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}>
              <option value="">All Severity</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select className="input w-40" value={resolvedFilter} onChange={e => setResolvedFilter(e.target.value)}>
              <option value="false">Open</option>
              <option value="true">Resolved</option>
              <option value="">All</option>
            </select>
          </div>

          {alertsLoading ? (
            <div className="flex justify-center py-12"><LoadingSpinner /></div>
          ) : alerts.length === 0 ? (
            <EmptyState
              icon={<CheckCircle className="w-12 h-12 text-green-300" />}
              title="No alerts"
              description="All compliance alerts are resolved. Great job!"
            />
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => {
                const sev = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.low;
                return (
                  <div key={alert.id} className={`rounded-lg border ${sev.border} ${sev.bg}`}>
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className={`w-5 h-5 ${sev.icon}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className={`font-semibold ${sev.text}`}>{alert.title}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium uppercase ${sev.bg} ${sev.text}`}>{alert.severity}</span>
                            {alert.resolved && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Resolved</span>}
                          </div>
                          <p className="text-sm text-gray-600 mt-0.5">{alert.message}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            <span>{timeAgo(alert.created_at)}</span>
                            {alert.due_date && <span>Due: {new Date(alert.due_date).toLocaleDateString()}</span>}
                            {alert.vehicle_id && <span><Truck className="w-3 h-3 inline" /> Vehicle #{alert.vehicle_id}</span>}
                            {alert.driver_id && <span><User className="w-3 h-3 inline" /> Driver #{alert.driver_id}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!alert.resolved && (
                          <button
                            className="btn btn-sm bg-white border border-gray-300 text-gray-700 hover:bg-green-50"
                            onClick={() => setResolvingId(alert.id)}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" /> Resolve
                          </button>
                        )}
                        <button className="p-1 hover:bg-white/50 rounded" onClick={() => setExpandedAlertId(expandedAlertId === alert.id ? null : alert.id)}>
                          {expandedAlertId === alert.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    {expandedAlertId === alert.id && (
                      <div className="border-t border-gray-200 px-4 py-3 bg-white/50">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div><span className="text-gray-500">Alert Type:</span> <span className="font-medium capitalize">{alert.alert_type}</span></div>
                          <div><span className="text-gray-500">Entity:</span> <span className="font-medium">{alert.entity_type} #{alert.entity_id}</span></div>
                          {alert.document_id && <div><span className="text-gray-500">Document:</span> <span className="font-medium">#{alert.document_id}</span></div>}
                          {alert.resolved_at && <div><span className="text-gray-500">Resolved:</span> <span className="font-medium">{new Date(alert.resolved_at).toLocaleString()}</span></div>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ---- DRIVER EVENTS TAB ---- */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-gray-400" />
            <select className="input w-48" value={eventTypeFilter} onChange={e => setEventTypeFilter(e.target.value)}>
              <option value="">All Event Types</option>
              {Object.entries(EVENT_TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {eventsLoading ? (
            <div className="flex justify-center py-12"><LoadingSpinner /></div>
          ) : events.length === 0 ? (
            <EmptyState
              icon={<Activity className="w-12 h-12 text-gray-300" />}
              title="No driver events"
              description="No driver safety events recorded yet"
            />
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-3 font-medium text-gray-600">Event</th>
                    <th className="text-left p-3 font-medium text-gray-600">Driver</th>
                    <th className="text-left p-3 font-medium text-gray-600">Severity</th>
                    <th className="text-left p-3 font-medium text-gray-600">Location</th>
                    <th className="text-left p-3 font-medium text-gray-600">Speed</th>
                    <th className="text-left p-3 font-medium text-gray-600">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => {
                    const IconComp = EVENT_TYPE_ICONS[event.event_type] || Activity;
                    const severityColors = ['', 'bg-green-100 text-green-700', 'bg-blue-100 text-blue-700', 'bg-amber-100 text-amber-700', 'bg-orange-100 text-orange-700', 'bg-red-100 text-red-700'];
                    return (
                      <tr key={event.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <IconComp className="w-4 h-4 text-gray-500" />
                            <span className="font-medium">{EVENT_TYPE_LABELS[event.event_type] || event.event_type}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="text-gray-600">Driver #{event.driver_id}</span>
                          {event.vehicle_id && <span className="text-xs text-gray-400 ml-2">| Vehicle #{event.vehicle_id}</span>}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${severityColors[event.severity] || ''}`}>
                            Level {event.severity}
                          </span>
                        </td>
                        <td className="p-3 text-gray-600">{event.location_name || (event.latitude ? `${event.latitude.toFixed(4)}, ${event.longitude?.toFixed(4)}` : '-')}</td>
                        <td className="p-3 text-gray-600">{event.speed_kmph ? `${event.speed_kmph} km/h` : '-'}</td>
                        <td className="p-3 text-gray-500">{timeAgo(event.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ---- AIS-140 TAB ---- */}
      {activeTab === 'ais140' && (
        <div className="space-y-4">
          {ais140Loading ? (
            <div className="flex justify-center py-12"><LoadingSpinner /></div>
          ) : !ais140Report ? (
            <EmptyState
              icon={<Truck className="w-12 h-12 text-gray-300" />}
              title="No AIS-140 data"
              description="Fleet compliance report not available"
            />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <KPICard title="Total Vehicles" value={ais140Report.total_vehicles} icon={<Truck className="w-5 h-5" />} color="blue" />
                <KPICard title="Compliant" value={ais140Report.compliant} icon={<CheckCircle className="w-5 h-5" />} color="green" />
                <KPICard title="Non-Compliant" value={ais140Report.non_compliant} icon={<XCircle className="w-5 h-5" />} color="red" />
                <KPICard title="Compliance %" value={`${ais140Report.compliance_pct.toFixed(1)}%`} icon={<BarChart3 className="w-5 h-5" />} color="purple" />
              </div>

              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-3 font-medium text-gray-600">Vehicle</th>
                      <th className="text-center p-3 font-medium text-gray-600">GPS Device</th>
                      <th className="text-center p-3 font-medium text-gray-600">SOS Button</th>
                      <th className="text-center p-3 font-medium text-gray-600">Driver Mapped</th>
                      <th className="text-center p-3 font-medium text-gray-600">Position Report</th>
                      <th className="text-center p-3 font-medium text-gray-600">Status</th>
                      <th className="text-left p-3 font-medium text-gray-600">Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ais140Report.vehicles.map((v) => (
                      <tr key={v.vehicle_id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium">{v.registration_number}</td>
                        <td className="p-3 text-center">{v.checks.gps_device ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-red-500 mx-auto" />}</td>
                        <td className="p-3 text-center">{v.checks.emergency_button ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-red-500 mx-auto" />}</td>
                        <td className="p-3 text-center">{v.checks.driver_mapped ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-red-500 mx-auto" />}</td>
                        <td className="p-3 text-center">{v.checks.position_reporting ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-red-500 mx-auto" />}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${v.compliant ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {v.compliant ? 'Compliant' : 'Non-Compliant'}
                          </span>
                        </td>
                        <td className="p-3 text-gray-500 text-xs">{v.issues.length > 0 ? v.issues.join(', ') : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ---- AUDIT NOTES TAB ---- */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          {auditLoading ? (
            <div className="flex justify-center py-12"><LoadingSpinner /></div>
          ) : auditNotes.length === 0 ? (
            <EmptyState
              icon={<FileWarning className="w-12 h-12 text-gray-300" />}
              title="No audit notes"
              description="No audit notes have been created yet"
            />
          ) : (
            <div className="space-y-3">
              {auditNotes.map((note) => (
                <div key={note.id} className={`card p-4 ${note.status === 'resolved' ? 'border-green-200 bg-green-50/30' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${note.status === 'open' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                          {note.status.toUpperCase()}
                        </span>
                        <span className="text-sm text-gray-500">{note.resource_type} #{note.resource_id}</span>
                      </div>
                      <p className="mt-1 text-gray-800">{note.note_text}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>Auditor #{note.auditor_id}</span>
                        <span>{new Date(note.created_at).toLocaleDateString()}</span>
                        {note.resolved_at && <span>Resolved: {new Date(note.resolved_at).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    {note.status === 'open' && (
                      <button
                        className="btn btn-sm bg-white border border-gray-300 hover:bg-green-50"
                        onClick={() => resolveNoteMutation.mutate(note.id)}
                        disabled={resolveNoteMutation.isPending}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" /> Resolve
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Resolve Alert Modal */}
      <Modal isOpen={!!resolvingId} onClose={() => { setResolvingId(null); setResolveNotes(''); }} title="Resolve Alert" size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Resolution Notes (optional)</label>
            <textarea className="input" rows={3} value={resolveNotes} onChange={e => setResolveNotes(e.target.value)} placeholder="Add notes about how this was resolved..." />
          </div>
          <div className="flex justify-end gap-3">
            <button className="btn btn-secondary" onClick={() => { setResolvingId(null); setResolveNotes(''); }}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={() => resolvingId && resolveAlertMutation.mutate({ id: resolvingId, notes: resolveNotes })}
              disabled={resolveAlertMutation.isPending}
            >
              {resolveAlertMutation.isPending ? 'Resolving...' : 'Mark Resolved'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
