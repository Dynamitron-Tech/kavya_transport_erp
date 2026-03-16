import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportService } from '@/services/dataService';
import { useAuthStore } from '@/store/authStore';
import {
  BarChart3, Truck, Users, Fuel, DollarSign, TrendingUp,
  MapPin, Building2, Wrench, Download,
  FileSpreadsheet
} from 'lucide-react';

interface ReportCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  permission: string;
}

const reportCards: ReportCard[] = [
  { id: 'trip-summary', title: 'Trip Summary', description: 'Overview of all trips with completion rates, distances, and timelines', icon: <MapPin size={24} />, color: 'bg-blue-100 text-blue-600', permission: 'reports:read' },
  { id: 'vehicle-performance', title: 'Vehicle Performance', description: 'Vehicle utilization, mileage analysis, and operational efficiency', icon: <Truck size={24} />, color: 'bg-green-100 text-green-600', permission: 'reports:read' },
  { id: 'driver-performance', title: 'Driver Performance', description: 'Driver ratings, trip counts, fuel efficiency, and safety metrics', icon: <Users size={24} />, color: 'bg-purple-100 text-purple-600', permission: 'reports:read' },
  { id: 'fuel-analysis', title: 'Fuel Analysis', description: 'Fuel consumption trends, cost per km, and efficiency comparisons', icon: <Fuel size={24} />, color: 'bg-orange-100 text-orange-600', permission: 'reports:read' },
  { id: 'revenue-analysis', title: 'Revenue Analysis', description: 'Revenue trends by client, route, and vehicle type', icon: <DollarSign size={24} />, color: 'bg-emerald-100 text-emerald-600', permission: 'finance:read' },
  { id: 'expense-analysis', title: 'Expense Analysis', description: 'Detailed expense breakdown by category, vehicle, and trip', icon: <TrendingUp size={24} />, color: 'bg-red-100 text-red-600', permission: 'finance:read' },
  { id: 'route-analysis', title: 'Route Analysis', description: 'Route profitability, frequency, and optimization insights', icon: <MapPin size={24} />, color: 'bg-cyan-100 text-cyan-600', permission: 'reports:read' },
  { id: 'client-outstanding', title: 'Client Outstanding', description: 'Outstanding receivables by client with aging analysis', icon: <Building2 size={24} />, color: 'bg-amber-100 text-amber-600', permission: 'finance:read' },
  { id: 'maintenance', title: 'Maintenance Report', description: 'Vehicle maintenance history, costs, and upcoming schedules', icon: <Wrench size={24} />, color: 'bg-gray-100 text-gray-600', permission: 'vehicles:read' },
];

export default function ReportsPage() {
  const { hasPermission } = useAuthStore();
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const reportParams = {
    ...(dateRange.from ? { from: dateRange.from } : {}),
    ...(dateRange.to ? { to: dateRange.to } : {}),
  };
  const hasDateParams = Object.keys(reportParams).length > 0;

  const { data: _reportData, isLoading } = useQuery({
    queryKey: ['report', selectedReport, dateRange],
    queryFn: () => {
      const params = hasDateParams ? (reportParams as any) : undefined;
      switch (selectedReport) {
        case 'trip-summary': return reportService.tripSummary(params);
        case 'vehicle-performance': return reportService.vehiclePerformance(params);
        case 'driver-performance': return reportService.driverPerformance(params);
        case 'fuel-analysis': return reportService.fuelAnalysis(params);
        case 'revenue-analysis': return reportService.revenueAnalysis(params);
        case 'expense-analysis': return reportService.expenseAnalysis(params);
        case 'route-analysis': return reportService.routeAnalysis(params);
        case 'client-outstanding': return reportService.clientOutstanding(params);
        default: return null;
      }
    },
    enabled: !!selectedReport,
  });

  const { data: dashboardSummary } = useQuery({
    queryKey: ['reports-dashboard-summary'],
    queryFn: reportService.dashboard,
  });

  const handleExport = async (format: string) => {
    if (!selectedReport) return;
    try {
      const blob = await reportService.exportReport(selectedReport, format, hasDateParams ? (reportParams as any) : undefined);
      const url = URL.createObjectURL(new Blob([blob]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedReport}-report.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* handle error */ }
  };

  const visibleReports = reportCards.filter((r) => hasPermission(r.permission));

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Generate detailed reports and insights</p>
          {dashboardSummary && (
            <p className="text-xs text-gray-500 mt-1">
              Jobs: {dashboardSummary.jobs?.total ?? 0} | Trips: {dashboardSummary.trips?.total ?? 0} | LR: {dashboardSummary.lr?.total ?? 0}
            </p>
          )}
        </div>
        {selectedReport && (
          <div className="flex gap-2">
            <input type="date" className="input-field w-40" value={dateRange.from} onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })} />
            <input type="date" className="input-field w-40" value={dateRange.to} onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })} />
            <button onClick={() => handleExport('xlsx')} className="btn-secondary flex items-center gap-2">
              <FileSpreadsheet size={16} /> Excel
            </button>
            <button onClick={() => handleExport('pdf')} className="btn-secondary flex items-center gap-2">
              <Download size={16} /> PDF
            </button>
          </div>
        )}
      </div>

      {/* Report selection grid */}
      {!selectedReport ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleReports.map((report) => (
            <button
              key={report.id}
              onClick={() => setSelectedReport(report.id)}
              className="card text-left hover:shadow-md hover:border-primary-200 transition-all group"
            >
              <div className={`w-12 h-12 rounded-xl ${report.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                {report.icon}
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{report.title}</h3>
              <p className="text-sm text-gray-500">{report.description}</p>
            </button>
          ))}
        </div>
      ) : (
        <div>
          <button
            onClick={() => setSelectedReport(null)}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium mb-4"
          >
            ← Back to all reports
          </button>

          <div className="card">
            <h3 className="font-semibold text-gray-900 text-lg mb-4">
              {reportCards.find((r) => r.id === selectedReport)?.title}
            </h3>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <BarChart3 size={64} className="mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium mb-1">Report Data</p>
                <p className="text-sm">Select a date range and the report will render here</p>
                <p className="text-xs mt-2">Charts and data tables will populate from the API</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
