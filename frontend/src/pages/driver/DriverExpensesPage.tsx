import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import DataTable, { Column } from '@/components/common/DataTable';
import { StatusBadge } from '@/components/common/Modal';
import api from '@/services/api';
import { driverService } from '@/services/dataService';
import { safeArray } from '@/utils/helpers';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';

interface ExpenseRow {
  id: number;
  trip_id?: number;
  category?: string;
  amount?: number;
  payment_mode?: string;
  description?: string;
  expense_date?: string;
  is_verified?: boolean;
}

export default function DriverExpensesPage() {
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    trip_id: '',
    category: 'fuel',
    amount: '',
    payment_mode: 'cash',
    description: '',
    expense_date: new Date().toISOString().slice(0, 16),
  });
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['driver-expenses', page],
    queryFn: async () => api.get('/expenses', { params: { page, limit: 20 } }),
  });

  const { data: myTripsData } = useQuery({
    queryKey: ['driver-expense-trips'],
    queryFn: () => driverService.getMyTrips({ page: 1, page_size: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const tripId = Number(form.trip_id);
      return api.post(`/trips/${tripId}/expenses`, {
        category: form.category,
        amount: Number(form.amount),
        payment_mode: form.payment_mode,
        description: form.description || undefined,
        expense_date: new Date(form.expense_date).toISOString(),
      });
    },
    onSuccess: () => {
      toast.success('Expense added successfully');
      setShowCreate(false);
      setForm({
        trip_id: '',
        category: 'fuel',
        amount: '',
        payment_mode: 'cash',
        description: '',
        expense_date: new Date().toISOString().slice(0, 16),
      });
      qc.invalidateQueries({ queryKey: ['driver-expenses'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Failed to add expense');
    },
  });

  const rows = safeArray<ExpenseRow>((data as any)?.data?.items ?? (data as any)?.items ?? data);
  const total = (data as any)?.data?.total ?? (data as any)?.total ?? rows.length;
  const myTrips = safeArray<any>(myTripsData);
  const tripLabelById = new Map(myTrips.map((t: any) => [t.id, t.trip_number]));

  const columns: Column<ExpenseRow>[] = [
    {
      key: 'expense_date',
      header: 'Date',
      render: (row) => <span className="text-sm">{row.expense_date ? new Date(row.expense_date).toLocaleDateString('en-IN') : '-'}</span>,
    },
    {
      key: 'trip_id',
      header: 'Trip',
      render: (row) => <span className="text-sm font-mono">{tripLabelById.get(row.trip_id || 0) || `#${row.trip_id || '-'}`}</span>,
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => <span className="text-sm capitalize">{row.category || '-'}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (row) => <span className="text-sm font-semibold">₹{Number((row.amount || 0) ?? 0).toLocaleString('en-IN')}</span>,
    },
    {
      key: 'payment_mode',
      header: 'Mode',
      render: (row) => <span className="text-sm">{row.payment_mode || '-'}</span>,
    },
    {
      key: 'is_verified',
      header: 'Verification',
      render: (row) => <StatusBadge status={row.is_verified ? 'verified' : 'pending'} />,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="page-subtitle">Submit and track your trip expenses</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-primary flex items-center gap-2" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Add Expense
          </button>
          <Link to="/dashboard" className="btn-secondary">Back</Link>
        </div>
      </div>

      {showCreate && (
        <div className="card space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Add Expense</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Trip</label>
              <select
                className="input-field"
                value={form.trip_id}
                onChange={(e) => setForm((p) => ({ ...p, trip_id: e.target.value }))}
              >
                <option value="">Select trip</option>
                {myTrips.map((trip: any) => (
                  <option key={trip.id} value={trip.id}>{trip.trip_number} - {trip.origin} to {trip.destination}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Category</label>
              <select
                className="input-field"
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              >
                <option value="fuel">Fuel</option>
                <option value="toll">Toll</option>
                <option value="parking">Parking</option>
                <option value="food">Food</option>
                <option value="loading">Loading</option>
                <option value="unloading">Unloading</option>
                <option value="misc">Misc</option>
              </select>
            </div>
            <div>
              <label className="label">Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input-field"
                value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Payment Mode</label>
              <select
                className="input-field"
                value={form.payment_mode}
                onChange={(e) => setForm((p) => ({ ...p, payment_mode: e.target.value }))}
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="fuel_card">Fuel Card</option>
              </select>
            </div>
            <div>
              <label className="label">Date & Time</label>
              <input
                type="datetime-local"
                className="input-field"
                value={form.expense_date}
                onChange={(e) => setForm((p) => ({ ...p, expense_date: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Description</label>
              <input
                className="input-field"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Optional notes"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button
              className="btn-primary"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.trip_id || !form.amount || Number(form.amount) <= 0 || !form.expense_date}
            >
              {createMutation.isPending ? 'Saving...' : 'Save Expense'}
            </button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={rows}
        total={total}
        page={page}
        pageSize={20}
        isLoading={isLoading}
        onPageChange={setPage}
        onRefresh={() => refetch()}
        emptyMessage="No expense records"
      />
    </div>
  );
}
