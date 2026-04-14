import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { financeManagerService } from '@/services/financeManagerService';
import { KPICard } from '@/components/common/Modal';
import {
  Users, AlertTriangle, Clock,
  ChevronRight, Building2, Truck, Receipt,
  Calendar, IndianRupee,
} from 'lucide-react';

const fmt = (paise: number) => `₹${((paise ?? 0) / 100).toLocaleString('en-IN')}`;

export default function FinanceManagerDashboardPage() {
  const navigate = useNavigate();

  const { data: summary } = useQuery({
    queryKey: ['fm-dashboard'],
    queryFn: () => financeManagerService.getDashboardSummary(),
    refetchInterval: 30_000,
  });

  const { data: schedules } = useQuery({
    queryKey: ['fm-schedules-upcoming'],
    queryFn: () => financeManagerService.getPaymentSchedules(undefined, 30),
  });

  const urgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'overdue': return 'bg-red-50 border-red-200 text-red-700';
      case 'urgent': return 'bg-amber-50 border-amber-200 text-amber-700';
      default: return 'bg-green-50 border-green-200 text-green-700';
    }
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'insurance': return <Truck size={16} />;
      case 'rent': return <Building2 size={16} />;
      case 'tax': return <Receipt size={16} />;
      default: return <Calendar size={16} />;
    }
  };

  const upcomingItems = (schedules || []).slice(0, 6);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Finance Manager</h1>
          <p className="page-subtitle">{summary?.month || new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })} — Payment control center</p>
        </div>
      </div>

      {/* Razorpay not yet activated notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-start gap-3">
        <IndianRupee size={18} className="text-blue-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-900">Razorpay Payouts — Pending Activation</p>
          <p className="text-xs text-blue-700 mt-0.5">
            Live payouts require a verified company domain email with Razorpay. Until then, use{' '}
            <span className="font-medium">manual bank transfers</span> and mark payments as processed in Payout History.
            Razorpay will be auto-enabled once the domain is verified after deployment.
          </p>
        </div>
      </div>

      {/* KPI Row — 4 cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          title="Pending Approvals"
          value={summary?.expenses?.pending_count?.toString() || '0'}
          icon={<AlertTriangle size={22} />}
          color="bg-amber-50 text-amber-600"
          onClick={() => navigate('/fm/expenses')}
        />
        <KPICard
          title="Staff Unpaid"
          value={`${(summary?.salary?.total_staff ?? 0) - (summary?.salary?.paid_count ?? 0)} / ${summary?.salary?.total_staff ?? 0}`}
          icon={<Users size={22} />}
          color="bg-blue-50 text-blue-600"
          onClick={() => navigate('/fm/salary')}
        />
        <KPICard
          title="Due This Week"
          value={summary ? fmt(summary.payables.due_this_week_paise) : '—'}
          icon={<Clock size={22} />}
          color={summary?.payables?.overdue_count ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}
          onClick={() => navigate('/fm/payables')}
        />
        <KPICard
          title="Trip Advances Due"
          value="Pay ₹1,500"
          icon={<IndianRupee size={22} />}
          color="bg-yellow-50 text-yellow-700"
          onClick={() => navigate('/fm/trip-advances')}
        />
      </div>

      {/* Overdue Alert */}
      {summary?.payables?.overdue_count ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-red-500 shrink-0" size={18} />
            <span className="text-sm font-medium text-red-800">
              {summary.payables.overdue_count} payment{summary.payables.overdue_count > 1 ? 's' : ''} overdue — action required
            </span>
          </div>
          <button
            onClick={() => navigate('/fm/payables')}
            className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-600"
          >
            View Payables
          </button>
        </div>
      ) : null}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pending Expense Approvals */}
        <div className="bg-white rounded-lg border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Pending GPay Expenses</h2>
            <button
              onClick={() => navigate('/fm/expenses')}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              View all <ChevronRight size={13} />
            </button>
          </div>
          <div className="flex items-center justify-between py-4">
            <div>
              <p className="text-3xl font-bold text-amber-600">{summary?.expenses?.pending_count || 0}</p>
              <p className="text-xs text-gray-400 mt-1">requests pending</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-semibold text-gray-700">
                {summary?.expenses?.pending_amount_paise ? fmt(summary.expenses.pending_amount_paise) : '₹0'}
              </p>
              <p className="text-xs text-gray-400 mt-1">total amount</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/fm/expenses')}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-2 text-sm font-medium transition"
          >
            Review Expenses
          </button>
        </div>

        {/* Upcoming Payables */}
        <div className="bg-white rounded-lg border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Upcoming Payables</h2>
            <button
              onClick={() => navigate('/fm/payables')}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              View all <ChevronRight size={13} />
            </button>
          </div>
          {upcomingItems.length === 0 ? (
            <p className="text-gray-400 text-sm py-6 text-center">No upcoming payments scheduled</p>
          ) : (
            <div className="space-y-2">
              {upcomingItems.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg border flex items-center justify-between ${urgencyColor(item.urgency)}`}
                >
                  <div className="flex items-center gap-2.5">
                    {typeIcon(item.schedule_type)}
                    <div>
                      <p className="text-xs font-medium">{item.description || item.schedule_type}</p>
                      <p className="text-[11px] opacity-70">{item.payee_name} · Due {item.next_due_date || 'TBD'}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold flex items-center gap-0.5">
                      <IndianRupee size={10} />{((item.amount_paise ?? 0) / 100).toLocaleString('en-IN')}
                    </p>
                    {item.days_until_due !== null && (
                      <p className="text-[11px] opacity-70">
                        {item.days_until_due < 0 ? `${Math.abs(item.days_until_due)}d overdue` : `${item.days_until_due}d left`}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
