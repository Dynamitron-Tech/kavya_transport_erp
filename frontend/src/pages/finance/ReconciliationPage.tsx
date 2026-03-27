import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { financeService } from '@/services/dataService';
import { safeArray } from '@/utils/helpers';
import { Upload, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

export default function ReconciliationPage() {
  const qc = useQueryClient();
  const [accountId, setAccountId] = useState<number>(0);
  const [activeStatementId, setActiveStatementId] = useState<number | null>(null);
  const [lineFilter, setLineFilter] = useState<string>('');
  const [showImport, setShowImport] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const bankAccounts = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: () => financeService.getBankAccounts(),
  });

  const summary = useQuery({
    queryKey: ['reconciliation-summary', activeStatementId],
    queryFn: () => financeService.getReconciliationSummary(activeStatementId!),
    enabled: !!activeStatementId,
  });

  const lines = useQuery({
    queryKey: ['statement-lines', activeStatementId, lineFilter],
    queryFn: () => financeService.listStatementLines(activeStatementId!, { status: lineFilter || undefined } as any),
    enabled: !!activeStatementId,
  });

  const importMutation = useMutation({
    mutationFn: () => financeService.importBankStatement(accountId, file!),
    onSuccess: (data: any) => {
      toast.success(`Statement imported: ${data.line_count} transactions`);
      setActiveStatementId(data.id);
      setShowImport(false);
      setFile(null);
    },
    onError: () => toast.error('Import failed'),
  });

  const reconcileMutation = useMutation({
    mutationFn: () => financeService.autoReconcile(activeStatementId!),
    onSuccess: () => {
      toast.success('Auto-reconciliation complete');
      qc.invalidateQueries({ queryKey: ['reconciliation-summary'] });
      qc.invalidateQueries({ queryKey: ['statement-lines'] });
    },
    onError: () => toast.error('Reconciliation failed'),
  });

  const matchMutation = useMutation({
    mutationFn: (lineId: number) => financeService.manualMatchLine(lineId, {}),
    onSuccess: () => {
      toast.success('Line matched');
      qc.invalidateQueries({ queryKey: ['statement-lines'] });
      qc.invalidateQueries({ queryKey: ['reconciliation-summary'] });
    },
  });

  const ignoreMutation = useMutation({
    mutationFn: (lineId: number) => financeService.ignoreStatementLine(lineId),
    onSuccess: () => {
      toast.success('Line ignored');
      qc.invalidateQueries({ queryKey: ['statement-lines'] });
      qc.invalidateQueries({ queryKey: ['reconciliation-summary'] });
    },
  });

  const accounts = safeArray(bankAccounts.data);
  const lineItems = safeArray((lines.data as any)?.data ?? lines.data);
  const summaryData = (summary.data as any) || {};

  const statusColor: Record<string, string> = {
    MATCHED: 'bg-green-100 text-green-800',
    UNMATCHED: 'bg-yellow-100 text-yellow-800',
    EXCEPTION: 'bg-red-100 text-red-800',
    IGNORED: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Bank Reconciliation</h1>
          <p className="page-subtitle">Import statements, auto-match, and reconcile transactions</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setShowImport(true)}>
            <Upload className="w-4 h-4 mr-1" /> Import CSV
          </button>
          {activeStatementId && (
            <button
              className="btn-primary"
              onClick={() => reconcileMutation.mutate()}
              disabled={reconcileMutation.isPending}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${reconcileMutation.isPending ? 'animate-spin' : ''}`} />
              Auto-Reconcile
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {activeStatementId && summaryData.total_lines != null && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total', value: summaryData.total_lines, color: 'text-blue-600' },
            { label: 'Matched', value: summaryData.matched, color: 'text-green-600' },
            { label: 'Unmatched', value: summaryData.unmatched, color: 'text-yellow-600' },
            { label: 'Exceptions', value: summaryData.exception, color: 'text-red-600' },
            { label: 'Ignored', value: summaryData.ignored, color: 'text-gray-500' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card p-4 text-center">
              <p className="text-sm text-gray-500">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value ?? 0}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter bar */}
      {activeStatementId && (
        <div className="flex gap-2">
          {['', 'MATCHED', 'UNMATCHED', 'EXCEPTION', 'IGNORED'].map((s) => (
            <button
              key={s}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                lineFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => setLineFilter(s)}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      )}

      {/* Statement Lines Table */}
      {activeStatementId ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="table-cell">Date</th>
                <th className="table-cell">Description</th>
                <th className="table-cell">Reference</th>
                <th className="table-cell text-right">Debit</th>
                <th className="table-cell text-right">Credit</th>
                <th className="table-cell">Status</th>
                <th className="table-cell">Confidence</th>
                <th className="table-cell">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((line: any) => (
                <tr key={line.id} className="border-b hover:bg-gray-50">
                  <td className="table-cell">{line.transaction_date}</td>
                  <td className="table-cell max-w-xs truncate">{line.description}</td>
                  <td className="table-cell">{line.reference_number || '-'}</td>
                  <td className="table-cell text-right text-red-600">
                    {line.debit_amount > 0 ? `₹${Number(line.debit_amount).toLocaleString('en-IN')}` : '-'}
                  </td>
                  <td className="table-cell text-right text-green-600">
                    {line.credit_amount > 0 ? `₹${Number(line.credit_amount).toLocaleString('en-IN')}` : '-'}
                  </td>
                  <td className="table-cell">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[line.reconciliation_status] || 'bg-gray-100'}`}>
                      {line.reconciliation_status}
                    </span>
                  </td>
                  <td className="table-cell">
                    {line.match_confidence ? `${(line.match_confidence * 100).toFixed(0)}%` : '-'}
                  </td>
                  <td className="table-cell">
                    {line.reconciliation_status === 'UNMATCHED' || line.reconciliation_status === 'EXCEPTION' ? (
                      <div className="flex gap-1">
                        <button
                          className="btn-icon text-green-600"
                          title="Manual Match"
                          onClick={() => matchMutation.mutate(line.id)}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          className="btn-icon text-gray-400"
                          title="Ignore"
                          onClick={() => ignoreMutation.mutate(line.id)}
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
              {lineItems.length === 0 && (
                <tr>
                  <td colSpan={8} className="table-cell text-center text-gray-400 py-8">
                    No statement lines found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card p-12 text-center text-gray-400">
          <Upload className="w-12 h-12 mx-auto mb-4" />
          <p className="text-lg">Import a bank statement CSV to get started</p>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Import Bank Statement</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Bank Account</label>
                <select className="input-field" value={accountId} onChange={(e) => setAccountId(Number(e.target.value))}>
                  <option value={0}>Select account</option>
                  {accounts.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.account_name} — {a.bank_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">CSV File</label>
                <input
                  type="file"
                  accept=".csv"
                  className="input-field"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn-secondary" onClick={() => setShowImport(false)}>Cancel</button>
              <button
                className="btn-primary"
                disabled={!accountId || !file || importMutation.isPending}
                onClick={() => importMutation.mutate()}
              >
                {importMutation.isPending ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
