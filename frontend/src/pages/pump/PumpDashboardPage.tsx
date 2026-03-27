import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Fuel, Droplets, AlertTriangle, TrendingUp, Plus, List } from 'lucide-react';
import { fuelPumpService } from '@/services/fuelPumpService';

export default function PumpDashboardPage() {
  const navigate = useNavigate();

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['pump-dashboard'],
    queryFn: fuelPumpService.getDashboard,
    refetchInterval: 30000,
  });

  const stats = dashboardData?.data;

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fuel Pump Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor fuel stock and daily operations</p>
        </div>
        <button
          onClick={() => navigate('/pump/issue')}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
        >
          <Plus size={18} />
          Issue Fuel
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={<Droplets className="text-blue-600" size={24} />}
          label="Total Stock"
          value={`${Number(stats?.total_stock_litres || 0).toLocaleString()} L`}
          bgColor="bg-blue-50"
        />
        <KPICard
          icon={<Fuel className="text-green-600" size={24} />}
          label="Today Issued"
          value={`${Number(stats?.today_issued_litres || 0).toLocaleString()} L`}
          subtext={`${stats?.today_issued_count || 0} transactions`}
          bgColor="bg-green-50"
        />
        <KPICard
          icon={<TrendingUp className="text-purple-600" size={24} />}
          label="This Month"
          value={`${Number(stats?.month_issued_litres || 0).toLocaleString()} L`}
          subtext={`₹${Number(stats?.month_cost || 0).toLocaleString()}`}
          bgColor="bg-purple-50"
        />
        <KPICard
          icon={<AlertTriangle className="text-red-600" size={24} />}
          label="Open Alerts"
          value={String(stats?.open_alerts || 0)}
          bgColor="bg-red-50"
          onClick={() => navigate('/pump/alerts')}
        />
      </div>

      {/* Tank Status */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Tank Status</h2>
        {stats?.tanks?.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.tanks.map((tank: any) => {
              const pct = tank.capacity_litres > 0
                ? (Number(tank.current_stock_litres) / Number(tank.capacity_litres)) * 100
                : 0;
              const isLow = tank.min_stock_alert && Number(tank.current_stock_litres) <= Number(tank.min_stock_alert);
              return (
                <div key={tank.id} className={`p-4 rounded-lg border ${isLow ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900">{tank.name}</h3>
                    <span className="text-xs uppercase font-semibold text-gray-500">{tank.fuel_type}</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-800">
                    {Number(tank.current_stock_litres).toLocaleString()} L
                  </div>
                  <div className="text-xs text-gray-500 mb-2">
                    of {Number(tank.capacity_litres).toLocaleString()} L capacity
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full ${pct > 30 ? 'bg-green-500' : pct > 15 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  {isLow && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <AlertTriangle size={12} /> Below minimum stock alert
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No tanks configured</p>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => navigate('/pump/log')}
          className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-gray-200 hover:border-primary-300 transition"
        >
          <List className="text-primary-600" size={24} />
          <div className="text-left">
            <div className="font-medium text-gray-900">Fuel Log</div>
            <div className="text-xs text-gray-500">View all fuel issue records</div>
          </div>
        </button>
        <button
          onClick={() => navigate('/pump/stock')}
          className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-gray-200 hover:border-primary-300 transition"
        >
          <Droplets className="text-blue-600" size={24} />
          <div className="text-left">
            <div className="font-medium text-gray-900">Stock Management</div>
            <div className="text-xs text-gray-500">Refills and adjustments</div>
          </div>
        </button>
        <button
          onClick={() => navigate('/pump/alerts')}
          className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-gray-200 hover:border-primary-300 transition"
        >
          <AlertTriangle className="text-red-600" size={24} />
          <div className="text-left">
            <div className="font-medium text-gray-900">Theft Alerts</div>
            <div className="text-xs text-gray-500">Anomaly detection</div>
          </div>
        </button>
      </div>
    </div>
  );
}

function KPICard({ icon, label, value, subtext, bgColor, onClick }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext?: string;
  bgColor: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-xl border border-gray-200 ${bgColor} ${onClick ? 'cursor-pointer hover:shadow-md' : ''} transition`}
    >
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <span className="text-sm font-medium text-gray-600">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {subtext && <div className="text-xs text-gray-500 mt-1">{subtext}</div>}
    </div>
  );
}
