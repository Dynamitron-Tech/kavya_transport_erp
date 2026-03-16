import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { financeService } from '@/services/dataService';
import DataTable, { Column } from '@/components/common/DataTable';
import { StatusBadge } from '@/components/common/Modal';
import type { Payment, FilterParams } from '@/types';
import { safeArray } from '@/utils/helpers';

export default function PaymentsPage() {
  const [filters, setFilters] = useState<FilterParams>({ page: 1, page_size: 20 });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['payments', filters],
    queryFn: () => financeService.listPayments(filters),
  });

  const columns: Column<Payment>[] = [
    {
      key: 'payment_number',
      header: 'Payment No.',
      sortable: true,
      render: (p) => <span className="font-mono text-sm font-medium text-primary-600">{p.payment_number}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      render: (p) => <span className="font-semibold">₹{Number((p.amount || 0) ?? 0).toLocaleString('en-IN')}</span>,
    },
    {
      key: 'method',
      header: 'Method',
      render: (p) => <span className="capitalize">{p.method?.replace('_', ' ')}</span>,
    },
    {
      key: 'payment_date',
      header: 'Date',
      sortable: true,
      render: (p) => new Date(p.payment_date).toLocaleDateString('en-IN'),
    },
    {
      key: 'reference_number',
      header: 'Reference',
      render: (p) => p.reference_number || '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => <StatusBadge status={p.status} />,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Payments</h1>
          <p className="page-subtitle">Track incoming and outgoing payments</p>
        </div>
      </div>
      <DataTable
        columns={columns}
        data={safeArray(data)}
        total={data?.total || 0}
        page={filters.page}
        pageSize={filters.page_size}
        isLoading={isLoading}
        searchPlaceholder="Search payments..."
        onSearch={(q) => setFilters({ ...filters, search: q, page: 1 })}
        onPageChange={(p) => setFilters({ ...filters, page: p })}
        onAdd={() => {}}
        addLabel="Record Payment"
        onRefresh={() => refetch()}
      />
    </div>
  );
}
