import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { accountantService } from '@/services/dataService';
import { KPICard, Modal } from '@/components/common/Modal';
import { SubmitButton } from '@/components/common/SubmitButton';
import DataTable from '@/components/common/DataTable';
import {
  Fuel, TrendingUp, Truck, Plus, BarChart3,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { AccountantFuelExpense } from '@/types';
import { safeArray } from '@/utils/helpers';

export default function AccountantFuelExpensePage() {
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    vehicle: 'KA-01-AB-1234',
    driver: '',
    litres: '',
    rate: '',
    odometer: '',
    station: '',
    date: new Date().toISOString().split('T')[0],
  });

  const safeNum = (val: any, decimals = 2) => Number(val ?? 0).toFixed(decimals);
  const safeLocale = (val: any) => Number(val ?? 0).toLocaleString('en-IN');
  const safeCurrency = (val: any) =>
    Number(val ?? 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
    });

  const { data, isLoading } = useQuery({
    queryKey: ['accountant-fuel-expenses'],
    queryFn: () => accountantService.listFuelExpenses(),
  });

  const { data: summaryData } = useQuery({
    queryKey: ['accountant-fuel-summary'],
    queryFn: () => accountantService.getFuelExpenseSummary(),
  });

  const items: AccountantFuelExpense[] = safeArray(data);
  const summary = summaryData || {
    total_fuel_cost: 0, total_litres: 0, avg_rate_per_litre: 0, avg_mileage: 0,
    by_vehicle: [], monthly_trend: [],
  };

  const fmt = (n: number) => `₹${safeCurrency(n)}`;

  const columns = [
    {
      key: 'date' as const,
      header: 'Date',
      render: (item: AccountantFuelExpense) => (
        <span className="text-sm">{new Date(item.date).toLocaleDateString('en-IN')}</span>
      ),
    },
    {
      key: 'vehicle_number' as const,
      header: 'Vehicle',
      render: (item: AccountantFuelExpense) => (
        <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded font-semibold">{item.vehicle}</span>
      ),
    },
    {
      key: 'driver_name' as const,
      header: 'Driver',
      render: (item: AccountantFuelExpense) => (
        <span className="text-sm">{item.driver}</span>
      ),
    },
    {
      key: 'fuel_station' as const,
      header: 'Station',
      render: (item: AccountantFuelExpense) => (
        <span className="text-sm text-gray-600">{item.fuel_station}</span>
      ),
    },
    {
      key: 'litres' as const,
      header: 'Litres',
      render: (item: AccountantFuelExpense) => (
        <span className="font-medium text-sm">{safeNum(item.fuel_quantity, 1)} L</span>
      ),
    },
    {
      key: 'rate_per_litre' as const,
      header: 'Rate/L',
      render: (item: AccountantFuelExpense) => (
        <span className="text-sm">{fmt(item.cost_per_litre)}</span>
      ),
    },
    {
      key: 'amount' as const,
      header: 'Amount',
      render: (item: AccountantFuelExpense) => (
        <span className="font-bold text-sm">{fmt(item.total_cost)}</span>
      ),
    },
    {
      key: 'odometer' as const,
      header: 'Odometer',
      render: (item: AccountantFuelExpense) => (
        <span className="text-sm text-gray-600">{safeLocale(item.odometer)} km</span>
      ),
    },
    {
      key: 'mileage' as const,
      header: 'Mileage',
      render: (item: AccountantFuelExpense) => (
        <span className={`text-sm font-bold ${item.mileage >= 4 ? 'text-green-600' : item.mileage >= 3 ? 'text-amber-600' : 'text-red-600'}`}>
          {safeNum(item.mileage, 1)} km/L
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Fuel Expense Tracking</h1>
          <p className="page-subtitle">Monitor fuel consumption, costs, and vehicle mileage</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Log Fuel Entry
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Total Fuel Cost" value={fmt(summary.total_fuel_cost)} icon={<Fuel size={22} />} color="bg-red-50 text-red-600" />
        <KPICard title="Total Litres" value={`${safeLocale(summary.total_litres)} L`} icon={<BarChart3 size={22} />} color="bg-blue-50 text-blue-600" />
        <KPICard title="Avg Rate/Litre" value={fmt(summary.avg_rate_per_litre)} icon={<TrendingUp size={22} />} color="bg-amber-50 text-amber-600" />
        <KPICard title="Avg Mileage" value={`${safeNum(summary.avg_mileage, 1)} km/L`} icon={<Truck size={22} />} color="bg-green-50 text-green-600" />
      </div>

      {/* Monthly Trend Chart */}
      {summary.monthly_trend?.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Monthly Fuel Cost Trend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={summary.monthly_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v: number) => `₹${safeNum(v / 1000, 0)}K`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: number) => [fmt(value), '']} />
              <Legend />
              <Bar dataKey="cost" name="Fuel Cost" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="litres" name="Litres" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Vehicle-wise Summary */}
      {summary.by_vehicle?.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Vehicle-wise Summary</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="table-header">Vehicle</th>
                  <th className="table-header">Total Cost</th>
                  <th className="table-header">Litres</th>
                  <th className="table-header">Entries</th>
                  <th className="table-header">Avg Mileage</th>
                </tr>
              </thead>
              <tbody>
                {summary.by_vehicle.map((v: any, i: number) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="table-cell font-mono font-semibold">{v.vehicle_number}</td>
                    <td className="table-cell font-bold">{fmt(v.total_cost)}</td>
                    <td className="table-cell">{safeNum(v.total_litres, 1)} L</td>
                    <td className="table-cell">{v.entries}</td>
                    <td className="table-cell">
                      <span className={`font-bold ${v.avg_mileage >= 4 ? 'text-green-600' : v.avg_mileage >= 3 ? 'text-amber-600' : 'text-red-600'}`}>
                        {safeNum(v.avg_mileage, 1)} km/L
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fuel Entries Table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">Recent Fuel Entries</h3>
        </div>
        <DataTable
          data={items}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No fuel entries found"
        />
      </div>

      {/* Create Fuel Entry Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Log Fuel Entry" size="md">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setCreateForm({
              vehicle: 'KA-01-AB-1234',
              driver: '',
              litres: '',
              rate: '',
              odometer: '',
              station: '',
              date: new Date().toISOString().split('T')[0],
            });
            setShowCreate(false);
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle</label>
              <select className="input-field" value={createForm.vehicle} onChange={(e) => setCreateForm((p) => ({ ...p, vehicle: e.target.value }))}>
                <option>KA-01-AB-1234</option>
                <option>MH-04-CD-5678</option>
                <option>TN-07-EF-9012</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Driver</label>
              <input type="text" className="input-field" placeholder="Driver name" value={createForm.driver} onChange={(e) => setCreateForm((p) => ({ ...p, driver: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Litres</label>
              <input type="number" step="0.1" className="input-field" placeholder="0.0" value={createForm.litres} onChange={(e) => setCreateForm((p) => ({ ...p, litres: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rate/Litre (₹)</label>
              <input type="number" step="0.01" className="input-field" placeholder="0.00" value={createForm.rate} onChange={(e) => setCreateForm((p) => ({ ...p, rate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Odometer (km)</label>
              <input type="number" className="input-field" placeholder="0" value={createForm.odometer} onChange={(e) => setCreateForm((p) => ({ ...p, odometer: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Station</label>
              <input type="text" className="input-field" placeholder="Station name" value={createForm.station} onChange={(e) => setCreateForm((p) => ({ ...p, station: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input type="date" className="input-field" value={createForm.date} onChange={(e) => setCreateForm((p) => ({ ...p, date: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <SubmitButton isLoading={false} label="Save Entry" disabled={!createForm.litres || !createForm.rate || !createForm.station} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
