import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3, TrendingUp, Download, Truck, Users, Wrench, Fuel,
  MapPin, DollarSign, Gauge
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import { KPICard } from '@/components/common/Modal';
import { fleetService } from '@/services/dataService';

type ReportTab = 'utilization' | 'profitability' | 'driver-performance' | 'maintenance-cost' | 'fuel-consumption' | 'trip-performance';

const reportTabs: { key: ReportTab; label: string; icon: any }[] = [
  { key: 'utilization', label: 'Fleet Utilization', icon: BarChart3 },
  { key: 'profitability', label: 'Vehicle Profitability', icon: DollarSign },
  { key: 'driver-performance', label: 'Driver Performance', icon: Users },
  { key: 'maintenance-cost', label: 'Maintenance Cost', icon: Wrench },
  { key: 'fuel-consumption', label: 'Fuel Consumption', icon: Fuel },
  { key: 'trip-performance', label: 'Trip Performance', icon: MapPin },
];

export default function FleetReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportTab>('utilization');
  const [dateRange] = useState({ from: '2026-02-01', to: '2026-02-28' });

  const { data: utilization } = useQuery({
    queryKey: ['fleet-report-utilization', dateRange],
    queryFn: () => fleetService.getFleetUtilizationReport(dateRange),
    enabled: activeReport === 'utilization',
  });

  const { data: profitability } = useQuery({
    queryKey: ['fleet-report-profitability', dateRange],
    queryFn: () => fleetService.getVehicleProfitabilityReport(dateRange),
    enabled: activeReport === 'profitability',
  });

  const { data: driverPerf } = useQuery({
    queryKey: ['fleet-report-driver', dateRange],
    queryFn: () => fleetService.getDriverPerformanceReport(dateRange),
    enabled: activeReport === 'driver-performance',
  });

  const { data: mainCost } = useQuery({
    queryKey: ['fleet-report-maintenance', dateRange],
    queryFn: () => fleetService.getMaintenanceCostReport(dateRange),
    enabled: activeReport === 'maintenance-cost',
  });

  const { data: fuelReport } = useQuery({
    queryKey: ['fleet-report-fuel', dateRange],
    queryFn: () => fleetService.getFuelConsumptionReport(dateRange),
    enabled: activeReport === 'fuel-consumption',
  });

  const { data: tripPerf } = useQuery({
    queryKey: ['fleet-report-trip', dateRange],
    queryFn: () => fleetService.getTripPerformanceReport(dateRange),
    enabled: activeReport === 'trip-performance',
  });

  const handleExport = async (format: 'pdf' | 'excel') => {
    await fleetService.exportReport(activeReport, format, dateRange);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Fleet Reports</h1>
          <p className="page-subtitle">Comprehensive fleet analytics and downloadable reports</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleExport('pdf')} className="btn-secondary flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" /> Export PDF
          </button>
          <button onClick={() => handleExport('excel')} className="btn-secondary flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" /> Export Excel
          </button>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {reportTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveReport(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${
                activeReport === tab.key
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ──── Fleet Utilization ──── */}
      {activeReport === 'utilization' && utilization && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KPICard title="Avg Utilization" value={`${utilization.summary?.avg_utilization || 0}%`} icon={<Gauge className="w-5 h-5" />} color="blue" />
            <KPICard title="Total KM" value={Number((utilization.summary?.total_km || 0) ?? 0).toLocaleString('en-IN')} icon={<MapPin className="w-5 h-5" />} color="green" />
            <KPICard title="Total Trips" value={utilization.summary?.total_trips || 0} icon={<Truck className="w-5 h-5" />} color="purple" />
            <KPICard title="Avg Trips/Vehicle" value={utilization.summary?.avg_trips_per_vehicle || 0} icon={<BarChart3 className="w-5 h-5" />} color="cyan" />
          </div>
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Utilization by Vehicle</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={utilization.by_vehicle || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="vehicle" fontSize={11} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="utilization" fill="#3b82f6" name="Utilization %" radius={[4, 4, 0, 0]} />
                <Bar dataKey="trips" fill="#10b981" name="Trips" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ──── Vehicle Profitability ──── */}
      {activeReport === 'profitability' && profitability && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Vehicle Profitability</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Vehicle</th>
                  <th className="text-right py-3 px-3 font-medium text-gray-500">Revenue</th>
                  <th className="text-right py-3 px-3 font-medium text-gray-500">Fuel</th>
                  <th className="text-right py-3 px-3 font-medium text-gray-500">Maint.</th>
                  <th className="text-right py-3 px-3 font-medium text-gray-500">Toll</th>
                  <th className="text-right py-3 px-3 font-medium text-gray-500">Driver</th>
                  <th className="text-right py-3 px-3 font-medium text-gray-500">Profit</th>
                  <th className="text-right py-3 px-3 font-medium text-gray-500">Margin</th>
                </tr>
              </thead>
              <tbody>
                {(profitability.by_vehicle || []).map((r: any, i: number) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-3 font-medium">{r.vehicle}</td>
                    <td className="py-3 px-3 text-right text-green-600">₹{(r.revenue ?? 0).toLocaleString('en-IN')}</td>
                    <td className="py-3 px-3 text-right text-red-500">₹{(r.fuel_cost ?? 0).toLocaleString('en-IN')}</td>
                    <td className="py-3 px-3 text-right text-red-500">₹{(r.maintenance_cost ?? 0).toLocaleString('en-IN')}</td>
                    <td className="py-3 px-3 text-right text-red-500">₹{(r.toll_cost ?? 0).toLocaleString('en-IN')}</td>
                    <td className="py-3 px-3 text-right text-red-500">₹{(r.driver_cost ?? 0).toLocaleString('en-IN')}</td>
                    <td className={`py-3 px-3 text-right font-semibold ${r.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ₹{(r.profit ?? 0).toLocaleString('en-IN')}
                    </td>
                    <td className={`py-3 px-3 text-right font-semibold ${r.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {Number(r.margin ?? 0).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ──── Driver Performance ──── */}
      {activeReport === 'driver-performance' && driverPerf && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Driver Performance</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Driver</th>
                  <th className="text-right py-3 px-3 font-medium text-gray-500">Trips</th>
                  <th className="text-right py-3 px-3 font-medium text-gray-500">KM</th>
                  <th className="text-right py-3 px-3 font-medium text-gray-500">On-Time</th>
                  <th className="text-right py-3 px-3 font-medium text-gray-500">Safety</th>
                  <th className="text-right py-3 px-3 font-medium text-gray-500">Mileage</th>
                  <th className="text-right py-3 px-3 font-medium text-gray-500">Overspeed</th>
                  <th className="text-right py-3 px-3 font-medium text-gray-500">Rating</th>
                </tr>
              </thead>
              <tbody>
                {(driverPerf.drivers || []).map((d: any, i: number) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-3 font-medium">{d.name}</td>
                    <td className="py-3 px-3 text-right">{d.trips}</td>
                    <td className="py-3 px-3 text-right">{(d.km_driven ?? 0).toLocaleString('en-IN')}</td>
                    <td className="py-3 px-3 text-right">
                      <span className={d.on_time_percent >= 90 ? 'text-green-600' : 'text-amber-600'}>{d.on_time_percent}%</span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className={d.safety_score >= 90 ? 'text-green-600' : d.safety_score >= 80 ? 'text-amber-600' : 'text-red-600'}>{d.safety_score}</span>
                    </td>
                    <td className="py-3 px-3 text-right">{d.fuel_efficiency} km/l</td>
                    <td className="py-3 px-3 text-right">
                      <span className={d.overspeed_events > 5 ? 'text-red-600 font-medium' : ''}>{d.overspeed_events}</span>
                    </td>
                    <td className="py-3 px-3 text-right">{d.customer_rating} ⭐</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ──── Maintenance Cost ──── */}
      {activeReport === 'maintenance-cost' && mainCost && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KPICard title="Total Cost" value={`₹${Number((mainCost.total_cost || 0) ?? 0).toLocaleString('en-IN')}`} icon={<Wrench className="w-5 h-5" />} color="blue" />
            <KPICard title="Preventive" value={`₹${Number((mainCost.breakdown?.preventive || 0) ?? 0).toLocaleString('en-IN')}`} icon={<Wrench className="w-5 h-5" />} color="green" />
            <KPICard title="Repair" value={`₹${Number((mainCost.breakdown?.repair || 0) ?? 0).toLocaleString('en-IN')}`} icon={<Wrench className="w-5 h-5" />} color="red" />
            <KPICard title="Tyres" value={`₹${Number((mainCost.breakdown?.tyres || 0) ?? 0).toLocaleString('en-IN')}`} icon={<Wrench className="w-5 h-5" />} color="amber" />
          </div>
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Monthly Maintenance Cost</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={mainCost.monthly_trend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v: number) => `₹${Number(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => `₹${(value ?? 0).toLocaleString('en-IN')}`} />
                <Bar dataKey="cost" fill="#ef4444" name="Cost" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ──── Fuel Consumption ──── */}
      {activeReport === 'fuel-consumption' && fuelReport && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KPICard title="Total Litres" value={Number((fuelReport.total_litres || 0) ?? 0).toLocaleString()} icon={<Fuel className="w-5 h-5" />} color="blue" />
            <KPICard title="Total Cost" value={`₹${Number((fuelReport.total_cost || 0) ?? 0).toLocaleString('en-IN')}`} icon={<DollarSign className="w-5 h-5" />} color="green" />
            <KPICard title="Avg Mileage" value={`${fuelReport.avg_mileage || 0} km/l`} icon={<Gauge className="w-5 h-5" />} color="purple" />
            <KPICard title="Cost/KM" value={`₹${fuelReport.cost_per_km || 0}`} icon={<TrendingUp className="w-5 h-5" />} color="amber" />
          </div>
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Fuel by Vehicle</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={fuelReport.by_vehicle || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="vehicle" fontSize={11} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="litres" fill="#3b82f6" name="Litres" radius={[4, 4, 0, 0]} />
                <Bar dataKey="mileage" fill="#10b981" name="Mileage (km/l)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ──── Trip Performance ──── */}
      {activeReport === 'trip-performance' && tripPerf && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KPICard title="Total Trips" value={tripPerf.total_trips || 0} icon={<Truck className="w-5 h-5" />} color="blue" />
            <KPICard title="On-Time Rate" value={`${tripPerf.on_time_rate || 0}%`} icon={<TrendingUp className="w-5 h-5" />} color="green" />
            <KPICard title="Total KM" value={Number((tripPerf.total_distance_km || 0) ?? 0).toLocaleString('en-IN')} icon={<MapPin className="w-5 h-5" />} color="purple" />
            <KPICard title="Revenue" value={`₹${Number((tripPerf.total_revenue || 0) ?? 0).toLocaleString('en-IN')}`} icon={<DollarSign className="w-5 h-5" />} color="cyan" />
          </div>
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Performance by Route</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-3 font-medium text-gray-500">Route</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-500">Trips</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-500">Avg Hours</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-500">On-Time %</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-500">Avg Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {(tripPerf.by_route || []).map((r: any, i: number) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-3 font-medium">{r.route}</td>
                      <td className="py-3 px-3 text-right">{r.trips}</td>
                      <td className="py-3 px-3 text-right">{r.avg_hours}h</td>
                      <td className="py-3 px-3 text-right">
                        <span className={r.on_time_rate >= 90 ? 'text-green-600' : 'text-amber-600'}>{r.on_time_rate}%</span>
                      </td>
                      <td className="py-3 px-3 text-right">₹{(r.avg_revenue ?? 0).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
