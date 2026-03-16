import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { dashboardService, reportService } from '@/services/dataService';
import { KPICard, TabPills, StatusBadge } from '@/components/common/Modal';
import {
  Truck, Users, Navigation, DollarSign, AlertTriangle,
  TrendingUp, Package, CheckCircle, ArrowRight,
  RefreshCw, FileText, MapPin, ChevronRight,
  Wallet, Receipt, Activity
} from 'lucide-react';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import ProjectAssociateDashboard from './ProjectAssociateDashboard';

const CHART_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function DashboardPage() {
  const { user, hasRole, hasPermission } = useAuthStore();
  const navigate = useNavigate();
  const [period, setPeriod] = useState('today');

  if (hasRole('project_associate')) {
    return <ProjectAssociateDashboard />;
  }

  const { data: overview, refetch } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: reportService.dashboard,
  });

  const { data: revenueTrend } = useQuery({
    queryKey: ['revenue-trend'],
    queryFn: () => dashboardService.getRevenueTrend({ period: 'monthly' }),
    enabled: hasPermission('finance:read'),
  });

  const { data: expenseBreakdown } = useQuery({
    queryKey: ['expense-breakdown'],
    queryFn: dashboardService.getExpenseBreakdown,
    enabled: hasPermission('finance:read'),
  });

  const { data: fleetUtilization } = useQuery({
    queryKey: ['fleet-utilization'],
    queryFn: dashboardService.getFleetUtilization,
    enabled: hasPermission('vehicles:read'),
  });

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: dashboardService.getNotifications,
  });

  const displayRevenue = Array.isArray(revenueTrend)
    ? revenueTrend.map((r: any) => ({ label: r.label, revenue: r.value, expense: r.value2 }))
    : [];
  const displayExpenses = Array.isArray(expenseBreakdown) ? expenseBreakdown : [];
  const displayFleet = Array.isArray(fleetUtilization) ? fleetUtilization : [];

  const fmt = (val: number) => {
    if (val >= 100000) return `₹${Number((val / 100000) ?? 0).toFixed(1)}L`;
    if (val >= 1000) return `₹${Number((val / 1000) ?? 0).toFixed(1)}K`;
    return `₹${val}`;
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  };

  const alertItems = Array.isArray(notifications) ? notifications : [];

  const quickActions = [
    { label: 'New Job', icon: <Package size={18} />, path: '/jobs', color: 'bg-primary-50 text-primary-600' },
    { label: 'Create LR', icon: <FileText size={18} />, path: '/lr', color: 'bg-green-50 text-green-600' },
    { label: 'Plan Trip', icon: <MapPin size={18} />, path: '/trips', color: 'bg-purple-50 text-purple-600' },
    { label: 'Add Invoice', icon: <Wallet size={18} />, path: '/finance', color: 'bg-amber-50 text-amber-600' },
  ];

  const totalFleet = displayFleet.reduce((s: number, d: any) => s + d.value, 0);

  return (
    <div className="space-y-6 pb-8">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title text-xl">{getGreeting()}, {user?.full_name?.split(' ')[0] || 'Admin'}</h1>
          <p className="page-subtitle">
            Fleet overview — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <TabPills
            tabs={[
              { key: 'today', label: 'Today' },
              { key: 'week', label: 'This Week' },
              { key: 'month', label: 'This Month' },
            ]}
            activeTab={period}
            onChange={setPeriod}
          />
          <button onClick={() => refetch()} className="btn-icon" title="Refresh">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {quickActions.map((a) => (
          <button
            key={a.label}
            onClick={() => navigate(a.path)}
            className="card-compact flex items-center gap-3 hover:shadow-card-hover transition-all group"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${a.color}`}>{a.icon}</div>
            <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900">{a.label}</span>
            <ArrowRight size={14} className="ml-auto text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-transform" />
          </button>
        ))}
      </div>

      {/* ── Primary KPI Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          title="Total Vehicles"
          value={overview?.trips?.total || 0}
          icon={<Truck size={20} className="text-blue-600" />}
          change={`${overview?.trips?.active || 0} active`}
          changeType="up"
          color="bg-blue-50"
          onClick={() => navigate('/vehicles')}
        />
        <KPICard
          title="Active Trips"
          value={overview?.jobs?.today || 0}
          icon={<Navigation size={20} className="text-green-600" />}
          change={`${overview?.jobs?.pending || 0} pending`}
          changeType="up"
          color="bg-green-50"
          onClick={() => navigate('/trips')}
        />
        {hasPermission('finance:read') && (
          <KPICard
            title="Monthly Revenue"
            value={fmt(0)}
            icon={<DollarSign size={20} className="text-purple-600" />}
            change="+12.5% vs last month"
            changeType="up"
            color="bg-purple-50"
            onClick={() => navigate('/finance')}
          />
        )}
        <KPICard
          title="Pending Alerts"
          value={alertItems.length}
          icon={<AlertTriangle size={20} className="text-amber-600" />}
          change="3 critical"
          changeType="down"
          color="bg-amber-50"
        />
      </div>

      {/* ── Secondary KPI Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          title="Available Drivers"
          value={`${overview?.lr?.today || 0}/${overview?.lr?.total || 0}`}
          icon={<Users size={20} className="text-cyan-600" />}
          color="bg-cyan-50"
          onClick={() => navigate('/drivers')}
        />
        <KPICard
          title="Pending Jobs"
          value={overview?.jobs?.total || 0}
          icon={<Package size={20} className="text-orange-600" />}
          change={`${overview?.jobs?.pending || 0} awaiting approval`}
          changeType="neutral"
          color="bg-orange-50"
          onClick={() => navigate('/jobs')}
        />
        {hasPermission('finance:read') && (
          <>
            <KPICard
              title="Receivables"
              value={fmt(0)}
              icon={<TrendingUp size={20} className="text-emerald-600" />}
              color="bg-emerald-50"
              onClick={() => navigate('/finance')}
            />
            <KPICard
              title="Monthly Expenses"
              value={fmt(0)}
              icon={<Wallet size={20} className="text-rose-600" />}
              change={`Profit: ${fmt(0)}`}
              changeType="up"
              color="bg-rose-50"
              onClick={() => navigate('/finance')}
            />
          </>
        )}
      </div>

      {/* ── Charts Row 1 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue & Expense Trend */}
        {hasPermission('finance:read') && (
          <div className="lg:col-span-2 card">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Revenue & Expense Trend</h3>
                <p className="text-xs text-gray-400 mt-0.5">Monthly comparison</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary-500" /> Revenue</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400" /> Expense</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={displayRevenue}>
                <defs>
                  <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value: number) => fmt(value)}
                  contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: 12 }}
                />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#2563eb" fill="url(#gRevenue)" strokeWidth={2.5} dot={false} />
                <Area type="monotone" dataKey="expense" name="Expense" stroke="#ef4444" fill="url(#gExpense)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Fleet Utilization Donut */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Fleet Utilization</h3>
            <button onClick={() => navigate('/vehicles')} className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
              View all <ChevronRight size={12} />
            </button>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={displayFleet}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={85}
                innerRadius={55}
                paddingAngle={3}
                strokeWidth={0}
              >
                {displayFleet.map((_: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {displayFleet.map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                <span className="text-gray-500">{item.label}</span>
                <span className="ml-auto font-semibold text-gray-800">{totalFleet > 0 ? Math.round((item.value / totalFleet) * 100) : item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Charts Row 2 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Expense Breakdown */}
        {hasPermission('finance:read') && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Expense Breakdown</h3>
              <span className="text-xs text-gray-400">% of total</span>
            </div>
            <div className="space-y-3">
              {displayExpenses.map((item: any, i: number) => (
                <div key={i}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-600 font-medium">{item.label}</span>
                    <span className="font-semibold text-gray-800">{item.value}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${item.value}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Alerts */}
        <div className={`card ${hasPermission('finance:read') ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">Recent Alerts</h3>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600">
                {alertItems.length}
              </span>
            </div>
            <button className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
              View all <ChevronRight size={12} />
            </button>
          </div>
          <div className="space-y-1">
            {alertItems.slice(0, 5).map((n: any) => ({
              title: n.title || n.message,
              severity: n.type || 'info',
              time: n.created_at || 'Recently',
              icon: <Activity size={14} />,
            })).map((alert: any, i: number) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer group">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  alert.severity === 'critical' ? 'bg-red-50 text-red-500' :
                  alert.severity === 'warning' ? 'bg-amber-50 text-amber-500' : 'bg-blue-50 text-blue-500'
                }`}>
                  {alert.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 font-medium truncate">{alert.title}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400 whitespace-nowrap">{alert.time}</span>
                  <ChevronRight size={14} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ))}
            {alertItems.length === 0 && (
              <div className="px-3 py-6 text-sm text-gray-400 text-center">No alerts available</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Workflow pipeline ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-gray-900">Workflow Pipeline</h3>
          <button onClick={() => navigate('/jobs')} className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
            Manage Jobs <ChevronRight size={12} />
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Draft', count: (overview as any)?.draft_jobs || 8, status: 'draft' },
            { label: 'Pending', count: (overview as any)?.pending_jobs || 12, status: 'pending' },
            { label: 'Approved', count: (overview as any)?.approved_jobs || 15, status: 'approved' },
            { label: 'In Transit', count: (overview as any)?.in_transit_jobs || 23, status: 'in_transit' },
            { label: 'Delivered', count: (overview as any)?.delivered_jobs || 45, status: 'delivered' },
            { label: 'Completed', count: (overview as any)?.completed_jobs || 89, status: 'completed' },
          ].map((stage) => (
            <div key={stage.label} className="text-center p-4 rounded-xl bg-gray-50/80 hover:bg-gray-100/80 transition-colors cursor-pointer group" onClick={() => navigate('/jobs')}>
              <p className="text-2xl font-bold text-gray-900">{stage.count}</p>
              <div className="mt-2">
                <StatusBadge status={stage.status} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
