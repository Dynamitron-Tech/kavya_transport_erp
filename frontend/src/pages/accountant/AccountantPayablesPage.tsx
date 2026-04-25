import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { accountantService } from '@/services/dataService';
import { KPICard } from '@/components/common/Modal';
import DataTable from '@/components/common/DataTable';
import {
  CreditCard, Clock, AlertTriangle, Wallet,
} from 'lucide-react';
import type { AccountantPayableItem, AccountantPayableType } from '@/types';
import { safeArray } from '@/utils/helpers';

const PAYABLE_TABS: { key: AccountantPayableType | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'vendor', label: 'Vendors' },
  { key: 'driver', label: 'Drivers' },
  { key: 'fuel', label: 'Fuel' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'other', label: 'Other' },
];

export default function AccountantPayablesPage() {
  const [typeFilter, setTypeFilter] = useState<AccountantPayableType | 'all'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['accountant-payables', typeFilter],
    queryFn: () => accountantService.getPayables({ page: 1, limit: 200 }),
  });

  const formatDate = (value?: string) => {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN');
  };

  const items: AccountantPayableItem[] = safeArray<any>(data)
    .filter((row: any) => Number(row.total_outstanding ?? row.pending_amount ?? 0) > 0)
    .map((row: any) => ({
      id: row.id ?? row.vendor_id,
      entity_name: row.vendor_name || (row.vendor_id ? `Vendor #${row.vendor_id}` : 'Vendor'),
      description: row.description || row.vendor_code || '-',
      payable_type: (typeFilter === 'all' ? 'vendor' : typeFilter) as AccountantPayableType,
      total_amount: Number(row.total_amount ?? row.total_outstanding ?? 0),
      paid_amount: 0,
      pending_amount: Number(row.pending_amount ?? row.total_outstanding ?? 0),
      due_date: row.due_date || row.as_on_date || null,
      aging_days: Number(row.aging_days ?? (row.as_on_date ? Math.max(0, Math.floor((Date.now() - new Date(row.as_on_date).getTime()) / (1000 * 60 * 60 * 24))) : 0)),
      status: Number(row.pending_amount ?? row.total_outstanding ?? 0) > 0 ? 'pending' : 'paid',
    }));
  const summary = {
    total_payable: items.reduce((sum, item) => sum + item.pending_amount, 0),
    overdue: 0,
    due_this_week: 0,
    by_type: {
      vendor: 0,
      driver: 0,
    },
  };

  const fmt = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;

  const columns = [
    {
      key: 'entity_name' as const,
      header: 'Name',
      render: (item: AccountantPayableItem) => (
        <div>
          <p className="font-semibold text-gray-900 text-sm">{item.entity_name}</p>
          <p className="text-xs text-gray-500">{item.description}</p>
        </div>
      ),
    },
    {
      key: 'payable_type' as const,
      header: 'Type',
      render: (item: AccountantPayableItem) => (
        <span className="text-xs font-medium capitalize px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
          {item.payable_type}
        </span>
      ),
    },
    {
      key: 'amount' as const,
      header: 'Amount',
      render: (item: AccountantPayableItem) => (
        <span className="font-semibold text-sm">{fmt(item.total_amount)}</span>
      ),
    },
    {
      key: 'paid_amount' as const,
      header: 'Paid',
      render: (item: AccountantPayableItem) => (
        <span className="text-green-600 font-medium text-sm">{fmt(item.paid_amount)}</span>
      ),
    },
    {
      key: 'balance' as const,
      header: 'Balance',
      render: (item: AccountantPayableItem) => (
        <span className="text-red-600 font-bold text-sm">{fmt(item.pending_amount)}</span>
      ),
    },
    {
      key: 'due_date' as const,
      header: 'Due Date',
      render: (item: AccountantPayableItem) => (
        <div className="flex items-center gap-1">
          <span className="text-sm">{formatDate(item.due_date || undefined)}</span>
          {item.aging_days > 0 && (
            <span className={`text-[10px] font-semibold ${item.aging_days > 30 ? 'text-red-600' : 'text-amber-600'}`}>
              ({item.aging_days}d)
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'status' as const,
      header: 'Status',
      render: (item: AccountantPayableItem) => {
        const statusKey = item.status || 'unknown';
        const colors: Record<string, string> = {
          pending: 'bg-amber-50 text-amber-700',
          partially_paid: 'bg-blue-50 text-blue-700',
          paid: 'bg-green-50 text-green-700',
          overdue: 'bg-red-50 text-red-700',
        };
        return (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[statusKey] || 'bg-gray-100 text-gray-700'}`}>
            {statusKey.replace('_', ' ')}
          </span>
        );
      },
    },
    {
      key: 'id' as const,
      header: 'Actions',
      render: (item: AccountantPayableItem) => (
        <button
          className="btn-primary py-1 px-3 text-xs"
          disabled={item.status === 'paid'}
          onClick={() => {}}
        >
          Pay
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Accounts Payable</h1>
          <p className="page-subtitle">Manage payments to vendors, drivers, and suppliers</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Total Payable" value={fmt(summary.total_payable)} icon={<Wallet size={22} />} color="bg-blue-50 text-blue-600" />
        <KPICard title="Overdue" value={fmt(summary.overdue)} icon={<AlertTriangle size={22} />} color="bg-red-50 text-red-600" />
        <KPICard title="Due This Week" value={fmt(summary.due_this_week)} icon={<Clock size={22} />} color="bg-amber-50 text-amber-600" />
        <KPICard
          title="Vendors / Drivers"
          value={`${fmt(summary.by_type?.vendor || 0)} / ${fmt(summary.by_type?.driver || 0)}`}
          icon={<CreditCard size={22} />}
          color="bg-purple-50 text-purple-600"
        />
      </div>

      {/* Type Filter Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {PAYABLE_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTypeFilter(tab.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              typeFilter === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <DataTable
          data={items}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No payables found"
        />
      </div>
    </div>
  );
}
