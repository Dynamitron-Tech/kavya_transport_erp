import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { financeManagerService, ExpenseSubmission } from '@/services/financeManagerService';
import {
  Receipt, CheckCircle2, XCircle, Clock, Eye,
  ThumbsUp, ThumbsDown, IndianRupee, Search,
} from 'lucide-react';

const fmt = (paise: number) => `₹${((paise || 0) / 100).toLocaleString('en-IN')}`;
const CATEGORY_LABELS: Record<string, string> = {
  fuel: 'Fuel / Diesel', spare_part: 'Spare Part', loading: 'Loading / Unloading',
  rto_fine: 'RTO Fine', toll: 'Toll', police: 'Police', food: 'Food / Daily Allowance',
  parking: 'Parking', tyre_puncture: 'Tyre Puncture', misc: 'Miscellaneous',
};

export default function ExpenseApprovalsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState<ExpenseSubmission | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: expenses, isLoading } = useQuery({
    queryKey: ['expense-queue', statusFilter],
    queryFn: () => financeManagerService.getExpenseQueue(statusFilter as any),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, reimburse }: { id: number; reimburse: boolean }) =>
      financeManagerService.approveExpense(id, reimburse),
    onSuccess: () => {
      toast.success('Expense approved');
      qc.invalidateQueries({ queryKey: ['expense-queue'] });
      setViewing(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Approval failed'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) =>
      financeManagerService.rejectExpense(id, rejectReason),
    onSuccess: () => {
      toast.success('Expense rejected');
      qc.invalidateQueries({ queryKey: ['expense-queue'] });
      setRejectId(null);
      setRejectReason('');
    },
  });

  const filtered = (expenses || []).filter((e: ExpenseSubmission) =>
    !search || e.driver_name?.toLowerCase().includes(search.toLowerCase()) ||
    e.description?.toLowerCase().includes(search.toLowerCase())
  );

  const statusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle2 size={12} /> Approved</span>;
      case 'rejected': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><XCircle size={12} /> Rejected</span>;
      case 'reimbursed': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><IndianRupee size={12} /> Reimbursed</span>;
      default: return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700"><Clock size={12} /> Pending</span>;
    }
  };

  const isOverThreshold = (e: ExpenseSubmission) => {
    const thresholds: Record<string, number> = { spare_part: 300000, loading: 400000 };
    return thresholds[e.category] && e.amount_paise > thresholds[e.category];
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><Receipt size={24} /> Expense Approvals</h1>
          <p className="page-subtitle">
            Review and approve driver expense submissions (GPay receipts)
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['pending', 'approved', 'rejected', 'all'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-sm rounded-md transition capitalize ${statusFilter === s ? 'bg-white shadow font-medium' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search driver / description..."
            className="border rounded-lg pl-8 pr-3 py-1.5 text-sm w-64"
          />
        </div>
      </div>

      {/* Cards Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading expenses...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Receipt size={40} className="mx-auto mb-3 opacity-50" />
          <p>No {statusFilter !== 'all' ? statusFilter : ''} expenses found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((exp: ExpenseSubmission) => (
            <div key={exp.id} className={`bg-white rounded-lg border p-4 hover:shadow-md transition ${isOverThreshold(exp) ? 'ring-2 ring-amber-300' : ''}`}>
              {/* Threshold Warning */}
              {isOverThreshold(exp) && (
                <div className="bg-amber-50 text-amber-700 text-xs px-2 py-1 rounded mb-3 flex items-center gap-1">
                  ⚠ Above auto-approve threshold — manually review
                </div>
              )}

              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-medium text-gray-900">{exp.driver_name || `Driver #${exp.driver_id}`}</p>
                  <p className="text-xs text-gray-400">{exp.created_at ? new Date(exp.created_at).toLocaleDateString('en-IN') : ''}</p>
                </div>
                {statusBadge(exp.status)}
              </div>

              <div className="space-y-1.5 text-sm mb-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Category</span>
                  <span className="font-medium">{CATEGORY_LABELS[exp.category] || exp.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount</span>
                  <span className="font-semibold text-gray-900">{fmt(exp.amount_paise)}</span>
                </div>
                {exp.trip_id && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Trip</span>
                    <span className="text-gray-700">#{exp.trip_id}</span>
                  </div>
                )}
              </div>

              {exp.description && (
                <p className="text-xs text-gray-500 bg-gray-50 rounded p-2 mb-3 line-clamp-2">{exp.description}</p>
              )}

              {/* Receipt Preview */}
              {exp.receipt_url && (
                <button
                  onClick={() => setViewing(exp)}
                  className="w-full border rounded p-2 flex items-center justify-center gap-2 text-sm text-blue-600 hover:bg-blue-50 mb-3"
                >
                  <Eye size={14} /> View Receipt
                </button>
              )}

              {/* Actions */}
              {exp.status === 'pending' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => approveMutation.mutate({ id: exp.id, reimburse: false })}
                    disabled={approveMutation.isPending}
                    className="flex-1 bg-green-500 text-white rounded-lg py-1.5 text-sm font-medium hover:bg-green-600 flex items-center justify-center gap-1"
                  >
                    <ThumbsUp size={14} /> Approve
                  </button>
                  <button
                    onClick={() => approveMutation.mutate({ id: exp.id, reimburse: true })}
                    disabled={approveMutation.isPending}
                    className="flex-1 bg-blue-500 text-white rounded-lg py-1.5 text-sm font-medium hover:bg-blue-600 flex items-center justify-center gap-1"
                  >
                    <IndianRupee size={14} /> Reimburse
                  </button>
                  <button
                    onClick={() => setRejectId(exp.id)}
                    className="bg-red-50 text-red-600 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-red-100"
                  >
                    <ThumbsDown size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Receipt Viewer Modal */}
      {viewing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setViewing(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold">Receipt — {viewing.driver_name || `Driver #${viewing.driver_id}`}</h3>
              <button onClick={() => setViewing(null)} className="text-gray-400 hover:text-gray-600"><XCircle size={20} /></button>
            </div>
            <div className="p-4">
              {viewing.receipt_url && (
                <img src={viewing.receipt_url} alt="GPay Receipt" className="w-full rounded-lg border" />
              )}
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-semibold">{fmt(viewing.amount_paise)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Category</span><span>{CATEGORY_LABELS[viewing.category] || viewing.category}</span></div>
                {viewing.description && <p className="bg-gray-50 rounded p-2 text-gray-600">{viewing.description}</p>}
              </div>
              {viewing.status === 'pending' && (
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => approveMutation.mutate({ id: viewing.id, reimburse: true })}
                    className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700"
                  >
                    Approve & Reimburse
                  </button>
                  <button
                    onClick={() => { setRejectId(viewing.id); setViewing(null); }}
                    className="flex-1 border border-red-300 text-red-600 rounded-lg py-2 text-sm font-medium hover:bg-red-50"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setRejectId(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3">Reject Expense</h3>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (optional)..."
              className="w-full border rounded-lg p-3 text-sm h-24 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => { setRejectId(null); setRejectReason(''); }} className="flex-1 border rounded-lg py-2 text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={() => rejectMutation.mutate(rejectId)}
                disabled={rejectMutation.isPending}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
