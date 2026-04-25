import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { financeService } from '@/services/dataService';
import { BarChart3, TrendingUp, Calendar, FileText } from 'lucide-react';

type ReportTab = 'daily' | 'weekly' | 'monthly' | 'gstr1';

export default function FinanceReportsPage() {
  const [tab, setTab] = useState<ReportTab>('daily');
  const [reportDate, setReportDate] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const dailyDigest = useQuery({
    queryKey: ['daily-digest', reportDate],
    queryFn: () => financeService.getDailyDigest(reportDate || undefined),
    enabled: tab === 'daily',
  });

  const weeklyPL = useQuery({
    queryKey: ['weekly-pl'],
    queryFn: () => financeService.getWeeklyPL(),
    enabled: tab === 'weekly',
  });

  const monthlyClose = useQuery({
    queryKey: ['monthly-close', year, month],
    queryFn: () => financeService.getMonthlyClose(year, month),
    enabled: tab === 'monthly',
  });

  const gstr1 = useQuery({
    queryKey: ['gstr1-report', year, month],
    queryFn: () => financeService.getGSTR1Report(year, month),
    enabled: tab === 'gstr1',
  });

  const tabs: { key: ReportTab; label: string; icon: React.ReactNode }[] = [
    { key: 'daily', label: 'Daily Digest', icon: <Calendar className="w-4 h-4" /> },
    { key: 'weekly', label: 'Weekly P&L', icon: <TrendingUp className="w-4 h-4" /> },
    { key: 'monthly', label: 'Monthly Close', icon: <BarChart3 className="w-4 h-4" /> },
    { key: 'gstr1', label: 'GSTR-1', icon: <FileText className="w-4 h-4" /> },
  ];

  const fmt = (v: any) => v != null ? `₹${Number(v).toLocaleString('en-IN')}` : '-';

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Finance Reports</h1>
          <p className="page-subtitle">Daily digest, P&L, monthly close, and GST reports</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition ${
              tab === t.key ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setTab(t.key)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Year/Month selector for monthly/gstr1 */}
      {(tab === 'monthly' || tab === 'gstr1') && (
        <div className="flex gap-3 items-center">
          <select className="input-field w-28" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[2023, 2024, 2025].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="input-field w-36" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m,i) => (
              <option key={i} value={i+1}>{m}</option>
            ))}
          </select>
        </div>
      )}

      {/* Date selector for daily */}
      {tab === 'daily' && (
        <div className="flex gap-3 items-center">
          <input type="date" className="input-field w-44" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
        </div>
      )}

      {/* Daily Digest */}
      {tab === 'daily' && (
        <div className="space-y-4">
          {dailyDigest.isLoading ? (
            <p className="text-gray-400">Loading...</p>
          ) : dailyDigest.data ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Invoices Raised', value: fmt((dailyDigest.data as any).invoices_raised_amount), sub: `${(dailyDigest.data as any).invoices_raised_count ?? 0} invoices` },
                  { label: 'Collections', value: fmt((dailyDigest.data as any).collections_amount), sub: `${(dailyDigest.data as any).collections_count ?? 0} payments` },
                  { label: 'Payments Made', value: fmt((dailyDigest.data as any).payments_made_amount), sub: `${(dailyDigest.data as any).payments_made_count ?? 0} payments` },
                  { label: 'Net Cash Flow', value: fmt((dailyDigest.data as any).net_cash_flow), sub: '' },
                ].map(({ label, value, sub }) => (
                  <div key={label} className="card p-4">
                    <p className="text-sm text-gray-500">{label}</p>
                    <p className="text-xl font-bold mt-1">{value}</p>
                    {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="card p-4">
                  <p className="text-sm text-gray-500">Outstanding</p>
                  <p className="text-xl font-bold text-amber-600">{fmt((dailyDigest.data as any).outstanding_receivable)}</p>
                </div>
                <div className="card p-4">
                  <p className="text-sm text-gray-500">Overdue Invoices</p>
                  <p className="text-xl font-bold text-red-600">{(dailyDigest.data as any).overdue_count ?? 0}</p>
                </div>
                <div className="card p-4">
                  <p className="text-sm text-gray-500">Total Bank Balance</p>
                  <p className="text-xl font-bold text-green-600">{fmt((dailyDigest.data as any).bank_balance_total)}</p>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Weekly P&L */}
      {tab === 'weekly' && (
        <div className="space-y-4">
          {weeklyPL.isLoading ? (
            <p className="text-gray-400">Loading...</p>
          ) : weeklyPL.data ? (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="card p-4 text-center">
                  <p className="text-sm text-gray-500">Revenue</p>
                  <p className="text-2xl font-bold text-green-600">{fmt((weeklyPL.data as any).revenue)}</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-sm text-gray-500">Expenses</p>
                  <p className="text-2xl font-bold text-red-600">{fmt((weeklyPL.data as any).expenses)}</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-sm text-gray-500">Net Profit</p>
                  <p className={`text-2xl font-bold ${(weeklyPL.data as any).net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {fmt((weeklyPL.data as any).net_profit)}
                  </p>
                </div>
              </div>
              {(weeklyPL.data as any).expense_breakdown && (
                <div className="card p-4">
                  <h3 className="text-sm font-semibold mb-3">Expense Breakdown</h3>
                  <div className="space-y-2">
                    {Object.entries((weeklyPL.data as any).expense_breakdown).map(([key, val]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="capitalize text-gray-600">{key.replace(/_/g, ' ')}</span>
                        <span className="font-medium">{fmt(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* Monthly Close */}
      {tab === 'monthly' && (
        <div className="space-y-4">
          {monthlyClose.isLoading ? (
            <p className="text-gray-400">Loading...</p>
          ) : monthlyClose.data ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: 'Total Invoiced', value: fmt((monthlyClose.data as any).total_invoiced) },
                { label: 'Collected', value: fmt((monthlyClose.data as any).total_collected) },
                { label: 'Paid Out', value: fmt((monthlyClose.data as any).total_paid) },
                { label: 'Outstanding', value: fmt((monthlyClose.data as any).outstanding) },
                { label: 'Net Profit', value: fmt((monthlyClose.data as any).net_profit) },
                { label: 'Collection Rate', value: `${((monthlyClose.data as any).collection_rate ?? 0).toFixed(1)}%` },
              ].map(({ label, value }) => (
                <div key={label} className="card p-4 text-center">
                  <p className="text-sm text-gray-500">{label}</p>
                  <p className="text-xl font-bold">{value}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* GSTR-1 */}
      {tab === 'gstr1' && (
        <div className="space-y-4">
          {gstr1.isLoading ? (
            <p className="text-gray-400">Loading...</p>
          ) : gstr1.data ? (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="card p-4 text-center">
                  <p className="text-sm text-gray-500">Total Invoices</p>
                  <p className="text-xl font-bold">{(gstr1.data as any).total_invoices ?? 0}</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-sm text-gray-500">Taxable Value</p>
                  <p className="text-xl font-bold">{fmt((gstr1.data as any).total_taxable_value)}</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-sm text-gray-500">Total Tax</p>
                  <p className="text-xl font-bold">{fmt((gstr1.data as any).total_tax)}</p>
                </div>
              </div>
              {(gstr1.data as any).b2b_invoices && (
                <div className="card overflow-x-auto">
                  <h3 className="text-sm font-semibold p-4 pb-2">B2B Invoices</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="table-header">
                        <th className="table-cell">Invoice #</th>
                        <th className="table-cell">Client GSTIN</th>
                        <th className="table-cell text-right">Taxable</th>
                        <th className="table-cell text-right">CGST</th>
                        <th className="table-cell text-right">SGST</th>
                        <th className="table-cell text-right">IGST</th>
                        <th className="table-cell text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {((gstr1.data as any).b2b_invoices || []).slice(0, 50).map((inv: any) => (
                        <tr key={inv.invoice_number} className="border-b">
                          <td className="table-cell">{inv.invoice_number}</td>
                          <td className="table-cell">{inv.client_gstin || '-'}</td>
                          <td className="table-cell text-right">{fmt(inv.taxable_value)}</td>
                          <td className="table-cell text-right">{fmt(inv.cgst)}</td>
                          <td className="table-cell text-right">{fmt(inv.sgst)}</td>
                          <td className="table-cell text-right">{fmt(inv.igst)}</td>
                          <td className="table-cell text-right font-medium">{fmt(inv.total_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
