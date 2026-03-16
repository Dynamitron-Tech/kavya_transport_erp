import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Users, CheckCircle, Clock } from 'lucide-react';
import DataTable, { Column } from '@/components/common/DataTable';
import { KPICard, StatusBadge } from '@/components/common/Modal';
import api from '@/services/api';
import { safeArray } from '@/utils/helpers';

interface AttendanceRecord {
  id: number;
  driver_name: string;
  date: string;
  check_in: string;
  check_out: string;
  status: string;
  hours_worked: number;
}

export default function AttendancePage() {
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 10));

  const { data, isLoading } = useQuery({
    queryKey: ['admin-attendance', dateFilter],
    queryFn: async () => {
      const res = await api.get('/drivers/attendance', {
        params: { date_from: dateFilter, date_to: dateFilter },
      });
      return res;
    },
  });

  const records: AttendanceRecord[] = safeArray(data).map((r: any) => ({
    id: r.id,
    driver_name: r.driver_name || `Driver #${r.driver_id}`,
    date: r.date || dateFilter,
    check_in: r.check_in_time || r.check_in || '-',
    check_out: r.check_out_time || r.check_out || '-',
    status: r.status || 'present',
    hours_worked: r.hours_worked || 0,
  }));

  const columns: Column<AttendanceRecord>[] = [
    {
      key: 'driver_name',
      header: 'Driver',
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
            <span className="text-sm font-medium text-green-600">{r.driver_name.charAt(0)}</span>
          </div>
          <span className="font-medium text-gray-900">{r.driver_name}</span>
        </div>
      ),
    },
    { key: 'date', header: 'Date', render: (r) => <span className="text-sm">{new Date(r.date).toLocaleDateString('en-IN')}</span> },
    { key: 'check_in', header: 'Check In', render: (r) => <span className="text-sm">{r.check_in}</span> },
    { key: 'check_out', header: 'Check Out', render: (r) => <span className="text-sm">{r.check_out}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'hours_worked', header: 'Hours', render: (r) => <span className="text-sm font-medium">{r.hours_worked}h</span> },
  ];

  const presentCount = records.filter(r => r.status === 'present').length;
  const absentCount = records.filter(r => r.status === 'absent').length;

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
        <KPICard title="Present" value={presentCount} icon={<CheckCircle className="w-5 h-5" />} color="green" />
        <KPICard title="Absent" value={absentCount} icon={<Users className="w-5 h-5" />} color="red" />
        <KPICard title="Avg Hours" value={records.length > 0 ? Math.round(records.reduce((s, r) => s + r.hours_worked, 0) / records.length) : 0} icon={<Clock className="w-5 h-5" />} color="purple" />
      </div>

      <div className="card">
        <DataTable columns={columns} data={records} isLoading={isLoading} emptyMessage="No attendance records for this date" />
      </div>
    </div>
  );
}
