import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  FileText, Download, FileSpreadsheet, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle2, Clock, BookOpen, CreditCard,
  Receipt, ChevronLeft,
} from 'lucide-react';
import { reportService } from '@/services/dataService';

const CHART_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

const fmtInr = (v: number) =>
  `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const today = new Date();
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  .toISOString()
  .slice(0, 10);
const todayStr = today.toISOString().slice(0, 10);

type LedgerFilter = 'ALL' | 'RECEIVABLE' | 'PAYABLE' | 'INCOME' | 'EXPENSE';

export default function AuditorReportPage() {
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(todayStr);
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>('ALL');
  const [ledgerPage, setLedgerPage] = useState(1);

  const params = { from_date: fromDate, to_date: toDate, ledger_page: ledgerPage };

  const { data: raw, isLoading, isError, refetch } = useQuery({
    queryKey: ['auditor-report', fromDate, toDate, ledgerPage],
    queryFn: () => reportService.auditorReport(params),
    staleTime: 2 * 60 * 1000,
  });

  const report = (raw as any)?.data ?? (raw as any);

  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      const blob = await reportService.exportAuditorReport(format, { from_date: fromDate, to_date: toDate });
      const url = URL.createObjectURL(new Blob([blob as any]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `auditor_report_${fromDate}_${toDate}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // handle silently — toast system can be plugged in here
    }
  };

  const payBreakdown: { name: string; value: number; count: number }[] = useMemo(() => {
    if (!report?.payment_breakdown) return [];
    return report.payment_breakdown.map((r: any) => ({
      name: r.method,
      value: r.amount,
      count: r.count,
    }));
  }, [report]);

  const filteredLedger = useMemo(() => {
    const entries: any[] = report?.ledger?.entries ?? [];
    if (ledgerFilter === 'ALL') return entries;
    return entries.filter((e) => e.ledger_type === ledgerFilter);
  }, [report, ledgerFilter]);

  const pl = report?.pl_summary;
  const gst = report?.gst_summary;
  const os = report?.outstanding_receivables;
  const tds = report?.tds_summary;
  const ledgerMeta = report?.ledger;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="page-header flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <a href="/reports" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
            <ChevronLeft size={16} /> Reports
          </a>
          <div>
            <h1 className="page-title">Auditor Report</h1>
            <p className="page-subtitle">Financial audit — P&L, payments, GST, receivables, TDS &amp; ledger</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="date"
            className="input-field w-40"
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setLedgerPage(1); }}
          />
          <span className="text-gray-400 text-sm">to</span>
          <input
            type="date"
            className="input-field w-40"
            value={toDate}
            onChange={(e) => { setToDate(e.target.value); setLedgerPage(1); }}
          />
          <button
            onClick={() => handleExport('csv')}
            className="btn-secondary flex items-center gap-1.5 text-sm"
          >
            <FileSpreadsheet size={15} /> CSV
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="btn-secondary flex items-center gap-1.5 text-sm"
          >
            <Download size={15} /> PDF
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      )}

      {isError && (
        <div className="card p-6 text-center text-red-500">
          Failed to load report.{' '}
          <button className="underline text-primary-600" onClick={() => refetch()}>Retry</button>
        </div>
      )}

      {report && (
        <>
          {/* ── KPI Strip ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <_KPICard
              label="Total Revenue"
              value={fmtInr(pl?.total_invoiced ?? 0)}
              icon={<TrendingUp size={20} />}
              color="text-emerald-600"
              bg="bg-emerald-50"
            />
            <_KPICard
              label="Net Profit"
              value={fmtInr(pl?.net_profit ?? 0)}
              icon={pl?.net_profit >= 0 ? <CheckCircle2 size={20} /> : <TrendingDown size={20} />}
              color={pl?.net_profit >= 0 ? 'text-emerald-600' : 'text-red-600'}
              bg={pl?.net_profit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}
            />
            <_KPICard
              label="Total Outstanding"
              value={fmtInr(os?.total_outstanding ?? 0)}
              icon={<Clock size={20} />}
              color="text-amber-600"
              bg="bg-amber-50"
            />
            <_KPICard
              label="GST Payable"
              value={fmtInr(gst?.net_gst_payable ?? 0)}
              icon={<Receipt size={20} />}
              color="text-blue-600"
              bg="bg-blue-50"
            />
          </div>

          {/* ── Row 1: P&L + Payment Chart ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* P&L Summary */}
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 text-base mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-indigo-600" /> P&amp;L Summary
              </h2>
              <table className="w-full text-sm">
                <tbody>
                  {[
                    { label: 'Total Invoiced', value: pl?.total_invoiced, color: 'text-gray-700' },
                    { label: 'Total Collected', value: pl?.total_collected, color: 'text-emerald-600' },
                    { label: 'Total Expenses', value: pl?.total_expenses, color: 'text-red-500' },
                  ].map((r) => (
                    <tr key={r.label} className="border-b border-gray-100">
                      <td className="py-2.5 text-gray-500">{r.label}</td>
                      <td className={`py-2.5 text-right font-medium ${r.color}`}>{fmtInr(r.value ?? 0)}</td>
                    </tr>
                  ))}
                  <tr className="bg-indigo-50">
                    <td className="py-3 font-semibold text-indigo-700">Net Profit / (Loss)</td>
                    <td className={`py-3 text-right font-bold text-lg ${(pl?.net_profit ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {fmtInr(pl?.net_profit ?? 0)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 text-gray-500">Collection Efficiency</td>
                    <td className="py-2.5 text-right font-medium text-blue-600">
                      {(pl?.collection_efficiency_percent ?? 0).toFixed(1)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Payment Method Breakdown */}
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 text-base mb-4 flex items-center gap-2">
                <CreditCard size={18} className="text-indigo-600" /> Payment Methods
              </h2>
              {payBreakdown.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No payment data</div>
              ) : (
                <div className="flex gap-4">
                  <ResponsiveContainer width="50%" height={180}>
                    <PieChart>
                      <Pie
                        data={payBreakdown}
                        dataKey="value"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={3}
                      >
                        {payBreakdown.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => fmtInr(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5 text-sm overflow-y-auto max-h-44">
                    {payBreakdown.map((item, i) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                          />
                          <span className="text-gray-600">{item.name}</span>
                        </span>
                        <span className="font-medium text-gray-800">{fmtInr(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Row 2: GST + Outstanding + TDS ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* GST Summary */}
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 text-base mb-4 flex items-center gap-2">
                <FileText size={18} className="text-indigo-600" /> GST Summary
              </h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="table-header text-left py-2 px-2">Component</th>
                    <th className="table-header text-right py-2 px-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Taxable Value', value: gst?.taxable_value },
                    { label: 'CGST Collected', value: gst?.cgst_amount },
                    { label: 'SGST Collected', value: gst?.sgst_amount },
                    { label: 'IGST Collected', value: gst?.igst_amount },
                  ].map((r) => (
                    <tr key={r.label} className="border-b border-gray-100">
                      <td className="table-cell text-gray-500 py-2">{r.label}</td>
                      <td className="table-cell text-right font-medium py-2">{fmtInr(r.value ?? 0)}</td>
                    </tr>
                  ))}
                  <tr className="bg-amber-50">
                    <td className="py-2.5 px-2 font-semibold text-amber-700">Net GST Payable</td>
                    <td className="py-2.5 px-2 text-right font-bold text-amber-700">
                      {fmtInr(gst?.net_gst_payable ?? 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Outstanding Receivables */}
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 text-base mb-4 flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-500" /> Outstanding
              </h2>
              <div className="space-y-3">
                {[
                  { label: 'Overdue', amount: os?.overdue_amount, count: os?.overdue_count, color: 'bg-red-50 border-red-200', txt: 'text-red-700' },
                  { label: 'Partially Paid', amount: os?.partially_paid_amount, count: os?.partially_paid_count, color: 'bg-amber-50 border-amber-200', txt: 'text-amber-700' },
                  { label: 'Disputed', amount: os?.disputed_amount, count: os?.disputed_count, color: 'bg-purple-50 border-purple-200', txt: 'text-purple-700' },
                ].map((r) => (
                  <div key={r.label} className={`rounded-lg border p-3 ${r.color}`}>
                    <div className="flex justify-between items-center">
                      <span className={`text-xs font-semibold uppercase tracking-wide ${r.txt}`}>{r.label}</span>
                      <span className={`text-xs font-medium ${r.txt}`}>{r.count ?? 0} invoices</span>
                    </div>
                    <div className={`text-lg font-bold mt-1 ${r.txt}`}>{fmtInr(r.amount ?? 0)}</div>
                  </div>
                ))}
                <div className="border-t pt-2 flex justify-between text-sm">
                  <span className="text-gray-500 font-medium">Total Outstanding</span>
                  <span className="font-bold text-gray-800">{fmtInr(os?.total_outstanding ?? 0)}</span>
                </div>
              </div>
            </div>

            {/* TDS Summary */}
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 text-base mb-4 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-indigo-600" /> TDS Summary
              </h2>
              <div className="space-y-4 mt-2">
                <div className="bg-indigo-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-indigo-500 uppercase tracking-widest mb-1">Total TDS Deducted</p>
                  <p className="text-2xl font-bold text-indigo-700">{fmtInr(tds?.total_tds_deducted ?? 0)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Payments with TDS</p>
                  <p className="text-2xl font-bold text-gray-700">{tds?.payment_count ?? 0}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Ledger Entries ── */}
          <div className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="font-semibold text-gray-900 text-base flex items-center gap-2">
                <BookOpen size={18} className="text-indigo-600" /> Ledger Entries
                <span className="text-xs text-gray-400 font-normal ml-1">
                  ({ledgerMeta?.total ?? 0} total)
                </span>
              </h2>
              {/* Filter chips */}
              <div className="flex gap-1.5 flex-wrap">
                {(['ALL', 'RECEIVABLE', 'PAYABLE', 'INCOME', 'EXPENSE'] as LedgerFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setLedgerFilter(f)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                      ledgerFilter === f
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    {['Date', 'Entry No.', 'Type', 'Account', 'Narration', 'Ref.', 'Debit', 'Credit', 'Balance'].map((h) => (
                      <th key={h} className="table-header py-2.5 px-3 text-left first:rounded-tl-lg last:rounded-tr-lg">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLedger.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-gray-400">No ledger entries for this period</td>
                    </tr>
                  ) : filteredLedger.map((row: any) => (
                    <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                      <td className="table-cell py-2 px-3 text-gray-500 whitespace-nowrap">{row.entry_date}</td>
                      <td className="table-cell py-2 px-3 font-mono text-xs text-gray-700">{row.entry_number}</td>
                      <td className="table-cell py-2 px-3">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                          row.ledger_type === 'INCOME' ? 'bg-green-100 text-green-700' :
                          row.ledger_type === 'EXPENSE' ? 'bg-red-100 text-red-700' :
                          row.ledger_type === 'RECEIVABLE' ? 'bg-blue-100 text-blue-700' :
                          row.ledger_type === 'PAYABLE' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{row.ledger_type}</span>
                      </td>
                      <td className="table-cell py-2 px-3 max-w-[160px] truncate text-gray-700">{row.account_name}</td>
                      <td className="table-cell py-2 px-3 max-w-[180px] truncate text-gray-500 text-xs">{row.narration || '—'}</td>
                      <td className="table-cell py-2 px-3 text-xs text-gray-400 font-mono">{row.reference_number || '—'}</td>
                      <td className="table-cell py-2 px-3 text-right font-mono text-emerald-700 font-medium">
                        {row.debit > 0 ? fmtInr(row.debit) : '—'}
                      </td>
                      <td className="table-cell py-2 px-3 text-right font-mono text-red-500 font-medium">
                        {row.credit > 0 ? fmtInr(row.credit) : '—'}
                      </td>
                      <td className="table-cell py-2 px-3 text-right font-mono font-bold text-gray-800">
                        {fmtInr(row.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {(ledgerMeta?.total_pages ?? 1) > 1 && (
              <div className="flex items-center justify-between mt-4 text-sm">
                <span className="text-gray-400">
                  Page {ledgerMeta.page} of {ledgerMeta.total_pages}
                  {' '}({ledgerMeta.total} entries)
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={ledgerPage <= 1}
                    onClick={() => setLedgerPage((p) => p - 1)}
                    className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40"
                  >
                    ← Prev
                  </button>
                  <button
                    disabled={ledgerPage >= (ledgerMeta?.total_pages ?? 1)}
                    onClick={() => setLedgerPage((p) => p + 1)}
                    className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Small helper components ──

function _KPICard({ label, value, icon, color, bg }: {
  label: string; value: string; icon: React.ReactNode; color: string; bg: string;
}) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        <p className={`text-lg font-bold ${color}`}>{value}</p>
      </div>
    </div>
  );
}
