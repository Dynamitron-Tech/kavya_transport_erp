import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Truck, Users, MapPin, Wrench, Fuel, AlertTriangle, Clock,
  Activity, FileWarning, ChevronRight, Navigation
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { fleetService, reportService } from '@/services/dataService';
import type {
  FleetDashboardKPIs, FleetAlert, FleetExpiringDocument,
  MaintenanceScheduleItem, ActiveTripItem
} from '@/types';
import { KPICard, StatusBadge } from '@/components/common/Modal';
import { safeArray } from '@/utils/helpers';

export default function FleetDashboardPage() {
  const navigate = useNavigate();

  const { data: kpis } = useQuery({
    queryKey: ['fleet-dashboard-kpis'],
    queryFn: fleetService.getDashboardKPIs,
  });

  useQuery({
    queryKey: ['fleet-dashboard-reports-summary'],
    queryFn: reportService.dashboard,
  });

  const { data: utilizationData } = useQuery({
    queryKey: ['fleet-utilization-chart'],
    queryFn: () => fleetService.getFleetUtilizationChart('monthly'),
  });

  const { data: fuelData } = useQuery({
    queryKey: ['fleet-fuel-chart'],
    queryFn: () => fleetService.getFuelConsumptionChart('monthly'),
  });

  const { data: maintenanceData } = useQuery({
    queryKey: ['fleet-maintenance-chart'],
    queryFn: () => fleetService.getMaintenanceCostChart('monthly'),
  });

  const { data: tripEfficiencyData } = useQuery({
    queryKey: ['fleet-trip-efficiency-chart'],
    queryFn: () => fleetService.getTripEfficiencyChart('monthly'),
  });

  const { data: recentAlerts } = useQuery({
    queryKey: ['fleet-recent-alerts'],
    queryFn: () => fleetService.getRecentAlerts(6),
  });

  const { data: expiringDocs } = useQuery({
    queryKey: ['fleet-expiring-docs'],
    queryFn: () => fleetService.getExpiringDocuments(30),
  });

  const { data: upcomingMaintenance } = useQuery({
    queryKey: ['fleet-upcoming-maintenance'],
    queryFn: fleetService.getUpcomingMaintenance,
  });

  const { data: activeTrips } = useQuery({
    queryKey: ['fleet-active-trips'],
    queryFn: fleetService.getActiveTrips,
  });

  const k = (kpis as FleetDashboardKPIs) || {} as FleetDashboardKPIs;

  const alertSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'warning': return 'text-amber-600 bg-amber-50';
      default: return 'text-blue-600 bg-blue-50';
    }
  };

  const alertIcon = (type: string) => {
    switch (type) {
      case 'overspeed': return <Navigation className="w-4 h-4" />;
      case 'geofence': return <MapPin className="w-4 h-4" />;
      case 'fuel_drop': return <Fuel className="w-4 h-4" />;
      case 'maintenance_due': return <Wrench className="w-4 h-4" />;
      case 'document_expiry': return <FileWarning className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="page-title">Fleet Dashboard</h1>
        <p className="page-subtitle">Real-time overview of your entire fleet operations</p>
      </div>

      {/* KPI Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Vehicles"
          value={k.total_vehicles || 0}
          icon={<Truck className="w-5 h-5" />}
          change={`${k.active_vehicles || 0} active`}
          color="blue"
        />
        <KPICard
          title="On Trip"
          value={k.vehicles_on_trip || 0}
          icon={<Navigation className="w-5 h-5" />}
          change={`${k.trips_in_progress || 0} trips in progress`}
          color="green"
        />
        <KPICard
          title="In Maintenance"
          value={k.vehicles_maintenance || 0}
          icon={<Wrench className="w-5 h-5" />}
          change={`${k.breakdown_vehicles || 0} breakdowns`}
          color="amber"
        />
        <KPICard
          title="Active Alerts"
          value={k.active_alerts || 0}
          icon={<AlertTriangle className="w-5 h-5" />}
          change="Requires attention"
          color="red"
        />
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Available Drivers"
          value={k.available_drivers || 0}
          icon={<Users className="w-5 h-5" />}
          change="Ready for dispatch"
          color="purple"
        />
        <KPICard
          title="Fleet Utilization"
          value={`${k.avg_fleet_utilization || 0}%`}
          icon={<Activity className="w-5 h-5" />}
          change="Average this month"
          color="cyan"
        />
        <KPICard
          title="On-Time Delivery"
          value={`${k.on_time_delivery_rate || 0}%`}
          icon={<Clock className="w-5 h-5" />}
          change="This month"
          color="green"
        />
        <KPICard
          title="Today's Fuel Cost"
          value={`₹${Number((k.fuel_cost_today || 0) ?? 0).toLocaleString('en-IN')}`}
          icon={<Fuel className="w-5 h-5" />}
          change="Across all vehicles"
          color="amber"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fleet Utilization Chart */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Fleet Utilization Trend</h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={utilizationData || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="on_trip" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} name="On Trip" />
              <Area type="monotone" dataKey="idle" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} name="Idle" />
              <Area type="monotone" dataKey="maintenance" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} name="Maintenance" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Fuel Consumption Chart */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Fuel Consumption</h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={fuelData || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis yAxisId="left" fontSize={12} />
              <YAxis yAxisId="right" orientation="right" fontSize={12} />
              <Tooltip formatter={(value: number, name: string) => 
                name === 'Cost' ? `₹${(value ?? 0).toLocaleString('en-IN')}` : name === 'Mileage' ? `${value} km/l` : `${(value ?? 0).toLocaleString()} L`
              } />
              <Legend />
              <Bar yAxisId="left" dataKey="litres" fill="#3b82f6" name="Litres" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="avg_mileage" fill="#10b981" name="Mileage" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Maintenance Cost Trend */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Maintenance Cost Trend</h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={maintenanceData?.trend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={(v: number) => `₹${Number(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => `₹${(value ?? 0).toLocaleString('en-IN')}`} />
              <Legend />
              <Bar dataKey="preventive" stackId="a" fill="#3b82f6" name="Preventive" />
              <Bar dataKey="repair" stackId="a" fill="#ef4444" name="Repair" />
              <Bar dataKey="tyres" stackId="a" fill="#f59e0b" name="Tyres" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Trip Efficiency */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Trip Efficiency</h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={tripEfficiencyData || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip formatter={(value: number, name: string) => name === 'Avg Hours' ? `${value}h` : `${value}%`} />
              <Legend />
              <Bar dataKey="on_time" fill="#10b981" name="On-Time %" radius={[4, 4, 0, 0]} />
              <Bar dataKey="delayed" fill="#f59e0b" name="Delayed %" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Panels Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Trips */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Active Trips</h3>
            <button onClick={() => navigate('/fleet/tracking')} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            {safeArray<ActiveTripItem>(activeTrips).slice(0, 5).map((trip: ActiveTripItem) => (
              <div key={trip.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{trip.vehicle}</p>
                  <p className="text-xs text-gray-500">{trip.origin} → {trip.destination}</p>
                </div>
                <div className="text-right">
                  <div className="w-20 bg-gray-200 rounded-full h-1.5">
                    <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${trip.progress}%` }} />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{trip.progress}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Recent Alerts</h3>
            <button onClick={() => navigate('/fleet/alerts')} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            {safeArray<FleetAlert>(recentAlerts).slice(0, 5).map((alert: FleetAlert) => (
              <div key={alert.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50">
                <div className={`p-1.5 rounded-lg ${alertSeverityColor(alert.severity)}`}>
                  {alertIcon(alert.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{alert.title}</p>
                  <p className="text-xs text-gray-500 truncate">{alert.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Expiring Documents & Upcoming Maintenance */}
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 text-sm">Expiring Documents</h3>
              <div className="flex gap-2">
                <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                  {safeArray<FleetExpiringDocument>(expiringDocs).filter((d: any) => d.days_remaining !== undefined && d.days_remaining < 0).length} expired
                </span>
                <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  {safeArray<FleetExpiringDocument>(expiringDocs).filter((d: any) => d.days_remaining !== undefined && d.days_remaining >= 0).length} expiring
                </span>
              </div>
            </div>
            <div className="space-y-2">
              {safeArray<FleetExpiringDocument>(expiringDocs).slice(0, 4).map((doc: FleetExpiringDocument) => (
                <div key={doc.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 truncate">{doc.entity} — {doc.document}</span>
                  <span className={`text-xs font-medium ${doc.days_remaining < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                    {doc.days_remaining < 0 ? `${Math.abs(doc.days_remaining)}d ago` : `${doc.days_remaining}d`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 text-sm">Upcoming Maintenance</h3>
              <button onClick={() => navigate('/fleet/maintenance')} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
                View All <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-2">
              {safeArray<MaintenanceScheduleItem>(upcomingMaintenance).slice(0, 4).map((item: MaintenanceScheduleItem) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="text-gray-700">{item.vehicle}</span>
                    <span className="text-gray-400 mx-1">·</span>
                    <span className="text-gray-500">{item.service_type}</span>
                  </div>
                  <StatusBadge status={item.priority} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
