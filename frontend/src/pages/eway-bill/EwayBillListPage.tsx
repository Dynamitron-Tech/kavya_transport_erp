// ============================================================
// E-Way Bill List Page — Paginated, filterable table view
// ============================================================

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ewayBillService, lrService } from '@/services/dataService';
import api from '@/services/api';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Modal } from '@/components/common/Modal';
import { SubmitButton } from '@/components/common/SubmitButton';
import { safeArray } from '@/utils/helpers';
import { handleApiError } from '../../utils/handleApiError';
import {
  Plus, ChevronRight, Search, Download,
  Eye, Edit, ChevronLeft, Trash2, XCircle,
  AlertCircle, ReceiptText
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  draft:      { label: 'Draft',      color: 'text-gray-700',    bg: 'bg-gray-100',         dot: 'bg-gray-400'    },
  generated:  { label: 'Generated',  color: 'text-emerald-700', bg: 'bg-emerald-50',        dot: 'bg-emerald-500' },
  active:     { label: 'Active',     color: 'text-blue-700',    bg: 'bg-blue-50',          dot: 'bg-blue-500'    },
  in_transit: { label: 'In Transit', color: 'text-purple-700',  bg: 'bg-purple-50',        dot: 'bg-purple-500'  },
  extended:   { label: 'Extended',   color: 'text-amber-700',   bg: 'bg-amber-50',         dot: 'bg-amber-500'   },
  completed:  { label: 'Completed',  color: 'text-green-700',   bg: 'bg-green-50',         dot: 'bg-green-500'   },
  cancelled:  { label: 'Cancelled',  color: 'text-red-700',     bg: 'bg-red-50',           dot: 'bg-red-500'     },
  expired:    { label: 'Expired',    color: 'text-orange-700',  bg: 'bg-orange-50',        dot: 'bg-orange-500'  },
};

