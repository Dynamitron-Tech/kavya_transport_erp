import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { accountantService, tripService } from '@/services/dataService';
import api from '@/services/api';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { KPICard, Modal } from '@/components/common/Modal';
import { SubmitButton } from '@/components/common/SubmitButton';
import DataTable from '@/components/common/DataTable';
import {
  Receipt, Clock, CheckCircle, XCircle, Plus,
  ThumbsUp, ThumbsDown, Fuel, Truck, Wrench, Building, MoreHorizontal, Pencil, Trash2,
} from 'lucide-react';
import type { AccountantExpenseItem, AccountantExpenseCategory } from '@/types';
import { safeArray } from '@/utils/helpers';
import { useAuthStore } from '@/store/authStore';
import { handleApiError } from '../../utils/handleApiError';

const CATEGORY_CONFIG: Record<AccountantExpenseCategory, { label: string; icon: typeof Fuel; color: string }> = {
  fuel: { label: 'Fuel', icon: Fuel, color: 'text-red-600 bg-red-50' },
  driver_allowance: { label: 'Driver Allowance', icon: Truck, color: 'text-blue-600 bg-blue-50' },
  toll: { label: 'Toll', icon: Receipt, color: 'text-purple-600 bg-purple-50' },
  vehicle_maintenance: { label: 'Maintenance', icon: Wrench, color: 'text-orange-600 bg-orange-50' },
  office: { label: 'Office', icon: Building, color: 'text-teal-600 bg-teal-50' },
  miscellaneous: { label: 'Miscellaneous', icon: MoreHorizontal, color: 'text-gray-600 bg-gray-100' },
};

const CATEGORY_TABS: { key: AccountantExpenseCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'fuel', label: 'Fuel' },
  { key: 'driver_allowance', label: 'Driver' },
  { key: 'toll', label: 'Toll' },
  { key: 'vehicle_maintenance', label: 'Maintenance' },
  { key: 'office', label: 'Office' },
  { key: 'miscellaneous', label: 'Other' },
];

