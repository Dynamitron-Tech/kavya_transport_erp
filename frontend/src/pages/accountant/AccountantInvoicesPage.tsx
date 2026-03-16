import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { accountantService, financeService } from '@/services/dataService';
import DataTable, { Column } from '@/components/common/DataTable';
import { StatusBadge, KPICard, TabPills, Modal } from '@/components/common/Modal';
import {
  FileText, Download, Send, Eye, Receipt,
  AlertTriangle, Clock, CheckCircle,
} from 'lucide-react';
import type { AccountantInvoice, AccountantInvoiceDetail, FilterParams } from '@/types';
import { safeArray } from '@/utils/helpers';
import { handleApiError } from '../../utils/handleApiError';

export default function AccountantInvoicesPage() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<FilterParams>({ page: 1, page_size: 20 });
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedInvoice, setSelectedInvoice] = useState<AccountantInvoiceDetail | null>(null);
  const [detailTab, setDetailTab] = useState('overview');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['accountant-invoices', filters, statusFilter],
    queryFn: () => financeService.listInvoices({
      ...filters,
      status: statusFilter !== 'all' ? statusFilter : undefined,
    }),
  });

  const sendMutation = useMutation({
    mutationFn: (id: number) => financeService.sendInvoice(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accountant-invoices'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice sent successfully.');
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: number) => financeService.updateInvoice(id, { status: 'paid' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accountant-invoices'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice marked as paid.');
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const items = safeArray<any>(data).map((item: any) => ({
    id: item.id,
    invoice_number: item.invoice_number,
    client_id: item.client_id || 0,
    client_name: item.client_name || item.client?.name || `Client #${item.client_id}`,
    trip_ref: item.trip_ref || '-',
    job_ref: item.job_ref || '-',
    invoice_date: item.invoice_date,
    due_date: item.due_date || item.invoice_date,
    subtotal: Number(item.subtotal || item.total_amount || 0),
    invoice_type: item.invoice_type || 'regular',
    gst_rate: Number(item.gst_rate || 0),
    total_amount: Number(item.total_amount || 0),
    tax_amount: Number(item.total_tax || item.tax_amount || 0),
    paid_amount: Number(item.amount_paid || item.paid_amount || 0),
    balance_amount: Number(item.amount_due || item.balance_amount || 0),
    status: item.status,
  })) as AccountantInvoice[];
  const total = data?.total || 0;

  const handleViewInvoice = async (invoice: AccountantInvoice) => {
    try {
      const detail = await accountantService.getInvoiceDetail(invoice.id);
      setSelectedInvoice(detail as any);
      setDetailTab('overview');
    } catch {
      // handle error
    }
  };

  const statusTabs = [
    { key: 'all', label: 'All' },
    { key: 'draft', label: 'Draft' },
    { key: 'sent', label: 'Sent' },
    { key: 'paid', label: 'Paid' },
    { key: 'overdue', label: 'Overdue' },
  ];

  const fmt = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;

  // Count by status from items
  const draftCount = items.filter(i => i.status === 'draft').length;
  const overdueCount = items.filter(i => i.status === 'overdue').length;
  const paidCount = items.filter(i => i.status === 'paid').length;
  const totalAmount = items.reduce((s, i) => s + i.total_amount, 0);

  const columns: Column<AccountantInvoice>[] = [
    {
      key: 'invoice_number',
      header: 'Invoice No.',
      sortable: true,
      render: (inv) => (
        <button onClick={() => handleViewInvoice(inv)} className="font-mono text-sm font-medium text-primary-600 hover:text-primary-700">
          {inv.invoice_number}
        </button>
      ),
    },
    {
      key: 'client_name',
      header: 'Client',
      render: (inv) => <span className="font-medium">{inv.client_name}</span>,
    },
    {
      key: 'trip_ref',
      header: 'Trip/Job Ref',
      render: (inv) => (
        <div>
          <span className="text-xs text-gray-500">{inv.trip_ref}</span>
          {inv.job_ref && <span className="block text-[10px] text-gray-400">{inv.job_ref}</span>}
        </div>
      ),
    },
    {
      key: 'invoice_date',
      header: 'Date',
      sortable: true,
      render: (inv) => new Date(inv.invoice_date).toLocaleDateString('en-IN'),
    },
    {
      key: 'total_amount',
      header: 'Amount',
      sortable: true,
      render: (inv) => (
        <div>
          <span className="font-semibold">{fmt(inv.total_amount)}</span>
          <span className="block text-[10px] text-gray-400">Tax: {fmt(inv.tax_amount)}</span>
        </div>
      ),
    },
    {
      key: 'balance_amount',
      header: 'Balance',
      render: (inv) => (
        <span className={inv.balance_amount > 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
          {fmt(inv.balance_amount)}
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
      header: '',
      render: (inv) => (
        <div className="flex items-center gap-1">
          <button onClick={() => handleViewInvoice(inv)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="View">
            <Eye size={14} className="text-gray-500" />
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded-lg" title="Download PDF">
            <Download size={14} className="text-gray-500" />
          </button>
          {inv.status === 'draft' && (
            <button onClick={() => sendMutation.mutate(inv.id)} className="p-1.5 hover:bg-blue-50 rounded-lg" title="Send Invoice">
              <Send size={14} className="text-blue-500" />
            </button>
          )}
          {(inv.status === 'sent' || inv.status === 'partial' || inv.status === 'overdue') && (
            <button onClick={() => markPaidMutation.mutate(inv.id)} className="p-1.5 hover:bg-green-50 rounded-lg" title="Mark Paid">
              <CheckCircle size={14} className="text-green-600" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const detailTabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'trips', label: 'Linked Trips' },
    { key: 'payments', label: 'Payment History' },
  ];

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Invoice Management</h1>
          <p className="page-subtitle">Create, manage, and track invoices</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Total Invoiced" value={fmt(totalAmount)} icon={<Receipt size={22} />} color="bg-blue-50 text-blue-600" />
        <KPICard title="Draft Invoices" value={draftCount} icon={<FileText size={22} />} color="bg-gray-100 text-gray-600" />
        <KPICard title="Overdue" value={overdueCount} icon={<AlertTriangle size={22} />} color="bg-red-50 text-red-600" />
        <KPICard title="Paid" value={paidCount} icon={<CheckCircle size={22} />} color="bg-green-50 text-green-600" />
      </div>

      {/* Status Tabs */}
      <TabPills tabs={statusTabs} activeTab={statusFilter} onChange={setStatusFilter} />

      {/* Table */}
      <DataTable
        columns={columns}
        data={items}
        total={total}
        page={filters.page}
        pageSize={filters.page_size}
        isLoading={isLoading}
        searchPlaceholder="Search invoices..."
        onSearch={(q) => setFilters({ ...filters, search: q, page: 1 })}
        onPageChange={(p) => setFilters({ ...filters, page: p })}
        onSort={(key, order) => setFilters({ ...filters, sort_by: key, sort_order: order })}
        onAdd={() => {}}
        addLabel="Create Invoice"
        onRefresh={() => refetch()}
        onExport={() => {}}
      />

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
            <TabPills tabs={detailTabs} activeTab={detailTab} onChange={setDetailTab} />

            {detailTab === 'overview' && (
              <div className="space-y-5">
                {/* Invoice Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Invoice Date</p>
                    <p className="font-semibold">{new Date(selectedInvoice.invoice_date).toLocaleDateString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Due Date</p>
                    <p className="font-semibold">{new Date(selectedInvoice.due_date).toLocaleDateString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Client GST</p>
                    <p className="font-mono text-xs font-semibold">{selectedInvoice.client_gst}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Type</p>
                    <p className="font-semibold capitalize">{(selectedInvoice.invoice_type || 'other').replace('_', ' ')}</p>
                  </div>
                </div>

                {/* Items Table */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">Line Items</h4>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Description</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Trip / LR</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Rate</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Tax</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {selectedInvoice.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-3 py-2">{item.description}</td>
                          <td className="px-3 py-2 text-xs text-gray-500">
                            {item.trip_number && <span className="block">{item.trip_number}</span>}
                            {item.lr_number && <span className="block">{item.lr_number}</span>}
                          </td>
                          <td className="px-3 py-2 text-right">{fmt(item.rate)}</td>
                          <td className="px-3 py-2 text-right text-gray-500">{fmt(item.tax_amount)}</td>
                          <td className="px-3 py-2 text-right font-medium">{fmt(item.amount + item.tax_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="flex justify-end">
                  <div className="w-72 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{fmt(selectedInvoice.subtotal)}</span></div>
                    {selectedInvoice.cgst_amount > 0 && <div className="flex justify-between"><span className="text-gray-500">CGST (9%)</span><span>{fmt(selectedInvoice.cgst_amount)}</span></div>}
                    {selectedInvoice.sgst_amount > 0 && <div className="flex justify-between"><span className="text-gray-500">SGST (9%)</span><span>{fmt(selectedInvoice.sgst_amount)}</span></div>}
                    {selectedInvoice.igst_amount > 0 && <div className="flex justify-between"><span className="text-gray-500">IGST (18%)</span><span>{fmt(selectedInvoice.igst_amount)}</span></div>}
                    <div className="flex justify-between border-t pt-1 font-semibold"><span>Total</span><span>{fmt(selectedInvoice.total_amount)}</span></div>
                    <div className="flex justify-between text-green-600"><span>Paid</span><span>{fmt(selectedInvoice.paid_amount)}</span></div>
                    <div className="flex justify-between text-red-600 font-bold"><span>Balance Due</span><span>{fmt(selectedInvoice.balance_amount)}</span></div>
                  </div>
                </div>
              </div>
            )}

            {detailTab === 'trips' && (
              <div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Trip Number</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Vehicle</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Driver</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Route</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Status</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Freight</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {selectedInvoice.linked_trips.map((trip) => (
                      <tr key={trip.id}>
                        <td className="px-3 py-2 font-mono text-primary-600">{trip.trip_number}</td>
                        <td className="px-3 py-2">{trip.vehicle}</td>
                        <td className="px-3 py-2">{trip.driver}</td>
                        <td className="px-3 py-2">{trip.origin} → {trip.destination}</td>
                        <td className="px-3 py-2"><StatusBadge status={trip.status} /></td>
                        <td className="px-3 py-2 text-right font-medium">{fmt(trip.freight_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {detailTab === 'payments' && (
              <div>
                {selectedInvoice.payment_history.length === 0 || selectedInvoice.payment_history[0].amount === 0 ? (
                  <div className="text-center py-8">
                    <Clock size={36} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-sm text-gray-400">No payments received yet</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Payment No.</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Date</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Amount</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Method</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Reference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {selectedInvoice.payment_history.map((pay) => (
                        <tr key={pay.id}>
                          <td className="px-3 py-2 font-mono text-primary-600">{pay.payment_number}</td>
                          <td className="px-3 py-2">{new Date(pay.date).toLocaleDateString('en-IN')}</td>
                          <td className="px-3 py-2 text-right font-semibold text-green-600">{fmt(pay.amount)}</td>
                          <td className="px-3 py-2 capitalize">{pay.method}</td>
                          <td className="px-3 py-2 text-gray-500">{pay.reference}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button className="btn-secondary flex items-center gap-2 text-sm">
                <Download size={14} /> Download PDF
              </button>
              {selectedInvoice.status === 'draft' && (
                <button onClick={() => sendMutation.mutate(selectedInvoice.id)} className="btn-primary flex items-center gap-2 text-sm">
                  <Send size={14} /> Send to Client
                </button>
              )}
              {(selectedInvoice.status === 'sent' || selectedInvoice.status === 'partial' || selectedInvoice.status === 'overdue') && (
                <button onClick={() => markPaidMutation.mutate(selectedInvoice.id)} className="btn-secondary flex items-center gap-2 text-sm">
                  <CheckCircle size={14} /> Mark Paid
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

