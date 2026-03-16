import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import DataTable, { Column } from '@/components/common/DataTable';
import api from '@/services/api';
import { safeArray } from '@/utils/helpers';

interface AttendanceRow {
  id?: number;
  attendance_date?: string;
  status?: string;
  in_time?: string;
  out_time?: string;
  remarks?: string;
  driver_id?: number;
}

export default function DriverAttendancePage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['driver-attendance', page],
    queryFn: async () => api.get('/attendance', { params: { page, limit: 20 } }),
  });

  const rows = safeArray<AttendanceRow>(data);

  const columns: Column<AttendanceRow>[] = [
    {
      key: 'attendance_date',
      header: 'Date',
      render: (row) => <span className="text-sm">{row.attendance_date ? new Date(row.attendance_date).toLocaleDateString('en-IN') : '-'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <span className="text-sm capitalize">{row.status || '-'}</span>,
    },
    {
      key: 'in_time',
      header: 'In',
      render: (row) => <span className="text-sm">{row.in_time || '-'}</span>,
    },
    {
      key: 'out_time',
      header: 'Out',
      render: (row) => <span className="text-sm">{row.out_time || '-'}</span>,
    },
    {
      key: 'remarks',
      header: 'Remarks',
      render: (row) => <span className="text-sm text-gray-600">{row.remarks || '-'}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance</h1>
          <p className="page-subtitle">Live attendance logs from backend API</p>
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
        emptyMessage="No attendance records"
      />
    </div>
  );
}
