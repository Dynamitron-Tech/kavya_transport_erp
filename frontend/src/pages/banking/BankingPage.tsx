import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { bankingService } from '@/services/dataService';
import api from '@/services/api';
import { useBankingStore } from '@/store/bankingStore';
import { Modal } from '@/components/common/Modal';
import { SubmitButton } from '@/components/common/SubmitButton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { safeArray } from '@/utils/helpers';
import { handleApiError } from '@/utils/handleApiError';
import type { BankingEntry, BankingEntryType, BankBalance } from '@/types';
import {
  Landmark, TrendingUp, ArrowLeftRight,
  Plus, Upload, Search,
  Banknote, CreditCard, Building2, AlertTriangle,
  CheckCircle2, XCircle, Pencil, Trash2,
  ArrowDownLeft, ArrowUpRight,
} from 'lucide-react';

const ENTRY_TYPES: { value: BankingEntryType; label: string; color: string; icon: any }[] = [
  { value: 'PAYMENT_RECEIVED', label: 'Payment Received', color: 'bg-green-100 text-green-800', icon: ArrowDownLeft },
  { value: 'PAYMENT_MADE', label: 'Payment Made', color: 'bg-red-100 text-red-800', icon: ArrowUpRight },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer', color: 'bg-blue-100 text-blue-800', icon: ArrowLeftRight },
  { value: 'CASH_DEPOSIT', label: 'Cash Deposit', color: 'bg-emerald-100 text-emerald-800', icon: Banknote },
  { value: 'CASH_WITHDRAWAL', label: 'Cash Withdrawal', color: 'bg-orange-100 text-orange-800', icon: Banknote },
  { value: 'JOURNAL_ENTRY', label: 'Journal Entry', color: 'bg-purple-100 text-purple-800', icon: CreditCard },
];

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'reconciliation', label: 'Reconciliation' },
  { key: 'accounts', label: 'Accounts' },
] as const;

