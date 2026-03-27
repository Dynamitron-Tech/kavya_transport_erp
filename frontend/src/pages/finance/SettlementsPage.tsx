import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { financeService } from '@/services/dataService';
import { safeArray } from '@/utils/helpers';
import { Plus, Check, Banknote } from 'lucide-react';

export default function SettlementsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [driverFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState({ driver_id: '', period_from: '', period_to: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['settlements', driverFilter, statusFilter],
    queryFn: () => financeService.listSettlements({
      driver_id: driverFilter || undefined,
      status: statusFilter || undefined,
    } as any),
  });

  const createMutation = useMutation({
    mutationFn: () => financeService.createSettlement({
      driver_id: Number(form.driver_id),
      period_from: form.period_from,
      period_to: form.period_to,
    }),
    onSuccess: (data: any) => {
      toast.success(`Settlement ${data.settlement_number} generated: ₹${Number(data.net_payable).toLocaleString('en-IN')}`);
      qc.invalidateQueries({ queryKey: ['settlements'] });
      setShowCreate(false);
      setForm({ driver_id: '', period_from: '', period_to: '' });
    },
    onError: () => toast.error('Failed to generate settlement'),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => financeService.approveSettlement(id),
    onSuccess: () => {
      toast.success('Settlement approved');
      qc.invalidateQueries({ queryKey: ['settlements'] });
    },
  });

  const payMutation = useMutation({
    mutationFn: (id: number) => financeService.paySettlement(id),
    onSuccess: () => {
      toast.success('Settlement paid');
      qc.invalidateQueries({ queryKey: ['settlements'] });
    },
  });

  const items = safeArray((data as any)?.data ?? data);

  const statusBadge: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-blue-100 text-blue-800',
    PAID: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
  };

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Driver Settlements</h1>
          <p className="page-subtitle">Generate, approve, and pay driver settlements</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1" /> Generate Settlement
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select className="input-field w-48" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="PAID">Paid</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="table-header">
              <th className="table-cell">Settlement #</th>
              <th className="table-cell">Driver ID</th>
              <th className="table-cell">Period</th>
              <th className="table-cell text-right">Trips</th>
              <th className="table-cell text-right">Earnings</th>
              <th className="table-cell text-right">Deductions</th>
              <th className="table-cell text-right">Net Payable</th>
              <th className="table-cell">Status</th>
              <th className="table-cell">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s: any) => (
              <tr key={s.id} className="border-b hover:bg-gray-50">
                <td className="table-cell font-medium">{s.settlement_number}</td>
                <td className="table-cell">{s.driver_id}</td>
                <td className="table-cell">{s.period_from} – {s.period_to}</td>
                <td className="table-cell text-right">{s.trip_count}</td>
                <td className="table-cell text-right text-green-600">₹{Number(s.total_earnings).toLocaleString('en-IN')}</td>
                <td className="table-cell text-right text-red-600">₹{Number(s.total_deductions).toLocaleString('en-IN')}</td>
                <td className="table-cell text-right font-semibold">₹{Number(s.net_payable).toLocaleString('en-IN')}</td>
                <td className="table-cell">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[s.status] || 'bg-gray-100'}`}>
                    {s.status}
                  </span>
                </td>
                <td className="table-cell">
                  <div className="flex gap-1">
                    {s.status === 'PENDING' && (
                      <button
                        className="btn-icon text-blue-600"
                        title="Approve"
                        onClick={() => approveMutation.mutate(s.id)}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    {s.status === 'APPROVED' && (
                      <button
                        className="btn-icon text-green-600"
                        title="Pay"
                        onClick={() => payMutation.mutate(s.id)}
                      >
                        <Banknote className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={9} className="table-cell text-center text-gray-400 py-8">
                  {isLoading ? 'Loading...' : 'No settlements found'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Generate Driver Settlement</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Driver ID</label>
                <input type="number" className="input-field" placeholder="Driver ID"
                  value={form.driver_id} onChange={(e) => setForm({ ...form, driver_id: e.target.value })} />
              </div>
              <div>
                <label className="label">Period From</label>
                <input type="date" className="input-field"
                  value={form.period_from} onChange={(e) => setForm({ ...form, period_from: e.target.value })} />
              </div>
              <div>
                <label className="label">Period To</label>
                <input type="date" className="input-field"
                  value={form.period_to} onChange={(e) => setForm({ ...form, period_to: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button
                className="btn-primary"
                disabled={!form.driver_id || !form.period_from || !form.period_to || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
