import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { financeService, tripService } from '@/services/dataService';
import DataTable, { Column } from '@/components/common/DataTable';
import { StatusBadge, KPICard, TabPills, Modal } from '@/components/common/Modal';
import { SubmitButton } from '@/components/common/SubmitButton';
import {
  FileText, Send, Eye, Receipt,
  AlertTriangle, CheckCircle,
} from 'lucide-react';
import type { FilterParams } from '@/types';
import { safeArray } from '@/utils/helpers';
import { exportTableToPdf } from '@/utils/pdfExport';
import { handleApiError } from '../../utils/handleApiError';

export default function AccountantInvoicesPage() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<FilterParams>({ page: 1, page_size: 20 });
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [detailTab, setDetailTab] = useState('overview');
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [generateTripId, setGenerateTripId] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['accountant-invoices', filters, statusFilter],
    queryFn: () => financeService.listInvoices({
      ...filters,
      status: statusFilter !== 'all' ? statusFilter : undefined,
    }),
  });

  const { data: tripsData } = useQuery({
    queryKey: ['invoice-trips'],
    queryFn: () => tripService.list({ page: 1, page_size: 500 }),
  });

  const sendMutation = useMutation({
    mutationFn: (id: number) => financeService.sendInvoice(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accountant-invoices'] });
      toast.success('Invoice sent successfully.');
    },
    onError: (error) => handleApiError(error, 'Failed to send invoice'),
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: number) => financeService.markInvoicePaid(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accountant-invoices'] });
      toast.success('Invoice marked as paid.');
      setSelectedInvoice(null);
    },
    onError: (error) => handleApiError(error, 'Failed to mark as paid'),
  });

  const generateMutation = useMutation({
    mutationFn: (tripId: number) => financeService.generateInvoiceFromTrip(tripId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accountant-invoices'] });
      toast.success('Invoice generated from trip.');
      setIsGenerateOpen(false);
      setGenerateTripId('');
    },
    onError: (error) => handleApiError(error, 'Failed to generate invoice'),
  });

  const rawItems = safeArray<any>((data as any)?.data ?? (data as any)?.items ?? data);
  const items = rawItems.map((item: any) => ({
    id: item.id,
    invoice_number: item.invoice_number,
    client_id: item.client_id || 0,
    client_name: item.client_name || item.client?.name || `Client #${item.client_id}`,
    trip_ref: item.trip_ref || '-',
    job_ref: item.job_ref || '-',
    invoice_date: item.invoice_date,
    due_date: item.due_date || item.invoice_date,
    subtotal: Number(item.subtotal || item.total_amount || 0),
    invoice_type: item.invoice_type || 'tax_invoice',
    gst_rate: Number(item.gst_rate || 0),
    total_amount: Number(item.total_amount || 0),
    tax_amount: Number(item.total_tax || item.tax_amount || 0),
    paid_amount: Number(item.amount_paid || item.paid_amount || 0),
    balance_amount: Number(item.amount_due || item.balance_amount || 0),
    status: item.status,
    cgst_amount: Number(item.cgst_amount || 0),
    sgst_amount: Number(item.sgst_amount || 0),
    igst_amount: Number(item.igst_amount || 0),
    items: item.items || [],
  }));

  const handleViewInvoice = (invoice: any) => {
    setSelectedInvoice(invoice);
    setDetailTab('overview');
  };

  const statusTabs = [
    { key: 'all', label: 'All' },
    { key: 'draft', label: 'Draft' },
    { key: 'sent', label: 'Sent' },
    { key: 'paid', label: 'Paid' },
    { key: 'overdue', label: 'Overdue' },
  ];

  const fmt = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;

  const draftCount = items.filter((i: any) => i.status === 'draft').length;
  const overdueCount = items.filter((i: any) => i.status === 'overdue').length;
  const paidCount = items.filter((i: any) => i.status === 'paid').length;
  const totalAmount = items.reduce((s: number, i: any) => s + i.total_amount, 0);

  const columns: Column<any>[] = [
    {
      key: 'invoice_number',
      header: 'Invoice No.',
      sortable: true,
      render: (inv: any) => (
        <button onClick={() => handleViewInvoice(inv)} className="font-mono text-sm font-medium text-primary-600 hover:text-primary-700">
          {inv.invoice_number}
        </button>
      ),
    },
    { key: 'client_name', header: 'Client', render: (inv: any) => <span className="font-medium">{inv.client_name}</span> },
    {
      key: 'invoice_date', header: 'Date', sortable: true,
      render: (inv: any) => new Date(inv.invoice_date).toLocaleDateString('en-IN'),
    },
    {
      key: 'due_date', header: 'Due Date', sortable: true,
      render: (inv: any) => {
        const isOverdue = new Date(inv.due_date) < new Date() && inv.status !== 'paid';
        return <span className={isOverdue ? 'text-red-600 font-medium' : ''}>{new Date(inv.due_date).toLocaleDateString('en-IN')}</span>;
      },
    },
    {
      key: 'total_amount', header: 'Amount', sortable: true,
      render: (inv: any) => (
        <div>
          <span className="font-semibold">{fmt(inv.total_amount)}</span>
          <span className="block text-[10px] text-gray-400">Tax: {fmt(inv.tax_amount)}</span>
        </div>
      ),
    },
    {
      key: 'balance_amount', header: 'Balance',
      render: (inv: any) => (
        <span className={inv.balance_amount > 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
          {fmt(inv.balance_amount)}
        </span>
      ),
    },
    { key: 'status', header: 'Status', render: (inv: any) => <StatusBadge status={inv.status} /> },
    {
      key: 'actions', header: '',
      render: (inv: any) => (
        <div className="flex items-center gap-1">
          <button onClick={() => handleViewInvoice(inv)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="View">
            <Eye size={14} className="text-gray-500" />
          </button>
          {inv.status === 'draft' && (
            <button onClick={() => sendMutation.mutate(inv.id)} className="p-1.5 hover:bg-blue-50 rounded-lg" title="Send Invoice">
              <Send size={14} className="text-blue-500" />
            </button>
          )}
          {(inv.status === 'sent' || inv.status === 'partial' || inv.status === 'partially_paid' || inv.status === 'overdue') && (
            <button onClick={() => markPaidMutation.mutate(inv.id)} className="p-1.5 hover:bg-green-50 rounded-lg" title="Mark Paid">
              <CheckCircle size={14} className="text-green-600" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const completedTrips = safeArray<any>((tripsData as any)?.items ?? tripsData)
    .filter((t: any) => t.status === 'completed' || t.status === 'delivered' || t.status === 'pod_uploaded');

  const handleExportPdf = () => {
    if (!items.length) {
      toast.error('No invoices available to export.');
      return;
    }

    exportTableToPdf<any>({
      title: 'Invoice Management Report',
      fileName: `accountant-invoices-${new Date().toISOString().slice(0, 10)}.pdf`,
      columns: [
        { header: 'Invoice No', accessor: (inv) => inv.invoice_number },
        { header: 'Client', accessor: (inv) => inv.client_name },
        { header: 'Date', accessor: (inv) => new Date(inv.invoice_date).toLocaleDateString('en-IN') },
        { header: 'Due Date', accessor: (inv) => new Date(inv.due_date).toLocaleDateString('en-IN') },
        { header: 'Amount', accessor: (inv) => Number(inv.total_amount || 0).toLocaleString('en-IN') },
        { header: 'Balance', accessor: (inv) => Number(inv.balance_amount || 0).toLocaleString('en-IN') },
        { header: 'Status', accessor: (inv) => inv.status },
      ],
      rows: items,
    });
  };

  return (
    <div className="space-y-5">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Invoice Management</h1>
          <p className="page-subtitle">Create, manage, and track invoices</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsGenerateOpen(true)} className="btn-secondary flex items-center gap-2 text-sm">
            <Receipt size={14} /> Generate from Trip
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Total Invoiced" value={fmt(totalAmount)} icon={<Receipt size={22} />} color="bg-blue-50 text-blue-600" />
        <KPICard title="Draft Invoices" value={draftCount} icon={<FileText size={22} />} color="bg-gray-100 text-gray-600" />
        <KPICard title="Overdue" value={overdueCount} icon={<AlertTriangle size={22} />} color="bg-red-50 text-red-600" />
        <KPICard title="Paid" value={paidCount} icon={<CheckCircle size={22} />} color="bg-green-50 text-green-600" />
      </div>

      <TabPills tabs={statusTabs} activeTab={statusFilter} onChange={setStatusFilter} />

      <DataTable
        columns={columns}
        data={items}
        total={(data as any)?.pagination?.total || (data as any)?.total || items.length}
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

      {/* Generate from Trip Modal */}
      <Modal isOpen={isGenerateOpen} onClose={() => setIsGenerateOpen(false)} title="Generate Invoice from Trip" size="md">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (generateTripId) generateMutation.mutate(Number(generateTripId)); }}>
          <p className="text-sm text-gray-500">Select a completed trip to auto-generate a GST invoice with freight details.</p>
          <div>
            <label className="label">Completed Trip</label>
            <select className="input-field" value={generateTripId} onChange={(e) => setGenerateTripId(e.target.value)} required>
              <option value="">Select trip</option>
              {completedTrips.map((t: any) => (
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

      {/* Invoice Detail Modal */}
      <Modal
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        title={selectedInvoice?.invoice_number || ''}
        subtitle={`${selectedInvoice?.client_name || ''} • ${selectedInvoice?.status?.toUpperCase() || ''}`}
        size="xl"
        headerBadge={selectedInvoice ? <StatusBadge status={selectedInvoice.status} /> : undefined}
      >
        {selectedInvoice && (
          <div className="space-y-5">
            <TabPills tabs={[{ key: 'overview', label: 'Overview' }, { key: 'items', label: 'Line Items' }]} activeTab={detailTab} onChange={setDetailTab} />

            {detailTab === 'overview' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><p className="text-gray-500">Invoice Date</p><p className="font-semibold">{new Date(selectedInvoice.invoice_date).toLocaleDateString('en-IN')}</p></div>
                  <div><p className="text-gray-500">Due Date</p><p className="font-semibold">{new Date(selectedInvoice.due_date).toLocaleDateString('en-IN')}</p></div>
                  <div><p className="text-gray-500">Type</p><p className="font-semibold capitalize">{(selectedInvoice.invoice_type || 'tax_invoice').replace('_', ' ')}</p></div>
                  <div><p className="text-gray-500">Status</p><StatusBadge status={selectedInvoice.status} /></div>
                </div>
                <div className="flex justify-end">
                  <div className="w-72 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{fmt(selectedInvoice.subtotal)}</span></div>
                    {selectedInvoice.cgst_amount > 0 && <div className="flex justify-between"><span className="text-gray-500">CGST</span><span>{fmt(selectedInvoice.cgst_amount)}</span></div>}
                    {selectedInvoice.sgst_amount > 0 && <div className="flex justify-between"><span className="text-gray-500">SGST</span><span>{fmt(selectedInvoice.sgst_amount)}</span></div>}
                    {selectedInvoice.igst_amount > 0 && <div className="flex justify-between"><span className="text-gray-500">IGST</span><span>{fmt(selectedInvoice.igst_amount)}</span></div>}
                    <div className="flex justify-between"><span className="text-gray-500">Tax</span><span>{fmt(selectedInvoice.tax_amount)}</span></div>
                    <div className="flex justify-between border-t pt-1 font-semibold"><span>Total</span><span>{fmt(selectedInvoice.total_amount)}</span></div>
                    <div className="flex justify-between text-green-600"><span>Paid</span><span>{fmt(selectedInvoice.paid_amount)}</span></div>
                    <div className="flex justify-between text-red-600 font-bold"><span>Balance Due</span><span>{fmt(selectedInvoice.balance_amount)}</span></div>
                  </div>
                </div>
              </div>
            )}

            {detailTab === 'items' && (
              <div>
                {(selectedInvoice.items || []).length === 0 ? (
                  <p className="text-center text-gray-400 py-8">No line items</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead><tr className="bg-gray-50 border-b">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Description</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Qty</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Rate</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Tax</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Amount</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {selectedInvoice.items.map((item: any, i: number) => (
                        <tr key={item.id || i}>
                          <td className="px-3 py-2">{item.description}</td>
                          <td className="px-3 py-2 text-right">{item.quantity || 1}</td>
                          <td className="px-3 py-2 text-right">{fmt(Number(item.rate || 0))}</td>
                          <td className="px-3 py-2 text-right text-gray-500">{fmt(Number(item.tax_amount || 0))}</td>
                          <td className="px-3 py-2 text-right font-medium">{fmt(Number(item.total || item.amount || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              {selectedInvoice.status === 'draft' && (
                <button onClick={() => { sendMutation.mutate(selectedInvoice.id); setSelectedInvoice(null); }} className="btn-primary flex items-center gap-2 text-sm">
                  <Send size={14} /> Send to Client
                </button>
              )}
              {(selectedInvoice.status === 'sent' || selectedInvoice.status === 'partial' || selectedInvoice.status === 'partially_paid' || selectedInvoice.status === 'overdue') && (
                <button onClick={() => markPaidMutation.mutate(selectedInvoice.id)} className="btn-primary flex items-center gap-2 text-sm bg-green-600 hover:bg-green-700">
                  <CheckCircle size={14} /> Mark as Paid
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

