// ============================================================
// Project Associate Dashboard — Workflow-Driven, Vehicle-Centric
// Transport ERP - Enterprise Fleet Dashboard
// Sections: KPIs → Fleet+Compliance → Trip Workflow →
//           Action Center + Revenue → Job Pipeline → Activity
// ============================================================

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { dashboardService, reportService } from '@/services/dataService';
import PAKpiCards from '@/components/modules/dashboard/PAKpiCards';
import PAActionCenter from '@/components/modules/dashboard/PAActionCenter';
import PAJobPipeline from '@/components/modules/dashboard/PAJobPipeline';
import PARecentActivity from '@/components/modules/dashboard/PARecentActivity';
import PABankingStatus from '@/components/modules/dashboard/PABankingStatus';
import PAFleetStatus from '@/components/modules/dashboard/PAFleetStatus';
import PAComplianceAlerts from '@/components/modules/dashboard/PAComplianceAlerts';
import PATripWorkflow from '@/components/modules/dashboard/PATripWorkflow';
import PASystemAlerts from '@/components/modules/dashboard/PASystemAlerts';
import PARevenueSnapshot from '@/components/modules/dashboard/PARevenueSnapshot';
import { RefreshCw } from 'lucide-react';

type DateFilter = 'today' | 'this_week' | 'this_month' | 'custom';

export default function ProjectAssociateDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');

  // ---- Data Fetching ----
  const { data: kpis, isLoading: kpisLoading, refetch: refetchKpis } = useQuery({
    queryKey: ['pa-kpis', dateFilter],
    queryFn: () => dashboardService.getPAKpis({ date_filter: dateFilter }),
  });

  useQuery({
    queryKey: ['pa-reports-dashboard'],
    queryFn: reportService.dashboard,
  });

  const { data: actionCenter, isLoading: actionsLoading } = useQuery({
    queryKey: ['pa-action-center'],
    queryFn: dashboardService.getPAActionCenter,
  });

  const { data: pipeline, isLoading: pipelineLoading } = useQuery({
    queryKey: ['pa-job-pipeline'],
    queryFn: dashboardService.getPAJobPipeline,
  });

  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ['pa-recent-activity'],
    queryFn: () => dashboardService.getPARecentActivity(15),
  });

  const { data: banking, isLoading: bankingLoading } = useQuery({
    queryKey: ['pa-banking-status'],
    queryFn: dashboardService.getPABankingStatus,
  });

  // New: Fleet, Compliance, Trip Workflow, Alerts, Revenue
  const { data: fleetStatus, isLoading: fleetLoading } = useQuery({
    queryKey: ['pa-fleet-status'],
    queryFn: dashboardService.getPAFleetStatus,
  });

  const { data: compliance, isLoading: complianceLoading } = useQuery({
    queryKey: ['pa-compliance-alerts'],
    queryFn: dashboardService.getPAComplianceAlerts,
  });

  const { data: tripWorkflow, isLoading: tripWorkflowLoading } = useQuery({
    queryKey: ['pa-trip-workflow'],
    queryFn: dashboardService.getPATripWorkflow,
  });

  const { data: systemAlerts, isLoading: alertsLoading } = useQuery({
    queryKey: ['pa-system-alerts'],
    queryFn: dashboardService.getPASystemAlerts,
  });

  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ['pa-revenue'],
    queryFn: () => dashboardService.getPARevenueSnapshot(),
  });

  const handleRefresh = () => {
    refetchKpis();
  };

  const dateFilterOptions: { value: DateFilter; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'this_week', label: 'This Week' },
    { value: 'this_month', label: 'This Month' },
  ];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const isLoading = fleetLoading || complianceLoading || alertsLoading;

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i}
               className="bg-white rounded-xl p-4 border border-gray-200 animate-pulse h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {getGreeting()}, {user?.full_name?.split(' ')[0]}
          </h1>
          <p className="text-gray-500 mt-1">
            Here's your workflow overview — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Date Filter */}
          <div className="flex items-center bg-white border border-gray-200 rounded-xl overflow-hidden">
            {dateFilterOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDateFilter(opt.value)}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  dateFilter === opt.value
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-xl transition-colors"
            title="Refresh data"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* ── SECTION 1: KPI Action Cards ── */}
      <PAKpiCards data={kpis ?? {}} isLoading={kpisLoading} navigate={navigate} />

      {/* ── SECTION 2: Fleet Status + Compliance Alerts + System Alerts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <PAFleetStatus
          data={{
            ...(fleetStatus ?? {}),
            recent_vehicles: ((fleetStatus as any)?.recent_vehicles ?? []),
            drivers: ((fleetStatus as any)?.drivers ?? []),
          } as any}
          isLoading={fleetLoading}
          navigate={navigate}
        />
        <PAComplianceAlerts
          data={{
            ...(compliance ?? {}),
            items: ((compliance as any)?.items ?? []),
          } as any}
          isLoading={complianceLoading}
          navigate={navigate}
        />
        <PASystemAlerts
          data={{
            ...(systemAlerts ?? {}),
            alerts: ((systemAlerts as any)?.systemAlerts ?? (systemAlerts as any)?.alerts ?? []),
          } as any}
          isLoading={alertsLoading}
          navigate={navigate}
        />
      </div>

      {/* ── SECTION 3: Trip Workflow Pipeline ── */}
      <PATripWorkflow data={tripWorkflow} isLoading={tripWorkflowLoading} navigate={navigate} />

      {/* ── SECTION 4: Action Center + Revenue Snapshot ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PAActionCenter data={actionCenter} isLoading={actionsLoading} navigate={navigate} />
        </div>
        <PARevenueSnapshot data={revenueData} isLoading={revenueLoading} navigate={navigate} />
      </div>

      {/* ── SECTION 5: Job Pipeline Kanban + Banking Status ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PAJobPipeline data={pipeline} isLoading={pipelineLoading} navigate={navigate} />
        </div>
        <PABankingStatus data={banking} isLoading={bankingLoading} navigate={navigate} />
      </div>

      {/* ── SECTION 6: Recent Activity Feed ── */}
      <PARecentActivity data={activity} isLoading={activityLoading} navigate={navigate} />
    </div>
  );
}
