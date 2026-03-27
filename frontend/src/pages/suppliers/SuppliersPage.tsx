import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { supplierService } from '@/services/dataService';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import DataTable, { Column } from '@/components/common/DataTable';
import { StatusBadge, Modal } from '@/components/common/Modal';
import { SubmitButton } from '@/components/common/SubmitButton';
import type { FilterParams } from '@/types';
import { Truck, Phone, Mail, Pencil, Trash2 } from 'lucide-react';
import { safeArray } from '@/utils/helpers';
import { handleApiError } from '../../utils/handleApiError';

const SUPPLIER_TYPE_LABELS: Record<string, string> = {
  broker: 'Broker',
  fleet_owner: 'Fleet Owner',
  individual: 'Individual',
};

export default function SuppliersPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filters] = useState<FilterParams>({ page: 1, page_size: 20 });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const emptyCreate = {
    name: '', code: '', supplier_type: 'broker', phone: '', email: '',
    contact_person: '', pan: '', gstin: '', address: '', city: '', state: '', pincode: '',
    bank_account_number: '', bank_ifsc: '', bank_name: '',
    tds_applicable: true, tds_rate: 1.0, credit_limit: 0, credit_days: 30,
  };
  const [createPayload, setCreatePayload] = useState(emptyCreate);
  const [editPayload, setEditPayload] = useState<Record<string, any>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', filters],
    queryFn: () => supplierService.list(filters),
  });

  const createMutation = useMutation({
    mutationFn: () => supplierService.create(createPayload as any),
    onSuccess: () => {
      setIsCreateOpen(false);
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Supplier created successfully.');
      setCreatePayload(emptyCreate);
    },
    onError: (error) => handleApiError(error, 'Create failed'),
  });

  const editMutation = useMutation({
    mutationFn: (payload: any) => supplierService.update(editItem!.id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Updated successfully');
      setEditItem(null);
    },
    onError: (error) => handleApiError(error, 'Update failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => supplierService.delete(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Deleted successfully');
    },
    onError: (error) => handleApiError(error, 'Delete failed'),
  });

  const handleEdit = (supplier: any) => {
    setEditItem(supplier);
    setEditPayload({
      name: supplier.name || '',
      supplier_type: supplier.supplier_type || 'broker',
      contact_person: supplier.contact_person || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      city: supplier.city || '',
      state: supplier.state || '',
      tds_rate: supplier.tds_rate || 1.0,
      is_active: supplier.is_active ?? true,
    });
  };

  const rows = safeArray<any>(data);

  const columns: Column<any>[] = [
    {
      key: 'code',
      header: 'Code',
      sortable: true,
      render: (s: any) => (
        <button onClick={(e) => { e.stopPropagation(); navigate(`/suppliers/${s.id}`); }} className="font-mono text-sm font-medium text-primary-600 hover:underline">
          {s.code}
        </button>
      ),
    },
    {
      key: 'name',
      header: 'Supplier Name',
      sortable: true,
      render: (s: any) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
            <Truck size={18} className="text-orange-600" />
          </div>
          <div>
            <button onClick={(e) => { e.stopPropagation(); navigate(`/suppliers/${s.id}`); }} className="font-medium text-gray-900 hover:text-primary-600 hover:underline text-left">
              {s.name}
            </button>
            <p className="text-xs text-gray-400">{SUPPLIER_TYPE_LABELS[s.supplier_type] || s.supplier_type}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (s: any) => (
        <div className="text-sm">
          {s.phone && <div className="flex items-center gap-1 text-gray-600"><Phone size={12} /> {s.phone}</div>}
          {s.email && <div className="flex items-center gap-1 text-gray-400 text-xs"><Mail size={12} /> {s.email}</div>}
        </div>
      ),
    },
    {
      key: 'gstin',
      header: 'GSTIN',
      render: (s: any) => <span className="font-mono text-sm">{s.gstin || '—'}</span>,
    },
    {
      key: 'city',
      header: 'City',
      render: (s: any) => <span className="text-sm text-gray-600">{s.city || '—'}</span>,
    },
    {
      key: 'tds_rate',
      header: 'TDS %',
      render: (s: any) => <span className="text-sm">{s.tds_applicable ? `${s.tds_rate}%` : 'N/A'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (s: any) => (
        <StatusBadge status={s.is_active ? 'available' : 'inactive'} />
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (s: any) => (
        <div className="flex gap-2">
          <button onClick={(e) => { e.stopPropagation(); handleEdit(s); }} className="p-1.5 rounded-md hover:bg-gray-100" title="Edit">
            <Pencil size={14} className="text-gray-500" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteId(String(s.id)); }} className="p-1.5 rounded-md hover:bg-red-50" title="Delete">
            <Trash2 size={14} className="text-red-400" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-sm text-gray-500 mt-1">Manage brokers, fleet owners, and contractors for market trucks</p>
        </div>
        <button onClick={() => setIsCreateOpen(true)} className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-white hover:bg-primary-700 font-medium text-sm">
          + Add Supplier
        </button>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        onRowClick={(row) => navigate(`/suppliers/${row.id}`)}
        searchPlaceholder="Search suppliers..."
        emptyMessage="No suppliers found"
      />

      {/* Create Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Add Supplier" size="lg">
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Name *</label>
              <input type="text" required value={createPayload.name} onChange={(e) => setCreatePayload({ ...createPayload, name: e.target.value })} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={createPayload.supplier_type} onChange={(e) => setCreatePayload({ ...createPayload, supplier_type: e.target.value })} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm">
                <option value="broker">Broker</option>
                <option value="fleet_owner">Fleet Owner</option>
                <option value="individual">Individual</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
              <input type="text" required value={createPayload.phone} onChange={(e) => setCreatePayload({ ...createPayload, phone: e.target.value })} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={createPayload.email} onChange={(e) => setCreatePayload({ ...createPayload, email: e.target.value })} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
              <input type="text" value={createPayload.contact_person} onChange={(e) => setCreatePayload({ ...createPayload, contact_person: e.target.value })} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PAN</label>
              <input type="text" value={createPayload.pan} maxLength={10} onChange={(e) => setCreatePayload({ ...createPayload, pan: e.target.value.toUpperCase() })} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN</label>
              <input type="text" value={createPayload.gstin} maxLength={15} onChange={(e) => setCreatePayload({ ...createPayload, gstin: e.target.value.toUpperCase() })} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">TDS Rate (%)</label>
              <input type="number" step="0.01" value={createPayload.tds_rate} onChange={(e) => setCreatePayload({ ...createPayload, tds_rate: parseFloat(e.target.value) || 0 })} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input type="text" value={createPayload.city} onChange={(e) => setCreatePayload({ ...createPayload, city: e.target.value })} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input type="text" value={createPayload.state} onChange={(e) => setCreatePayload({ ...createPayload, state: e.target.value })} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
              <input type="text" value={createPayload.bank_name} onChange={(e) => setCreatePayload({ ...createPayload, bank_name: e.target.value })} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bank Account</label>
              <input type="text" value={createPayload.bank_account_number} onChange={(e) => setCreatePayload({ ...createPayload, bank_account_number: e.target.value })} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
              <input type="text" value={createPayload.bank_ifsc} maxLength={11} onChange={(e) => setCreatePayload({ ...createPayload, bank_ifsc: e.target.value.toUpperCase() })} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Credit Days</label>
              <input type="number" value={createPayload.credit_days} onChange={(e) => setCreatePayload({ ...createPayload, credit_days: parseInt(e.target.value) || 30 })} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setIsCreateOpen(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
            <SubmitButton isLoading={createMutation.isPending} label="Create Supplier" />
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title="Edit Supplier">
        <form onSubmit={(e) => { e.preventDefault(); editMutation.mutate(editPayload); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input type="text" value={editPayload.name || ''} onChange={(e) => setEditPayload({ ...editPayload, name: e.target.value })} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={editPayload.supplier_type || 'broker'} onChange={(e) => setEditPayload({ ...editPayload, supplier_type: e.target.value })} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm">
                <option value="broker">Broker</option>
                <option value="fleet_owner">Fleet Owner</option>
                <option value="individual">Individual</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input type="text" value={editPayload.phone || ''} onChange={(e) => setEditPayload({ ...editPayload, phone: e.target.value })} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={editPayload.email || ''} onChange={(e) => setEditPayload({ ...editPayload, email: e.target.value })} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">TDS Rate (%)</label>
              <input type="number" step="0.01" value={editPayload.tds_rate || ''} onChange={(e) => setEditPayload({ ...editPayload, tds_rate: parseFloat(e.target.value) || 0 })} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={editPayload.is_active ? 'active' : 'inactive'} onChange={(e) => setEditPayload({ ...editPayload, is_active: e.target.value === 'active' })} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setEditItem(null)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
            <SubmitButton isLoading={editMutation.isPending} label="Save Changes" />
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteId}
        title="Delete Supplier"
        message="Are you sure you want to delete this supplier? This action cannot be undone."
        onConfirm={() => { if (deleteId) { deleteMutation.mutate(deleteId); setDeleteId(null); } }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
