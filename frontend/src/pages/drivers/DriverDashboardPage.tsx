import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { driverService } from '@/services/dataService';
import { KPICard, LoadingPage } from '@/components/common/Modal';
import type { DriverDashboard, DriverAlert } from '@/types';
import {
  Users, UserCheck, Truck, Clock, ShieldAlert,
  AlertTriangle, Star, TrendingUp, ChevronRight, Bell,
} from 'lucide-react';

function SeverityBadge({ severity }: { severity: string }) {
  const cls = severity === 'critical'
    ? 'bg-red-100 text-red-700'
    : severity === 'warning'
    ? 'bg-amber-100 text-amber-700'
    : 'bg-blue-100 text-blue-700';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{severity}</span>;
}

export default function DriverDashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery<DriverDashboard>({
    queryKey: ['driver-dashboard'],
    queryFn: () => driverService.getDashboard(),
  });

  if (isLoading) return <LoadingPage />;
  if (!data) return null;

  const { kpis, charts, alerts } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Driver Dashboard</h1>
          <p className="page-subtitle">Overview of your driver workforce and operations</p>
        </div>
        <button onClick={() => navigate('/drivers')} className="btn-primary">
          View All Drivers
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard title="Total Drivers" value={kpis.total_drivers} icon={<Users size={20} />} color="blue" />
        <KPICard title="Active" value={kpis.active_drivers} icon={<UserCheck size={20} />} color="green" />
        <KPICard title="On Trip" value={kpis.on_trip} icon={<Truck size={20} />} color="purple" />
        <KPICard title="Available" value={kpis.available} icon={<Clock size={20} />} color="blue" />
        <KPICard title="License Expiring" value={kpis.license_expiring_soon} icon={<AlertTriangle size={20} />} color="yellow" />
        <KPICard title="Alerts" value={kpis.total_alerts} icon={<ShieldAlert size={20} />} color="red" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Status Distribution</h3>
          <div className="space-y-3">
            {charts.status_distribution.map((item) => {
              const pct = kpis.total_drivers > 0 ? (item.value / kpis.total_drivers) * 100 : 0;
              return (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-24">{item.label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                    <div
                      className="h-5 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                      style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: item.color }}
                    >
                      {pct > 8 && <span className="text-white text-xs font-medium">{item.value}</span>}
                    </div>
                  </div>
                  <span className="text-sm font-semibold w-10 text-right">{item.value}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weekly Utilization */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Weekly Utilization</h3>
          <div className="flex items-end gap-2 h-40">
            {charts.utilization.map((day) => {
              const total = day.on_trip + day.available + day.on_leave + day.resting;
              const maxH = 140;
              return (
                <div key={day.label} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col-reverse" style={{ height: maxH }}>
                    <div style={{ height: `${(day.on_trip / total) * maxH}px` }} className="bg-purple-500 rounded-t" title={`On Trip: ${day.on_trip}`} />
                    <div style={{ height: `${(day.available / total) * maxH}px` }} className="bg-green-500" title={`Available: ${day.available}`} />
                    <div style={{ height: `${(day.on_leave / total) * maxH}px` }} className="bg-amber-400" title={`On Leave: ${day.on_leave}`} />
                    <div style={{ height: `${(day.resting / total) * maxH}px` }} className="bg-blue-400 rounded-b" title={`Resting: ${day.resting}`} />
                  </div>
                  <span className="text-xs text-gray-500">{day.label}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-500" /> On Trip</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500" /> Available</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400" /> On Leave</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-400" /> Resting</span>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Drivers by Trips */}
        <div className="card lg:col-span-1">
          <h3 className="font-semibold text-gray-900 mb-4">Top 10 Drivers by Trips</h3>
          <div className="space-y-2">
            {charts.trips_per_driver.map((d, i) => (
              <div
                key={d.driver_id}
                className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => navigate(`/drivers/${d.driver_id}`)}
              >
                <span className="text-xs text-gray-400 w-5">{i + 1}.</span>
                <span className="flex-1 text-sm font-medium truncate">{d.label}</span>
                <span className="text-sm font-semibold text-primary-600">{d.value}</span>
                <ChevronRight size={14} className="text-gray-300" />
              </div>
            ))}
          </div>
        </div>

        {/* Performance Trends */}
        <div className="card lg:col-span-1">
          <h3 className="font-semibold text-gray-900 mb-4">Performance Trends</h3>
          <div className="space-y-3">
            {charts.performance_trends.map((m) => (
              <div key={m.label} className="flex items-center gap-3 text-sm">
                <span className="text-gray-500 w-20">{m.label}</span>
                <div className="flex-1 flex items-center gap-2">
                  <Star size={12} className="text-amber-400 fill-amber-400" />
                  <span className="font-medium">{m.avg_rating}</span>
                </div>
                <div className="flex items-center gap-1 text-green-600">
                  <TrendingUp size={12} />
                  <span className="font-medium">{m.on_time_pct}%</span>
                </div>
                <span className="text-gray-400">{m.trips_completed} trips</span>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="card lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Bell size={16} className="text-red-500" />
              Recent Alerts
              <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-medium">{alerts.length}</span>
            </h3>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {alerts.slice(0, 10).map((alert: DriverAlert) => (
              <div
                key={alert.id}
                className="p-2 border border-gray-100 rounded hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => navigate(`/drivers/${alert.driver_id}`)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <SeverityBadge severity={alert.severity} />
                  <span className="text-xs text-gray-400 truncate">{alert.driver_name}</span>
                </div>
                <p className="text-sm text-gray-700 truncate">{alert.message}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-2xl font-bold text-primary-600">{kpis.avg_rating}</p>
          <p className="text-sm text-gray-500 mt-1">Avg Rating</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-green-600">{kpis.avg_safety_score}</p>
          <p className="text-sm text-gray-500 mt-1">Avg Safety Score</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-amber-600">{kpis.on_leave}</p>
          <p className="text-sm text-gray-500 mt-1">On Leave</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-red-600">{kpis.license_expired}</p>
          <p className="text-sm text-gray-500 mt-1">Expired Licenses</p>
        </div>
      </div>
    </div>
  );
}
