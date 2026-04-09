import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { financeManagerService, PaymentScheduleItem } from '@/services/financeManagerService';
import {
  CalendarClock, Plus, Trash2, IndianRupee, AlertTriangle,
  XCircle, Building2, Shield, FileText,
} from 'lucide-react';

const fmt = (paise: number) => `₹${((paise || 0) / 100).toLocaleString('en-IN')}`;
const TYPE_ICONS: Record<string, any> = {
  rent: Building2, insurance: Shield, tax: FileText,
  permit: FileText, emi: IndianRupee, other: CalendarClock,
};
const TYPE_COLORS: Record<string, string> = {
  rent: 'bg-purple-100 text-purple-700',
  insurance: 'bg-blue-100 text-blue-700',
  tax: 'bg-amber-100 text-amber-700',
  permit: 'bg-teal-100 text-teal-700',
  emi: 'bg-orange-100 text-orange-700',
  other: 'bg-gray-100 text-gray-700',
};

export default function PayablesDashboardPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    payment_type: 'rent', label: '', amount_paise: '', frequency: 'monthly',
    due_day: '1', vendor_name: '', notes: '',
  });

  const { data: schedules, isLoading } = useQuery({
    queryKey: ['payment-schedules'],
    queryFn: () => financeManagerService.getPaymentSchedules(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => financeManagerService.createPaymentSchedule(payload),
    onSuccess: () => {
      toast.success('Schedule created');
      qc.invalidateQueries({ queryKey: ['payment-schedules'] });
      setShowAdd(false);
      setForm({ payment_type: 'rent', label: '', amount_paise: '', frequency: 'monthly', due_day: '1', vendor_name: '', notes: '' });
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail || 'Creation failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => financeManagerService.deletePaymentSchedule(id),
    onSuccess: () => {
      toast.success('Schedule deleted');
      qc.invalidateQueries({ queryKey: ['payment-schedules'] });
    },
  });

  const payMutation = useMutation({
    mutationFn: (sched: PaymentScheduleItem) =>
      financeManagerService.payVendor({ vendor_name: sched.vendor_name || sched.label, amount_paise: sched.amount_paise, purpose: `${sched.payment_type}: ${sched.label}` }),
    onSuccess: () => {
      toast.success('Payment initiated');
      qc.invalidateQueries({ queryKey: ['payment-schedules'] });
    },
  });

  const items = schedules || [];
  const overdue = items.filter((s: PaymentScheduleItem) => s.days_until_due != null && s.days_until_due < 0);
  const urgent = items.filter((s: PaymentScheduleItem) => s.days_until_due != null && s.days_until_due >= 0 && s.days_until_due <= 3);
  const upcoming = items.filter((s: PaymentScheduleItem) => s.days_until_due != null && s.days_until_due > 3);

  const renderCard = (sched: PaymentScheduleItem) => {
    const Icon = TYPE_ICONS[sched.payment_type] || CalendarClock;
    const isOverdue = sched.days_until_due != null && sched.days_until_due < 0;
    const isUrgent = sched.days_until_due != null && sched.days_until_due >= 0 && sched.days_until_due <= 3;

    return (
      <div
        key={sched.id}
        className={`bg-white rounded-lg border p-4 hover:shadow-md transition ${isOverdue ? 'border-red-300 ring-1 ring-red-200' : isUrgent ? 'border-amber-300' : ''}`}
      >
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${TYPE_COLORS[sched.payment_type] || TYPE_COLORS.other}`}>
              <Icon size={16} />
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">{sched.label}</p>
              <p className="text-xs text-gray-400 capitalize">{sched.payment_type} · {sched.frequency}</p>
            </div>
          </div>
          <button
            onClick={() => deleteMutation.mutate(sched.id)}
            className="text-gray-300 hover:text-red-500 transition"
          >
            <Trash2 size={14} />
          </button>
        </div>

        <div className="flex justify-between items-center mb-3">
          <span className="text-lg font-semibold text-gray-900">{fmt(sched.amount_paise)}</span>
          {isOverdue && (
            <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
              <AlertTriangle size={12} /> {Math.abs(sched.days_until_due!)}d overdue
            </span>
          )}
          {isUrgent && !isOverdue && (
            <span className="text-xs text-amber-600 font-medium">
              Due in {sched.days_until_due}d
            </span>
          )}
          {!isOverdue && !isUrgent && sched.days_until_due !== undefined && (
            <span className="text-xs text-gray-400">{sched.days_until_due}d away</span>
          )}
        </div>

        {sched.vendor_name && (
          <p className="text-xs text-gray-500 mb-2">Vendor: {sched.vendor_name}</p>
        )}
        {sched.next_due_date && (
          <p className="text-xs text-gray-400 mb-3">Next: {new Date(sched.next_due_date).toLocaleDateString('en-IN')}</p>
        )}

        {(isOverdue || isUrgent) && (
          <button
            onClick={() => payMutation.mutate(sched)}
            disabled={payMutation.isPending}
            className={`w-full py-1.5 rounded-lg text-sm font-medium ${isOverdue ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-amber-500 text-white hover:bg-amber-600'} disabled:opacity-50`}
          >
            {payMutation.isPending ? 'Processing...' : `Pay ${fmt(sched.amount_paise)}`}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><CalendarClock size={24} /> Payables & Schedules</h1>
          <p className="page-subtitle">Manage recurring payments — rent, insurance, tax, permits, EMI</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus size={16} /> Add Schedule
        </button>
      </div>

      {/* Overdue Alert */}
      {overdue.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-3">
          <AlertTriangle size={18} className="text-red-500 shrink-0" />
          <span className="text-sm text-red-700 font-medium">
            {overdue.length} overdue payment{overdue.length > 1 ? 's' : ''} — {fmt(overdue.reduce((a: number, s: PaymentScheduleItem) => a + s.amount_paise, 0))} total
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading schedules...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CalendarClock size={40} className="mx-auto mb-3 opacity-50" />
          <p>No payment schedules yet — add one above</p>
        </div>
      ) : (
        <>
          {/* Overdue */}
          {overdue.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-red-600 mb-3">Overdue ({overdue.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {overdue.map(renderCard)}
              </div>
            </div>
          )}

          {/* Urgent */}
          {urgent.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-amber-600 mb-3">Due Soon ({urgent.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {urgent.map(renderCard)}
              </div>
            </div>
          )}

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-600 mb-3">Upcoming ({upcoming.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {upcoming.map(renderCard)}
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Schedule Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">New Payment Schedule</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600"><XCircle size={20} /></button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                  <select
                    value={form.payment_type}
                    onChange={e => setForm({ ...form, payment_type: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="rent">Rent</option>
                    <option value="insurance">Insurance</option>
                    <option value="tax">Tax</option>
                    <option value="permit">Permit</option>
                    <option value="emi">EMI</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
                  <select
                    value={form.frequency}
                    onChange={e => setForm({ ...form, frequency: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                    <option value="one_time">One-time</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
                <input
                  value={form.label}
                  onChange={e => setForm({ ...form, label: e.target.value })}
                  placeholder="e.g. Office Rent - Coimbatore"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    value={form.amount_paise}
                    onChange={e => setForm({ ...form, amount_paise: e.target.value })}
                    placeholder="25000"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Due Day</label>
                  <input
                    type="number"
                    value={form.due_day}
                    onChange={e => setForm({ ...form, due_day: e.target.value })}
                    min={1}
                    max={31}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Vendor Name</label>
                <input
                  value={form.vendor_name}
                  onChange={e => setForm({ ...form, vendor_name: e.target.value })}
                  placeholder="Vendor / Landlord name"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm h-16 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAdd(false)} className="flex-1 border rounded-lg py-2 text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate({
                  ...form,
                  amount_paise: Number(form.amount_paise) * 100,
                  due_day: Number(form.due_day),
                })}
                disabled={!form.label || !form.amount_paise || createMutation.isPending}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