export default function AccountantExpensesPage() {
  const { hasPermission } = useAuthStore();
  const canCreateExpense = hasPermission('expense:create');
  const [catFilter, setCatFilter] = useState<AccountantExpenseCategory | 'all'>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteExpenseId, setDeleteExpenseId] = useState<number | null>(null);
  const [editExpense, setEditExpense] = useState<AccountantExpenseItem | null>(null);
  const [editForm, setEditForm] = useState({ amount: '', description: '' });
  const [createForm, setCreateForm] = useState({
    trip_id: '',
    expense_type: 'FUEL',
    amount: '',
    description: '',
  });
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['accountant-expenses', catFilter],
    queryFn: () => api.get('/expenses', { params: { page: 1, limit: 200, category: catFilter === 'all' ? undefined : catFilter } }),
  });

  const { data: tripsData } = useQuery({
    queryKey: ['expenses-create-trips'],
    queryFn: () => tripService.list({ page: 1, page_size: 500 }),
  });

  const approveMut = useMutation({
    mutationFn: (id: number) => accountantService.approveExpense(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accountant-expenses'] }),
  });

  const rejectMut = useMutation({
    mutationFn: (id: number) => accountantService.rejectExpense(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accountant-expenses'] }),
  });

  const createMut = useMutation({
    mutationFn: () => {
      const categoryMap: Record<string, string> = {
        FUEL: 'fuel',
        TOLL: 'toll',
        LOADING: 'loading',
        UNLOADING: 'unloading',
        DRIVER_ALLOWANCE: 'advance',
        BREAKDOWN_REPAIR: 'repair',
        OTHER: 'misc',
      };
      return tripService.addExpense(Number(createForm.trip_id), {
        category: categoryMap[createForm.expense_type] || 'misc',
        amount: Number(createForm.amount || 0),
        description: createForm.description,
        payment_mode: 'cash',
        expense_date: new Date().toISOString(),
      } as any);
    },
    onSuccess: () => {
      setIsCreateOpen(false);
      qc.invalidateQueries({ queryKey: ['accountant-expenses'] });
      toast.success('Expense created successfully.');
      setCreateForm({
        trip_id: '',
        expense_type: 'FUEL',
        amount: '',
        description: '',
      });
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      try {
        return await api.put(`/expenses/${id}`, payload);
      } catch {
        return api.put(`/accountant/expenses/${id}`, payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accountant-expenses'] });
      toast.success('Expense updated successfully.');
    },
    onError: (error: any) => handleApiError(error, 'Failed to update expense.'),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      try {
        return await api.delete(`/expenses/${id}`);
      } catch {
        return api.delete(`/accountant/expenses/${id}`);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accountant-expenses'] });
      toast.success('Expense deleted successfully.');
    },
    onError: (error: any) => handleApiError(error, 'Failed to delete expense.'),
  });

  const handleEditExpense = (item: AccountantExpenseItem) => {
    setEditExpense(item);
    setEditForm({ amount: String(item.amount || ''), description: item.description || '' });
  };

  const items = safeArray<any>(data).map((item: any) => ({
    id: item.id,
    expense_number: item.expense_number || String(item.id),
    trip_ref: item.trip_ref || '-',
    driver: item.driver || '-',
    payment_method: item.payment_method || 'cash',
    vendor: item.vendor || '-',
    date: item.expense_date || item.date,
    category: item.category || 'miscellaneous',
    description: item.description || '-',
    vehicle: item.vehicle || '-',
    amount: Number(item.amount || 0),
    status: item.is_verified ? 'approved' : 'pending',
    receipt_url: item.receipt_url || null,
  })) as AccountantExpenseItem[];
  const summary = (data as any)?.summary || { total: 0, pending_approval: 0, approved: 0, rejected: 0 };

  const fmt = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;

  const columns = [
    {
      key: 'date' as const,
      header: 'Date',
      render: (item: AccountantExpenseItem) => (
        <span className="text-sm">{new Date(item.date).toLocaleDateString('en-IN')}</span>
      ),
    },
    {
      key: 'category' as const,
      header: 'Category',
      render: (item: AccountantExpenseItem) => {
        const cfg = CATEGORY_CONFIG[item.category as AccountantExpenseCategory] || CATEGORY_CONFIG.miscellaneous;
        const Icon = cfg.icon;
        return (
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
            <Icon size={12} /> {cfg.label}
          </span>
        );
      },
    },
    {
      key: 'description' as const,
      header: 'Description',
      render: (item: AccountantExpenseItem) => (
        <div>
          <p className="text-sm font-medium text-gray-900">{item.description}</p>
          {item.receipt_url && <p className="text-xs text-gray-400">Receipt: {item.receipt_url}</p>}
        </div>
      ),
    },
    {
      key: 'vehicle_number' as const,
      header: 'Vehicle',
      render: (item: AccountantExpenseItem) => (
        <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">{item.vehicle || '—'}</span>
      ),
    },
    {
      key: 'amount' as const,
      header: 'Amount',
      render: (item: AccountantExpenseItem) => (
        <span className="font-bold text-sm">{fmt(item.amount)}</span>
      ),
    },
    {
      key: 'status' as const,
      header: 'Status',
      render: (item: AccountantExpenseItem) => {
        const colors: Record<string, string> = {
          pending: 'bg-amber-50 text-amber-700',
          approved: 'bg-green-50 text-green-700',
          rejected: 'bg-red-50 text-red-700',
        };
        return (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[item.status] || 'bg-gray-100'}`}>
            {item.status}
          </span>
        );
      },
    },
    {
      key: 'id' as const,
      header: 'Actions',
      render: (item: AccountantExpenseItem) => (
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleEditExpense(item)}
              className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
              title="Edit"
            >
              <Pencil size={14} />
            </button>
          {item.status === 'pending' && (
            <>
            <button
              onClick={() => approveMut.mutate(item.id)}
              className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors"
              title="Approve"
            >
              <ThumbsUp size={14} />
            </button>
            <button
              onClick={() => rejectMut.mutate(item.id)}
              className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
              title="Reject"
            >
              <ThumbsDown size={14} />
            </button>
            </>
          )}
            <button
              onClick={() => {
                setDeleteExpenseId(item.id);
              }}
              className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Expense Management</h1>
          <p className="page-subtitle">Track and approve all operational expenses</p>
          {!canCreateExpense && (
            <p className="text-xs text-amber-700 mt-1">You have read/approval access for expenses. Create is restricted by role permission.</p>
          )}
        </div>
        {canCreateExpense && (
          <button type="button" onClick={() => setIsCreateOpen(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Add Expense
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Total Expenses" value={fmt(summary.total)} icon={<Receipt size={22} />} color="bg-blue-50 text-blue-600" />
        <KPICard title="Pending Approval" value={fmt(summary.pending_approval)} icon={<Clock size={22} />} color="bg-amber-50 text-amber-600" />
        <KPICard title="Approved" value={fmt(summary.approved)} icon={<CheckCircle size={22} />} color="bg-green-50 text-green-600" />
        <KPICard title="Rejected" value={fmt(summary.rejected)} icon={<XCircle size={22} />} color="bg-red-50 text-red-600" />
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit overflow-x-auto">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setCatFilter(tab.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              catFilter === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <DataTable
          data={items}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No expenses found"
        />
      </div>

      {/* Create Expense Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Add New Expense" size="md">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trip</label>
            <select className="input-field" value={createForm.trip_id} onChange={(e) => setCreateForm((prev) => ({ ...prev, trip_id: e.target.value }))} required>
              <option value="">Select trip</option>
              {safeArray<any>((tripsData as any)?.items ?? tripsData).map((trip: any) => (
                <option key={trip.id} value={trip.id}>{trip.trip_number || `Trip #${trip.id}`}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expense Type</label>
            <select className="input-field" value={createForm.expense_type} onChange={(e) => setCreateForm((prev) => ({ ...prev, expense_type: e.target.value }))}>
              <option value="FUEL">FUEL</option>
              <option value="TOLL">TOLL</option>
              <option value="LOADING">LOADING</option>
              <option value="UNLOADING">UNLOADING</option>
              <option value="DRIVER_ALLOWANCE">DRIVER_ALLOWANCE</option>
              <option value="BREAKDOWN_REPAIR">BREAKDOWN_REPAIR</option>
              <option value="OTHER">OTHER</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
              <input type="number" className="input-field" placeholder="0.00" value={createForm.amount} onChange={(e) => setCreateForm((prev) => ({ ...prev, amount: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea className="input-field" rows={2} placeholder="Describe the expense..." value={createForm.description} onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t">
            <button type="button" onClick={() => setIsCreateOpen(false)} className="btn-secondary">Cancel</button>
            <SubmitButton isLoading={createMut.isPending} label="Submit Expense" loadingLabel="Submitting..." disabled={!createForm.trip_id || !createForm.amount || !createForm.description} />
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!editExpense} onClose={() => setEditExpense(null)} title="Edit Expense" size="md">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!editExpense) return;
            const amount = Number(editForm.amount);
            if (Number.isNaN(amount) || amount <= 0) {
              toast.error('Invalid amount.');
              return;
            }
            updateMut.mutate({
              id: editExpense.id,
              payload: {
                amount,
                description: editForm.description,
                category: editExpense.category,
                date: editExpense.date,
              },
            });
            setEditExpense(null);
          }}
        >
          <div>
            <label className="label">Amount (₹)</label>
            <input type="number" className="input-field" value={editForm.amount} onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input-field" rows={2} value={editForm.description} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} required />
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t">
            <button type="button" className="btn-secondary" onClick={() => setEditExpense(null)}>Cancel</button>
            <SubmitButton isLoading={updateMut.isPending} label="Save Changes" />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleteExpenseId !== null}
        title="Delete Expense"
        message="This action cannot be undone. Are you sure?"
        confirmLabel="Delete"
        isDangerous={true}
        onConfirm={() => {
          if (deleteExpenseId === null) return;
          deleteMut.mutate(deleteExpenseId);
          setDeleteExpenseId(null);
        }}
        onCancel={() => setDeleteExpenseId(null)}
      />
    </div>
  );
}

