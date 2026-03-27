import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { clientService } from '@/services/dataService';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import DataTable, { Column } from '@/components/common/DataTable';
import { StatusBadge, Modal } from '@/components/common/Modal';
import { SubmitButton } from '@/components/common/SubmitButton';
import { useAuthStore } from '@/store/authStore';
import type { FilterParams } from '@/types';
import { Building2, Phone, Mail, Pencil, Trash2 } from 'lucide-react';
import { safeArray } from '@/utils/helpers';
import { exportTableToPdf } from '@/utils/pdfExport';
import { handleApiError } from '../../utils/handleApiError';

export default function ClientsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  useAuthStore();
  const [filters, setFilters] = useState<FilterParams>({ page: 1, page_size: 20 });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const emptyCreate = {
    name: '', code: '', client_type: 'corporate', gstin: '', email: '', phone: '',
    address_line1: '', city: '', state: '', pincode: '', credit_limit: 0, credit_days: 30,
  };
  const [createPayload, setCreatePayload] = useState(emptyCreate);
  const [editPayload, setEditPayload] = useState({ name: '', email: '', phone: '', city: '', state: '' });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['clients', filters],
    queryFn: () => clientService.list(filters),
  });

  const createMutation = useMutation({
    mutationFn: () => clientService.create(createPayload as any),
    onSuccess: () => {
      setIsCreateOpen(false);
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client created successfully.');
      setCreatePayload(emptyCreate);
    },
    onError: (error) => handleApiError(error, 'Create failed'),
  });

  const editMutation = useMutation({
    mutationFn: (payload: any) => clientService.update(editItem!.id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Updated successfully');
      setEditItem(null);
    },
    onError: (error) => handleApiError(error, 'Update failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clientService.delete(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Deleted successfully');
    },
    onError: (error) => handleApiError(error, 'Delete failed'),
  });

  const handleEdit = (client: any) => {
    setEditItem(client);
    setEditPayload({
      name: client.name || '',
      email: client.email || '',
      phone: client.phone || '',
      city: client.city || '',
      state: client.state || '',
    });
  };

  const rows = safeArray<any>(data);

  const handleExportPdf = () => {
    exportTableToPdf({
      title: 'Clients Report',
      fileName: `clients-${new Date().toISOString().slice(0, 10)}.pdf`,
      rows,
      columns: [
        { header: 'Code', accessor: (c) => c.code },
        { header: 'Client Name', accessor: (c) => c.name },
        { header: 'GST Number', accessor: (c) => c.gstin },
        { header: 'Phone', accessor: (c) => c.phone },
        { header: 'Email', accessor: (c) => c.email },
        { header: 'City', accessor: (c) => c.city },
        { header: 'Credit Limit', accessor: (c) => `INR ${Number(c.credit_limit || 0).toLocaleString('en-IN')}` },
        { header: 'Outstanding', accessor: (c) => `INR ${Number(c.outstanding_amount || 0).toLocaleString('en-IN')}` },
        { header: 'Status', accessor: (c) => (c.is_active ? 'Active' : 'Inactive') },
      ],
    });
  };

  const columns: Column<any>[] = [
    {
      key: 'code',
      header: 'Code',
      sortable: true,
      render: (c: any) => (
        <button onClick={(e) => { e.stopPropagation(); navigate(`/clients/${c.id}`); }} className="font-mono text-sm font-medium text-primary-600 hover:underline">
          {c.code}
        </button>
      ),
    },
    {
      key: 'name',
      header: 'Client Name',
      sortable: true,
      render: (c: any) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Building2 size={18} className="text-blue-600" />
          </div>
          <div>
            <button onClick={(e) => { e.stopPropagation(); navigate(`/clients/${c.id}`); }} className="font-medium text-gray-900 hover:text-primary-600 hover:underline text-left">
              {c.name}
            </button>
            <p className="text-xs text-gray-400 capitalize">{c.client_type}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'gstin',
      header: 'GST Number',
      render: (c: any) => <span className="font-mono text-sm">{c.gstin || '—'}</span>,
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (c: any) => (
        <div className="text-sm">
          {c.phone && <div className="flex items-center gap-1 text-gray-600"><Phone size={12} /> {c.phone}</div>}
          {c.email && <div className="flex items-center gap-1 text-gray-400 text-xs"><Mail size={12} /> {c.email}</div>}
        </div>
      ),
    },
    {
      key: 'city',
      header: 'City',
      render: (c: any) => c.city || '—',
    },
    {
      key: 'credit_limit',
      header: 'Credit Limit',
      sortable: true,
      render: (c: any) => `₹${Number(c.credit_limit || 0).toLocaleString('en-IN')}`,
    },
    {
      key: 'outstanding_amount',
      header: 'Outstanding',
      sortable: true,
      render: (c: any) => (
        <span className={Number(c.outstanding_amount || 0) > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}>
          ₹{Number(c.outstanding_amount || 0).toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (c: any) => <StatusBadge status={c.is_active ? 'active' : 'inactive'} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (c: any) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={(e) => { e.stopPropagation(); handleEdit(c); }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg" title="Edit"><Pencil className="w-4 h-4" /></button>
          <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteId(String(c.id)); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">Manage your client base and billing</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        total={(data as any)?.total || (data as any)?.pagination?.total || 0}
        page={filters.page}
        pageSize={filters.page_size}
        isLoading={isLoading}
        searchPlaceholder="Search clients..."
        onSearch={(q) => setFilters({ ...filters, search: q, page: 1 })}
        onPageChange={(p) => setFilters({ ...filters, page: p })}
        onSort={(key, order) => setFilters({ ...filters, sort_by: key, sort_order: order })}
        onRowClick={(c: any) => navigate(`/clients/${c.id}`)}
        onAdd={() => setIsCreateOpen(true)}
        addLabel="Add Client"
        onRefresh={() => refetch()}
        onExport={handleExportPdf}
        emptyMessage="No clients found. Create your first client to get started."
      />

      {/* Create Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Add New Client" size="lg" footer={
        <>
          <button className="btn-secondary" onClick={() => setIsCreateOpen(false)}>Cancel</button>
          <button className="btn-primary" disabled={createMutation.isPending || !createPayload.name || !createPayload.code} onClick={() => createMutation.mutate()}>
            {createMutation.isPending ? 'Creating...' : 'Create Client'}
          </button>
        </>
      }>
        <form className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Client Name *</label><input type="text" className="input-field" placeholder="Enter client name" value={createPayload.name} onChange={(e) => setCreatePayload(p => ({ ...p, name: e.target.value }))} /></div>
            <div><label className="label">Client Code *</label><input type="text" className="input-field" placeholder="e.g., CLI001" value={createPayload.code} onChange={(e) => setCreatePayload(p => ({ ...p, code: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Client Type</label>
              <select className="input-field" value={createPayload.client_type} onChange={(e) => setCreatePayload(p => ({ ...p, client_type: e.target.value }))}>
                <option value="corporate">Corporate</option><option value="individual">Individual</option><option value="government">Government</option>
              </select>
            </div>
            <div><label className="label">GSTIN</label><input type="text" className="input-field" placeholder="22AAAAA0000A1Z5" value={createPayload.gstin} onChange={(e) => setCreatePayload(p => ({ ...p, gstin: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Email</label><input type="email" className="input-field" placeholder="client@example.com" value={createPayload.email} onChange={(e) => setCreatePayload(p => ({ ...p, email: e.target.value }))} /></div>
            <div><label className="label">Phone</label><input type="tel" className="input-field" placeholder="+91 98765 43210" value={createPayload.phone} onChange={(e) => setCreatePayload(p => ({ ...p, phone: e.target.value }))} /></div>
          </div>
          <div><label className="label">Address</label><textarea className="input-field" rows={2} placeholder="Enter address" value={createPayload.address_line1} onChange={(e) => setCreatePayload(p => ({ ...p, address_line1: e.target.value }))} /></div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="label">City</label><input type="text" className="input-field" placeholder="City" value={createPayload.city} onChange={(e) => setCreatePayload(p => ({ ...p, city: e.target.value }))} /></div>
            <div><label className="label">State</label><input type="text" className="input-field" placeholder="State" value={createPayload.state} onChange={(e) => setCreatePayload(p => ({ ...p, state: e.target.value }))} /></div>
            <div><label className="label">Pincode</label><input type="text" className="input-field" placeholder="560001" value={createPayload.pincode} onChange={(e) => setCreatePayload(p => ({ ...p, pincode: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Credit Limit (₹)</label><input type="number" className="input-field" placeholder="500000" value={createPayload.credit_limit} onChange={(e) => setCreatePayload(p => ({ ...p, credit_limit: Number(e.target.value) || 0 }))} /></div>
            <div><label className="label">Credit Days</label><input type="number" className="input-field" placeholder="30" value={createPayload.credit_days} onChange={(e) => setCreatePayload(p => ({ ...p, credit_days: Number(e.target.value) || 0 }))} /></div>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title={`Edit ${editItem?.name || ''}`} size="lg">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); editMutation.mutate(editPayload); }}>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Client Name</label><input className="input-field" value={editPayload.name} onChange={(e) => setEditPayload(p => ({ ...p, name: e.target.value }))} required /></div>
            <div><label className="label">Email</label><input className="input-field" value={editPayload.email} onChange={(e) => setEditPayload(p => ({ ...p, email: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="label">Phone</label><input className="input-field" value={editPayload.phone} onChange={(e) => setEditPayload(p => ({ ...p, phone: e.target.value }))} /></div>
            <div><label className="label">City</label><input className="input-field" value={editPayload.city} onChange={(e) => setEditPayload(p => ({ ...p, city: e.target.value }))} /></div>
            <div><label className="label">State</label><input className="input-field" value={editPayload.state} onChange={(e) => setEditPayload(p => ({ ...p, state: e.target.value }))} /></div>
          </div>
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
            <button type="button" onClick={() => setEditItem(null)} className="btn-secondary">Cancel</button>
            <SubmitButton isLoading={editMutation.isPending} label="Save Changes" />
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} title="Delete Record" message="This action cannot be undone." confirmLabel="Delete" isDangerous={true}
        onConfirm={() => { if (!deleteId) return; deleteMutation.mutate(deleteId); setDeleteId(null); }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
