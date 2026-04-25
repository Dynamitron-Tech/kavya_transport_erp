/**
 * DriverTyreDashboardPage — Driver's home for tyre inspections.
 * Route: /driver/tyre
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { AlertTriangle, ClipboardCheck, History, ChevronRight, Gauge } from 'lucide-react';

interface AssignedVehicle {
  id: number;
  registration_number: string;
  vehicle_type: string;
  last_inspection: string | null;
  days_since_inspection: number | null;
  overdue: boolean;
  tyre_count: number;
  alert_count: number;
}

interface FieldAlert {
  id: number;
  registration_number: string;
  position: string;
  alert_type: string;
  severity: string;
  current_value: number | null;
  status: string;
  created_at: string;
}

export default function DriverTyreDashboardPage() {
  const { user } = useAuthStore();

  const { data: vehiclesData, isLoading: vehiclesLoading } = useQuery({
    queryKey: ['driver-assigned-vehicles'],
    queryFn: async () => {
      const res = await api.get('/vehicle', { params: { assigned_driver_id: user?.id, limit: 50 } });
      return (res as any)?.data?.items || (res as any)?.items || [];
    },
    enabled: !!user?.id,
  });

  const { data: alertsData } = useQuery({
    queryKey: ['driver-tyre-alerts'],
    queryFn: async () => {
      const res = await api.get('/tyre/field-alerts', { params: { status: 'OPEN', limit: 10 } });
      return (res as any)?.data?.items || (res as any)?.items || [];
    },
    refetchInterval: 30000,
  });

  const vehicles: AssignedVehicle[] = vehiclesData || [];
  const alerts: FieldAlert[] = alertsData || [];
  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL');

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <h1 className="text-lg font-bold text-gray-900">Tyre Inspections</h1>
        <p className="text-sm text-gray-500">Hello, {user?.full_name || 'Driver'}</p>
      </div>

      <div className="px-4 py-4 space-y-5 max-w-lg mx-auto">
        {/* Critical alert banner */}
        {criticalAlerts.length > 0 && (
          <div className="bg-red-600 text-white rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-bold text-sm">
                {criticalAlerts.length} Critical Alert{criticalAlerts.length > 1 ? 's' : ''}
              </p>
              <p className="text-xs mt-0.5 opacity-90">
                {criticalAlerts.map(a => `${a.registration_number} ${a.position}`).join(', ')}
              </p>
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-3">
          <Link to="/driver/tyre-history" className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col items-center gap-1.5 hover:border-blue-400 transition">
            <History className="w-6 h-6 text-blue-600" />
            <span className="text-xs font-medium text-gray-700 text-center">My History</span>
          </Link>
          <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col items-center gap-1.5">
            <ClipboardCheck className="w-6 h-6 text-green-600" />
            <span className="text-xs font-medium text-gray-700 text-center">Today: {vehicles.filter(v => v.days_since_inspection === 0).length}</span>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col items-center gap-1.5">
            <Gauge className="w-6 h-6 text-amber-600" />
            <span className="text-xs font-medium text-gray-700 text-center">Alerts: {alerts.length}</span>
          </div>
        </div>

        {/* Assigned vehicles */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Your Vehicles</h2>
          {vehiclesLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse h-20" />
              ))}
            </div>
          ) : vehicles.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-sm text-gray-400">
              No vehicles assigned to you.
            </div>
          ) : (
            <div className="space-y-3">
              {vehicles.map(v => {
                const statusColor = v.overdue ? 'border-red-400 bg-red-50' :
                  v.days_since_inspection !== null && v.days_since_inspection <= 2 ? 'border-green-400 bg-green-50' :
                  'border-gray-200 bg-white';
                const statusText = v.overdue ? '⚠ Overdue inspection' :
                  v.days_since_inspection === null ? 'Never inspected' :
                  v.days_since_inspection === 0 ? '✓ Inspected today' :
                  `Last: ${v.days_since_inspection}d ago`;

                return (
                  <Link
                    key={v.id}
                    to={`/driver/inspect/${v.id}`}
                    className={`flex items-center gap-4 border-2 rounded-xl p-4 hover:shadow-md transition ${statusColor}`}
                  >
                    <div className="flex-1">
                      <p className="font-bold text-gray-900 text-sm">{v.registration_number}</p>
                      <p className="text-xs text-gray-500">{v.vehicle_type} · {v.tyre_count} tyres</p>
                      <p className={`text-xs mt-1 font-medium ${v.overdue ? 'text-red-600' : 'text-gray-500'}`}>
                        {statusText}
                      </p>
                    </div>
                    {v.alert_count > 0 && (
                      <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                        {v.alert_count} alert{v.alert_count > 1 ? 's' : ''}
                      </span>
                    )}
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Open alerts */}
        {alerts.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Open Alerts</h2>
            <div className="space-y-2">
              {alerts.slice(0, 5).map(a => (
                <div key={a.id} className={`flex items-start gap-3 rounded-xl p-3 border ${a.severity === 'CRITICAL' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                  <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${a.severity === 'CRITICAL' ? 'text-red-600' : 'text-amber-600'}`} />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{a.registration_number} – {a.position}</p>
                    <p className="text-xs text-gray-500">{a.alert_type.replace(/_/g, ' ')}</p>
                  </div>
                  <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${a.severity === 'CRITICAL' ? 'bg-red-200 text-red-700' : 'bg-amber-200 text-amber-700'}`}>
                    {a.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
