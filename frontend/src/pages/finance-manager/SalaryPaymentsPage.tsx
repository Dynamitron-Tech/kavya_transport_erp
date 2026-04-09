import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { financeManagerService, SalaryStaffItem } from '@/services/financeManagerService';
import {
  Users, IndianRupee, CheckCircle2, Clock, AlertCircle,
  Banknote, XCircle, ChevronLeft, Download,
} from 'lucide-react';

const fmt = (paise: number) => `₹${((paise || 0) / 100).toLocaleString('en-IN')}`;

type Tab = 'staff' | 'history';

export default function SalaryPaymentsPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [activeTab, setActiveTab] = useState<Tab>('staff');
  const [confirmItem, setConfirmItem] = useState<SalaryStaffItem | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const { data: summary, isLoading } = useQuery({
    queryKey: ['salary-summary', month],
    queryFn: () => financeManagerService.getSalarySummary(month),
  });

  const { data: payouts } = useQuery({
    queryKey: ['payouts-salary'],
    queryFn: () => financeManagerService.getPayouts('salary'),
    enabled: activeTab === 'history',
  });

  const payMutation = useMutation({
    mutationFn: (item: SalaryStaffItem) =>
      financeManagerService.paySalary(item.employee_id, month, item.salary_paise),
    onSuccess: () => {
      toast.success('Salary payment initiated');
      qc.invalidateQueries({ queryKey: ['salary-summary'] });
      setConfirmItem(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Payment failed'),
  });

  const bulkPayMutation = useMutation({
    mutationFn: () => {
      const items = (summary?.staff || []).filter(s => selected.has(s.employee_id) && s.status === 'unpaid');
      return financeManagerService.paySalaryBulk(
        items.map(i => ({ employee_id: i.employee_id, amount_paise: i.salary_paise })),
        month,
      );
    },
    onSuccess: () => {
      toast.success('Bulk salary payments initiated');
      qc.invalidateQueries({ queryKey: ['salary-summary'] });
      setSelected(new Set());
    },
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case 'processed': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle2 size={12} /> Paid</span>;
      case 'processing': case 'queued': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700"><Clock size={12} /> Processing</span>;
      case 'failed': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><XCircle size={12} /> Failed</span>;
      default: return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"><AlertCircle size={12} /> Unpaid</span>;
    }
  };

  const staff = summary?.staff || [];
  const toggleSelect = (id: number) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const selectAll = () => {
    const unpaid = staff.filter(s => s.status === 'unpaid').map(s => s.employee_id);
    setSelected(selected.size === unpaid.length ? new Set() : new Set(unpaid));
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><Banknote size={24} /> Salary Payments</h1>
          <p className="page-subtitle">
            {summary
              ? `${staff.length} employees · ${fmt(summary.total_due_paise)} total due · ${summary.paid_count} paid`
              : 'Loading...'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      {/* Progress */}
      {summary && (
        <div className="bg-white rounded-lg border p-4 flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <div className="flex-1 bg-gray-100 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all"
                  style={{ width: `${staff.length ? (summary.paid_count / staff.length) * 100 : 0}%` }}
                />
              </div>
              <span className="text-sm text-gray-600">{summary.paid_count}/{staff.length}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span className="text-green-600">{fmt(summary.paid_paise)} paid</span>
              <span className="text-amber-600">{fmt(summary.remaining_paise)} remaining</span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          className={`px-4 py-1.5 text-sm rounded-md transition ${activeTab === 'staff' ? 'bg-white shadow font-medium' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('staff')}
        >
          <Users size={14} className="inline mr-1.5" /> Staff ({staff.length})
        </button>
        <button
          className={`px-4 py-1.5 text-sm rounded-md transition ${activeTab === 'history' ? 'bg-white shadow font-medium' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('history')}
        >
          <Clock size={14} className="inline mr-1.5" /> History
        </button>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && activeTab === 'staff' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm text-blue-700 font-medium">
            {selected.size} selected — {fmt(staff.filter(s => selected.has(s.employee_id)).reduce((a, s) => a + s.salary_paise, 0))} total
          </span>
          <button
            onClick={() => bulkPayMutation.mutate()}
            disabled={bulkPayMutation.isPending}
            className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {bulkPayMutation.isPending ? 'Processing...' : `Pay ${selected.size} Selected`}
          </button>
        </div>
      )}

      {/* Staff Table */}
      {activeTab === 'staff' && (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="py-3 px-4 text-left">
                  <input
                    type="checkbox"
                    checked={selected.size > 0 && selected.size === staff.filter(s => s.status === 'unpaid').length}
                    onChange={selectAll}
                    className="rounded"
                  />
                </th>
                <th className="py-3 px-4 text-left font-medium text-gray-600">Name</th>
                <th className="py-3 px-4 text-left font-medium text-gray-600">Designation</th>
                <th className="py-3 px-4 text-left font-medium text-gray-600">Bank</th>
                <th className="py-3 px-4 text-right font-medium text-gray-600">Amount</th>
                <th className="py-3 px-4 text-center font-medium text-gray-600">Status</th>
                <th className="py-3 px-4 text-center font-medium text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {staff.map(item => (
                <tr key={item.employee_id} className="hover:bg-gray-50">
                  <td className="py-3 px-4">
                    {item.status === 'unpaid' && (
                      <input
                        type="checkbox"
                        checked={selected.has(item.employee_id)}
                        onChange={() => toggleSelect(item.employee_id)}
                        className="rounded"
                      />
                    )}
                  </td>
                  <td className="py-3 px-4 font-medium text-gray-900">{item.name}</td>
                  <td className="py-3 px-4 text-gray-500">{item.designation}</td>
                  <td className="py-3 px-4 text-gray-500">
                    {item.has_bank_account
                      ? `${item.bank_name || 'Bank'} ****${item.bank_last4}`
                      : <span className="text-red-500 text-xs">No account</span>}
                  </td>
                  <td className="py-3 px-4 text-right font-mono">{fmt(item.salary_paise)}</td>
                  <td className="py-3 px-4 text-center">{statusBadge(item.status)}</td>
                  <td className="py-3 px-4 text-center">
                    {item.status === 'unpaid' && item.has_bank_account && (
                      <button
                        onClick={() => setConfirmItem(item)}
                        className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-xs font-medium"
                      >
                        Pay {fmt(item.salary_paise)}
                      </button>
                    )}
                    {item.status === 'unpaid' && !item.has_bank_account && (
                      <span className="text-xs text-red-500">Add account first</span>
                    )}
                    {item.status === 'processed' && (
                      <span className="text-xs text-green-600">UTR: {item.utr || '—'}</span>
                    )}
                    {(item.status === 'processing' || item.status === 'queued') && (
                      <span className="text-xs text-yellow-600">Processing...</span>
                    )}
                  </td>
                </tr>
              ))}
              {staff.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">No staff found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="py-3 px-4 text-left font-medium text-gray-600">Date</th>
                <th className="py-3 px-4 text-left font-medium text-gray-600">Recipient</th>
                <th className="py-3 px-4 text-right font-medium text-gray-600">Amount</th>
                <th className="py-3 px-4 text-center font-medium text-gray-600">Method</th>
                <th className="py-3 px-4 text-left font-medium text-gray-600">UTR</th>
                <th className="py-3 px-4 text-center font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(payouts || []).map((p: any) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-500">{p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN') : '—'}</td>
                  <td className="py-3 px-4 font-medium">{p.recipient_name || '—'}</td>
                  <td className="py-3 px-4 text-right font-mono">{fmt(p.amount_paise)}</td>
                  <td className="py-3 px-4 text-center uppercase text-xs text-gray-500">{p.payment_method}</td>
                  <td className="py-3 px-4 text-gray-500 text-xs font-mono">{p.utr || '—'}</td>
                  <td className="py-3 px-4 text-center">{statusBadge(p.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setConfirmItem(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3">Confirm Salary Payment</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>Pay <strong className="text-gray-900">{fmt(confirmItem.salary_paise)}</strong> to <strong className="text-gray-900">{confirmItem.name}</strong>?</p>
              <p>Bank: {confirmItem.bank_name} ****{confirmItem.bank_last4}</p>
              <p>Method: IMPS (instant)</p>
              <p className="text-xs text-gray-400">Razorpay fee: ~₹5</p>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setConfirmItem(null)}
                className="flex-1 border rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => payMutation.mutate(confirmItem)}
                disabled={payMutation.isPending}
                className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {payMutation.isPending ? 'Processing...' : 'Confirm & Pay'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
