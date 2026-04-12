/**
 * Finance Hub — Single-route tabbed finance centre.
 * URL: /finance?tab=overview|transactions|invoices|banking|reports
 *       &sub=receivables|payables|expenses|fuel|settlements
 *       &view=accounts|ledger|reconciliation
 */
import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard, Receipt, ArrowUpDown, Landmark, BarChart3,
  TrendingDown, AlertTriangle, Wallet, Clock, RefreshCw,
  Download, Bell, DollarSign, FileText, IndianRupee, XCircle,
  ThumbsDown, CheckCircle2, Car,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/services/api';
import { useFinanceAlertStore } from '@/store/financeAlertStore';
import { financeManagerService, type ExpenseSubmission } from '@/services/financeManagerService';
import type {
  FinanceKPI, OverdueAlert, UpcomingPayment, EWBAlert, BankingAlert,
} from '@/types/finance';
import { safeArray } from '@/utils/helpers';

// Lazy-load heavy sub-pages
const AccountantReceivablesPage = lazy(() => import('../accountant/AccountantReceivablesPage'));
const AccountantPayablesPage = lazy(() => import('../accountant/AccountantPayablesPage'));
const AccountantExpensesPage = lazy(() => import('../accountant/AccountantExpensesPage'));
const AccountantFuelExpensePage = lazy(() => import('../accountant/AccountantFuelExpensePage'));
const SettlementsPage = lazy(() => import('./SettlementsPage'));
const PaymentsHubPage = lazy(() => import('./PaymentsHubPage'));
const AccountantBankingPage = lazy(() => import('../accountant/AccountantBankingPage'));
const AccountantLedgerPage = lazy(() => import('../accountant/AccountantLedgerPage'));
const ReconciliationPage = lazy(() => import('./ReconciliationPage'));
const AccountantReportsPage = lazy(() => import('../accountant/AccountantReportsPage'));
const InvoiceWorkspacePage = lazy(() => import('./InvoiceWorkspacePage'));
const TripExpensesPage = lazy(() => import('../finance-manager/TripExpensesPage'));

type Tab = 'overview' | 'transactions' | 'invoices' | 'banking' | 'reports';
type TransactionSub = 'receivables' | 'payables' | 'expenses' | 'fuel' | 'settlements' | 'payments' | 'trip-expenses';
type BankingView = 'accounts' | 'ledger' | 'reconciliation';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={15} /> },
  { id: 'transactions', label: 'Transactions', icon: <ArrowUpDown size={15} /> },
  { id: 'invoices', label: 'Invoices', icon: <Receipt size={15} /> },
  { id: 'banking', label: 'Banking', icon: <Landmark size={15} /> },
  { id: 'reports', label: 'Reports', icon: <BarChart3 size={15} /> },
];

const TXN_SUBS: { id: TransactionSub; label: string }[] = [
  { id: 'receivables', label: 'Receivables' },
  { id: 'payables', label: 'Payables' },
  { id: 'trip-expenses', label: 'Trip Expenses' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'fuel', label: 'Fuel' },
  { id: 'settlements', label: 'Settlements' },
  { id: 'payments', label: 'Payments Hub' },
];

const BANKING_VIEWS: { id: BankingView; label: string }[] = [
  { id: 'accounts', label: 'Accounts' },
  { id: 'ledger', label: 'Ledger' },
  { id: 'reconciliation', label: 'Reconciliation' },
];

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

