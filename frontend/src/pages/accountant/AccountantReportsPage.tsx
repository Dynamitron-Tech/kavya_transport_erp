import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { accountantService } from '@/services/dataService';
import {
  FileText, TrendingUp, TrendingDown, BarChart3,
  Download, ChevronDown, ChevronUp, Truck, Users, Fuel, Calendar,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import type { AccountantReportType } from '@/types';

interface ReportConfig {
  key: AccountantReportType;
  title: string;
  description: string;
  icon: typeof FileText;
  color: string;
  chartType: 'bar' | 'pie' | 'line' | 'table';
}

const REPORTS: ReportConfig[] = [
  { key: 'profit_loss', title: 'Profit & Loss Statement', description: 'Revenue, expenses, and net profit breakdown', icon: TrendingUp, color: 'bg-green-50 text-green-600 border-green-200', chartType: 'bar' },
  { key: 'expense', title: 'Expense Analysis', description: 'Category-wise expense breakdown and trends', icon: TrendingDown, color: 'bg-red-50 text-red-600 border-red-200', chartType: 'pie' },
  { key: 'revenue', title: 'Revenue Report', description: 'Client-wise and route-wise revenue analysis', icon: BarChart3, color: 'bg-blue-50 text-blue-600 border-blue-200', chartType: 'bar' },
  { key: 'trip_profitability', title: 'Trip Profitability', description: 'Per-trip revenue vs cost analysis', icon: Truck, color: 'bg-purple-50 text-purple-600 border-purple-200', chartType: 'table' },
  { key: 'client_outstanding', title: 'Client Outstanding', description: 'Client-wise receivable aging report', icon: Users, color: 'bg-amber-50 text-amber-600 border-amber-200', chartType: 'table' },
  { key: 'vendor_payables', title: 'Vendor Payables', description: 'Vendor-wise payable summary', icon: Users, color: 'bg-teal-50 text-teal-600 border-teal-200', chartType: 'table' },
  { key: 'fuel_cost', title: 'Fuel Cost Analysis', description: 'Vehicle-wise fuel cost and mileage report', icon: Fuel, color: 'bg-orange-50 text-orange-600 border-orange-200', chartType: 'bar' },
  { key: 'monthly_summary', title: 'Monthly Summary', description: 'Month-wise P&L, cash flow, and key metrics', icon: Calendar, color: 'bg-indigo-50 text-indigo-600 border-indigo-200', chartType: 'line' },
];

const PIE_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function AccountantReportsPage() {
  const [expandedReport, setExpandedReport] = useState<AccountantReportType | null>(null);

  const fmt = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Financial Reports</h1>
          <p className="page-subtitle">Generate and analyze financial reports</p>
        </div>
      </div>

      {/* Report Cards Grid */}
      <div className="space-y-3">
        {REPORTS.map((report) => (
          <ReportCard
            key={report.key}
            config={report}
            isExpanded={expandedReport === report.key}
            onToggle={() => setExpandedReport(expandedReport === report.key ? null : report.key)}
            fmt={fmt}
          />
        ))}
      </div>
    </div>
  );
}

function ReportCard({
  config,
  isExpanded,
  onToggle,
  fmt,
}: {
  config: ReportConfig;
  isExpanded: boolean;
  onToggle: () => void;
  fmt: (n: number) => string;
}) {
  const Icon = config.icon;

  const { data, isLoading } = useQuery({
    queryKey: ['accountant-report', config.key],
    queryFn: () => {
      switch (config.key) {
        case 'profit_loss': return accountantService.getProfitLossReport();
        case 'expense': return accountantService.getExpenseReport();
        case 'revenue': return accountantService.getRevenueReport();
        case 'trip_profitability': return accountantService.getTripProfitabilityReport();
        case 'client_outstanding': return accountantService.getClientOutstandingReport();
        case 'vendor_payables': return accountantService.getVendorPayablesReport();
        case 'fuel_cost': return accountantService.getFuelCostReport();
        case 'monthly_summary': return accountantService.getMonthlySummaryReport();
      }
    },
    enabled: isExpanded,
  });

  return (
    <div className={`card p-0 overflow-hidden border ${isExpanded ? 'ring-1 ring-primary-200' : ''}`}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-4">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${config.color}`}>
            <Icon size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">{config.title}</h3>
            <p className="text-xs text-gray-500">{config.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isExpanded && (
            <button
              onClick={(e) => { e.stopPropagation(); }}
              className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1"
            >
              <Download size={12} /> Export
            </button>
          )}
          {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-100 px-5 py-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
            </div>
          ) : data ? (
            <ReportContent config={config} data={data} fmt={fmt} />
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No data available</p>
          )}
        </div>
      )}
    </div>
  );
}

