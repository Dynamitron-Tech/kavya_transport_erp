import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Users, CheckCircle, Clock } from 'lucide-react';
import DataTable, { Column } from '@/components/common/DataTable';
import { KPICard, StatusBadge } from '@/components/common/Modal';
import api from '@/services/api';
import { safeArray } from '@/utils/helpers';

interface AttendanceRecord {
  id: number;
  user_id?: number;
  employee_name: string;
  employee_email?: string;
  employee_role?: string;
  date: string;
  check_in: string;
  status: string;
  check_in_photo_url?: string;
  remarks?: string;
}

export default function AttendancePage() {
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 10));

  const { data, isLoading } = useQuery({
    queryKey: ['admin-attendance', dateFilter],
    queryFn: async () => {
      const res = await api.get('/attendance', {
        params: { page: 1, limit: 100, date: dateFilter },
      });
      return res;
    },
  });

  const { data: usersData } = useQuery({
    queryKey: ['attendance-users-role-map'],
    queryFn: async () => {
      const res = await api.get('/users', {
        params: { page: 1, limit: 500 },
      });
      return res;
    },
  });

  const formatRole = (value: string) => value.replace(/_/g, ' ').trim();

  const users = safeArray<any>((usersData as any)?.data?.items ?? (usersData as any)?.items ?? usersData);
  const roleByUserId = new Map<number, string>();
  const roleByEmail = new Map<string, string>();
  users.forEach((u: any) => {
    const roleCandidates = [u?.role, ...safeArray<string>(u?.roles)].filter(Boolean);
    const role = roleCandidates.length > 0 ? formatRole(String(roleCandidates[0])) : '';
    const userId = Number(u?.id);
    const email = String(u?.email || '').trim().toLowerCase();
    if (role && Number.isFinite(userId) && userId > 0) roleByUserId.set(userId, role);
    if (role && email) roleByEmail.set(email, role);
  });

  const rows = safeArray<any>((data as any)?.data?.items ?? (data as any)?.items ?? data);

  const records: AttendanceRecord[] = rows.map((r: any) => ({
    id: r.id,
    user_id: Number(r.user_id || 0) || undefined,
    employee_name: r.employee_name || `Employee #${r.user_id}`,
    employee_email: r.employee_email,
    employee_role: (
      r.employee_role ||
      roleByUserId.get(Number(r.user_id)) ||
      roleByEmail.get(String(r.employee_email || '').trim().toLowerCase()) ||
      '-'
    ),
    date: r.date || dateFilter,
    check_in: r.check_in_time || '-',
    status: r.status || 'present',
    check_in_photo_url: r.check_in_photo_url,
    remarks: r.remarks,
  }));
  const total = (data as any)?.data?.total ?? (data as any)?.total ?? records.length;

  const columns: Column<AttendanceRecord>[] = [
    {
      key: 'employee_name',
      header: 'Employee',
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
            <span className="text-sm font-medium text-green-600">{r.employee_name.charAt(0)}</span>
          </div>
          <div>
            <span className="font-medium text-gray-900">{r.employee_name}</span>
            {r.employee_email && <p className="text-xs text-gray-400">{r.employee_email}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'employee_role',
      header: 'Role',
      render: (r) => <span className="text-sm capitalize">{r.employee_role || '-'}</span>,
    },
    { key: 'date', header: 'Date', render: (r) => <span className="text-sm">{new Date(r.date).toLocaleDateString('en-IN')}</span> },
    {
      key: 'check_in',
      header: 'Check In',
      render: (r) => <span className="text-sm">{r.check_in ? new Date(r.check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'}</span>,
    },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'check_in_photo_url',
      header: 'Photo',
      render: (r) => r.check_in_photo_url
        ? <img src={r.check_in_photo_url} alt="Attendance" className="w-10 h-10 rounded-lg object-cover border border-gray-200" />
        : <span className="text-sm text-gray-400">-</span>,
    },
    { key: 'remarks', header: 'Remarks', render: (r) => <span className="text-sm text-gray-600">{r.remarks || '-'}</span> },
  ];

  const onTimeCount = records.filter((r) => r.status === 'present').length;
  const lateCount = records.filter((r) => r.status === 'late').length;
  const checkedInCount = onTimeCount + lateCount;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Attendance</h1>
          <p className="page-subtitle">Track driver attendance and work hours</p>
        </div>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="input"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard title="Total Records" value={records.length} icon={<Calendar className="w-5 h-5" />} color="blue" />
        <KPICard title="Present" value={checkedInCount} icon={<CheckCircle className="w-5 h-5" />} color="green" />
        <KPICard title="Late" value={lateCount} icon={<Users className="w-5 h-5" />} color="red" />
        <KPICard title="On Time %" value={checkedInCount > 0 ? `${Math.round((onTimeCount / checkedInCount) * 100)}%` : '0%'} icon={<Clock className="w-5 h-5" />} color="purple" />
      </div>

      <div className="card">
        <DataTable columns={columns} data={records} total={total} page={1} pageSize={100} isLoading={isLoading} emptyMessage="No attendance records for this date" />
      </div>
    </div>
  );
}
