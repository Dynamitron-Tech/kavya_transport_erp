import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Download, Calendar } from 'lucide-react';
import { fuelPumpService } from '@/services/fuelPumpService';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function PumpReportsPage() {
  const [range, setRange] = useState(30);

  const fromDate = toIsoDate(new Date(Date.now() - range * 24 * 60 * 60 * 1000));
  const toDate = toIsoDate(new Date());

  const { data: dashData } = useQuery({
    queryKey: ['pump-dashboard'],
    queryFn: () => fuelPumpService.getDashboard(),
  });

  const { data: issuesData } = useQuery({
    queryKey: ['fuel-issues-report', fromDate, toDate],
    queryFn: () => fuelPumpService.getIssues({ page: 1, limit: 500, date_from: fromDate, date_to: toDate }),
  });

  const { data: tanksData } = useQuery({
    queryKey: ['fuel-tanks-report'],
    queryFn: () => fuelPumpService.getTanks(),
  });

  const dashboard = dashData?.data;
  const issues = issuesData?.data || [];
  const tanks = tanksData?.data || [];

  // Daily aggregation — all returned issues are already in the date range
  const dailyMap = new Map<string, { date: string; litres: number; amount: number; count: number }>();

  issues.forEach((issue: any) => {
    const d = new Date(issue.issued_at || issue.created_at);
    const key = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    const existing = dailyMap.get(key) || { date: key, litres: 0, amount: 0, count: 0 };
    existing.litres += Number(issue.quantity_litres ?? 0) || 0;
    existing.amount += Number(issue.total_amount ?? 0) || 0;
    existing.count += 1;
    dailyMap.set(key, existing);
  });
  const dailyData = Array.from(dailyMap.values());

  // Vehicle breakdown
  const vehicleMap = new Map<string, number>();
  issues.forEach((issue: any) => {
    const v = issue.vehicle_registration || `V#${issue.vehicle_id}`;
    vehicleMap.set(v, (vehicleMap.get(v) || 0) + (Number(issue.quantity_litres ?? 0) || 0));
  });
  const vehicleData = Array.from(vehicleMap.entries())
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const handleExport = () => {
    const rows = [
      ['Date', 'Vehicle', 'Driver', 'Qty (L)', 'Rate', 'Amount', 'Odometer', 'Flagged'],
      ...issues.map((i: any) => [
        new Date(i.issued_at || i.created_at).toLocaleDateString('en-IN'),
        i.vehicle_registration || i.vehicle_id,
        i.driver_name || i.driver_id,
        i.quantity_litres,
        i.rate_per_litre,
        i.total_amount,
        i.odometer_reading,
        i.is_flagged ? 'Yes' : 'No',
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fuel_report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fuel Reports</h1>
          <p className="text-sm text-gray-500">Consumption analysis and insights</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Calendar size={16} className="text-gray-400" />
            <select
              value={range}
              onChange={(e) => setRange(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700"
          >
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Stock (L)', value: (+(dashboard?.total_stock_litres ?? 0) || 0).toLocaleString('en-IN') },
            { label: 'Month Issued (L)', value: (+(dashboard?.month_issued_litres ?? 0) || 0).toLocaleString('en-IN') },
            { label: 'Month Amount', value: `₹${(+(dashboard?.month_cost ?? 0) || 0).toLocaleString('en-IN')}` },
            { label: 'Open Alerts', value: (dashboard?.open_alerts ?? 0) },
          ].map((c) => (
            <div key={c.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className="text-xl font-bold mt-1">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Daily Consumption Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Daily Fuel Consumption (L)</h2>
        {dailyData.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">No data for selected period</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `${(v ?? 0).toFixed(1)} L`} />
              <Bar dataKey="litres" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Vehicle Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Top Vehicles by Fuel Consumed</h2>
          {vehicleData.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={vehicleData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name}: ${value}L`}>
                  {vehicleData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `${v} L`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Tank Levels */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Current Tank Levels</h2>
          <div className="space-y-4">
            {tanks.map((tank: any) => {
              const pct = tank.capacity_litres > 0 ? (Number(tank.current_stock_litres) / Number(tank.capacity_litres)) * 100 : 0;
              const isLow = Number(tank.current_stock_litres) <= Number(tank.min_alert_litres);
              return (
                <div key={tank.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{tank.name}</span>
                    <span className={isLow ? 'text-red-600 font-semibold' : 'text-gray-500'}>
                      {Number(tank.current_stock_litres).toLocaleString('en-IN')}L / {Number(tank.capacity_litres).toLocaleString('en-IN')}L
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${isLow ? 'bg-red-500' : pct < 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {tanks.length === 0 && <p className="text-gray-400 text-sm text-center py-4">No tanks configured</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