// ──────────────────────────────────────────────
// KPI Strip
// ──────────────────────────────────────────────
function KPIStrip({ kpis, loading }: { kpis?: FinanceKPI; loading: boolean }) {
  const cards = [
    {
      label: 'Total Invoiced',
      value: kpis ? fmt(kpis.total_invoiced) : '—',
      icon: <FileText size={18} className="text-blue-600" />,
      bg: 'bg-blue-50',
      color: 'text-blue-700',
    },
    {
      label: 'Outstanding',
      value: kpis ? fmt(kpis.outstanding) : '—',
      icon: <Clock size={18} className="text-amber-600" />,
      bg: 'bg-amber-50',
      color: 'text-amber-700',
    },
    {
      label: 'Overdue',
      value: kpis ? fmt(kpis.overdue) : '—',
      icon: <AlertTriangle size={18} className="text-red-600" />,
      bg: 'bg-red-50',
      color: 'text-red-700',
    },
    {
      label: 'Cash Balance',
      value: kpis ? fmt(kpis.cash_balance) : '—',
      icon: <Wallet size={18} className="text-green-600" />,
      bg: 'bg-green-50',
      color: 'text-green-700',
    },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((c) => (
        <div key={c.label} className={`${c.bg} rounded-xl p-4 border border-gray-100 shadow-sm`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{c.label}</span>
            {c.icon}
          </div>
          {loading ? (
            <div className="h-7 w-24 bg-gray-200 animate-pulse rounded" />
          ) : (
            <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────
// Overdue Invoices Panel
// ──────────────────────────────────────────────
function OverduePanell({ onRemind }: { onRemind: (id: number) => void }) {
  const { data, isLoading } = useQuery<{ data: OverdueAlert[] }>({
    queryKey: ['finance-hub-overdue'],
    queryFn: () => api.get('/finance/alerts/overdue'),
    refetchInterval: 60_000,
  });
  const items = safeArray<OverdueAlert>(data?.data);

  return (
    <AlertPanel
      title="Overdue Invoices"
      icon={<TrendingDown size={15} className="text-red-500" />}
      count={items.length}
      isLoading={isLoading}
      empty="No overdue invoices"
    >
      {items.slice(0, 8).map((inv) => {
        const badgeColor =
          inv.days_overdue > 30 ? 'bg-red-100 text-red-700' :
          inv.days_overdue > 7 ? 'bg-amber-100 text-amber-700' :
          'bg-yellow-100 text-yellow-700';
        return (
          <div key={inv.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-800 truncate">{inv.invoice_number}</p>
              <p className="text-[11px] text-gray-500 truncate">{inv.client_name}</p>
            </div>
            <div className="flex items-center gap-2 ml-3 flex-shrink-0">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badgeColor}`}>
                {inv.days_overdue}d
              </span>
              <span className="text-xs font-semibold text-gray-700">{fmt(inv.amount)}</span>
              <button
                onClick={() => onRemind(inv.id)}
                className="text-[10px] px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-600 font-medium transition-colors"
              >
                Remind
              </button>
            </div>
          </div>
        );
      })}
    </AlertPanel>
  );
}

// ──────────────────────────────────────────────
// Upcoming Payments Panel
// ──────────────────────────────────────────────
function UpcomingPaymentsPanel() {
  const { data, isLoading } = useQuery<{ data: UpcomingPayment[] }>({
    queryKey: ['finance-hub-upcoming'],
    queryFn: () => api.get('/finance/alerts/upcoming-payments', { params: { days: 7 } }),
    refetchInterval: 60_000,
  });
  const items = safeArray<UpcomingPayment>(data?.data);

  return (
    <AlertPanel
      title="Upcoming Payments (7d)"
      icon={<DollarSign size={15} className="text-amber-500" />}
      count={items.length}
      isLoading={isLoading}
      empty="No payments due this week"
    >
      {items.slice(0, 8).map((p) => (
        <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gray-800 truncate">{p.description}</p>
            <p className="text-[11px] text-gray-500 truncate">{p.vendor} · Due {p.due_date}</p>
          </div>
          <span className="text-xs font-semibold text-gray-700 ml-3 flex-shrink-0">{fmt(p.amount)}</span>
        </div>
      ))}
    </AlertPanel>
  );
}

// ──────────────────────────────────────────────
// EWB Expiry Panel
// ──────────────────────────────────────────────
function EWBExpiryPanel() {
  const { data, isLoading } = useQuery<{ data: EWBAlert[] }>({
    queryKey: ['finance-hub-ewb'],
    queryFn: () => api.get('/eway-bills/expiring', { params: { hours: 24 } }),
    refetchInterval: 60_000,
  });
  const items = safeArray<EWBAlert>(data?.data ?? (data as any)?.items);

  return (
    <AlertPanel
      title="EWB Expiring (24h)"
      icon={<Bell size={15} className="text-orange-500" />}
      count={items.length}
      isLoading={isLoading}
      empty="No EWBs expiring soon"
    >
      {items.slice(0, 8).map((e) => (
        <div key={e.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gray-800 truncate">{e.ewb_number}</p>
            <p className="text-[11px] text-gray-500 truncate">{e.vehicle_number} · {e.hours_left}h left</p>
          </div>
          {e.lr_number && (
            <span className="text-[10px] text-gray-500 ml-2 flex-shrink-0">{e.lr_number}</span>
          )}
        </div>
      ))}
    </AlertPanel>
  );
}

// ──────────────────────────────────────────────
// Low Balance Panel
// ──────────────────────────────────────────────
function LowBalancePanel() {
  const { data, isLoading } = useQuery<{ data: BankingAlert[] }>({
    queryKey: ['finance-hub-banking-alerts'],
    queryFn: () => api.get('/finance/alerts/banking', { params: { threshold: 10000 } }),
    refetchInterval: 60_000,
  });
  const items = safeArray<BankingAlert>(data?.data);

  return (
    <AlertPanel
      title="Low Balance Accounts"
      icon={<Landmark size={15} className="text-purple-500" />}
      count={items.length}
      isLoading={isLoading}
      empty="All accounts above threshold"
    >
      {items.slice(0, 8).map((a) => (
        <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gray-800 truncate">{a.account_name}</p>
            <p className="text-[11px] text-gray-500 truncate">{a.bank_name}</p>
          </div>
          <span className="text-xs font-bold text-red-600 ml-3 flex-shrink-0">{fmt(a.balance)}</span>
        </div>
      ))}
    </AlertPanel>
  );
}

// ──────────────────────────────────────────────
// Shared AlertPanel wrapper
// ──────────────────────────────────────────────
function AlertPanel({
  title, icon, count, isLoading, empty, children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  isLoading: boolean;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold text-gray-700">{title}</span>
        </div>
        {count > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
            {count}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-1 max-h-[260px]">
        {isLoading ? (
          <div className="py-6 flex justify-center">
            <RefreshCw size={16} className="text-gray-400 animate-spin" />
          </div>
        ) : count === 0 ? (
          <p className="text-xs text-gray-400 py-6 text-center">{empty}</p>
        ) : children}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Category labels for expense submissions
// ──────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  fuel: 'Fuel', spare_part: 'Spare Part', loading: 'Loading / Unloading',
  rto_fine: 'RTO Fine', toll: 'Toll', police: 'Police', food: 'Food',
  parking: 'Parking', tyre_puncture: 'Tyre Puncture', misc: 'Misc',
  other: 'Other',
};

// ──────────────────────────────────────────────
// Driver Expenses Panel
// ──────────────────────────────────────────────
function DriverExpensesPanel() {
  const qc = useQueryClient();
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['finance-hub-driver-expenses'],
    queryFn: () => financeManagerService.getExpenseQueue('pending'),
    refetchInterval: 30_000,
  });
  const items: ExpenseSubmission[] = Array.isArray(data) ? data : [];

  const payMutation = useMutation({
    mutationFn: (id: number) => financeManagerService.approveExpense(id, true),
    onSuccess: (_res, id) => {
      toast.success('Expense paid & reimbursed');
      qc.invalidateQueries({ queryKey: ['finance-hub-driver-expenses'] });
      qc.invalidateQueries({ queryKey: ['expense-queue'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Payment failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => financeManagerService.rejectExpense(id, rejectReason || 'Rejected by finance'),
    onSuccess: () => {
      toast.success('Expense rejected');
      qc.invalidateQueries({ queryKey: ['finance-hub-driver-expenses'] });
      qc.invalidateQueries({ queryKey: ['expense-queue'] });
      setRejectId(null);
      setRejectReason('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Rejection failed'),
  });

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm md:col-span-2">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Car size={15} className="text-blue-500" />
            <span className="text-sm font-semibold text-gray-700">Driver Expense Submissions</span>
            <span className="text-xs text-gray-400">(pending payment)</span>
          </div>
          {items.length > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {items.length}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="py-6 flex justify-center">
              <RefreshCw size={16} className="text-gray-400 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center">No pending driver expenses</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-2 text-left font-medium">Driver</th>
                  <th className="px-4 py-2 text-left font-medium">Category</th>
                  <th className="px-4 py-2 text-left font-medium">Trip</th>
                  <th className="px-4 py-2 text-left font-medium">Date</th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                  <th className="px-4 py-2 text-left font-medium">Method</th>
                  <th className="px-4 py-2 text-left font-medium">Receipt</th>
                  <th className="px-4 py-2 text-center font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((exp) => (
                  <tr key={exp.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-800">{exp.submitter_name || exp.driver_name || `#${exp.submitted_by}`}</p>
                      {exp.upi_ref_number && <p className="text-[10px] text-gray-400">UPI: {exp.upi_ref_number}</p>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        {CATEGORY_LABELS[exp.category] || exp.category}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {exp.trip_id ? `#${exp.trip_id}` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">
                      {exp.submitted_at ? new Date(exp.submitted_at).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                      {fmt(exp.amount_paise)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-gray-500 capitalize">{exp.payment_method || 'gpay'}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      {exp.receipt_image_s3 ? (
                        <button
                          onClick={() => setViewingReceipt(exp.receipt_image_s3!)}
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <CheckCircle2 size={11} className="text-green-500" /> View
                        </button>
                      ) : (
                        <span className="text-xs text-gray-300">No receipt</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => payMutation.mutate(exp.id)}
                          disabled={payMutation.isPending}
                          title="Pay & Reimburse"
                          className="flex items-center gap-1 px-2.5 py-1 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                        >
                          <IndianRupee size={11} /> Pay
                        </button>
                        <button
                          onClick={() => setRejectId(exp.id)}
                          title="Reject"
                          className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 text-xs font-medium rounded-lg hover:bg-red-100 transition-colors"
                        >
                          <ThumbsDown size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Receipt viewer modal */}
      {viewingReceipt && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setViewingReceipt(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="font-semibold text-sm">Receipt</span>
              <button onClick={() => setViewingReceipt(null)}><XCircle size={18} className="text-gray-400 hover:text-gray-600" /></button>
            </div>
            <div className="p-4">
              <img src={viewingReceipt} alt="Expense receipt" className="w-full rounded-lg border" />
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectId !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setRejectId(null)}>
          <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-3">Reject Expense</h3>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason (optional)…"
              className="w-full border rounded-lg p-3 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { setRejectId(null); setRejectReason(''); }}
                className="flex-1 border rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => rejectMutation.mutate(rejectId!)}
                disabled={rejectMutation.isPending}
                className="flex-1 bg-red-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-600 disabled:opacity-50"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ──────────────────────────────────────────────
// Overview Tab
// ──────────────────────────────────────────────
function OverviewTab() {
  const { setAlertCount } = useFinanceAlertStore();

  const { data: kpiData, isLoading: kpiLoading } = useQuery<{ data: FinanceKPI }>({
    queryKey: ['finance-hub-kpis'],
    queryFn: () => api.get('/finance/dashboard/kpis'),
    refetchInterval: 60_000,
  });
  const { data: overdueData } = useQuery<{ data: OverdueAlert[] }>({
    queryKey: ['finance-hub-overdue'],
    queryFn: () => api.get('/finance/alerts/overdue'),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const count = safeArray<OverdueAlert>(overdueData?.data).length;
    setAlertCount(count);
  }, [overdueData, setAlertCount]);

  const handleRemind = useCallback(async (id: number) => {
    try {
      await api.post(`/finance/invoices/${id}/remind`);
    } catch {
      // no-op — endpoint may not be wired to a real mailer yet
    }
  }, []);

  return (
    <div>
      <KPIStrip kpis={kpiData?.data} loading={kpiLoading} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <OverduePanell onRemind={handleRemind} />
        <UpcomingPaymentsPanel />
        <EWBExpiryPanel />
        <LowBalancePanel />
        <DriverExpensesPanel />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Transactions Tab
// ──────────────────────────────────────────────
function TransactionsTab({ sub, setSub }: { sub: TransactionSub; setSub: (s: TransactionSub) => void }) {
  return (
    <div>
      {/* Sub-tab bar */}
      <div className="flex gap-1 mb-5 border-b border-gray-200 pb-0">
        {TXN_SUBS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSub(s.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              sub === s.id
                ? 'border-blue-600 text-blue-700 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <Suspense fallback={<LoadingPane />}>
        {sub === 'receivables' && <AccountantReceivablesPage />}
        {sub === 'payables' && <AccountantPayablesPage />}
        {sub === 'trip-expenses' && <TripExpensesPage />}
        {sub === 'expenses' && <AccountantExpensesPage />}
        {sub === 'fuel' && <AccountantFuelExpensePage />}
        {sub === 'settlements' && <SettlementsPage />}
        {sub === 'payments' && <PaymentsHubPage />}
      </Suspense>
    </div>
  );
}

// ──────────────────────────────────────────────
// Invoices Tab
// ──────────────────────────────────────────────
function InvoicesTab() {
  return (
    <Suspense fallback={<LoadingPane />}>
      <InvoiceWorkspacePage />
    </Suspense>
  );
}

// ──────────────────────────────────────────────
// Banking Tab
// ──────────────────────────────────────────────
function BankingTab({ view, setView }: { view: BankingView; setView: (v: BankingView) => void }) {
  return (
    <div>
      <div className="flex gap-1 mb-5 border-b border-gray-200 pb-0">
        {BANKING_VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              view === v.id
                ? 'border-blue-600 text-blue-700 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
      <Suspense fallback={<LoadingPane />}>
        {view === 'accounts' && <AccountantBankingPage />}
        {view === 'ledger' && <AccountantLedgerPage />}
        {view === 'reconciliation' && <ReconciliationPage />}
      </Suspense>
    </div>
  );
}

// ──────────────────────────────────────────────
// Reports Tab
// ──────────────────────────────────────────────
function ReportsTab() {
  return (
    <Suspense fallback={<LoadingPane />}>
      <AccountantReportsPage />
    </Suspense>
  );
}

// ──────────────────────────────────────────────
// Loading Pane
// ──────────────────────────────────────────────
function LoadingPane() {
  return (
    <div className="flex items-center justify-center py-20 text-gray-400">
      <RefreshCw size={20} className="animate-spin mr-2" />
      <span className="text-sm">Loading…</span>
    </div>
  );
}

// ──────────────────────────────────────────────
// Finance Hub Page
// ──────────────────────────────────────────────
export default function FinanceHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = (searchParams.get('tab') as Tab) || 'overview';
  const sub = (searchParams.get('sub') as TransactionSub) || 'receivables';
  const view = (searchParams.get('view') as BankingView) || 'accounts';

  const setTab = (t: Tab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', t);
    // Reset sub/view when switching top-level tabs
    next.delete('sub');
    next.delete('view');
    setSearchParams(next, { replace: true });
  };

  const setSub = (s: TransactionSub) => {
    const next = new URLSearchParams(searchParams);
    next.set('sub', s);
    setSearchParams(next, { replace: true });
  };

  const setView = (v: BankingView) => {
    const next = new URLSearchParams(searchParams);
    next.set('view', v);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Finance Hub</h1>
            <p className="text-sm text-gray-500 mt-0.5">Unified finance — invoices, transactions, banking &amp; reports</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              onClick={() => window.location.reload()}
            >
              <RefreshCw size={14} />
              Refresh
            </button>
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium shadow-sm"
              onClick={() => setTab('reports')}
            >
              <Download size={14} />
              Reports
            </button>
          </div>
        </div>

        {/* Top-level tab bar */}
        <div className="flex gap-1 mt-4 -mb-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-blue-600 text-blue-700 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-6 py-6">
        {tab === 'overview' && <OverviewTab />}
        {tab === 'transactions' && <TransactionsTab sub={sub} setSub={setSub} />}
        {tab === 'invoices' && <InvoicesTab />}
        {tab === 'banking' && <BankingTab view={view} setView={setView} />}
        {tab === 'reports' && <ReportsTab />}
      </div>
    </div>
  );
}