function ReportContent({ config, data, fmt }: { config: ReportConfig; data: any; fmt: (n: number) => string }) {
  switch (config.key) {
    case 'profit_loss':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 rounded-xl p-4">
              <p className="text-xs text-green-600 font-medium">Total Revenue</p>
              <p className="text-xl font-bold text-green-700">{fmt(data.total_revenue || 0)}</p>
            </div>
            <div className="bg-red-50 rounded-xl p-4">
              <p className="text-xs text-red-600 font-medium">Total Expenses</p>
              <p className="text-xl font-bold text-red-700">{fmt(data.total_expenses || 0)}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-xs text-blue-600 font-medium">Net Profit</p>
              <p className="text-xl font-bold text-blue-700">{fmt(data.net_profit || 0)}</p>
              <p className="text-xs text-blue-500">{Number(data.profit_margin ?? 0).toFixed(1)}% margin</p>
            </div>
          </div>
          {data.monthly?.length > 0 && (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v: number) => `₹${Number(v / 100000).toFixed(0)}L`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => [fmt(value), '']} />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="Profit" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      );

    case 'expense':
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.categories?.length > 0 && (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={data.categories} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }: any) => `${name} ${Number(percent * 100).toFixed(0)}%`}>
                  {data.categories.map((_: any, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [fmt(value), '']} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Category Breakdown</h4>
            {data.categories?.map((cat: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-sm capitalize">{cat.category?.replace('_', ' ')}</span>
                </div>
                <span className="text-sm font-bold">{fmt(cat.amount)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between py-2 mt-2 border-t-2 border-gray-200">
              <span className="text-sm font-bold">Total</span>
              <span className="text-sm font-bold">{fmt(data.total || 0)}</span>
            </div>
          </div>
        </div>
      );

    case 'revenue':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-xs text-blue-600 font-medium">Total Revenue</p>
              <p className="text-xl font-bold text-blue-700">{fmt(data.total_revenue || 0)}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4">
              <p className="text-xs text-green-600 font-medium">Avg per Trip</p>
              <p className="text-xl font-bold text-green-700">{fmt(data.avg_per_trip || 0)}</p>
            </div>
          </div>
          {data.by_client?.length > 0 && (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.by_client} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tickFormatter={(v: number) => `₹${Number(v / 100000).toFixed(0)}L`} tick={{ fontSize: 11 }} />
                <YAxis dataKey="client" type="category" width={120} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => [fmt(value), '']} />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      );

    case 'trip_profitability':
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-header">Trip ID</th>
                <th className="table-header">Route</th>
                <th className="table-header">Revenue</th>
                <th className="table-header">Cost</th>
                <th className="table-header">Profit</th>
                <th className="table-header">Margin</th>
              </tr>
            </thead>
            <tbody>
              {data.trips?.map((trip: any, i: number) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="table-cell font-mono text-xs">{trip.trip_id}</td>
                  <td className="table-cell">{trip.route}</td>
                  <td className="table-cell text-green-600 font-medium">{fmt(trip.revenue)}</td>
                  <td className="table-cell text-red-600 font-medium">{fmt(trip.cost)}</td>
                  <td className="table-cell font-bold">{fmt(trip.profit)}</td>
                  <td className="table-cell">
                    <span className={`font-bold ${trip.margin >= 20 ? 'text-green-600' : trip.margin >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
                      {Number(trip.margin ?? 0).toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'client_outstanding':
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-header">Client</th>
                <th className="table-header">Total Due</th>
                <th className="table-header">0-30 Days</th>
                <th className="table-header">31-60 Days</th>
                <th className="table-header">61-90 Days</th>
                <th className="table-header">90+ Days</th>
              </tr>
            </thead>
            <tbody>
              {data.clients?.map((client: any, i: number) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="table-cell font-semibold">{client.name}</td>
                  <td className="table-cell font-bold">{fmt(client.total_due)}</td>
                  <td className="table-cell text-green-600">{fmt(client.aging_0_30)}</td>
                  <td className="table-cell text-amber-600">{fmt(client.aging_31_60)}</td>
                  <td className="table-cell text-orange-600">{fmt(client.aging_61_90)}</td>
                  <td className="table-cell text-red-600 font-bold">{fmt(client.aging_over_90)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'vendor_payables':
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-header">Vendor</th>
                <th className="table-header">Type</th>
                <th className="table-header">Total</th>
                <th className="table-header">Paid</th>
                <th className="table-header">Balance</th>
              </tr>
            </thead>
            <tbody>
              {data.vendors?.map((vendor: any, i: number) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="table-cell font-semibold">{vendor.name}</td>
                  <td className="table-cell capitalize">{vendor.type}</td>
                  <td className="table-cell">{fmt(vendor.total)}</td>
                  <td className="table-cell text-green-600">{fmt(vendor.paid)}</td>
                  <td className="table-cell text-red-600 font-bold">{fmt(vendor.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'fuel_cost':
      return (
        <div className="space-y-4">
          {data.by_vehicle?.length > 0 && (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.by_vehicle}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="vehicle" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v: number) => `₹${Number(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => [fmt(value), '']} />
                <Legend />
                <Bar dataKey="cost" name="Fuel Cost" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-red-50 rounded-xl p-4">
              <p className="text-xs text-red-600 font-medium">Total Fuel Cost</p>
              <p className="text-xl font-bold text-red-700">{fmt(data.total_cost || 0)}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-xs text-blue-600 font-medium">Total Litres</p>
              <p className="text-xl font-bold text-blue-700">{Number((data.total_litres || 0) ?? 0).toLocaleString('en-IN')} L</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4">
              <p className="text-xs text-green-600 font-medium">Avg Mileage</p>
              <p className="text-xl font-bold text-green-700">{Number(data.avg_mileage ?? 0).toFixed(1) || '0.0'} km/L</p>
            </div>
          </div>
        </div>
      );

    case 'monthly_summary':
      return (
        <div className="space-y-4">
          {data.months?.length > 0 && (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.months}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v: number) => `₹${Number(v / 100000).toFixed(0)}L`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => [fmt(value), '']} />
                <Legend />
                <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" strokeWidth={2} />
                <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" strokeWidth={2} />
                <Line type="monotone" dataKey="profit" name="Profit" stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      );

    default:
      return <p className="text-sm text-gray-400 text-center py-8">Report not available</p>;
  }
}
