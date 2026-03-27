import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { reportService } from '@/services/dataService';
import { KPICard } from '@/components/common/Modal';
import { Building2, ClipboardList, Shield, Wrench, Wallet, ArrowRight, Gauge, PlusCircle } from 'lucide-react';

const getGreeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export default function ManagerDashboardPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuthStore();

  const { data: overview, refetch } = useQuery({
    queryKey: ['manager-dashboard-overview'],
    queryFn: reportService.dashboard,
  });

  const shortcuts = [
    { label: 'Masters', subtitle: 'Clients, vehicles, drivers', path: '/clients', icon: <Building2 size={16} className="text-blue-600" />, bg: 'bg-blue-50' },
    { label: 'Operations', subtitle: 'LR and market trips', path: '/lr', icon: <ClipboardList size={16} className="text-emerald-600" />, bg: 'bg-emerald-50' },
    { label: 'Fleet Manager', subtitle: 'Fleet dashboard and tracking', path: '/fleet/dashboard', icon: <Wrench size={16} className="text-amber-600" />, bg: 'bg-amber-50' },
    { label: 'Accountant', subtitle: 'Finance dashboard and controls', path: '/accountant/dashboard', icon: <Wallet size={16} className="text-purple-600" />, bg: 'bg-purple-50' },
    { label: 'Compliance', subtitle: 'Vehicle and driver compliance', path: '/fleet/compliance', icon: <Shield size={16} className="text-rose-600" />, bg: 'bg-rose-50' },
    { label: 'Quick Actions', subtitle: 'Create LR and trip actions', path: '/lr/new', icon: <PlusCircle size={16} className="text-cyan-600" />, bg: 'bg-cyan-50' },
  ];

  const fmt = (val: number) => {
    if (val >= 100000) return `₹${Number(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${Number(val / 1000).toFixed(1)}K`;
    return `₹${val}`;
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title text-xl">{getGreeting()}, Manager</h1>
          <p className="page-subtitle">
            Manager overview aligned to your navigation tabs
          </p>
        </div>
        <button onClick={() => refetch()} className="btn-secondary">Refresh</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          title="Active Jobs"
          value={overview?.active_jobs || 0}
          icon={<ClipboardList size={20} className="text-blue-600" />}
          change={`${overview?.total_clients || 0} clients`}
          changeType="neutral"
          color="bg-blue-50"
          onClick={() => navigate('/jobs')}
        />
        <KPICard
          title="Active Trips"
          value={overview?.active_trips || 0}
          icon={<Gauge size={20} className="text-green-600" />}
          change={`${overview?.pending_lrs || 0} pending LRs`}
          changeType="up"
          color="bg-green-50"
          onClick={() => navigate('/trips')}
        />
        <KPICard
          title="Total Vehicles"
          value={overview?.total_vehicles || 0}
          icon={<Wrench size={20} className="text-amber-600" />}
          change={`${overview?.available_vehicles || 0} available`}
          changeType="neutral"
          color="bg-amber-50"
          onClick={() => navigate('/fleet/vehicles')}
        />
        {hasPermission('finance:read') && (
          <KPICard
            title="Monthly Revenue"
            value={fmt(overview?.monthly_revenue || 0)}
            icon={<Wallet size={20} className="text-purple-600" />}
            change={`Profit: ${fmt(overview?.profit || 0)}`}
            changeType={overview?.profit > 0 ? 'up' : 'down'}
            color="bg-purple-50"
            onClick={() => navigate('/accountant/dashboard')}
          />
        )}
      </div>

      <div className="card">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Manager Tabs</h3>
          <p className="text-xs text-gray-500 mt-1">Direct access to modules from your manager sidebar</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {shortcuts.map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className="p-4 border border-gray-100 rounded-xl hover:shadow-card-hover hover:border-gray-200 transition-all text-left group"
            >
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center flex-shrink-0`}>{item.icon}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.subtitle}</p>
                </div>
                <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