function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function formatRupees(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return `₹${safeAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function getAccountBalanceRupees(account: any): number {
  if (typeof account?.current_balance === 'number') return account.current_balance;
  if (typeof account?.current_balance_rupees === 'number') return account.current_balance_rupees;
  if (typeof account?.current_balance_paise === 'number') return account.current_balance_paise / 100;
  return 0;
}

// ── Overview Tab ──────────────────────────────────────────────────

function OverviewTab() {
  const { data: balance, isLoading } = useQuery({
    queryKey: ['banking-balance'],
    queryFn: bankingService.getBalance,
  });
  const { data: historyData } = useQuery({
    queryKey: ['banking-balance-history'],
    queryFn: () => bankingService.getBalanceHistory({ days: 30 }),
  });

  const accounts: BankBalance[] = safeArray(balance?.accounts);
  const totalRupees = balance?.total_balance_rupees ?? 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Balance</p>
              <p className="text-2xl font-bold text-gray-900">{formatRupees(totalRupees)}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg"><Landmark className="w-6 h-6 text-blue-600" /></div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Bank Accounts</p>
              <p className="text-2xl font-bold text-gray-900">{accounts.length}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg"><Building2 className="w-6 h-6 text-green-600" /></div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Highest Balance</p>
              <p className="text-2xl font-bold text-gray-900">
                {accounts.length > 0 ? formatRupees(Math.max(...accounts.map(a => getAccountBalanceRupees(a)))) : '₹0.00'}
              </p>
            </div>
            <div className="p-3 bg-emerald-100 rounded-lg"><TrendingUp className="w-6 h-6 text-emerald-600" /></div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Low Balance Alerts</p>
              <p className="text-2xl font-bold text-gray-900">
                {accounts.filter(a => a.alert_threshold_paise && (getAccountBalanceRupees(a) * 100) < a.alert_threshold_paise).length}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg"><AlertTriangle className="w-6 h-6 text-red-600" /></div>
          </div>
        </div>
      </div>

      {/* Account Cards */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Bank Accounts</h3>
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading accounts...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((acc) => (
              <div key={acc.account_id} className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-gray-900">{acc.account_name}</h4>
                    <p className="text-sm text-gray-500">{acc.bank_name}</p>
                  </div>
                  <Building2 className="w-5 h-5 text-gray-400" />
                </div>
                <p className="text-xs text-gray-400 mb-2">A/C: ****{acc.account_number?.slice(-4)}</p>
                <p className="text-xl font-bold text-gray-900">{formatRupees(getAccountBalanceRupees(acc))}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Balance History Chart Placeholder */}
      {historyData && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-lg font-semibold mb-3">30-Day Balance Trend</h3>
          <div className="h-48 flex items-end gap-1">
            {safeArray(historyData).slice(-30).map((point: any, idx: number) => {
              const max = Math.max(...safeArray(historyData).map((p: any) => Math.abs((p.balance_paise ?? p.net_balance_paise) || 0)), 1);
              const pointPaise = (point.balance_paise ?? point.net_balance_paise) || 0;
              const height = Math.max(5, (Math.abs(pointPaise) / max) * 100);
              return (
                <div key={idx} className="flex-1 flex flex-col items-center justify-end" title={`${point.date}: ${formatPaise(pointPaise)}`}>
                  <div className={`w-full rounded-t ${pointPaise >= 0 ? 'bg-green-400' : 'bg-red-400'}`} style={{ height: `${height}%` }} />
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">Daily net balance (last 30 days)</p>
        </div>
      )}
    </div>
  );
}

// ── Transactions Tab ─────────────────────────────────────────────

function TransactionsTab() {
  const qc = useQueryClient();
  const { filters, setFilters, setShowCreateEntry, setEditingEntry } = useBankingStore();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: entriesData, isLoading } = useQuery({
    queryKey: ['banking-entries', filters, page],
    queryFn: () => bankingService.listEntries({ ...filters, page, limit } as any),
  });

  const { data: accountsData } = useQuery({
    queryKey: ['banking-accounts-filter'],
    queryFn: () => api.get('/finance/bank-accounts'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => bankingService.deleteEntry(id),
    onSuccess: () => {
      toast.success('Entry deleted');
      qc.invalidateQueries({ queryKey: ['banking-entries'] });
      qc.invalidateQueries({ queryKey: ['banking-balance'] });
      setDeleteId(null);
    },
    onError: (err: any) => handleApiError(err),
  });

  const entries: BankingEntry[] = safeArray(entriesData?.data);
  const total = entriesData?.pagination?.total ?? 0;
  const pages = entriesData?.pagination?.pages ?? 1;
  const accounts = safeArray(accountsData?.data);

  const getEntryTypeInfo = (type: BankingEntryType) => ENTRY_TYPES.find(t => t.value === type) || ENTRY_TYPES[0];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search entries..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
            value={filters.search || ''}
            onChange={e => setFilters({ search: e.target.value || undefined })}
          />
        </div>
        <select className="border rounded-lg px-3 py-2 text-sm" value={filters.account_id || ''} onChange={e => setFilters({ account_id: e.target.value ? Number(e.target.value) : undefined })}>
          <option value="">All Accounts</option>
          {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.account_name || a.bank_name}</option>)}
        </select>
        <select className="border rounded-lg px-3 py-2 text-sm" value={filters.entry_type || ''} onChange={e => setFilters({ entry_type: (e.target.value || undefined) as any })}>
          <option value="">All Types</option>
          {ENTRY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button onClick={() => setShowCreateEntry(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          <Plus className="w-4 h-4" /> New Entry
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Entry No</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Reconciled</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-500">Loading...</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-500">No entries found</td></tr>
            ) : entries.map(entry => {
              const info = getEntryTypeInfo(entry.entry_type);
              const isCredit = ['PAYMENT_RECEIVED', 'CASH_DEPOSIT'].includes(entry.entry_type);
              return (
                <tr key={entry.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{entry.entry_no}</td>
                  <td className="px-4 py-3">{new Date(entry.entry_date).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${info.color}`}>
                      {info.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-[200px] truncate">{entry.description || entry.reference_no || '-'}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                    {isCredit ? '+' : '-'}{formatPaise(entry.amount_paise)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {entry.reconciled ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-gray-300 mx-auto" />}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {!entry.reconciled && (
                        <>
                          <button onClick={() => setEditingEntry(entry)} className="p-1 hover:bg-gray-100 rounded"><Pencil className="w-4 h-4 text-gray-500" /></button>
                          <button onClick={() => setDeleteId(entry.id)} className="p-1 hover:bg-gray-100 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Showing {entries.length} of {total} entries</p>
          <div className="flex gap-1">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-50">Prev</button>
            <span className="px-3 py-1 text-sm">Page {page} of {pages}</span>
            <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-50">Next</button>
          </div>
        </div>
      )}

      <ConfirmDialog isOpen={deleteId !== null} title="Delete Entry?" message="This action cannot be undone." onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} onCancel={() => setDeleteId(null)} />
    </div>
  );
}

