/**
 * Payments Hub — Unified outgoing payments screen
 * Tabs: Driver Settlements | Market Vehicles | Trip Expenses | Vendor Payables
 * All payments are manual net banking: accountant transfers then records UTR here.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wallet, CheckCircle, Clock, XCircle, Truck, User, Package,
  Store, ArrowUpRight, X, AlertCircle, CreditCard, Zap
} from 'lucide-react';
import { financeService } from '../../services/dataService';
import toast from 'react-hot-toast';
import { safeArray } from '../../utils/helpers';

// ── helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number | undefined | null) =>
  n != null ? `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—';

const statusBadge = (status: string) => {
  const s = (status || '').toLowerCase();
  if (s === 'paid' || s === 'settled') return 'bg-green-100 text-green-700';
  if (s === 'approved') return 'bg-blue-100 text-blue-700';
  if (s === 'pending') return 'bg-amber-100 text-amber-700';
  if (s === 'disputed' || s === 'rejected') return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-600';
};

const PAYMENT_METHODS = ['NEFT', 'RTGS', 'UPI', 'CHEQUE', 'CASH'];

// ── Record Payment Modal ──────────────────────────────────────────────────────

interface PayModalProps {
  title: string;
  amount: number;
  onConfirm: (method: string, ref: string, date: string) => void;
  onClose: () => void;
  loading: boolean;
  showRef?: boolean;
  bankingInfo?: {
    bank_name?: string | null;
    account_number?: string | null;
    ifsc_code?: string | null;
    account_type?: string | null;
    upi_id?: string | null;
  };
}

function RecordPaymentModal({ title, amount, onConfirm, onClose, loading, showRef = true, bankingInfo }: PayModalProps) {
  const [method, setMethod] = useState('NEFT');
  const [ref, setRef] = useState('');
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split('T')[0]);

  const submit = () => {
    if (showRef && !ref.trim()) { toast.error('Enter reference / UTR number'); return; }
    onConfirm(method, ref.trim(), paidDate);
  };

  const hasBankDetails = bankingInfo?.account_number || bankingInfo?.upi_id;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h3 className="font-semibold text-gray-900">Record Payment</h3>
            <p className="text-sm text-gray-500 mt-0.5">{title}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {hasBankDetails && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Transfer To</p>
              {bankingInfo?.account_number && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Account</span>
                  <span className="text-sm font-mono font-medium text-gray-800">
                    {bankingInfo.bank_name ? `${bankingInfo.bank_name} · ` : ''}{bankingInfo.account_number}
                    {bankingInfo.account_type ? ` (${bankingInfo.account_type})` : ''}
                  </span>
                </div>
              )}
              {bankingInfo?.ifsc_code && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">IFSC</span>
                  <span className="text-sm font-mono text-gray-800">{bankingInfo.ifsc_code}</span>
                </div>
              )}
              {bankingInfo?.upi_id && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">UPI</span>
                  <span className="text-sm font-mono text-gray-800">{bankingInfo.upi_id}</span>
                </div>
              )}
            </div>
          )}

          {!hasBankDetails && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                No bank account / UPI details on file for this driver. Ask the driver to update their banking info in their profile.
              </p>
            </div>
          )}

          <div className="bg-blue-50 rounded-xl p-3 flex items-center gap-3">
            <Wallet className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-xs text-blue-600">Amount to Pay</p>
              <p className="text-lg font-bold text-blue-900">{fmt(amount)}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Method</label>
            <div className="grid grid-cols-5 gap-1.5">
              {PAYMENT_METHODS.map(m => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`py-2 rounded-lg text-xs font-medium border transition-all ${
                    method === m
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {showRef && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {method === 'CHEQUE' ? 'Cheque Number' : method === 'UPI' ? 'UPI Transaction ID' : 'UTR / Reference Number'}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="text"
                value={ref}
                onChange={e => setRef(e.target.value)}
                placeholder={method === 'CHEQUE' ? 'e.g. 000123' : 'e.g. SBIN2026040900001'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Date</label>
            <input
              type="date"
              value={paidDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={e => setPaidDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Transfer money via your bank app first, then enter the reference number here to record the payment.
            </p>
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Recording...' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Driver Settlements ───────────────────────────────────────────────────

function DriverSettlementsTab() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [payingId, setPayingId] = useState<number | null>(null);
  const [payingSettlement, setPayingSettlement] = useState<any>(null);

  const { data: raw, isLoading } = useQuery({
    queryKey: ['settlements-payables', statusFilter],
    queryFn: () => financeService.listDriverSettlements({ status: statusFilter || undefined }),
  });
  const settlements = safeArray(raw?.data ?? raw);

  const approveMut = useMutation({
    mutationFn: (id: number) => financeService.approveDriverSettlement(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settlements-payables'] }); toast.success('Settlement approved'); },
    onError: () => toast.error('Failed to approve'),
  });

  const payMut = useMutation({
    mutationFn: ({ id, method, ref, date }: { id: number; method: string; ref: string; date: string }) =>
      financeService.payDriverSettlement(id, { payment_method: method, reference_number: ref, paid_date: date }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settlements-payables'] });
      toast.success('Payment recorded ✓');
      setPayingId(null);
      setPayingSettlement(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Failed to record payment'),
  });

  const pending = settlements.filter(s => ['pending', 'approved'].includes((s.status || '').toLowerCase()));
  const pendingTotal = pending.reduce((sum: number, s: any) => sum + (s.net_amount_paise || 0) / 100, 0);

  return (
    <div className="space-y-4">
      {pendingTotal > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
          <Wallet className="h-5 w-5 text-blue-600" />
          <div>
            <p className="text-sm font-medium text-blue-900">Pending Driver Payments</p>
            <p className="text-xs text-blue-600">{pending.length} settlements · Total {fmt(pendingTotal)}</p>
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {['', 'pending', 'approved', 'paid'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              statusFilter === s ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : settlements.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <User className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No driver settlements</p>
        </div>
      ) : (
        <div className="space-y-2">
          {settlements.map((s: any) => {
            const status = (s.status || '').toLowerCase();
            const netAmt = (s.net_amount_paise || 0) / 100;
            return (
              <div key={s.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 text-sm">
                        {s.driver_first_name} {s.driver_last_name || ''}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(s.status)}`}>
                        {s.status?.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {s.settlement_number} · {s.origin && s.destination ? `${s.origin} → ${s.destination}` : 'Settlement'}
                    </p>
                    {s.paid_date && (
                      <p className="text-xs text-green-600 mt-0.5">
                        Paid on {new Date(s.paid_date).toLocaleDateString('en-IN')} via {s.payment_method}
                        {s.payment_reference ? ` · Ref: ${s.payment_reference}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-gray-900">{fmt(netAmt)}</p>
                    <div className="flex gap-1.5 mt-2 justify-end">
                      {status === 'pending' && (
                        <button
                          onClick={() => approveMut.mutate(s.id)}
                          disabled={approveMut.isPending}
                          className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100"
                        >
                          Approve
                        </button>
                      )}
                      {status === 'approved' && (
                        <button
                          onClick={() => { setPayingId(s.id); setPayingSettlement(s); }}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700"
                        >
                          Record Payment
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {payingId && payingSettlement && (
        <RecordPaymentModal
          title={`${payingSettlement.driver_first_name} ${payingSettlement.driver_last_name || ''} · ${payingSettlement.settlement_number}`}
          amount={(payingSettlement.net_amount_paise || 0) / 100}
          loading={payMut.isPending}
          onClose={() => { setPayingId(null); setPayingSettlement(null); }}
          onConfirm={(method, ref, date) => payMut.mutate({ id: payingId, method, ref, date })}
          bankingInfo={{
            bank_name: payingSettlement.driver_bank_name,
            account_number: payingSettlement.driver_account_number,
            ifsc_code: payingSettlement.driver_ifsc_code,
            account_type: payingSettlement.driver_account_type,
            upi_id: payingSettlement.driver_upi_id,
          }}
        />
      )}
    </div>
  );
}

// ── Tab: Market Vehicles ──────────────────────────────────────────────────────

function MarketVehiclesTab() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [settling, setSettling] = useState<any>(null);

  const { data: raw, isLoading } = useQuery({
    queryKey: ['market-trips-hub', statusFilter],
    queryFn: () => financeService.listMarketTrips({ status: statusFilter || undefined }),
  });
  const trips = safeArray(raw?.data ?? raw);

  const settleMut = useMutation({
    mutationFn: ({ id, ref, remarks }: { id: number; ref: string; remarks: string }) =>
      financeService.settleMarketTrip(id, { settlement_reference: ref, settlement_remarks: remarks }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['market-trips-hub'] });
      toast.success('Market trip settled ✓');
      setSettling(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Failed to settle'),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {['', 'DELIVERED', 'SETTLED', 'IN_TRANSIT'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              statusFilter === s ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {s ? s.replace('_', ' ') : 'All'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : trips.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Truck className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No market vehicle trips</p>
        </div>
      ) : (
        <div className="space-y-2">
          {trips.map((t: any) => (
            <div key={t.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900 text-sm">{t.vehicle_registration || 'Unknown'}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(t.status)}`}>
                      {(t.status || '').replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t.driver_name || '—'} · {t.vehicle_make || ''} {t.vehicle_type || ''}
                  </p>
                  {t.settlement_reference && (
                    <p className="text-xs text-green-600 mt-0.5">Ref: {t.settlement_reference}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-semibold text-gray-900">{fmt(t.net_payable)}</p>
                  <p className="text-xs text-gray-500">Net (after TDS)</p>
                  {(t.status || '').toUpperCase() === 'DELIVERED' && (
                    <button
                      onClick={() => setSettling(t)}
                      className="mt-2 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700"
                    >
                      Record Payment
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {settling && (
        <RecordPaymentModal
          title={`${settling.vehicle_registration} · Market Vehicle`}
          amount={settling.net_payable}
          loading={settleMut.isPending}
          onClose={() => setSettling(null)}
          onConfirm={(method, ref, date) => settleMut.mutate({ id: settling.id, ref, remarks: `${method} on ${date}` })}
        />
      )}
    </div>
  );
}

// ── Tab: Trip Expenses ────────────────────────────────────────────────────────

function TripExpensesTab() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('approved');
  const [paying, setPaying] = useState<any>(null);

  const { data: raw, isLoading } = useQuery({
    queryKey: ['expenses-hub', statusFilter],
    queryFn: () => financeService.listExpenses({ status: statusFilter || undefined }),
  });
  const expenses = safeArray(raw?.data ?? raw);

  const payMut = useMutation({
    mutationFn: ({ id, mode, ref }: { id: number; mode: string; ref: string }) =>
      financeService.payExpense(id, { payment_mode: mode.toLowerCase(), reference_number: ref }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses-hub'] });
      toast.success('Expense paid ✓');
      setPaying(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Failed to pay'),
  });

  const pendingTotal = expenses
    .filter((e: any) => (e.expense_status || e.status || '').toLowerCase() === 'approved')
    .reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

  return (
    <div className="space-y-4">
      {statusFilter === 'approved' && pendingTotal > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <Package className="h-5 w-5 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-900">Approved — Awaiting Payment</p>
            <p className="text-xs text-amber-600">Total {fmt(pendingTotal)}</p>
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {['pending', 'approved', 'paid', 'rejected'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              statusFilter === s ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No expenses</p>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((e: any) => {
            const status = (e.expense_status || e.status || '').toLowerCase();
            return (
              <div key={e.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 text-sm capitalize">
                        {(e.category || '').replace('_', ' ')}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(status)}`}>
                        {status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {e.description || '—'} {e.location ? `· ${e.location}` : ''}
                    </p>
                    {e.reference_number && (
                      <p className="text-xs text-green-600 mt-0.5">Ref: {e.reference_number}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-gray-900">{fmt(e.amount)}</p>
                    {status === 'approved' && (
                      <button
                        onClick={() => setPaying(e)}
                        className="mt-2 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700"
                      >
                        Record Payment
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {paying && (
        <RecordPaymentModal
          title={`${(paying.category || '').replace('_', ' ')} · ${paying.description || ''}`}
          amount={Number(paying.amount)}
          loading={payMut.isPending}
          onClose={() => setPaying(null)}
          onConfirm={(method, ref) => payMut.mutate({ id: paying.id, mode: method, ref })}
        />
      )}
    </div>
  );
}

// ── Tab: Vendor Payables ──────────────────────────────────────────────────────

function VendorPayablesTab() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [paying, setPaying] = useState<any>(null);

  const { data: raw, isLoading } = useQuery({
    queryKey: ['supplier-payables-hub', statusFilter],
    queryFn: () => financeService.listSupplierPayables({ status: statusFilter || undefined }),
  });
  const payables = safeArray(raw?.data ?? raw);

  const payMut = useMutation({
    mutationFn: ({ id, method, ref, date }: { id: number; method: string; ref: string; date: string }) =>
      financeService.paySupplierPayable(id, { payment_method: method, reference_number: ref, paid_date: date }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier-payables-hub'] });
      toast.success('Vendor payable paid ✓');
      setPaying(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Failed to pay'),
  });

  const pendingTotal = payables
    .filter((p: any) => (p.status || '').toLowerCase() === 'pending')
    .reduce((s: number, p: any) => s + Number(p.net_payable || p.amount || 0), 0);

  return (
    <div className="space-y-4">
      {pendingTotal > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <Store className="h-5 w-5 text-red-600" />
          <div>
            <p className="text-sm font-medium text-red-900">Pending Vendor Payments</p>
            <p className="text-xs text-red-600">Total {fmt(pendingTotal)}</p>
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {['', 'PENDING', 'PAID'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              statusFilter === s ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : payables.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Store className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No vendor payables</p>
        </div>
      ) : (
        <div className="space-y-2">
          {payables.map((p: any) => {
            const status = (p.status || '').toLowerCase();
            const due = p.due_date ? new Date(p.due_date) : null;
            const isOverdue = due && due < new Date() && status === 'pending';
            return (
              <div key={p.id} className={`bg-white border rounded-xl p-4 shadow-sm ${isOverdue ? 'border-red-200' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 text-sm">{p.payable_number}</span>
                      {isOverdue && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">OVERDUE</span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(status)}`}>
                        {status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {p.description || '—'} {p.expense_category ? `· ${p.expense_category}` : ''}
                    </p>
                    {due && (
                      <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                        Due: {due.toLocaleDateString('en-IN')}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-gray-900">{fmt(p.net_payable || p.amount)}</p>
                    {status === 'pending' && (
                      <button
                        onClick={() => setPaying(p)}
                        className="mt-2 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700"
                      >
                        Record Payment
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {paying && (
        <RecordPaymentModal
          title={`${paying.payable_number} · ${paying.description || 'Vendor Payable'}`}
          amount={Number(paying.net_payable || paying.amount)}
          loading={payMut.isPending}
          onClose={() => setPaying(null)}
          onConfirm={(method, ref, date) => payMut.mutate({ id: paying.id, method, ref, date })}
        />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type TabKey = 'drivers' | 'market' | 'expenses' | 'vendors';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'drivers', label: 'Driver Settlements', icon: <User className="h-4 w-4" /> },
  { key: 'market', label: 'Market Vehicles', icon: <Truck className="h-4 w-4" /> },
  { key: 'expenses', label: 'Trip Expenses', icon: <Package className="h-4 w-4" /> },
  { key: 'vendors', label: 'Vendor Payables', icon: <Store className="h-4 w-4" /> },
];

export default function PaymentsHubPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('drivers');

  // Summary counts
  const { data: settlementsRaw } = useQuery({
    queryKey: ['settlements-payables', 'approved'],
    queryFn: () => financeService.listDriverSettlements({ status: 'approved' }),
  });
  const { data: expensesRaw } = useQuery({
    queryKey: ['expenses-hub', 'approved'],
    queryFn: () => financeService.listExpenses({ status: 'approved' }),
  });
  const { data: payablesRaw } = useQuery({
    queryKey: ['supplier-payables-hub', 'PENDING'],
    queryFn: () => financeService.listSupplierPayables({ status: 'PENDING' }),
  });

  const settlementCount = safeArray(settlementsRaw?.data ?? settlementsRaw).length;
  const expenseCount = safeArray(expensesRaw?.data ?? expensesRaw).length;
  const payableCount = safeArray(payablesRaw?.data ?? payablesRaw).length;

  const badge = (count: number) =>
    count > 0 ? (
      <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 font-medium">
        {count}
      </span>
    ) : null;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments Hub</h1>
          <p className="text-sm text-gray-500 mt-0.5">Outgoing payments — record UTR after net banking transfer</p>
        </div>
        <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-xl">
          <CreditCard className="h-4 w-4 text-blue-600" />
          <span className="text-xs text-blue-700 font-medium">Manual Net Banking</span>
        </div>
      </div>

      {/* Summary KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Driver Settlements', count: settlementCount, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Market Vehicles', count: 0, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Trip Expenses', count: expenseCount, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Vendor Payables', count: payableCount, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(item => (
          <div key={item.label} className={`${item.bg} rounded-xl p-3`}>
            <p className="text-xs text-gray-500">{item.label}</p>
            <p className={`text-xl font-bold ${item.color}`}>{item.count}</p>
            <p className="text-xs text-gray-400">awaiting payment</p>
          </div>
        ))}
      </div>

      {/* Razorpay banner (only shows when enabled) */}
      <RazorpayBanner />

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.key === 'drivers' && badge(settlementCount)}
              {tab.key === 'expenses' && badge(expenseCount)}
              {tab.key === 'vendors' && badge(payableCount)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'drivers' && <DriverSettlementsTab />}
        {activeTab === 'market' && <MarketVehiclesTab />}
        {activeTab === 'expenses' && <TripExpensesTab />}
        {activeTab === 'vendors' && <VendorPayablesTab />}
      </div>
    </div>
  );
}

// ── Razorpay status banner ────────────────────────────────────────────────────

function RazorpayBanner() {
  const { data } = useQuery({
    queryKey: ['razorpay-status'],
    queryFn: () => financeService.razorpayStatus(),
    retry: false,
  });
  const status = data?.data;
  if (!status) return null;

  if (status.ready) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-3">
        <Zap className="h-4 w-4 text-green-600" />
        <p className="text-xs text-green-700 font-medium">
          Razorpay is active — you can send payment links to clients from the invoice view.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-3">
      <CreditCard className="h-4 w-4 text-gray-400" />
      <p className="text-xs text-gray-500">
        Razorpay not configured yet. Once you have your API keys, set{' '}
        <code className="bg-gray-100 px-1 rounded">RAZORPAY_ENABLED=true</code> in .env to accept online payments from clients.
      </p>
    </div>
  );
}
