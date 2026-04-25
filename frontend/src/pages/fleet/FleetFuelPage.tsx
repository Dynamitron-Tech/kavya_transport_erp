import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, DollarSign, AlertTriangle, Gauge
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import DataTable, { Column } from '@/components/common/DataTable';
import { KPICard, StatusBadge } from '@/components/common/Modal';
import { fleetService } from '@/services/dataService';
import type { FuelRecord, FuelSummary } from '@/types';
import { safeArray } from '@/utils/helpers';

export default function FleetFuelPage() {
  const [period, setPeriod] = useState('this_month');

  const { data: records, isLoading } = useQuery({
    queryKey: ['fleet-fuel-records'],
    queryFn: () => fleetService.getFuelRecords({}),
  });

  const { data: summary } = useQuery({
    queryKey: ['fleet-fuel-summary', period],
    queryFn: () => fleetService.getFuelSummary(period),
  });

  const s = (summary as FuelSummary) || {} as FuelSummary;

  const columns: Column<FuelRecord>[] = [
    { key: 'date', header: 'Date', render: (r) => <span className="text-sm">{new Date(r.date).toLocaleDateString('en-IN')}</span> },
    { key: 'vehicle', header: 'Vehicle', render: (r) => <span className="font-medium text-sm">{r.vehicle}</span> },
    { key: 'driver', header: 'Driver', render: (r) => <span className="text-sm">{r.driver}</span> },
    { key: 'litres', header: 'Litres', render: (r) => <span className="text-sm font-medium">{r.litres} L</span> },
    { key: 'cost_per_litre', header: '₹/L', render: (r) => <span className="text-sm">₹{r.cost_per_litre}</span> },
    { key: 'total_cost', header: 'Total Cost', render: (r) => <span className="text-sm font-medium">₹{(r.total_cost ?? 0).toLocaleString('en-IN')}</span> },
    { key: 'odometer', header: 'Odometer', render: (r) => <span className="text-sm">{(r.odometer ?? 0).toLocaleString('en-IN')} km</span> },
    { key: 'mileage', header: 'Mileage', render: (r) => (
      <span className={`text-sm font-medium ${r.mileage >= 4 ? 'text-green-600' : r.mileage >= 3.5 ? 'text-amber-600' : 'text-red-600'}`}>
        {r.mileage} km/l
      </span>
    ) },
    { key: 'station', header: 'Station', render: (r) => <span className="text-sm text-gray-500 truncate max-w-[140px] block">{r.station}</span> },
    { key: 'payment_mode', header: 'Payment', render: (r) => <StatusBadge status={r.payment_mode} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Fuel Management</h1>
          <p className="page-subtitle">Monitor fuel consumption, costs, mileage and detect theft</p>
        </div>
        <select className="input w-40" value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="this_week">This Week</option>
          <option value="this_month">This Month</option>
          <option value="last_month">Last Month</option>
          <option value="this_quarter">This Quarter</option>
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Fuel Cost"
          value={`₹${Number((s.total_cost || 0) ?? 0).toLocaleString('en-IN')}`}
          icon={<DollarSign className="w-5 h-5" />}
          change={`${Number((s.total_litres || 0) ?? 0).toLocaleString()} litres`}
          color="blue"
        />
        <KPICard
          title="Avg Mileage"
          value={`${s.avg_mileage || 0} km/l`}
          icon={<Gauge className="w-5 h-5" />}
          change={`Cost: ₹${s.cost_per_km || 0}/km`}
          color="green"
        />
        <KPICard
          title="Best Mileage"
          value={`${s.best_mileage_vehicle?.mileage || 0} km/l`}
          icon={<TrendingUp className="w-5 h-5" />}
          change={s.best_mileage_vehicle?.vehicle || '—'}
          color="green"
        />
        <KPICard
          title="Fuel Theft Alerts"
          value={s.fuel_theft_alerts || 0}
          icon={<AlertTriangle className="w-5 h-5" />}
          change={`Worst: ${s.worst_mileage_vehicle?.vehicle || '—'} (${s.worst_mileage_vehicle?.mileage || 0} km/l)`}
          color="red"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Monthly Fuel Cost Trend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={s.monthly_trend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={(v: number) => `₹${Number(v / 100000).toFixed(1)}L`} />
              <Tooltip formatter={(value: number) => `₹${(value ?? 0).toLocaleString('en-IN')}`} />
              <Legend />
              <Bar dataKey="cost" fill="#3b82f6" name="Cost (₹)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* By Vehicle */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Mileage by Vehicle</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={s.by_vehicle || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" fontSize={12} />
              <YAxis dataKey="vehicle" type="category" fontSize={11} width={110} />
              <Tooltip formatter={(value: number, name: string) => name === 'Mileage' ? `${value} km/l` : `₹${(value ?? 0).toLocaleString('en-IN')}`} />
              <Legend />
              <Bar dataKey="mileage" fill="#10b981" name="Mileage" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Fuel Records Table */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">Fuel Fill Records</h3>
        <DataTable
          columns={columns}
          data={safeArray<FuelRecord>(records)}
          isLoading={isLoading}
          emptyMessage="No fuel records found"
        />
      </div>
    </div>
  );
}
