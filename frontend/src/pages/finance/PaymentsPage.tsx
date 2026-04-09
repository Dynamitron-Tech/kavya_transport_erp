/**
 * Payments Page — INCOMING ONLY
 *
 * This page handles Razorpay-collected client payments only:
 *   - Send a payment link for an unpaid invoice
 *   - View history of Razorpay-collected payments
 *
 * Company OUTGOING expenses (salaries, GPay, etc.) are managed in
 * AccountantExpensesPage (/accountant/expenses).
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';
import DataTable, { Column } from '@/components/common/DataTable';
import { Modal, StatusBadge } from '@/components/common/Modal';
import { SubmitButton } from '@/components/common/SubmitButton';
import type { Payment, FilterParams } from '@/types';
import { safeArray } from '@/utils/helpers';
import { handleApiError } from '@/utils/handleApiError';
import { SendHorizonal, CreditCard, IndianRupee, Info } from 'lucide-react';
import { financeService } from '@/services/dataService';

export default function PaymentsPage() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<FilterParams>({ page: 1, page_size: 20 });
  const [isSendLinkOpen, setIsSendLinkOpen] = useState(false);
  const [linkForm, setLinkForm] = useState({ invoice_id: '', client_phone: '', notes: '' });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['payments', filters],
    queryFn: () => financeService.listPayments(filters),
  });

  const { data: invoicesData } = useQuery({
    queryKey: ['invoices-unpaid'],
    queryFn: () => api.get('/finance/invoices', { params: { status: 'sent', limit: 100 } }),
    enabled: isSendLinkOpen,
  });

  const sendLinkMutation = useMutation({
    mutationFn: () =>
      api.post('/finance/payment-links', {
        invoice_id: parseInt(linkForm.invoice_id),
        ...(linkForm.client_phone ? { client_phone: linkForm.client_phone } : {}),
        ...(linkForm.notes ? { notes: linkForm.notes } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['invoices-unpaid'] });
      toast.success('Payment link sent to client.');
      setIsSendLinkOpen(false);
      setLinkForm({ invoice_id: '', client_phone: '', notes: '' });
    },
    onError: (e) => handleApiError(e, 'Failed to send payment link'),
  });

  const payments = safeArray<Payment>((data as any)?.data ?? (data as any)?.items ?? data);
  const invoices = safeArray<any>((invoicesData as any)?.data?.items ?? (invoicesData as any)?.data ?? invoicesData);

  const columns: Column<Payment>[] = [
    {
      key: 'payment_number',
      header: 'Payment No.',
      sortable: true,
      render: (p) => <span className="font-mono text-sm font-medium text-primary-600">{p.payment_number}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      render: (p) => <span className="font-semibold">₹{Number(p.amount || 0).toLocaleString('en-IN')}</span>,
    },
    {
      key: 'method',
      header: 'Method',
      render: (p) => (
        <span className="inline-flex items-center gap-1 text-sm">
          <CreditCard size={12} className="text-gray-400" />
          {((p as any).payment_method || p.method || 'Razorpay').toString().replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'payment_date',
      header: 'Date',
      sortable: true,
      render: (p) => p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN') : '—',
    },
    {
      key: 'reference_number',
      header: 'Razorpay Ref',
      render: (p) => {
        const ref = (p as any).transaction_ref || p.reference_number;
        return ref ? <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{ref}</span> : <span className="text-gray-400 text-xs">—</span>;
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => <StatusBadge status={p.status} />,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <IndianRupee size={22} className="text-primary-600" /> Client Payments
          </h1>
          <p className="page-subtitle">Razorpay-collected payments from client invoices</p>
        </div>
        <button onClick={() => setIsSendLinkOpen(true)} className="btn-primary flex items-center gap-2">
          <SendHorizonal size={15} /> Send Payment Link
        </button>
      </div>

      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <Info size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-blue-800">
          This page shows <strong>incoming</strong> client payments via Razorpay only.
          For outgoing expenses (salaries, GPay, driver advances), go to{' '}
          <a href="/accountant/expenses" className="underline font-medium">Company Expenses</a>.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={payments}
        total={(data as any)?.pagination?.total || (data as any)?.total || payments.length}
        page={filters.page}
        pageSize={filters.page_size}
        isLoading={isLoading}
        searchPlaceholder="Search by ref or client..."
        onSearch={(q) => setFilters({ ...filters, search: q, page: 1 })}
        onPageChange={(p) => setFilters({ ...filters, page: p })}
        onRefresh={() => refetch()}
      />

      <Modal isOpen={isSendLinkOpen} onClose={() => setIsSendLinkOpen(false)} title="Send Payment Link to Client" size="md">
        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); if (!linkForm.invoice_id) { toast.error('Select an invoice'); return; } sendLinkMutation.mutate(); }}
        >
          <div>
            <label className="label">Invoice *</label>
            <select
              className="input-field"
              value={linkForm.invoice_id}
              onChange={(e) => setLinkForm({ ...linkForm, invoice_id: e.target.value })}
              required
            >
              <option value="">Select unpaid invoice...</option>
              {invoices.map((inv: any) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoice_number} — {inv.client_name || `Client #${inv.client_id}`} — ₹{Number(inv.total_amount || 0).toLocaleString('en-IN')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Client WhatsApp / Phone (optional)</label>
            <input
              type="tel"
              className="input-field"
              placeholder="+91 98765 43210"
              value={linkForm.client_phone}
              onChange={(e) => setLinkForm({ ...linkForm, client_phone: e.target.value })}
            />
            <p className="text-xs text-gray-400 mt-1">If provided, the link will be sent via WhatsApp.</p>
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <input
              type="text"
              className="input-field"
              placeholder="Description shown on payment link"
              value={linkForm.notes}
              onChange={(e) => setLinkForm({ ...linkForm, notes: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setIsSendLinkOpen(false)}>Cancel</button>
            <SubmitButton isLoading={sendLinkMutation.isPending} label="Send Link via Razorpay" loadingLabel="Sending..." />
          </div>
        </form>
      </Modal>
    </div>
  );
}
