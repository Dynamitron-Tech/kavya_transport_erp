import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { financeService } from '@/services/dataService';
import DataTable, { Column } from '@/components/common/DataTable';
import { Modal, StatusBadge } from '@/components/common/Modal';
import { SubmitButton } from '@/components/common/SubmitButton';
import type { Payment, FilterParams } from '@/types';
import { safeArray } from '@/utils/helpers';
import { handleApiError } from '@/utils/handleApiError';

export default function PaymentsPage() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<FilterParams>({ page: 1, page_size: 20 });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState({
    payment_date: new Date().toISOString().slice(0, 10),
    payment_type: 'received',
    amount: '',
    payment_method: 'cash',
    invoice_id: '',
    client_id: '',
    vendor_id: '',
    transaction_ref: '',
    remarks: '',
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['payments', filters],
    queryFn: () => financeService.listPayments(filters),
  });

  const createMutation = useMutation({
    mutationFn: () => financeService.createPayment({
      payment_date: form.payment_date,
      amount: Number(form.amount || 0),
      method: form.payment_method as any,
      invoice_id: form.invoice_id ? Number(form.invoice_id) : undefined,
      client_id: form.client_id ? Number(form.client_id) : undefined,
      vendor_id: form.vendor_id ? Number(form.vendor_id) : undefined,
      reference_number: form.transaction_ref || undefined,
      notes: form.remarks || undefined,
    } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['ledger'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['receivables'] });
      qc.invalidateQueries({ queryKey: ['payables'] });
      toast.success('Payment recorded successfully.');
      setIsCreateOpen(false);
      setForm({
        payment_date: new Date().toISOString().slice(0, 10),
        payment_type: 'received',
        amount: '',
        payment_method: 'cash',
        invoice_id: '',
        client_id: '',
        vendor_id: '',
        transaction_ref: '',
        remarks: '',
      });
    },
    onError: (error) => handleApiError(error, 'Failed to record payment'),
  });

  const payments = safeArray<Payment>((data as any)?.data ?? (data as any)?.items ?? data);

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
      render: (p) => <span className="font-semibold">₹{Number((p.amount || 0) ?? 0).toLocaleString('en-IN')}</span>,
    },
    {
      key: 'method',
      header: 'Method',
      render: (p) => <span className="capitalize">{((p as any).payment_method || p.method || '—').toString().replace('_', ' ')}</span>,
    },
    {
      key: 'payment_date',
      header: 'Date',
      sortable: true,
      render: (p) => p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN') : '—',
    },
    {
      key: 'reference_number',
      header: 'Reference',
      render: (p) => (p as any).transaction_ref || p.reference_number || '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => <StatusBadge status={p.status} />,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Payments</h1>
          <p className="page-subtitle">Track incoming and outgoing payments</p>
        </div>
      </div>
      <DataTable
        columns={columns}
        data={payments}
        total={(data as any)?.pagination?.total || (data as any)?.total || payments.length}
        page={filters.page}
        pageSize={filters.page_size}
        isLoading={isLoading}
        searchPlaceholder="Search payments..."
        onSearch={(q) => setFilters({ ...filters, search: q, page: 1 })}
        onPageChange={(p) => setFilters({ ...filters, page: p })}
        onAdd={() => setIsCreateOpen(true)}
        addLabel="Record Payment"
        onRefresh={() => refetch()}
      />

      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Record Payment"
        size="md"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.amount || Number(form.amount) <= 0) {
              toast.error('Enter a valid amount');
              return;
            }
            createMutation.mutate();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Payment Date</label>
              <input
                type="date"
                className="input-field"
                value={form.payment_date}
                onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Type</label>
              <select
                className="input-field"
                value={form.payment_type}
                onChange={(e) => setForm({ ...form, payment_type: e.target.value })}
              >
                <option value="received">Received</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input-field"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Method</label>
              <select
                className="input-field"
                value={form.payment_method}
                onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
              >
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="upi">UPI</option>
                <option value="neft">NEFT</option>
                <option value="rtgs">RTGS</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Invoice ID</label>
              <input
                type="number"
                min="1"
                className="input-field"
                value={form.invoice_id}
                onChange={(e) => setForm({ ...form, invoice_id: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="label">Client ID</label>
              <input
                type="number"
                min="1"
                className="input-field"
                value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="label">Vendor ID</label>
              <input
                type="number"
                min="1"
                className="input-field"
                value={form.vendor_id}
                onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>

          <div>
            <label className="label">Transaction Ref</label>
            <input
              className="input-field"
              value={form.transaction_ref}
              onChange={(e) => setForm({ ...form, transaction_ref: e.target.value })}
              placeholder="Optional"
            />
          </div>

          <div>
            <label className="label">Remarks</label>
            <textarea
              className="input-field"
              rows={3}
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              placeholder="Optional"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </button>
            <SubmitButton isLoading={createMutation.isPending} label="Record Payment" loadingLabel="Saving..." />
          </div>
        </form>
      </Modal>
    </div>
  );
}
