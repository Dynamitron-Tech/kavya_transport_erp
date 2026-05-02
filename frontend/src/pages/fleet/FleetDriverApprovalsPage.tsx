/**
 * FleetDriverApprovalsPage — Fleet Manager view of driver leave & advance approval requests
 * Mirrors the app's FleetDriverApprovalsScreen (two tabs: Leave, Advance)
 * APIs:
 *   Leave:   GET  /driver-requests/leaves/pending        → data: [...]
 *            GET  /driver-requests/leaves/reviewed       → data: [...]
 *            POST /driver-requests/leaves/{id}/review    → { action, note? }
 *   Advance: GET  /driver-requests/advance-requests/fleet → data: [...]
 *            POST /driver-requests/advance-requests/{id}/acknowledge
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Wallet, Calendar, CheckCircle, XCircle, Clock, RefreshCw, History } from 'lucide-react';
import api from '@/services/api';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(s?: string) {
  if (!s) return '—';
  try {
    const ts = s.endsWith('Z') || s.includes('+') ? s : s + 'Z';
    return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  }
  catch { return s; }
}

function fmtDay(s?: string) {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return s; }
}

function initials(name: string) {
  return name.trim().split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase() || '?';
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function FleetDriverApprovalsPage() {
  const [tab, setTab] = useState<'leave' | 'advance'>('leave');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Driver Approvals</h1>
        <p className="text-sm text-gray-500 mt-1">Review and action pending leave and advance requests</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('leave')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === 'leave'
              ? 'bg-white text-orange-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Calendar size={15} />
          Leave Requests
        </button>
        <button
          onClick={() => setTab('advance')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === 'advance'
              ? 'bg-white text-orange-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Wallet size={15} />
          Advance Requests
        </button>
      </div>

      {tab === 'leave' ? <LeaveTab /> : <AdvanceTab />}
    </div>
  );
}

// ─── Leave tab ───────────────────────────────────────────────────────────────

function LeaveTab() {
  const queryClient = useQueryClient();
  const [sub, setSub] = useState<'pending' | 'history'>('pending');

  const { data: pendingData, isLoading: pendingLoading, isError: pendingError, refetch: refetchPending } = useQuery({
    queryKey: ['fleet-pending-leaves'],
    queryFn: async () => {
      const res = await api.get('/driver-requests/leaves/pending');
      return ((res as any)?.data ?? []) as any[];
    },
  });

  const { data: historyData, isLoading: historyLoading, isError: historyError, refetch: refetchHistory } = useQuery({
    queryKey: ['fleet-leaves-history'],
    queryFn: async () => {
      const res = await api.get('/driver-requests/leaves/reviewed');
      return ((res as any)?.data ?? []) as any[];
    },
    enabled: sub === 'history',
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, action, note }: { id: number; action: string; note?: string }) => {
      return api.post(`/driver-requests/leaves/${id}/review`, { action, ...(note ? { note } : {}) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet-pending-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['fleet-leaves-history'] });
    },
  });

  const pendingList: any[] = pendingData ?? [];
  const historyList: any[] = historyData ?? [];

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setSub('pending')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${sub === 'pending' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Clock size={14} />
          Pending
          {pendingList.length > 0 && (
            <span className="bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{pendingList.length}</span>
          )}
        </button>
        <button
          onClick={() => setSub('history')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${sub === 'history' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <History size={14} />
          History
        </button>
      </div>

      {/* Pending */}
      {sub === 'pending' && (
        <>
          {pendingLoading ? <LoadingSkeleton /> :
           pendingError ? <ErrorState onRetry={() => refetchPending()} message="Failed to load leave requests" /> :
           pendingList.length === 0 ? <EmptyState icon={<Calendar size={48} />} message="No pending leave requests" /> : (
            <div className="space-y-4">
              {pendingList.map((leave) => (
                <LeaveCard key={leave.id} leave={leave} reviewMutation={reviewMutation} />
              ))}
            </div>
          )}
        </>
      )}

      {/* History */}
      {sub === 'history' && (
        <>
          {historyLoading ? <LoadingSkeleton /> :
           historyError ? <ErrorState onRetry={() => refetchHistory()} message="Failed to load leave history" /> :
           historyList.length === 0 ? <EmptyState icon={<History size={48} />} message="No reviewed leave requests yet" /> : (
            <div className="card overflow-hidden p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Driver</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Leave Period</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Reason</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Review Note</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Reviewed On</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {historyList.map((leave) => (
                    <tr key={leave.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
                            <User size={13} className="text-orange-500" />
                          </div>
                          <span className="font-medium text-gray-900">{leave.driver_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {fmtDay(leave.start_date)} → {fmtDay(leave.end_date)}
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{leave.reason || '—'}</td>
                      <td className="px-4 py-3">
                        {leave.status === 'APPROVED'
                          ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium flex items-center gap-1 w-fit"><CheckCircle size={11} />Approved</span>
                          : <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium flex items-center gap-1 w-fit"><XCircle size={11} />Rejected</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{leave.review_note || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{fmtDate(leave.reviewed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LeaveCard({ leave, reviewMutation }: { leave: any; reviewMutation: any }) {
  const [note, setNote] = useState('');
  const [dialogAction, setDialogAction] = useState<'approve' | 'reject' | null>(null);

  const handleReview = () => {
    if (!dialogAction) return;
    reviewMutation.mutate({ id: leave.id, action: dialogAction, note: note.trim() || undefined });
    setDialogAction(null);
    setNote('');
  };

  const isPending = reviewMutation.isPending;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
          <User size={20} className="text-orange-500" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="font-semibold text-gray-900">{leave.driver_name ?? 'Driver'}</p>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold">
              <Clock size={11} /> Pending
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {fmtDay(leave.start_date)} → {fmtDay(leave.end_date)}
          </p>
          {leave.reason && (
            <div className="mt-3 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700">
              {leave.reason}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-3">
        <button
          onClick={() => setDialogAction('reject')}
          disabled={isPending}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          <XCircle size={16} /> Reject
        </button>
        <button
          onClick={() => setDialogAction('approve')}
          disabled={isPending}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          <CheckCircle size={16} /> Approve
        </button>
      </div>

      {/* Inline confirm dialog */}
      {dialogAction && (
        <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">
            {dialogAction === 'approve'
              ? `Confirm approval for ${leave.driver_name}'s leave?`
              : 'Confirm rejection for this leave request?'}
          </p>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Add a note (optional)"
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setDialogAction(null)}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleReview}
              disabled={isPending}
              className={`px-5 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50 ${
                dialogAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {isPending ? 'Saving…' : dialogAction === 'approve' ? 'Approve' : 'Reject'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Advance tab ──────────────────────────────────────────────────────────────

function AdvanceTab() {
  const queryClient = useQueryClient();
  const [sub, setSub] = useState<'pending' | 'history'>('pending');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['fleet-advance-requests'],
    queryFn: async () => {
      const res = await api.get('/driver-requests/advance-requests/fleet');
      return ((res as any)?.data ?? []) as any[];
    },
  });

  const ackMutation = useMutation({
    mutationFn: async (id: number) => {
      return api.post(`/driver-requests/advance-requests/${id}/acknowledge`, {});
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fleet-advance-requests'] }),
  });

  if (isLoading) return <LoadingSkeleton />;
  if (isError) return <ErrorState onRetry={() => refetch()} message="Failed to load advance requests" />;

  const all: any[] = data ?? [];
  const pending = all.filter(r => r.status === 'PENDING');
  const history = all.filter(r => r.status !== 'PENDING');

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setSub('pending')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${sub === 'pending' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Clock size={14} />
          Pending
          {pending.length > 0 && (
            <span className="bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{pending.length}</span>
          )}
        </button>
        <button
          onClick={() => setSub('history')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${sub === 'history' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <History size={14} />
          History
          {history.length > 0 && (
            <span className="bg-gray-400 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{history.length}</span>
          )}
        </button>
      </div>

      {/* Pending */}
      {sub === 'pending' && (
        pending.length === 0 ? <EmptyState icon={<Wallet size={48} />} message="No pending advance requests" /> : (
          <div className="space-y-4">
            {pending.map((adv) => (
              <AdvanceCard key={adv.id} adv={adv} ackMutation={ackMutation} />
            ))}
          </div>
        )
      )}

      {/* History */}
      {sub === 'history' && (
        history.length === 0 ? <EmptyState icon={<History size={48} />} message="No processed advance requests yet" /> : (
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Driver</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Trip</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Note</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Processed On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {history.map((adv) => (
                  <tr key={adv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 text-xs font-bold text-blue-600">
                          {initials(adv.driver_name ?? 'D')}
                        </div>
                        <span className="font-medium text-gray-900">{adv.driver_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{adv.trip_number || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">₹{Number(adv.amount).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3">
                      {adv.status === 'APPROVED'
                        ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium flex items-center gap-1 w-fit"><CheckCircle size={11} />Processed</span>
                        : <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium flex items-center gap-1 w-fit"><XCircle size={11} />Rejected</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{adv.review_note || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{fmtDate(adv.reviewed_at ?? adv.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

function AdvanceCard({ adv, ackMutation }: { adv: any; ackMutation: any }) {
  const name: string = adv.driver_name ?? 'Driver';
  const amount: number = adv.amount ?? 0;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 text-sm font-bold text-blue-600">
          {initials(name)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="font-semibold text-gray-900">{name}</p>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold">
              <Clock size={11} /> Pending
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Advance request · ₹{amount.toLocaleString('en-IN')}
          </p>
          {adv.trip_number && (
            <div className="mt-2 text-xs text-gray-500">
              Trip: <span className="font-medium text-gray-700">{adv.trip_number}</span>
            </div>
          )}
          {adv.review_note && (
            <div className="mt-2 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700">
              {adv.review_note}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4">
        <button
          onClick={() => ackMutation.mutate(adv.id)}
          disabled={ackMutation.isPending}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          <CheckCircle size={16} />
          {ackMutation.isPending ? 'Processing…' : 'Mark as Processed'}
        </button>
      </div>
    </div>
  );
}

// ─── Shared components ────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white border border-gray-200 rounded-2xl p-5 animate-pulse">
          <div className="flex gap-4">
            <div className="w-11 h-11 rounded-xl bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <div className="flex-1 h-10 bg-gray-200 rounded-xl" />
            <div className="flex-1 h-10 bg-gray-200 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-4">
      {icon}
      <p className="text-base font-medium">{message}</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-4">
      <XCircle size={48} className="text-red-400" />
      <p className="text-base font-medium text-red-500">{message}</p>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium"
      >
        <RefreshCw size={14} /> Retry
      </button>
    </div>
  );
}