const StatusBadge = ({ status }: { status: string }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full ${cfg.bg} ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

const fmt = (v: number | undefined | null) => (v ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function EwayBillListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<any | null>(null);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [createForm, setCreateForm] = useState({
    lr_id: '',
    ewb_number: '',
    validity_date: new Date().toISOString().slice(0, 10),
    goods_value: '',
    from_state: '',
    to_state: '',
  });
  const [editForm, setEditForm] = useState({ supplier_name: '', recipient_name: '', vehicle_number: '' });

  const limit = 15;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['eway-bills', page, search, statusFilter],
    queryFn: () => ewayBillService.list({ page, limit, search: search || undefined, status: statusFilter || undefined }),
  });

  const { data: lrsData } = useQuery({
    queryKey: ['eway-create-lrs'],
    queryFn: () => lrService.list({ page: 1, page_size: 500 }),
  });

  const items = safeArray(data);
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const deleteMutation = useMutation({
    mutationFn: (id: number) => ewayBillService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eway-bills'] });
      toast.success('E-Way Bill deleted successfully.');
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => ewayBillService.cancel(id, { reason: 'Cancelled from list action' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eway-bills'] });
      toast.success('E-Way Bill cancelled successfully.');
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => ewayBillService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eway-bills'] });
      toast.success('E-Way Bill updated successfully.');
      setEditItem(null);
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const createMutation = useMutation({
    mutationFn: () => ewayBillService.create({
      lr_id: createForm.lr_id ? Number(createForm.lr_id) : null,
      document_number: createForm.ewb_number,
      document_date: createForm.validity_date,
      from_gstin: '29ABCDE1234F1Z5',
      from_name: 'Dispatch Party',
      from_place: createForm.from_state,
      from_state_code: '29',
      from_pincode: '560001',
      to_name: 'Delivery Party',
      to_place: createForm.to_state,
      to_state_code: '33',
      to_pincode: '600001',
      total_value: Number(createForm.goods_value || 0),
      total_invoice_value: Number(createForm.goods_value || 0),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eway-bills'] });
      toast.success('E-Way Bill created successfully.');
      setIsCreateOpen(false);
      setCreateForm({
        lr_id: '',
        ewb_number: '',
        validity_date: new Date().toISOString().slice(0, 10),
        goods_value: '',
        from_state: '',
        to_state: '',
      });
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const handleDelete = (eway: any) => setDeleteItem(eway);
  const handleEdit = (eway: any) => {
    setEditItem(eway);
    setEditForm({
      supplier_name: eway.supplier_name || '',
      recipient_name: eway.recipient_name || '',
      vehicle_number: eway.vehicle_number || '',
    });
  };

  // Quick stats


  return (
    <div className="max-w-[1200px] mx-auto pb-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-4">
        <Link to="/dashboard" className="hover:text-primary-600">Dashboard</Link>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="text-gray-900 font-semibold">E-Way Bills</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ReceiptText size={22} className="text-primary-600" /> E-Way Bills
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total record{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => {}} className="btn-ghost flex items-center gap-1.5 text-sm"><Download size={15} /> Export</button>
          <button type="button" onClick={() => setIsCreateOpen(true)} className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus size={15} /> Generate E-Way Bill
          </button>
        </div>
      </div>

      {/* Quick Status Tabs */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        <button onClick={() => { setStatusFilter(''); setPage(1); }}
          className={`whitespace-nowrap px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
            !statusFilter ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
          }`}>All ({total})</button>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <button key={key} onClick={() => { setStatusFilter(key); setPage(1); }}
            className={`whitespace-nowrap px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              statusFilter === key ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}>{cfg.label}</button>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by E-Way Bill number, supplier, recipient, vehicle…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-200 placeholder-gray-400" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary-600" />
          </div>
        ) : isError ? (
          <div className="text-center py-20">
            <AlertCircle size={32} className="mx-auto text-red-400 mb-2" />
            <p className="text-sm text-gray-500">Failed to load E-Way Bills</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <ReceiptText size={40} className="mx-auto text-gray-300 mb-3" />
            <h3 className="text-base font-medium text-gray-600">No E-Way Bills found</h3>
            <p className="text-sm text-gray-400 mt-1">{search ? 'Try adjusting your search' : 'Generate your first E-Way Bill'}</p>
            {!search && (
              <button type="button" onClick={() => setIsCreateOpen(true)} className="btn-primary text-sm mt-4 inline-flex items-center gap-1.5">
                <Plus size={15} /> Generate E-Way Bill
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-4 py-2.5 text-left">E-Way Bill No.</th>
                  <th className="px-4 py-2.5 text-left">Date</th>
                  <th className="px-4 py-2.5 text-left">Supplier</th>
                  <th className="px-4 py-2.5 text-left">Recipient</th>
                  <th className="px-4 py-2.5 text-right">Invoice Value (₹)</th>
                  <th className="px-4 py-2.5 text-center">Vehicle</th>
                  <th className="px-4 py-2.5 text-center">Status</th>
                  <th className="px-4 py-2.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((eway: any, index: number) => {
                  const rowKey = `${eway.id ?? 'no-id'}-${eway.eway_bill_number ?? 'no-bill'}-${index}`;
                  return (
                    <tr key={rowKey} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => navigate(`/lr/eway-bill/${eway.id}`)}>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-primary-700 font-mono text-xs">{eway.eway_bill_number}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{eway.eway_bill_date || '—'}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 text-xs">{eway.supplier_name || '—'}</p>
                        <p className="text-xs text-gray-400">{eway.supplier_city}, {eway.supplier_state_code}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 text-xs">{eway.recipient_name || '—'}</p>
                        <p className="text-xs text-gray-400">{eway.recipient_city}, {eway.recipient_state_code}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">₹{fmt(eway.total_invoice_value)}</td>
                      <td className="px-4 py-3 text-center font-mono text-xs text-gray-600">{eway.vehicle_number || '—'}</td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={eway.status} /></td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => navigate(`/lr/eway-bill/${eway.id}`)} className="p-1.5 text-gray-400 hover:text-primary-600 rounded-md hover:bg-gray-100" title="View"><Eye size={14} /></button>
                          {eway.status === 'draft' && (
                            <button onClick={() => handleEdit(eway)} className="p-1.5 text-gray-400 hover:text-primary-600 rounded-md hover:bg-gray-100" title="Edit"><Edit size={14} /></button>
                          )}
                          {eway.status !== 'cancelled' && eway.status !== 'completed' && (
                            <button onClick={() => cancelMutation.mutate(Number(eway.id))} className="p-1.5 text-amber-500 hover:text-amber-700 rounded-md hover:bg-amber-50" title="Cancel"><XCircle size={14} /></button>
                          )}
                          <button onClick={() => handleDelete(eway)} className="p-1.5 text-red-500 hover:text-red-700 rounded-md hover:bg-red-50" title="Delete"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-40"><ChevronLeft size={16} /></button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p: number;
                if (totalPages <= 5) p = i + 1;
                else if (page <= 3) p = i + 1;
                else if (page >= totalPages - 2) p = totalPages - 4 + i;
                else p = page - 2 + i;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 text-xs font-medium rounded-md transition-colors ${
                      p === page ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}>{p}</button>
                );
              })}
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-40"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!deleteItem}
        title="Delete E-Way Bill"
        message={deleteItem ? `Delete E-Way Bill ${deleteItem.eway_bill_number}? This action cannot be undone.` : ''}
        confirmLabel="Delete"
        isDangerous={true}
        onConfirm={() => {
          if (!deleteItem) return;
          deleteMutation.mutate(Number(deleteItem.id));
          setDeleteItem(null);
        }}
        onCancel={() => setDeleteItem(null)}
      />

      <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title="Edit E-Way Bill" size="md">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!editItem) return;
            updateMutation.mutate({
              id: Number(editItem.id),
              payload: {
                supplier_name: editForm.supplier_name,
                recipient_name: editForm.recipient_name,
                vehicle_number: editForm.vehicle_number,
              },
            });
          }}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Name</label>
            <input className="input-field" value={editForm.supplier_name} onChange={(e) => setEditForm((p) => ({ ...p, supplier_name: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Name</label>
            <input className="input-field" value={editForm.recipient_name} onChange={(e) => setEditForm((p) => ({ ...p, recipient_name: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Number</label>
            <input className="input-field" value={editForm.vehicle_number} onChange={(e) => setEditForm((p) => ({ ...p, vehicle_number: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setEditItem(null)}>Cancel</button>
            <SubmitButton isLoading={updateMutation.isPending} label="Save Changes" />
          </div>
        </form>
      </Modal>

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create E-Way Bill" size="md">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">LR</label>
            <select className="input-field" value={createForm.lr_id} onChange={(e) => setCreateForm((p) => ({ ...p, lr_id: e.target.value }))}>
              <option value="">Select LR</option>
              {safeArray<any>((lrsData as any)?.items ?? lrsData).map((lr: any) => (
                <option key={lr.id} value={lr.id}>{lr.lr_number || `LR #${lr.id}`}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-Way Bill Number</label>
            <input className="input-field" value={createForm.ewb_number} onChange={(e) => setCreateForm((p) => ({ ...p, ewb_number: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Validity Date</label>
            <input type="date" className="input-field" value={createForm.validity_date} onChange={(e) => setCreateForm((p) => ({ ...p, validity_date: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Goods Value</label>
            <input type="number" min="0" step="0.01" className="input-field" value={createForm.goods_value} onChange={(e) => setCreateForm((p) => ({ ...p, goods_value: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From State</label>
              <input className="input-field" value={createForm.from_state} onChange={(e) => setCreateForm((p) => ({ ...p, from_state: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To State</label>
              <input className="input-field" value={createForm.to_state} onChange={(e) => setCreateForm((p) => ({ ...p, to_state: e.target.value }))} required />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setIsCreateOpen(false)}>Cancel</button>
            <SubmitButton isLoading={createMutation.isPending} label="Create E-Way Bill" loadingLabel="Creating..." disabled={!createForm.ewb_number || !createForm.validity_date || !createForm.from_state || !createForm.to_state} />
          </div>
        </form>
      </Modal>
    </div>
  );
}

