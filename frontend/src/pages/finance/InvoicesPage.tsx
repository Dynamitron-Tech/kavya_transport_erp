import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { financeService, tripService } from '@/services/dataService';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import DataTable, { Column } from '@/components/common/DataTable';
import { Modal, StatusBadge } from '@/components/common/Modal';
import { SubmitButton } from '@/components/common/SubmitButton';
import type { Invoice, FilterParams } from '@/types';
import { CheckCircle2, Pencil, Receipt, Send, Trash2 } from 'lucide-react';
import { safeArray } from '@/utils/helpers';
import { exportTableToPdf } from '@/utils/pdfExport';
import { handleApiError } from '../../utils/handleApiError';

export default function InvoicesPage() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<FilterParams>({ page: 1, page_size: 20 });
  const [deleteInvoice, setDeleteInvoice] = useState<Invoice | null>(null);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [editDueDate, setEditDueDate] = useState('');
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [generateTripId, setGenerateTripId] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['invoices', filters],
    queryFn: () => financeService.listInvoices(filters),
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
    onError: (error) => handleApiError(error, 'Operation failed'),
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: number) => financeService.markInvoicePaid(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['ledger'] });
      qc.invalidateQueries({ queryKey: ['receivables'] });
      qc.invalidateQueries({ queryKey: ['accountant-invoices'] });
      qc.invalidateQueries({ queryKey: ['accountant-ledger-entries'] });
      qc.invalidateQueries({ queryKey: ['accountant-receivables'] });
      qc.invalidateQueries({ queryKey: ['accountant-kpis'] });
      qc.invalidateQueries({ queryKey: ['accountant-reports-dashboard'] });
      qc.invalidateQueries({ queryKey: ['accountant-revenue-trend'] });
      qc.invalidateQueries({ queryKey: ['accountant-cash-flow'] });
      qc.invalidateQueries({ queryKey: ['accountant-recent-transactions'] });
      qc.invalidateQueries({ queryKey: ['accountant-pending-actions'] });
      toast.success('Invoice marked as paid.');
    },
    onError: (error) => handleApiError(error, 'Operation failed'),
  });

  const generateMutation = useMutation({
    mutationFn: (tripId: number) => financeService.generateInvoiceFromTrip(tripId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice generated from trip.');
      setIsGenerateOpen(false);
      setGenerateTripId('');
    },
    onError: (error) => handleApiError(error, 'Failed to generate invoice'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => financeService.deleteInvoice(id),
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

  const invoices = safeArray<Invoice>((data as any)?.data ?? (data as any)?.items ?? data);

  const handleExportPdf = () => {
    if (!invoices.length) {
      toast.error('No invoices available to export.');
      return;
    }

    exportTableToPdf<Invoice>({
      title: 'Invoices Report',
      fileName: `invoices-${new Date().toISOString().slice(0, 10)}.pdf`,
      columns: [
        { header: 'Invoice No', accessor: (inv) => inv.invoice_number },
        { header: 'Client', accessor: (inv) => inv.client?.name || (inv as any).client_name || (inv as any).billing_name || `Client #${inv.client_id}` },
        { header: 'Date', accessor: (inv) => new Date(inv.invoice_date).toLocaleDateString('en-IN') },
        { header: 'Due Date', accessor: (inv) => new Date(inv.due_date).toLocaleDateString('en-IN') },
        { header: 'Amount', accessor: (inv) => Number((inv.total_amount || 0) ?? 0).toLocaleString('en-IN') },
        { header: 'Paid', accessor: (inv) => Number((inv.paid_amount || 0) ?? 0).toLocaleString('en-IN') },
        { header: 'Balance', accessor: (inv) => Number((inv.balance_amount || 0) ?? 0).toLocaleString('en-IN') },
        { header: 'Status', accessor: (inv) => inv.status },
      ],
      rows: invoices,
    });
  };

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
      render: (inv) => inv.client?.name || (inv as any).client_name || (inv as any).billing_name || `Client #${inv.client_id}`,
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
        const status = String(inv.status || '').toLowerCase();
        const isOverdue = new Date(inv.due_date) < new Date() && status !== 'paid';
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
      render: (inv) => `₹${Number(((inv as any).amount_paid ?? (inv as any).paid_amount ?? 0) || 0).toLocaleString('en-IN')}`,
    },
    {
      key: 'balance_amount',
      header: 'Balance',
      render: (inv) => (
        <span className={Number(((inv as any).amount_due ?? (inv as any).balance_amount ?? 0) || 0) > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
          ₹{Number(((inv as any).amount_due ?? (inv as any).balance_amount ?? 0) || 0).toLocaleString('en-IN')}
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
          {(() => {
            const status = String(inv.status || '').toLowerCase();
            return (
              <>
          <button onClick={() => handleEdit(inv)} className="p-1.5 rounded-md hover:bg-gray-100" title="Edit">
            <Pencil size={14} className="text-gray-600" />
          </button>
          {status === 'draft' && (
            <button onClick={() => sendMutation.mutate(inv.id)} className="p-1.5 rounded-md hover:bg-blue-50" title="Send">
              <Send size={14} className="text-blue-600" />
            </button>
          )}
          {(status === 'sent' || status === 'partial' || status === 'partially_paid') && (
            <button onClick={() => markPaidMutation.mutate(inv.id)} className="p-1.5 rounded-md hover:bg-green-50" title="Mark Paid">
              <CheckCircle2 size={14} className="text-green-600" />
            </button>
          )}
          <button onClick={() => handleDelete(inv)} className="p-1.5 rounded-md hover:bg-red-50" title="Delete">
            <Trash2 size={14} className="text-red-600" />
          </button>
              </>
            );
          })()}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">Manage invoices, billing, and collections</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsGenerateOpen(true)} className="btn-secondary flex items-center gap-2 text-sm">
            <Receipt size={14} /> Generate from Trip
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={invoices}
        total={(data as any)?.pagination?.total || data?.total || 0}
        page={filters.page}
        pageSize={filters.page_size}
        isLoading={isLoading}
        searchPlaceholder="Search invoices..."
        onSearch={(q) => setFilters({ ...filters, search: q, page: 1 })}
        onPageChange={(p) => setFilters({ ...filters, page: p })}
        onSort={(key, order) => setFilters({ ...filters, sort_by: key, sort_order: order })}
        onRefresh={() => refetch()}
        onExport={handleExportPdf}
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

      {/* Generate from Trip Modal */}
      <Modal isOpen={isGenerateOpen} onClose={() => setIsGenerateOpen(false)} title="Generate Invoice from Trip" size="md">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (generateTripId) generateMutation.mutate(Number(generateTripId)); }}>
          <p className="text-sm text-gray-500">Select a completed trip to auto-generate a GST invoice with freight details, client info, and tax calculations.</p>
          <div>
            <label className="label">Completed Trip</label>
            <select className="input-field" value={generateTripId} onChange={(e) => setGenerateTripId(e.target.value)} required>
              <option value="">Select trip</option>
              {safeArray<any>((tripsData as any)?.items ?? tripsData)
                .filter((t: any) => t.status === 'completed' || t.status === 'delivered' || t.status === 'pod_uploaded')
                .map((t: any) => (
                  <option key={t.id} value={t.id}>{t.trip_number || `Trip #${t.id}`} — {t.origin_city || ''} → {t.destination_city || ''}</option>
                ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setIsGenerateOpen(false)}>Cancel</button>
            <SubmitButton isLoading={generateMutation.isPending} label="Generate Invoice" loadingLabel="Generating..." disabled={!generateTripId} />
          </div>
        </form>
      </Modal>
    </div>
  );
}

