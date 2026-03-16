import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';
import { clientService, financeService, tripService } from '@/services/dataService';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import DataTable, { Column } from '@/components/common/DataTable';
import { Modal, StatusBadge } from '@/components/common/Modal';
import { SubmitButton } from '@/components/common/SubmitButton';
import { useAuthStore } from '@/store/authStore';
import type { Invoice, FilterParams } from '@/types';
import { CheckCircle2, Pencil, Send, Trash2 } from 'lucide-react';
import { safeArray } from '@/utils/helpers';
import { handleApiError } from '../../utils/handleApiError';

export default function InvoicesPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuthStore();
  const [filters, setFilters] = useState<FilterParams>({ page: 1, page_size: 20 });
  const [deleteInvoice, setDeleteInvoice] = useState<Invoice | null>(null);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [editDueDate, setEditDueDate] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    client_id: '',
    trip_ids: [] as string[],
    billing_period_start: new Date().toISOString().slice(0, 10),
    billing_period_end: new Date().toISOString().slice(0, 10),
    payment_due_date: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['invoices', filters],
    queryFn: () => financeService.listInvoices(filters),
  });

  const { data: clientsData } = useQuery({
    queryKey: ['invoice-create-clients'],
    queryFn: () => clientService.list({ page: 1, page_size: 500 }),
  });

  const { data: tripsData } = useQuery({
    queryKey: ['invoice-create-trips'],
    queryFn: () => tripService.list({ page: 1, page_size: 500 }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Invoice> }) => financeService.updateInvoice(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice updated successfully.');
      setEditInvoice(null);
      setEditDueDate('');
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const sendMutation = useMutation({
    mutationFn: (id: number) => financeService.sendInvoice(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice sent successfully.');
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const selectedClient = safeArray<any>((clientsData as any)?.items ?? clientsData).find((c: any) => String(c.id) === createForm.client_id);
      return financeService.createInvoice({
        client_id: Number(createForm.client_id),
        invoice_date: createForm.billing_period_end,
        due_date: createForm.payment_due_date,
        billing_name: selectedClient?.name || `Client #${createForm.client_id}`,
        notes: createForm.notes || `Billing period: ${createForm.billing_period_start} to ${createForm.billing_period_end}`,
        items: createForm.trip_ids.map((tripId, idx) => ({
          description: `Trip ${tripId} billing`,
          quantity: 1,
          rate: 1000,
          tax_rate: 18,
          trip_id: Number(tripId),
          item_number: idx + 1,
        })),
      } as Partial<Invoice>);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice created successfully.');
      setCreateForm({
        client_id: '',
        trip_ids: [],
        billing_period_start: new Date().toISOString().slice(0, 10),
        billing_period_end: new Date().toISOString().slice(0, 10),
        payment_due_date: new Date().toISOString().slice(0, 10),
        notes: '',
      });
      setIsCreateOpen(false);
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/finance/invoices/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice deleted successfully.');
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const handleEdit = (invoice: Invoice) => {
    setEditInvoice(invoice);
    setEditDueDate(invoice.due_date?.toString().slice(0, 10) || '');
  };

  const handleDelete = (invoice: Invoice) => setDeleteInvoice(invoice);

  const columns: Column<Invoice>[] = [
    {
      key: 'invoice_number',
      header: 'Invoice No.',
      sortable: true,
      render: (inv) => <span className="font-mono text-sm font-medium text-primary-600">{inv.invoice_number}</span>,
    },
    {
      key: 'client',
      header: 'Client',
      render: (inv) => inv.client?.name || `Client #${inv.client_id}`,
    },
    {
      key: 'invoice_date',
      header: 'Date',
      sortable: true,
      render: (inv) => new Date(inv.invoice_date).toLocaleDateString('en-IN'),
    },
    {
      key: 'due_date',
      header: 'Due Date',
      sortable: true,
      render: (inv) => {
        const isOverdue = new Date(inv.due_date) < new Date() && inv.status !== 'paid';
        return <span className={isOverdue ? 'text-red-600 font-medium' : ''}>{new Date(inv.due_date).toLocaleDateString('en-IN')}</span>;
      },
    },
    {
      key: 'total_amount',
      header: 'Amount',
      sortable: true,
      render: (inv) => `₹${Number((inv.total_amount || 0) ?? 0).toLocaleString('en-IN')}`,
    },
    {
      key: 'paid_amount',
      header: 'Paid',
      render: (inv) => `₹${Number((inv.paid_amount || 0) ?? 0).toLocaleString('en-IN')}`,
    },
    {
      key: 'balance_amount',
      header: 'Balance',
      render: (inv) => (
        <span className={inv.balance_amount > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
          ₹{Number((inv.balance_amount || 0) ?? 0).toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (inv) => <StatusBadge status={inv.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (inv) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => handleEdit(inv)} className="p-1.5 rounded-md hover:bg-gray-100" title="Edit">
            <Pencil size={14} className="text-gray-600" />
          </button>
          {inv.status === 'draft' && (
            <button onClick={() => sendMutation.mutate(inv.id)} className="p-1.5 rounded-md hover:bg-blue-50" title="Send">
              <Send size={14} className="text-blue-600" />
            </button>
          )}
          {(inv.status === 'sent' || inv.status === 'partial') && (
            <button onClick={() => updateMutation.mutate({ id: inv.id, payload: { status: 'paid' } as Partial<Invoice> })} className="p-1.5 rounded-md hover:bg-green-50" title="Mark Paid">
              <CheckCircle2 size={14} className="text-green-600" />
            </button>
          )}
          <button onClick={() => handleDelete(inv)} className="p-1.5 rounded-md hover:bg-red-50" title="Delete">
            <Trash2 size={14} className="text-red-600" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">Manage invoices, billing, and collections</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={safeArray<Invoice>(data)}
        total={data?.total || 0}
        page={filters.page}
        pageSize={filters.page_size}
        isLoading={isLoading}
        searchPlaceholder="Search invoices..."
        onSearch={(q) => setFilters({ ...filters, search: q, page: 1 })}
        onPageChange={(p) => setFilters({ ...filters, page: p })}
        onSort={(key, order) => setFilters({ ...filters, sort_by: key, sort_order: order })}
        onAdd={hasPermission('invoices:create') ? () => setIsCreateOpen(true) : undefined}
        addLabel="Create Invoice"
        onRefresh={() => refetch()}
        onExport={() => {}}
      />

      <ConfirmDialog
        isOpen={!!deleteInvoice}
        title="Delete Invoice"
        message={deleteInvoice ? `Delete invoice ${deleteInvoice.invoice_number}? This action cannot be undone.` : ''}
        confirmLabel="Delete"
        isDangerous={true}
        onConfirm={() => {
          if (!deleteInvoice) return;
          deleteMutation.mutate(deleteInvoice.id);
          setDeleteInvoice(null);
        }}
        onCancel={() => setDeleteInvoice(null)}
      />

      <Modal
        isOpen={!!editInvoice}
        onClose={() => { setEditInvoice(null); setEditDueDate(''); }}
        title="Edit Invoice"
        size="md"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!editInvoice || !editDueDate) return;
            updateMutation.mutate({
              id: editInvoice.id,
              payload: { due_date: editDueDate } as Partial<Invoice>,
            });
          }}
        >
          <div>
            <label className="label">Invoice Number</label>
            <input className="input-field" value={editInvoice?.invoice_number || ''} disabled />
          </div>
          <div>
            <label className="label">Due Date</label>
            <input
              type="date"
              className="input-field"
              value={editDueDate}
              onChange={(e) => setEditDueDate(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => { setEditInvoice(null); setEditDueDate(''); }}
            >
              Cancel
            </button>
            <SubmitButton isLoading={updateMutation.isPending} label="Save Changes" />
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Invoice"
        size="lg"
      >
        {/** Collect requested fields and map to backend invoice schema in createMutation. */}
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Client</label>
              <select className="input-field" value={createForm.client_id} onChange={(e) => setCreateForm((p) => ({ ...p, client_id: e.target.value, trip_ids: [] }))} required>
                <option value="">Select client</option>
                {safeArray<any>((clientsData as any)?.items ?? clientsData).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name || `Client #${c.id}`}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Trip IDs</label>
              <select
                multiple
                className="input-field min-h-[120px]"
                value={createForm.trip_ids}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions).map((opt) => opt.value);
                  setCreateForm((p) => ({ ...p, trip_ids: values }));
                }}
              >
                {safeArray<any>((tripsData as any)?.items ?? tripsData)
                  .filter((trip: any) => {
                    if (!createForm.client_id) return true;
                    return String(trip.client_id || trip.job?.client_id || '') === createForm.client_id;
                  })
                  .map((trip: any) => (
                    <option key={trip.id} value={trip.id}>{trip.trip_number || `Trip #${trip.id}`}</option>
                  ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Billing Period Start</label>
              <input type="date" className="input-field" value={createForm.billing_period_start} onChange={(e) => setCreateForm((p) => ({ ...p, billing_period_start: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Billing Period End</label>
              <input type="date" className="input-field" value={createForm.billing_period_end} onChange={(e) => setCreateForm((p) => ({ ...p, billing_period_end: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Payment Due Date</label>
              <input type="date" className="input-field" value={createForm.payment_due_date} onChange={(e) => setCreateForm((p) => ({ ...p, payment_due_date: e.target.value }))} required />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input-field" rows={2} value={createForm.notes} onChange={(e) => setCreateForm((p) => ({ ...p, notes: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setIsCreateOpen(false)}>Cancel</button>
            <SubmitButton
              isLoading={createMutation.isPending}
              label="Create Invoice"
              loadingLabel="Creating..."
              disabled={!createForm.client_id || !createForm.billing_period_start || !createForm.billing_period_end || !createForm.payment_due_date}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}

