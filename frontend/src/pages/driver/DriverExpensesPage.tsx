import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import DataTable, { Column } from '@/components/common/DataTable';
import { StatusBadge } from '@/components/common/Modal';
import api from '@/services/api';
import { safeArray } from '@/utils/helpers';

interface ExpenseRow {
  id: number;
  trip_id?: number;
  category?: string;
  amount?: number;
  payment_mode?: string;
  description?: string;
  expense_date?: string;
  is_verified?: boolean;
}

export default function DriverExpensesPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['driver-expenses', page],
    queryFn: async () => api.get('/expenses', { params: { page, limit: 20 } }),
  });

  const rows = safeArray<ExpenseRow>(data);

  const columns: Column<ExpenseRow>[] = [
    {
      key: 'expense_date',
      header: 'Date',
      render: (row) => <span className="text-sm">{row.expense_date ? new Date(row.expense_date).toLocaleDateString('en-IN') : '-'}</span>,
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => <span className="text-sm capitalize">{row.category || '-'}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (row) => <span className="text-sm font-semibold">₹{Number((row.amount || 0) ?? 0).toLocaleString('en-IN')}</span>,
    },
    {
      key: 'payment_mode',
      header: 'Mode',
      render: (row) => <span className="text-sm">{row.payment_mode || '-'}</span>,
    },
    {
      key: 'is_verified',
      header: 'Verification',
      render: (row) => <StatusBadge status={row.is_verified ? 'verified' : 'pending'} />,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="page-subtitle">Live expense records from backend API</p>
        </div>
        <Link to="/dashboard" className="btn-secondary">Back</Link>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        total={data?.total || 0}
        page={page}
        pageSize={20}
        isLoading={isLoading}
        onPageChange={setPage}
        onRefresh={() => refetch()}
        emptyMessage="No expense records"
      />
    </div>
  );
}
