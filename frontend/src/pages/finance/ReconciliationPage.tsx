import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';
import { safeArray } from '@/utils/helpers';
import {
  Upload, CheckCircle, XCircle, ChevronDown, FileText,
} from 'lucide-react';


// ─── API helpers ─────────────────────────────────────────────────────────────

const reconciliationApi = {
  upload: async (file: File, bankAccountId: number) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('bank_account_id', String(bankAccountId));
    const r = await api.post('/reconciliation/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return r.data;
  },
  getSessions: async () => {
    const r = await api.get('/reconciliation/sessions');
    return r.data;
  },
  getSession: async (id: number, page = 1, confidence?: string, status?: string) => {
    const r = await api.get(`/reconciliation/sessions/${id}`, {
      params: { page, limit: 100, confidence, status },
    });
    return r.data;
  },
  confirm: async (sessionId: number, confirmations: ConfirmItem[]) => {
    const r = await api.post(`/reconciliation/sessions/${sessionId}/confirm`, { confirmations });
    return r.data;
  },
  confirmAllHigh: async (sessionId: number) => {
    const r = await api.post(`/reconciliation/sessions/${sessionId}/confirm-all-high`);
    return r.data;
  },
  getBankAccounts: async () => {
    const r = await api.get('/banking/accounts');
    return r.data;
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConfirmItem {
  transaction_row: number;
  action: 'confirm_match' | 'create_expense' | 'skip' | 'manual_entry';
  entity_id?: number;
  entity_type?: string;
  expense_category?: string;
  notes?: string;
}

interface ReconLine {
  id: number;
  row_number: number;
  txn_date: string;
  description: string;
  reference_number: string | null;
  debit_paise: number;
  credit_paise: number;
  transaction_type: 'debit' | 'credit';
  matched_entity_type: string | null;
  matched_entity_id: number | null;
  matched_entity_ref: string | null;
  matched_amount_paise: number | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  match_reason: string | null;
  suggested_category: string | null;
  alternative_matches: Array<{
    entity_type: string;
    entity_id: number;
    entity_ref: string;
    amount_paise: number;
    confidence: string;
    reason: string;
  }>;
  status: 'pending' | 'confirmed' | 'skipped';
}

interface ReconSession {
  id: number;
  bank_name: string | null;
  source_file_name: string;
  statement_from: string | null;
  statement_to: string | null;
  status: string;
  total_transactions: number;
  confirmed_count: number;
  skipped_count: number;
  unmatched_count: number;
  high_confidence_count: number;
  medium_confidence_count: number;
  created_at: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = [
  { value: 'driver_salary', label: 'Driver Salary' },
  { value: 'staff_salary', label: 'Staff Salary' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'tax', label: 'Tax / GST / TDS' },
  { value: 'permit_compliance', label: 'Permit / RTO' },
  { value: 'market_vehicle_rent', label: 'Vehicle Rent' },
  { value: 'vehicle_spare_part', label: 'Spare Parts / Repairs' },
  { value: 'loading_unloading', label: 'Loading / Unloading' },
  { value: 'misc_field', label: 'Miscellaneous' },
];

const BANK_BADGES = ['HDFC', 'ICICI', 'SBI', 'AXIS', 'KOTAK'];

const fmtAmount = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100);

type TabFilter = 'all' | 'needs_review' | 'high' | 'confirmed' | 'skipped';

// ─── Inline create expense form ───────────────────────────────────────────────

function InlineExpenseForm({
  line,
  onSave,
  onCancel,
}: {
  line: ReconLine;
  onSave: (category: string, notes: string) => void;
  onCancel: () => void;
}) {
  const [cat, setCat] = useState(line.suggested_category ?? 'misc_field');
  const [notes, setNotes] = useState(line.description ?? '');
  return (
    <tr className="bg-blue-50 border-l-4 border-l-blue-400">
      <td colSpan={6} className="px-4 py-3">
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Category</label>
            <select
              value={cat}
              onChange={e => setCat(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
            >
              {EXPENSE_CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-48">
            <label className="block text-xs text-gray-500 mb-0.5">Description</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Amount</label>
            <span className="font-semibold text-red-600">{fmtAmount(line.debit_paise)}</span>
            <span className="text-xs text-gray-400 ml-1">(locked)</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onSave(cat, notes)}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              Save &amp; Confirm
            </button>
            <button
              onClick={onCancel}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── Row component ────────────────────────────────────────────────────────────

function ReconciliationRow({
  line,
  onConfirm,
  onSkip,
  onCreateExpense,
}: {
  line: ReconLine;
  onConfirm: (item: ConfirmItem) => void;
  onSkip: (row: number) => void;
  onCreateExpense: (row: number, category: string, notes: string) => void;
}) {
  const [expandExpense, setExpandExpense] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const rowBg =
    line.status === 'confirmed' ? 'bg-green-50' :
    line.status === 'skipped' ? 'bg-gray-50 opacity-60' :
    line.confidence === 'HIGH' ? 'bg-green-50' :
    line.confidence === 'MEDIUM' ? 'bg-amber-50' :
    'bg-white';

  const confDot =
    line.confidence === 'HIGH' ? 'bg-green-500' :
    line.confidence === 'MEDIUM' ? 'bg-amber-500' :
    line.confidence === 'LOW' ? 'bg-orange-400' :
    'bg-gray-300';

  const isCredit = line.transaction_type === 'credit';
  const amount = isCredit ? line.credit_paise : line.debit_paise;

  const shortDesc =
    line.description && line.description.length > 55
      ? line.description.slice(0, 55) + '…'
      : line.description;

  return (
    <>
      <tr className={`${rowBg} border-b border-gray-100 text-sm`}>
        {/* Date */}
        <td className="px-3 py-2.5 whitespace-nowrap text-gray-600 text-xs">
          {line.txn_date ? new Date(line.txn_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
        </td>

        {/* Narration */}
        <td className="px-3 py-2.5 max-w-xs">
          <span title={line.description ?? ''} className="block truncate text-gray-800">
            {shortDesc || '—'}
          </span>
          {line.reference_number && (
            <span className="text-xs text-gray-400 font-mono">{line.reference_number}</span>
          )}
        </td>

        {/* Amount */}
        <td className={`px-3 py-2.5 text-right font-semibold whitespace-nowrap ${isCredit ? 'text-green-700' : 'text-red-600'}`}>
          {isCredit ? '+' : '−'}{fmtAmount(amount)}
        </td>

        {/* Matched to */}
        <td className="px-3 py-2.5">
          {line.status === 'confirmed' ? (
            <span className="inline-flex items-center gap-1 text-green-700 text-xs">
              <CheckCircle size={12} /> Confirmed
            </span>
          ) : line.matched_entity_ref ? (
            <div>
              <span className="text-gray-800 text-xs font-medium">{line.matched_entity_ref}</span>
              {line.matched_amount_paise && (
                <span className="ml-1 text-gray-400 text-xs">· {fmtAmount(line.matched_amount_paise)}</span>
              )}
            </div>
          ) : (
            <span className="text-gray-400 text-xs">— No match found</span>
          )}
          {!line.matched_entity_ref && line.suggested_category && line.status === 'pending' && (
            <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">
              Looks like: {EXPENSE_CATEGORIES.find(c => c.value === line.suggested_category)?.label ?? line.suggested_category}
            </span>
          )}
          {/* Alternative matches */}
          {line.alternative_matches.length > 0 && line.status === 'pending' && line.confidence !== 'HIGH' && (
            <div className="mt-0.5 text-xs text-gray-400">
              Other:{' '}
              {line.alternative_matches.slice(0, 2).map(alt => (
                <button
                  key={alt.entity_id}
                  onClick={() => onConfirm({ transaction_row: line.row_number, action: 'confirm_match', entity_id: alt.entity_id, entity_type: alt.entity_type })}
                  className="text-blue-600 underline mr-2 hover:text-blue-800"
                >
                  {alt.entity_ref}
                </button>
              ))}
            </div>
          )}
        </td>

        {/* Confidence */}
        <td className="px-3 py-2.5 whitespace-nowrap">
          {line.status === 'confirmed' ? null : (
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full inline-block ${confDot}`} />
              <span className="text-xs text-gray-600">
                {line.confidence === 'NONE' ? 'Unmatched' : line.confidence}
              </span>
            </div>
          )}
          {line.match_reason && line.status === 'pending' && (
            <div className="text-xs text-gray-400 mt-0.5 max-w-[160px] truncate" title={line.match_reason}>
              {line.match_reason}
            </div>
          )}
        </td>

        {/* Action */}
        <td className="px-3 py-2.5 whitespace-nowrap">
          {line.status === 'confirmed' || line.status === 'skipped' ? (
            <span className="text-xs text-gray-400 italic">{line.status}</span>
          ) : line.confidence === 'HIGH' ? (
            <button
              onClick={() => onConfirm({ transaction_row: line.row_number, action: 'confirm_match' })}
              className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 font-medium"
            >
              Confirm
            </button>
          ) : line.matched_entity_ref ? (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(o => !o)}
                className="flex items-center gap-1 px-2 py-1 border border-gray-300 rounded text-xs text-gray-700 hover:bg-gray-50"
              >
                Review <ChevronDown size={12} />
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-10 w-48 text-xs">
                  <button
                    onClick={() => { onConfirm({ transaction_row: line.row_number, action: 'confirm_match' }); setDropdownOpen(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50"
                  >
                    ✓ Confirm this match
                  </button>
                  {line.alternative_matches.slice(0, 2).map(alt => (
                    <button
                      key={alt.entity_id}
                      onClick={() => { onConfirm({ transaction_row: line.row_number, action: 'confirm_match', entity_id: alt.entity_id, entity_type: alt.entity_type }); setDropdownOpen(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 text-blue-600"
                    >
                      → {alt.entity_ref}
                    </button>
                  ))}
                  <button
                    onClick={() => { onSkip(line.row_number); setDropdownOpen(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 text-gray-500"
                  >
                    Skip
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex gap-1">
              {line.transaction_type === 'debit' && (
                <button
                  onClick={() => setExpandExpense(e => !e)}
                  className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs hover:bg-blue-100"
                >
                  Create expense ↓
                </button>
              )}
              <button
                onClick={() => onConfirm({ transaction_row: line.row_number, action: 'manual_entry' })}
                className="px-2 py-1 text-gray-500 border border-gray-200 rounded text-xs hover:bg-gray-50"
                title="Manual entry"
              >
                Manual
              </button>
              <button
                onClick={() => onSkip(line.row_number)}
                className="p-1 text-gray-400 hover:text-gray-600"
                title="Skip"
              >
                <XCircle size={14} />
              </button>
            </div>
          )}
        </td>
      </tr>

      {/* Inline expense form */}
      {expandExpense && (
        <InlineExpenseForm
          line={line}
          onSave={(cat, notes) => {
            onCreateExpense(line.row_number, cat, notes);
            setExpandExpense(false);
          }}
          onCancel={() => setExpandExpense(false)}
        />
      )}
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReconciliationPage() {
  const qc = useQueryClient();
  const dropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [accountId, setAccountId] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);

  // ── Queries ──
  const sessionListQ = useQuery({
    queryKey: ['recon-sessions'],
    queryFn: reconciliationApi.getSessions,
  });
  const sessions: ReconSession[] = safeArray((sessionListQ.data as any)?.data ?? sessionListQ.data);

  const sessionDetailQ = useQuery({
    queryKey: ['recon-session', activeSessionId, activeTab],
    queryFn: () => reconciliationApi.getSession(activeSessionId!, 1, undefined, undefined),
    enabled: !!activeSessionId,
  });
  const sessionData = (sessionDetailQ.data as any)?.data;
  const sessionInfo: ReconSession | null = sessionData?.session ?? null;
  const allLines: ReconLine[] = safeArray(sessionData?.lines);

  const bankAccountsQ = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: reconciliationApi.getBankAccounts,
  });
  const bankAccounts = safeArray((bankAccountsQ.data as any)?.data ?? bankAccountsQ.data);

  // ── Filtered lines ──
  const filteredLines = allLines.filter(line => {
    if (activeTab === 'high') return line.confidence === 'HIGH' && line.status === 'pending';
    if (activeTab === 'needs_review') return (line.confidence === 'MEDIUM' || line.confidence === 'NONE' || line.confidence === 'LOW') && line.status === 'pending';
    if (activeTab === 'confirmed') return line.status === 'confirmed';
    if (activeTab === 'skipped') return line.status === 'skipped';
    return true;
  });

  // ── Upload mutation ──
  const uploadMutation = useMutation({
    mutationFn: ({ file, accId }: { file: File; accId: number }) =>
      reconciliationApi.upload(file, accId),
    onSuccess: (data: any) => {
      const d = data?.data ?? data;
      toast.success(`Parsed ${d.total_transactions} transactions — ${d.auto_matched_high} high-confidence matches`);
      setActiveSessionId(d.session_id);
      qc.invalidateQueries({ queryKey: ['recon-sessions'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail ?? 'Upload failed');
    },
  });

  // ── Confirm mutation ──
  const confirmMutation = useMutation({
    mutationFn: (items: ConfirmItem[]) =>
      reconciliationApi.confirm(activeSessionId!, items),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recon-session', activeSessionId] });
      qc.invalidateQueries({ queryKey: ['recon-sessions'] });
    },
    onError: () => toast.error('Action failed'),
  });

  // ── Confirm all HIGH mutation ──
  const confirmAllHighMutation = useMutation({
    mutationFn: () => reconciliationApi.confirmAllHigh(activeSessionId!),
    onSuccess: (data: any) => {
      const count = data?.data?.confirmed ?? 0;
      toast.success(`${count} transactions confirmed`);
      qc.invalidateQueries({ queryKey: ['recon-session', activeSessionId] });
      qc.invalidateQueries({ queryKey: ['recon-sessions'] });
    },
    onError: () => toast.error('Bulk confirm failed'),
  });

  // ── Drag and drop handlers ──
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  const handleDragLeave = useCallback(() => setIsDragging(false), []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && accountId) {
      uploadMutation.mutate({ file: f, accId: accountId });
    } else if (!accountId) {
      toast.error('Select a bank account first');
    }
  }, [accountId, uploadMutation]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && accountId) {
      uploadMutation.mutate({ file: f, accId: accountId });
    } else if (!accountId) {
      toast.error('Select a bank account first');
    }
    e.target.value = '';
  };

  // ── Action handlers ──
  const handleConfirm = (item: ConfirmItem) => confirmMutation.mutate([item]);
  const handleSkip = (row: number) => confirmMutation.mutate([{ transaction_row: row, action: 'skip' }]);
  const handleCreateExpense = (row: number, category: string, notes: string) =>
    confirmMutation.mutate([{ transaction_row: row, action: 'create_expense', expense_category: category, notes }]);

  // ── Counts for summary bar ──
  const highPending = allLines.filter(l => l.confidence === 'HIGH' && l.status === 'pending').length;
  const mediumPending = allLines.filter(l => l.confidence === 'MEDIUM' && l.status === 'pending').length;
  const unmatched = allLines.filter(l => l.confidence === 'NONE' && l.status === 'pending').length;
  const confirmedTotal = allLines.filter(l => l.status === 'confirmed').length;
  const totalRelevant = allLines.length;

  const TABS: { key: TabFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'needs_review', label: 'Needs review' },
    { key: 'high', label: 'High confidence' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'skipped', label: 'Skipped' },
  ];

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Bank Reconciliation</h1>
          <p className="page-subtitle">Upload statement → auto-match → confirm in minutes</p>
        </div>
      </div>

      {/* ── Upload zone ── */}
      <div className="card p-5">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="flex-1">
            <label className="label">Bank Account</label>
            <select
              className="input-field"
              value={accountId}
              onChange={e => setAccountId(Number(e.target.value))}
            >
              <option value={0}>Select account…</option>
              {bankAccounts.map((a: any) => (
                <option key={a.id} value={a.id}>{a.account_name} — {a.bank_name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-1 text-xs text-gray-400">
            {BANK_BADGES.map(b => (
              <span key={b} className="px-2 py-0.5 bg-gray-100 rounded font-medium">{b}</span>
            ))}
          </div>
        </div>

        <div
          ref={dropRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
            ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}
            ${uploadMutation.isPending ? 'pointer-events-none opacity-60' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Upload className="w-10 h-10 mx-auto mb-3 text-gray-400" />
          {uploadMutation.isPending ? (
            <p className="text-blue-600 font-medium">Parsing & matching…</p>
          ) : (
            <>
              <p className="text-gray-700 font-medium">Drop your bank statement CSV or Excel here</p>
              <p className="text-gray-400 text-sm mt-1">or click to browse</p>
            </>
          )}
        </div>
      </div>

      {/* ── Past sessions ── */}
      {sessions.length > 0 && (
        <div className="card overflow-x-auto">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Past sessions</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="table-cell">Date</th>
                <th className="table-cell">File</th>
                <th className="table-cell">Bank</th>
                <th className="table-cell">Transactions</th>
                <th className="table-cell">Status</th>
                <th className="table-cell">Action</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s: ReconSession) => (
                <tr key={s.id} className={`border-b hover:bg-gray-50 ${activeSessionId === s.id ? 'bg-blue-50' : ''}`}>
                  <td className="table-cell text-xs">{s.created_at ? new Date(s.created_at).toLocaleDateString('en-IN') : '—'}</td>
                  <td className="table-cell text-xs truncate max-w-[180px]">{s.source_file_name}</td>
                  <td className="table-cell text-xs">{s.bank_name ?? 'Generic'}</td>
                  <td className="table-cell text-xs">{s.total_transactions} ({s.confirmed_count} done)</td>
                  <td className="table-cell">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="table-cell">
                    <button
                      onClick={() => setActiveSessionId(s.id)}
                      className="text-blue-600 text-xs hover:underline"
                    >
                      {s.status === 'completed' ? 'View' : 'Resume'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Active session review ── */}
      {activeSessionId && sessionInfo && (
        <>
          {/* Summary bar */}
          <div className="card p-4">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div className="flex flex-wrap gap-3">
                <SummaryPill
                  label="HIGH confidence"
                  count={highPending}
                  color="green"
                  action={highPending > 0 ? () => confirmAllHighMutation.mutate() : undefined}
                  actionLabel={`Confirm all ${highPending}`}
                  loading={confirmAllHighMutation.isPending}
                />
                <SummaryPill label="MEDIUM" count={mediumPending} color="amber" />
                <SummaryPill label="Unmatched" count={unmatched} color="gray" />
                <SummaryPill label="Confirmed" count={confirmedTotal} color="blue" />
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-semibold">{confirmedTotal}</span>
                <span className="text-gray-400"> / {totalRelevant} reconciled</span>
                {totalRelevant > 0 && (
                  <div className="mt-1 h-1.5 w-32 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${Math.round((confirmedTotal / totalRelevant) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 flex-wrap">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Keyboard shortcut hint for confirm-all */}
          {highPending > 0 && activeTab !== 'confirmed' && activeTab !== 'skipped' && (
            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
              <span className="text-green-800">
                <CheckCircle className="w-4 h-4 inline mr-1" />
                <strong>{highPending}</strong> HIGH confidence matches ready
              </span>
              <button
                onClick={() => confirmAllHighMutation.mutate()}
                disabled={confirmAllHighMutation.isPending}
                className="px-4 py-1.5 bg-green-600 text-white rounded-md text-xs font-medium hover:bg-green-700 disabled:opacity-60"
              >
                {confirmAllHighMutation.isPending ? 'Confirming…' : `Confirm all ${highPending}`}
              </button>
            </div>
          )}

          {/* Table */}
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {['Date', 'Bank narration', 'Amount', 'Matched to', 'Confidence', 'Action'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessionDetailQ.isLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-400 text-sm">Loading…</td>
                  </tr>
                ) : filteredLines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-400 text-sm">
                      No transactions in this filter
                    </td>
                  </tr>
                ) : (
                  filteredLines.map(line => (
                    <ReconciliationRow
                      key={line.id}
                      line={line}
                      onConfirm={handleConfirm}
                      onSkip={handleSkip}
                      onCreateExpense={handleCreateExpense}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* All confirmed banner */}
          {sessionInfo.status === 'completed' && (
            <div className="card p-6 text-center bg-green-50 border border-green-200">
              <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <p className="text-green-800 font-semibold text-lg">All {sessionInfo.total_transactions} transactions reconciled</p>
              <div className="flex justify-center gap-3 mt-4">
                <button className="btn-secondary text-sm">Export report</button>
              </div>
            </div>
          )}
        </>
      )}

      {!activeSessionId && !uploadMutation.isPending && sessions.length === 0 && (
        <div className="card p-16 text-center text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg">Upload a bank statement to get started</p>
          <p className="text-sm mt-1">Select a bank account above, then drop your CSV</p>
        </div>
      )}
    </div>
  );
}

// ─── SummaryPill helper ───────────────────────────────────────────────────────

function SummaryPill({
  label,
  count,
  color,
  action,
  actionLabel,
  loading,
}: {
  label: string;
  count: number;
  color: 'green' | 'amber' | 'gray' | 'blue';
  action?: () => void;
  actionLabel?: string;
  loading?: boolean;
}) {
  const colorMap = {
    green: 'bg-green-100 text-green-800',
    amber: 'bg-amber-100 text-amber-800',
    gray: 'bg-gray-100 text-gray-600',
    blue: 'bg-blue-100 text-blue-800',
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${colorMap[color]} text-sm`}>
      <span className="font-semibold">{count}</span>
      <span>{label}</span>
      {action && count > 0 && (
        <button
          onClick={action}
          disabled={loading}
          className="ml-1 px-2 py-0.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-60"
        >
          {loading ? '…' : actionLabel}
        </button>
      )}
    </div>
  );
}

