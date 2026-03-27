import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { accountantService, reportService } from '@/services/dataService';
import { KPICard } from '@/components/common/Modal';
import {
  IndianRupee, TrendingUp, TrendingDown, Wallet,
  Building2, FileText, AlertTriangle,
  Fuel, Users, ArrowUpRight, ArrowDownRight, Clock,
  ChevronRight, Receipt,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import type {
  AccountantDashboardKPIs, AccountantRevenueTrend, AccountantExpenseBreakdown,
  AccountantCashFlow, AccountantTransaction, AccountantPendingAction,
} from '@/types';

const COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#6b7280'];

export default function AccountantDashboardPage() {
  const navigate = useNavigate();

  const { data: kpis } = useQuery<AccountantDashboardKPIs>({
    queryKey: ['accountant-kpis'],
    queryFn: () => accountantService.getDashboardKPIs(),
  });

  useQuery({
    queryKey: ['accountant-reports-dashboard'],
    queryFn: reportService.dashboard,
  });

  const { data: revenueTrend } = useQuery<AccountantRevenueTrend[]>({
    queryKey: ['accountant-revenue-trend'],
    queryFn: () => accountantService.getRevenueTrend(),
  });

  const { data: expenseBreakdown } = useQuery<AccountantExpenseBreakdown[]>({
    queryKey: ['accountant-expense-breakdown'],
    queryFn: () => accountantService.getExpenseBreakdown(),
  });

  const { data: cashFlow } = useQuery<AccountantCashFlow[]>({
    queryKey: ['accountant-cash-flow'],
    queryFn: () => accountantService.getCashFlow(),
  });

  const { data: transactions } = useQuery<AccountantTransaction[]>({
    queryKey: ['accountant-recent-transactions'],
    queryFn: () => accountantService.getRecentTransactions(),
  });

  const { data: pendingActions } = useQuery<AccountantPendingAction[]>({
    queryKey: ['accountant-pending-actions'],
    queryFn: () => accountantService.getPendingActions(),
  });

  const fmt = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-50 text-red-700 ring-red-600/20';
      case 'high': return 'bg-orange-50 text-orange-700 ring-orange-600/20';
      case 'medium': return 'bg-amber-50 text-amber-700 ring-amber-600/20';
      default: return 'bg-gray-50 text-gray-600 ring-gray-500/20';
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Accountant Dashboard</h1>
          <p className="page-subtitle">Financial overview and key metrics</p>
        </div>
      </div>

      {/* KPI Row 1 - Revenue & Profit */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Total Revenue"
          value={kpis ? fmt(kpis.total_revenue) : '—'}
          icon={<IndianRupee size={22} />}
          change={kpis?.revenue_change}
          changeType="up"
          color="bg-green-50 text-green-600"
          onClick={() => navigate('/accountant/reports')}
        />
        <KPICard
          title="Total Expenses"
          value={kpis ? fmt(kpis.total_expenses) : '—'}
          icon={<TrendingDown size={22} />}
          change={kpis?.expense_change}
          changeType="down"
          color="bg-red-50 text-red-600"
          onClick={() => navigate('/accountant/expenses')}
        />
        <KPICard
          title="Net Profit"
          value={kpis ? fmt(kpis.net_profit) : '—'}
          icon={<TrendingUp size={22} />}
          change={kpis?.profit_change}
          changeType="up"
          color="bg-blue-50 text-blue-600"
          onClick={() => navigate('/accountant/reports')}
        />
        <KPICard
          title="Profit Margin"
          value={kpis ? `${kpis.profit_margin}%` : '—'}
          icon={<Receipt size={22} />}
          color="bg-purple-50 text-purple-600"
        />
      </div>

      {/* KPI Row 2 - Outstanding & Cash */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Receivables"
          value={kpis ? fmt(kpis.outstanding_receivables) : '—'}
          icon={<ArrowUpRight size={22} />}
          change={kpis?.receivable_change}
          changeType="down"
          color="bg-amber-50 text-amber-600"
          onClick={() => navigate('/accountant/receivables')}
        />
        <KPICard
          title="Payables"
          value={kpis ? fmt(kpis.pending_payables) : '—'}
          icon={<ArrowDownRight size={22} />}
          color="bg-orange-50 text-orange-600"
          onClick={() => navigate('/accountant/payables')}
        />
        <KPICard
          title="Bank Balance"
          value={kpis ? fmt(kpis.bank_balance) : '—'}
          icon={<Building2 size={22} />}
          color="bg-cyan-50 text-cyan-600"
          onClick={() => navigate('/accountant/banking')}
        />
        <KPICard
          title="Cash in Hand"
          value={kpis ? fmt(kpis.cash_in_hand) : '—'}
          icon={<Wallet size={22} />}
          color="bg-teal-50 text-teal-600"
          onClick={() => navigate('/accountant/banking')}
        />
      </div>

      {/* KPI Row 3 - Operations */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Overdue Invoices"
          value={kpis?.overdue_invoices ?? '—'}
          icon={<AlertTriangle size={22} />}
          change={kpis ? fmt(kpis.overdue_amount) : undefined}
          changeType="down"
          color="bg-red-50 text-red-600"
          onClick={() => navigate('/accountant/invoices')}
        />
        <KPICard
          title="Unbilled Trips"
          value={kpis?.unbilled_trips ?? '—'}
          icon={<FileText size={22} />}
          color="bg-yellow-50 text-yellow-600"
          onClick={() => navigate('/accountant/invoices')}
        />
        <KPICard
          title="Fuel Expenses"
          value={kpis ? fmt(kpis.fuel_expenses) : '—'}
          icon={<Fuel size={22} />}
          color="bg-indigo-50 text-indigo-600"
          onClick={() => navigate('/accountant/fuel')}
        />
        <KPICard
          title="Driver Payments"
          value={kpis ? fmt(kpis.driver_payments_pending) : '—'}
          icon={<Users size={22} />}
          color="bg-pink-50 text-pink-600"
          onClick={() => navigate('/accountant/payables')}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Revenue vs Expense Trend */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Revenue vs Expenses</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={revenueTrend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${Number(v / 100000).toFixed(0)}L`} />
              <Tooltip formatter={(v: number) => [`₹${(v ?? 0).toLocaleString('en-IN')}`, '']} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="profit" name="Profit" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Expense Breakdown Pie */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Expense Distribution</h3>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width="50%" height={250}>
              <PieChart>
                <Pie
                  data={expenseBreakdown || []}
                  dataKey="amount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={55}
                >
                  {(expenseBreakdown || []).map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [`₹${(v ?? 0).toLocaleString('en-IN')}`, '']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {(expenseBreakdown || []).map((item, i) => (
                <div key={item.category} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-gray-600">{item.category}</span>
                  </div>
                  <span className="font-semibold">{item.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Cash Flow Chart */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Cash Flow</h3>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={cashFlow || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${Number(v / 100000).toFixed(0)}L`} />
            <Tooltip formatter={(v: number) => [`₹${(v ?? 0).toLocaleString('en-IN')}`, '']} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="inflow" name="Inflow" stroke="#10b981" fill="#10b981" fillOpacity={0.15} />
            <Area type="monotone" dataKey="outflow" name="Outflow" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} />
            <Area type="monotone" dataKey="net" name="Net Cash" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom Row: Recent Transactions + Pending Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Transactions */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Recent Transactions</h3>
            <button onClick={() => navigate('/accountant/ledger')} className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
              View All <ChevronRight size={14} />
            </button>
          </div>
          <div className="space-y-2">
            {(transactions || []).slice(0, 8).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    tx.amount > 0 ? 'bg-green-50' : 'bg-red-50'
                  }`}>
                    {tx.amount > 0 ? <ArrowUpRight size={16} className="text-green-600" /> : <ArrowDownRight size={16} className="text-red-600" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 truncate">{tx.description}</p>
                    <p className="text-[11px] text-gray-400">
                      <Clock size={10} className="inline mr-1" />
                      {new Date(tx.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-semibold flex-shrink-0 ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {tx.amount > 0 ? '+' : ''}{fmt(Math.abs(tx.amount))}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Actions */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Pending Actions</h3>
            <span className="text-xs font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
              {(pendingActions || []).length} items
            </span>
          </div>
          <div className="space-y-2">
            {(pendingActions || []).map((action) => (
              <div
                key={action.id}
                onClick={() => navigate(action.link)}
                className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ring-1 ring-inset ${getPriorityColor(action.priority)}`}>
                    {action.priority}
                  </span>
                  <span className="text-sm text-gray-700">{action.title}</span>
                </div>
                <ChevronRight size={16} className="text-gray-400" />
              </div>
            ))}
          </div>

          {/* Quick Stats */}
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3">
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <p className="text-lg font-bold text-amber-700">{kpis?.gst_payable ? fmt(kpis.gst_payable) : '—'}</p>
              <p className="text-[11px] text-amber-600 font-medium">GST Payable</p>
            </div>
            <div className="text-center p-3 bg-indigo-50 rounded-lg">
              <p className="text-lg font-bold text-indigo-700">{kpis?.tds_payable ? fmt(kpis.tds_payable) : '—'}</p>
              <p className="text-[11px] text-indigo-600 font-medium">TDS Payable</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
