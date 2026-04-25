import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  CalendarCheck2,
  CarFront,
  CheckCircle2,
  Clock3,
  FileText,
  IndianRupee,
  MapPinned,
  RefreshCw,
  Wallet,
} from 'lucide-react';

import api from '@/services/api';
import { driverService } from '@/services/dataService';
import { KPICard, StatusBadge } from '@/components/common/Modal';
import { safeArray } from '@/utils/helpers';

interface DriverTripRow {
  id: number;
  trip_number: string;
  origin: string;
  destination: string;
  trip_date?: string;
  status?: string;
  vehicle_registration?: string;
}

interface AttendanceRow {
  date?: string;
  status?: string;
  check_in_time?: string;
}

interface ExpenseRow {
  amount?: number;
  is_verified?: boolean;
  expense_date?: string;
}

const ACTIVE_TRIP_STATUSES = new Set([
  'planned',
  'vehicle_assigned',
  'driver_assigned',
  'ready',
  'started',
  'loading',
  'in_transit',
  'unloading',
]);

export default function DriverDashboardPage() {
  const navigate = useNavigate();

  const {
    data: tripsResponse,
    isLoading: tripsLoading,
    refetch: refetchTrips,
  } = useQuery({
    queryKey: ['driver-dashboard-my-trips'],
    queryFn: () => driverService.getMyTrips({ page: 1, page_size: 100 }),
  });

  const {
    data: attendanceResponse,
    isLoading: attendanceLoading,
    refetch: refetchAttendance,
  } = useQuery({
    queryKey: ['driver-dashboard-attendance'],
    queryFn: () => api.get('/attendance', { params: { page: 1, limit: 30 } }),
  });

  const {
    data: expenseResponse,
    isLoading: expenseLoading,
    refetch: refetchExpenses,
  } = useQuery({
    queryKey: ['driver-dashboard-expenses'],
    queryFn: () => api.get('/expenses', { params: { page: 1, limit: 100 } }),
  });

  const trips = safeArray<DriverTripRow>(tripsResponse);
  const attendanceRows = safeArray<AttendanceRow>(
    (attendanceResponse as any)?.data?.items ?? (attendanceResponse as any)?.items ?? attendanceResponse,
  );
  const expenses = safeArray<ExpenseRow>(
    (expenseResponse as any)?.data?.items ?? (expenseResponse as any)?.items ?? expenseResponse,
  );

  const kpis = useMemo(() => {
    const activeTrips = trips.filter((trip) => ACTIVE_TRIP_STATUSES.has((trip.status || '').toLowerCase())).length;
    const completedTrips = trips.filter((trip) => (trip.status || '').toLowerCase() === 'completed').length;

    const today = new Date().toISOString().slice(0, 10);
    const todayAttendance = attendanceRows.find((row) => row.date?.slice(0, 10) === today);

    const totalExpense = expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const pendingExpenses = expenses.filter((row) => row.is_verified !== true).length;

    return {
      totalTrips: trips.length,
      activeTrips,
      completedTrips,
      todayAttendance: todayAttendance?.status || 'not_marked',
      totalExpense,
      pendingExpenses,
    };
  }, [trips, attendanceRows, expenses]);

  const recentTrips = [...trips]
    .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
    .slice(0, 5);

  const refreshAll = () => {
    refetchTrips();
    refetchAttendance();
    refetchExpenses();
  };

  const isLoading = tripsLoading || attendanceLoading || expenseLoading;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title text-xl">Driver Dashboard</h1>
          <p className="page-subtitle">My trips, attendance, and expenses at a glance</p>
        </div>
        <button onClick={refreshAll} className="btn-icon" title="Refresh driver dashboard">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          title="Assigned Trips"
          value={kpis.totalTrips}
          icon={<MapPinned size={20} className="text-blue-600" />}
          change={`${kpis.activeTrips} active`}
          changeType="up"
          color="bg-blue-50"
          onClick={() => navigate('/driver/trips')}
        />
        <KPICard
          title="Completed Trips"
          value={kpis.completedTrips}
          icon={<CheckCircle2 size={20} className="text-green-600" />}
          change="This period"
          changeType="neutral"
          color="bg-green-50"
          onClick={() => navigate('/driver/trips')}
        />
        <KPICard
          title="Today's Attendance"
          value={String(kpis.todayAttendance).replace('_', ' ')}
          icon={<CalendarCheck2 size={20} className="text-purple-600" />}
          color="bg-purple-50"
          onClick={() => navigate('/driver/attendance')}
        />
        <KPICard
          title="Expense Total"
          value={`₹${Math.round(kpis.totalExpense).toLocaleString('en-IN')}`}
          icon={<IndianRupee size={20} className="text-amber-600" />}
          change={`${kpis.pendingExpenses} pending verification`}
          changeType={kpis.pendingExpenses > 0 ? 'down' : 'neutral'}
          color="bg-amber-50"
          onClick={() => navigate('/driver/expenses')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Recent Trips</h3>
            <button className="text-xs text-primary-600 hover:text-primary-700 font-medium" onClick={() => navigate('/driver/trips')}>
              View all
            </button>
          </div>

          {isLoading ? (
            <p className="text-sm text-gray-500">Loading trips...</p>
          ) : recentTrips.length === 0 ? (
            <p className="text-sm text-gray-500">No assigned trips yet.</p>
          ) : (
            <div className="space-y-2">
              {recentTrips.map((trip) => (
                <button
                  key={trip.id}
                  onClick={() => navigate('/driver/trips')}
                  className="w-full text-left p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-primary-700">{trip.trip_number}</p>
                      <p className="text-sm text-gray-700">{trip.origin} to {trip.destination}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {trip.trip_date ? new Date(trip.trip_date).toLocaleDateString('en-IN') : '-'}
                        {' • '}
                        {trip.vehicle_registration || 'Vehicle pending'}
                      </p>
                    </div>
                    <StatusBadge status={trip.status || 'planned'} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">My Work</h3>
          <button onClick={() => navigate('/driver/trips')} className="w-full p-3 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 flex items-center gap-2 text-sm font-medium">
            <CarFront size={16} /> Open My Trips
          </button>
          <button onClick={() => navigate('/driver/attendance')} className="w-full p-3 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 flex items-center gap-2 text-sm font-medium">
            <Clock3 size={16} /> Mark Attendance
          </button>
          <button onClick={() => navigate('/driver/expenses')} className="w-full p-3 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 flex items-center gap-2 text-sm font-medium">
            <Wallet size={16} /> View Expenses
          </button>
          <button onClick={() => navigate('/driver/documents')} className="w-full p-3 rounded-lg bg-cyan-50 text-cyan-700 hover:bg-cyan-100 flex items-center gap-2 text-sm font-medium">
            <FileText size={16} /> My Documents
          </button>
        </div>
      </div>
    </div>
  );
}
