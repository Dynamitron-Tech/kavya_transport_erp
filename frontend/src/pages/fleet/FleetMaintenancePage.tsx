import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar, ClipboardList, Package, CircleDot, Battery, AlertTriangle, TrendingUp
} from 'lucide-react';
import DataTable, { Column } from '@/components/common/DataTable';
import { KPICard, StatusBadge } from '@/components/common/Modal';
import { fleetService, tpmsService } from '@/services/dataService';
import type { MaintenanceScheduleItem, WorkOrder, PartInventory, TyreRecord, BatteryRecord, MaintenancePrediction } from '@/types';
import { safeArray } from '@/utils/helpers';

type TabKey = 'schedule' | 'work-orders' | 'parts' | 'tyres' | 'battery' | 'predictive';

const tabs = [
  { key: 'schedule' as TabKey, label: 'Service Schedule', icon: Calendar },
  { key: 'work-orders' as TabKey, label: 'Work Orders', icon: ClipboardList },
  { key: 'parts' as TabKey, label: 'Parts Inventory', icon: Package },
  { key: 'tyres' as TabKey, label: 'Tyre Management', icon: CircleDot },
  { key: 'battery' as TabKey, label: 'Battery Health', icon: Battery },
  { key: 'predictive' as TabKey, label: 'Predictive', icon: TrendingUp },
];

