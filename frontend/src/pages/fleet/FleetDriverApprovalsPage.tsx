/**
 * FleetDriverApprovalsPage — Fleet Manager view of driver leave & advance approval requests
 * Mirrors the app's FleetDriverApprovalsScreen (two tabs: Leave, Advance)
 * APIs:
 *   Leave:   GET  /driver-requests/leaves/pending        → data: [...]
 *            POST /driver-requests/leaves/{id}/review    → { action, note? }
 *   Advance: GET  /driver-requests/advance-requests/fleet → data: [...]
 *            POST /driver-requests/advance-requests/{id}/acknowledge
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Wallet, Calendar, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import api from '@/services/api';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(s?: string) {
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

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['fleet-pending-leaves'],
    queryFn: async () => {
      const res = await api.get('/driver-requests/leaves/pending');
      return ((res as any)?.data ?? []) as any[];
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, action, note }: { id: number; action: string; note?: string }) => {
      return api.post(`/driver-requests/leaves/${id}/review`, { action, ...(note ? { note } : {}) });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fleet-pending-leaves'] }),
  });

  if (isLoading) return <LoadingSkeleton />;
  if (isError) return <ErrorState onRetry={() => refetch()} message="Failed to load leave requests" />;

  const leaves: any[] = data ?? [];

  if (leaves.length === 0) {
    return <EmptyState icon={<Calendar size={48} />} message="No pending leave requests" />;
  }

  return (
    <div className="space-y-4">
      {leaves.map((leave) => (
        <LeaveCard key={leave.id} leave={leave} reviewMutation={reviewMutation} />
      ))}
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
            {fmtDate(leave.start_date)} → {fmtDate(leave.end_date)}
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

  if (pending.length === 0) {
    return <EmptyState icon={<Wallet size={48} />} message="No pending advance requests" />;
  }

  return (
    <div className="space-y-4">
      {pending.map((adv) => (
        <AdvanceCard key={adv.id} adv={adv} ackMutation={ackMutation} />
      ))}
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