// ── Reconciliation Tab ───────────────────────────────────────────

function ReconciliationTab() {
  const qc = useQueryClient();
  const { csvPreview, setCSVPreview } = useBankingStore();
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: accountsData } = useQuery({
    queryKey: ['banking-accounts-recon'],
    queryFn: () => api.get('/finance/bank-accounts'),
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedAccountId) throw new Error('Select an account');
      return bankingService.importCSV(selectedAccountId, file);
    },
    onSuccess: (data: any) => {
      toast.success(`CSV imported: ${data.total_rows} rows`);
      setCSVPreview(data);
      qc.invalidateQueries({ queryKey: ['csv-transactions'] });
    },
    onError: (err: any) => handleApiError(err),
  });

  const { data: txnsData } = useQuery({
    queryKey: ['csv-transactions', csvPreview?.import_id],
    queryFn: () => csvPreview ? bankingService.listCSVTransactions(csvPreview.import_id) : null,
    enabled: !!csvPreview?.import_id,
  });

  const matchMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => bankingService.matchCSVTransaction(id, payload),
    onSuccess: () => {
      toast.success('Matched');
      qc.invalidateQueries({ queryKey: ['csv-transactions'] });
    },
    onError: (err: any) => handleApiError(err),
  });

  const ignoreMutation = useMutation({
    mutationFn: (id: number) => bankingService.ignoreCSVTransaction(id),
    onSuccess: () => {
      toast.success('Ignored');
      qc.invalidateQueries({ queryKey: ['csv-transactions'] });
    },
    onError: (err: any) => handleApiError(err),
  });

  const accounts = safeArray(accountsData?.data);
  const csvTransactions = safeArray(txnsData?.data);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) importMutation.mutate(file);
  };

  const statusColors: Record<string, string> = {
    MATCHED: 'bg-green-100 text-green-800',
    UNMATCHED: 'bg-yellow-100 text-yellow-800',
    EXCEPTION: 'bg-red-100 text-red-800',
    IGNORED: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="space-y-4">
      {/* Import Controls */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-lg font-semibold mb-3">CSV Bank Statement Import</h3>
        <p className="text-sm text-gray-500 mb-4">Upload a CSV bank statement. Supports HDFC, ICICI, SBI, Axis, and Kotak formats. Auto-detection included.</p>
        <div className="flex items-center gap-3">
          <select className="border rounded-lg px-3 py-2 text-sm" value={selectedAccountId || ''} onChange={e => setSelectedAccountId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Select Bank Account</option>
            {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.account_name} ({a.bank_name})</option>)}
          </select>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
          <button onClick={() => fileRef.current?.click()} disabled={!selectedAccountId || importMutation.isPending} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
            <Upload className="w-4 h-4" /> {importMutation.isPending ? 'Importing...' : 'Upload CSV'}
          </button>
        </div>
      </div>

      {/* Import Summary */}
      {csvPreview && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-800 mb-2">Import Summary: {csvPreview.filename}</h4>
          <div className="grid grid-cols-5 gap-4 text-sm">
            <div><span className="text-gray-500">Bank:</span> <span className="font-medium">{csvPreview.bank_detected}</span></div>
            <div><span className="text-gray-500">Rows:</span> <span className="font-medium">{csvPreview.total_rows}</span></div>
            <div><span className="text-gray-500">Matched:</span> <span className="font-medium text-green-600">{csvPreview.matched}</span></div>
            <div><span className="text-gray-500">Unmatched:</span> <span className="font-medium text-yellow-600">{csvPreview.unmatched}</span></div>
            <div><span className="text-gray-500">Exceptions:</span> <span className="font-medium text-red-600">{csvPreview.exceptions}</span></div>
          </div>
        </div>
      )}

      {/* CSV Transactions Table */}
      {csvTransactions.length > 0 && (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Reference</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Debit</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Credit</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {csvTransactions.map((txn: any) => (
                <tr key={txn.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">{txn.txn_date ? new Date(txn.txn_date).toLocaleDateString('en-IN') : '-'}</td>
                  <td className="px-4 py-3 max-w-[250px] truncate">{txn.description}</td>
                  <td className="px-4 py-3 font-mono text-xs">{txn.reference_no || '-'}</td>
                  <td className="px-4 py-3 text-right text-red-600">{txn.debit_paise ? formatPaise(txn.debit_paise) : '-'}</td>
                  <td className="px-4 py-3 text-right text-green-600">{txn.credit_paise ? formatPaise(txn.credit_paise) : '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[txn.match_status] || 'bg-gray-100'}`}>
                      {txn.match_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {txn.match_status !== 'MATCHED' && txn.match_status !== 'IGNORED' && (
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => matchMutation.mutate({ id: txn.id, payload: {} })} className="text-xs text-blue-500 hover:text-blue-700">Match</button>
                        <button onClick={() => ignoreMutation.mutate(txn.id)} className="text-xs text-gray-500 hover:text-gray-700">Ignore</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!csvPreview && csvTransactions.length === 0 && (
        <div className="bg-white rounded-lg border p-12 text-center">
          <Upload className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Upload a bank CSV statement to start reconciliation</p>
          <p className="text-sm text-gray-400 mt-1">Supported: HDFC, ICICI, SBI, Axis, Kotak</p>
        </div>
      )}
    </div>
  );
}

// ── Accounts Tab ─────────────────────────────────────────────────

function AccountsTab() {
  const { data: balance, isLoading } = useQuery({
    queryKey: ['banking-balance'],
    queryFn: bankingService.getBalance,
  });

  const accounts: BankBalance[] = safeArray(balance?.accounts);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Account Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Bank</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Account Number</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Current Balance</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Alert Threshold</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-500">Loading...</td></tr>
            ) : accounts.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-500">No bank accounts found</td></tr>
            ) : accounts.map(acc => {
              const balanceRupees = getAccountBalanceRupees(acc);
              const balancePaise = balanceRupees * 100;
              const isLow = acc.alert_threshold_paise && balancePaise < acc.alert_threshold_paise;
              return (
                <tr key={acc.account_id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{acc.account_name}</td>
                  <td className="px-4 py-3">{acc.bank_name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{acc.account_number}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${isLow ? 'text-red-600' : 'text-gray-900'}`}>
                    {formatRupees(balanceRupees)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {acc.alert_threshold_paise ? formatPaise(acc.alert_threshold_paise) : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {isLow ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <AlertTriangle className="w-3 h-3" /> Low
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">OK</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Create Banking Entry Modal ───────────────────────────────────

function CreateBankingEntryModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    account_id: '',
    entry_date: new Date().toISOString().split('T')[0],
    entry_type: 'PAYMENT_RECEIVED' as BankingEntryType,
    amount: '',
    payment_method: 'bank_transfer',
    reference_no: '',
    client_id: '',
    job_id: '',
    invoice_id: '',
    transfer_to_account_id: '',
    description: '',
  });

  const { data: accountsData } = useQuery({
    queryKey: ['banking-accounts-modal'],
    queryFn: () => api.get('/finance/bank-accounts'),
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => bankingService.createEntry(payload),
    onSuccess: () => {
      toast.success('Banking entry created');
      qc.invalidateQueries({ queryKey: ['banking-entries'] });
      qc.invalidateQueries({ queryKey: ['banking-balance'] });
      onClose();
    },
    onError: (err: any) => handleApiError(err),
  });

  const accounts = safeArray(accountsData?.data);
  const isTransfer = form.entry_type === 'BANK_TRANSFER';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountRupees = parseFloat(form.amount);
    if (!amountRupees || amountRupees <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    const payload: any = {
      account_id: Number(form.account_id),
      entry_date: form.entry_date,
      entry_type: form.entry_type,
      amount_paise: Math.round(amountRupees * 100),
      payment_method: form.payment_method || undefined,
      reference_no: form.reference_no || undefined,
      description: form.description || undefined,
    };
    if (form.client_id) payload.client_id = Number(form.client_id);
    if (form.job_id) payload.job_id = Number(form.job_id);
    if (form.invoice_id) payload.invoice_id = Number(form.invoice_id);
    if (isTransfer && form.transfer_to_account_id) payload.transfer_to_account_id = Number(form.transfer_to_account_id);
    createMutation.mutate(payload);
  };

  return (
    <Modal isOpen onClose={onClose} title="Create Banking Entry" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Entry Type Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Entry Type</label>
          <div className="grid grid-cols-3 gap-2">
            {ENTRY_TYPES.map(t => (
              <button key={t.value} type="button" onClick={() => setForm(f => ({ ...f, entry_type: t.value }))}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all ${form.entry_type === t.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300'}`}>
                <t.icon className="w-4 h-4" /> {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Account */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bank Account *</label>
            <select required className="w-full border rounded-lg px-3 py-2 text-sm" value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}>
              <option value="">Select Account</option>
              {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.account_name} ({a.bank_name})</option>)}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input type="date" required className="w-full border rounded-lg px-3 py-2 text-sm" value={form.entry_date} onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹) *</label>
            <input type="number" required min="0.01" step="0.01" placeholder="0.00" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
              <option value="upi">UPI</option>
              <option value="neft">NEFT</option>
              <option value="rtgs">RTGS</option>
            </select>
          </div>

          {/* Transfer To Account */}
          {isTransfer && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Transfer To Account *</label>
              <select required className="w-full border rounded-lg px-3 py-2 text-sm" value={form.transfer_to_account_id} onChange={e => setForm(f => ({ ...f, transfer_to_account_id: e.target.value }))}>
                <option value="">Select Target Account</option>
                {accounts.filter((a: any) => String(a.id) !== form.account_id).map((a: any) => (
                  <option key={a.id} value={a.id}>{a.account_name} ({a.bank_name})</option>
                ))}
              </select>
            </div>
          )}

          {/* Reference */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reference No</label>
            <input type="text" placeholder="Cheque/UTR/Ref No" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.reference_no} onChange={e => setForm(f => ({ ...f, reference_no: e.target.value }))} />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Payment description..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          <SubmitButton isLoading={createMutation.isPending} label="Create Entry" />
        </div>
      </form>
    </Modal>
  );
}

// ── Main Page Component ──────────────────────────────────────────

export default function BankingPage() {
  const { activeTab, setActiveTab, showCreateEntry, setShowCreateEntry } = useBankingStore();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Banking</h1>
          <p className="text-sm text-gray-500">Manage bank entries, reconciliation, and account balances</p>
        </div>
        <button onClick={() => setShowCreateEntry(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> New Entry
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-6">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`pb-3 text-sm font-medium transition-colors ${activeTab === tab.key ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'transactions' && <TransactionsTab />}
      {activeTab === 'reconciliation' && <ReconciliationTab />}
      {activeTab === 'accounts' && <AccountsTab />}

      {/* Create Entry Modal */}
      {showCreateEntry && <CreateBankingEntryModal onClose={() => setShowCreateEntry(false)} />}
    </div>
  );
}