export default function FleetMaintenancePage() {
  const [activeTab, setActiveTab] = useState<TabKey>('schedule');

  const formatDate = (value?: string | null) => {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN');
  };

  const { data: scheduleData, isLoading: scheduleLoading } = useQuery<any>({
    queryKey: ['fleet-maintenance-schedule'],
    queryFn: () => fleetService.getMaintenanceSchedule({}),
    enabled: activeTab === 'schedule',
  });

  const { data: workOrderData, isLoading: woLoading } = useQuery<any>({
    queryKey: ['fleet-work-orders'],
    queryFn: () => fleetService.getWorkOrders({}),
    enabled: activeTab === 'work-orders',
  });

  const { data: partsData, isLoading: partsLoading } = useQuery<any>({
    queryKey: ['fleet-parts-inventory'],
    queryFn: fleetService.getPartsInventory,
    enabled: activeTab === 'parts',
  });

  const { data: tyreData, isLoading: tyreLoading } = useQuery<any>({
    queryKey: ['fleet-tyre-management'],
    queryFn: fleetService.getTyreManagement,
    enabled: activeTab === 'tyres',
  });

  const { data: batteryData, isLoading: batteryLoading } = useQuery<any>({
    queryKey: ['fleet-battery-monitoring'],
    queryFn: fleetService.getBatteryMonitoring,
    enabled: activeTab === 'battery',
  });

  const { data: predictData, isLoading: predictLoading } = useQuery<MaintenancePrediction[]>({
    queryKey: ['fleet-predictive-maintenance'],
    queryFn: tpmsService.predictFleet,
    enabled: activeTab === 'predictive',
  });

  // Schedule columns
  const scheduleColumns: Column<MaintenanceScheduleItem>[] = [
    { key: 'vehicle', header: 'Vehicle', render: (r) => <span className="font-medium">{r.vehicle}</span> },
    { key: 'service_type', header: 'Type', render: (r) => <StatusBadge status={r.service_type} /> },
    { key: 'description', header: 'Description', render: (r) => <span className="text-sm">{r.description}</span> },
    { key: 'due_date', header: 'Due Date', render: (r) => <span className="text-sm">{formatDate(r.due_date)}</span> },
    { key: 'due_km', header: 'Due KM', render: (r) => <span className="text-sm">{r.due_km ? Number(r.due_km).toLocaleString('en-IN') : '—'}</span> },
    { key: 'current_km', header: 'Current KM', render: (r) => <span className="text-sm">{(r.current_km ?? 0).toLocaleString('en-IN')}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'priority', header: 'Priority', render: (r) => <StatusBadge status={r.priority || 'medium'} /> },
    { key: 'estimated_cost', header: 'Est. Cost', render: (r) => <span className="text-sm">₹{(r.estimated_cost ?? 0).toLocaleString('en-IN')}</span> },
  ];

  // Work Order columns
  const woColumns: Column<WorkOrder>[] = [
    { key: 'work_order_number', header: 'WO #', render: (r) => <span className="font-medium text-blue-600">{r.work_order_number}</span> },
    { key: 'vehicle', header: 'Vehicle', render: (r) => <span className="text-sm">{r.vehicle}</span> },
    { key: 'type', header: 'Type', render: (r) => <StatusBadge status={r.type} /> },
    { key: 'description', header: 'Description', render: (r) => <span className="text-sm truncate max-w-[200px] block">{r.description}</span> },
    { key: 'workshop', header: 'Workshop', render: (r) => <span className="text-sm">{r.workshop}</span> },
    { key: 'expected_completion', header: 'Expected', render: (r) => <span className="text-sm">{formatDate(r.expected_completion)}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'cost', header: 'Cost', render: (r) => <span className="text-sm">₹{(r.cost ?? 0).toLocaleString('en-IN')}</span> },
  ];

  // Parts columns
  const partsColumns: Column<PartInventory>[] = [
    { key: 'part_name', header: 'Part Name', render: (r) => <span className="font-medium">{r.part_name}</span> },
    { key: 'category', header: 'Category', render: (r) => <span className="text-sm">{r.category}</span> },
    { key: 'quantity', header: 'Qty', render: (r) => <span className={`text-sm font-medium ${r.quantity === 0 ? 'text-red-600' : r.quantity <= r.reorder_level ? 'text-amber-600' : 'text-gray-900'}`}>{r.quantity} {r.unit}</span> },
    { key: 'reorder_level', header: 'Reorder At', render: (r) => <span className="text-sm">{r.reorder_level} {r.unit}</span> },
    { key: 'unit_cost', header: 'Unit Cost', render: (r) => <span className="text-sm">₹{(r.unit_cost ?? 0).toLocaleString('en-IN')}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];

  // Tyre columns
  const tyreColumns: Column<TyreRecord>[] = [
    { key: 'vehicle', header: 'Vehicle', render: (r) => <span className="font-medium">{r.vehicle}</span> },
    { key: 'position', header: 'Position', render: (r) => <span className="text-sm">{r.position}</span> },
    { key: 'brand', header: 'Brand', render: (r) => <span className="text-sm">{r.brand} {r.model}</span> },
    { key: 'installed_date', header: 'Installed', render: (r) => <span className="text-sm">{formatDate(r.installed_date)}</span> },
    { key: 'tread_depth_mm', header: 'Tread (mm)', render: (r) => <span className={`text-sm font-medium ${r.tread_depth_mm < 4 ? 'text-red-600' : r.tread_depth_mm < 6 ? 'text-amber-600' : 'text-green-600'}`}>{r.tread_depth_mm}</span> },
    { key: 'current_km', header: 'KM Run', render: (r) => <span className="text-sm">{Number(r.current_km - r.installed_km).toLocaleString('en-IN')} km</span> },
    { key: 'condition', header: 'Condition', render: (r) => <StatusBadge status={r.condition} /> },
  ];

  // Battery columns
  const batteryColumns: Column<BatteryRecord>[] = [
    { key: 'vehicle', header: 'Vehicle', render: (r) => <span className="font-medium">{r.vehicle}</span> },
    { key: 'brand', header: 'Battery', render: (r) => <span className="text-sm">{r.brand} {r.model}</span> },
    { key: 'installed_date', header: 'Installed', render: (r) => <span className="text-sm">{formatDate(r.installed_date)}</span> },
    { key: 'voltage', header: 'Voltage', render: (r) => <span className={`text-sm font-medium ${r.voltage < 12 ? 'text-red-600' : r.voltage < 12.4 ? 'text-amber-600' : 'text-green-600'}`}>{r.voltage}V</span> },
    { key: 'health_percent', header: 'Health', render: (r) => (
      <div className="flex items-center gap-2">
        <div className="w-16 bg-gray-200 rounded-full h-2">
          <div className={`h-2 rounded-full ${r.health_percent > 70 ? 'bg-green-500' : r.health_percent > 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${r.health_percent}%` }} />
        </div>
        <span className="text-xs font-medium">{r.health_percent}%</span>
      </div>
    ) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'expected_replacement', header: 'Replace By', render: (r) => <span className="text-sm">{formatDate(r.expected_replacement)}</span> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Maintenance Management</h1>
        <p className="page-subtitle">Service schedules, work orders, parts, tyres and battery monitoring</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${
                activeTab === tab.key
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="card">
        {activeTab === 'schedule' && (
          <DataTable columns={scheduleColumns} data={safeArray<MaintenanceScheduleItem>((scheduleData as any)?.items ?? scheduleData)} isLoading={scheduleLoading} emptyMessage="No scheduled maintenance" />
        )}
        {activeTab === 'work-orders' && (
          <DataTable columns={woColumns} data={safeArray<WorkOrder>((workOrderData as any)?.items ?? workOrderData)} isLoading={woLoading} emptyMessage="No work orders" />
        )}
        {activeTab === 'parts' && (
          <>
            {partsData && (
              <div className="grid grid-cols-3 gap-4 mb-4">
                <KPICard title="Total Value" value={`₹${Number((partsData.total_value || 0) ?? 0).toLocaleString('en-IN')}`} icon={<Package className="w-5 h-5" />} color="blue" />
                <KPICard title="Low Stock" value={partsData.low_stock_count || 0} icon={<AlertTriangle className="w-5 h-5" />} color="amber" />
                <KPICard title="Out of Stock" value={partsData.out_of_stock_count || 0} icon={<AlertTriangle className="w-5 h-5" />} color="red" />
              </div>
            )}
            <DataTable columns={partsColumns} data={safeArray<PartInventory>((partsData as any)?.items ?? partsData)} isLoading={partsLoading} emptyMessage="No parts in inventory" />
          </>
        )}
        {activeTab === 'tyres' && (
          <>
            {tyreData?.summary && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <KPICard title="Total Tyres" value={tyreData.summary.total_tyres} icon={<CircleDot className="w-5 h-5" />} color="blue" />
                <KPICard title="Good" value={tyreData.summary.good} icon={<CircleDot className="w-5 h-5" />} color="green" />
                <KPICard title="Fair" value={tyreData.summary.fair} icon={<CircleDot className="w-5 h-5" />} color="amber" />
                <KPICard title="Replace Soon" value={tyreData.summary.replace_soon} icon={<CircleDot className="w-5 h-5" />} color="red" />
                <KPICard title="Critical" value={tyreData.summary.critical} icon={<AlertTriangle className="w-5 h-5" />} color="red" />
              </div>
            )}
            <DataTable columns={tyreColumns} data={safeArray<TyreRecord>((tyreData as any)?.items ?? tyreData)} isLoading={tyreLoading} emptyMessage="No tyre records" />
          </>
        )}
        {activeTab === 'battery' && (
          <DataTable columns={batteryColumns} data={safeArray<BatteryRecord>((batteryData as any)?.items ?? batteryData)} isLoading={batteryLoading} emptyMessage="No battery records" />
        )}
        {activeTab === 'predictive' && (
          <PredictiveTab data={safeArray<MaintenancePrediction>(predictData)} isLoading={predictLoading} />
        )}
      </div>
    </div>
  );
}

/* ── Predictive Maintenance Tab ────────────────────── */

function PredictiveTab({ data, isLoading }: { data: MaintenancePrediction[]; isLoading: boolean }) {
  if (isLoading) return <div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" /></div>;

  const critical = data.filter(d => d.urgency === 'critical');
  const soon = data.filter(d => d.urgency === 'soon');
  const normal = data.filter(d => d.urgency === 'normal');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4 mb-2">
        <KPICard title="Critical" value={critical.length} icon={<AlertTriangle className="w-5 h-5" />} color="bg-red-100 text-red-600" />
        <KPICard title="Due Soon" value={soon.length} icon={<TrendingUp className="w-5 h-5" />} color="bg-yellow-100 text-yellow-600" />
        <KPICard title="Normal" value={normal.length} icon={<Calendar className="w-5 h-5" />} color="bg-green-100 text-green-600" />
      </div>

      <div className="divide-y divide-gray-100">
        {data.map((p, i) => {
          const urgencyMap = {
            critical: { bg: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-700', label: 'Overdue / Critical' },
            soon: { bg: 'bg-yellow-50 border-yellow-200', badge: 'bg-yellow-100 text-yellow-700', label: 'Due Soon' },
            normal: { bg: 'bg-white border-gray-200', badge: 'bg-green-100 text-green-700', label: 'Normal' },
          };
          const style = urgencyMap[p.urgency];
          return (
            <div key={i} className={`flex items-center gap-4 p-4 rounded-lg border ${style.bg} mb-2`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{p.registration_number}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Last service: {p.last_service_date ? new Date(p.last_service_date).toLocaleDateString('en-IN') : '—'}
                  {p.km_since_last != null && ` • ${Number(p.km_since_last).toLocaleString()} km since`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {p.predicted_date ? new Date(p.predicted_date).toLocaleDateString('en-IN') : 'N/A'}
                </p>
                {p.km_remaining != null && (
                  <p className="text-xs text-gray-500">{Number(p.km_remaining).toLocaleString()} km remaining</p>
                )}
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${style.badge}`}>{style.label}</span>
            </div>
          );
        })}
        {data.length === 0 && (
          <div className="text-center py-12 text-sm text-gray-400">
            <TrendingUp className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            No predictive maintenance data available yet
          </div>
        )}
      </div>
    </div>
  );
}
