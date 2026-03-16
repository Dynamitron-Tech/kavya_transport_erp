import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tripService } from '@/services/dataService';
import { StatusBadge, LoadingPage } from '@/components/common/Modal';
import { useAuthStore } from '@/store/authStore';
import { ArrowLeft, Play, Square, MapPin, Fuel, DollarSign, Navigation, ChevronRight } from 'lucide-react';

export default function TripDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuthStore();

  const { data: trip, isLoading } = useQuery({
    queryKey: ['trip', id],
    queryFn: () => tripService.get(Number(id)),
    enabled: !!id,
  });

  const { data: expenses } = useQuery({
    queryKey: ['trip-expenses', id],
    queryFn: () => tripService.getExpenses(Number(id)),
    enabled: !!id,
  });

  const startMutation = useMutation({
    mutationFn: () => tripService.start(Number(id), { start_odometer: 0 }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trip', id] }),
  });

  const completeMutation = useMutation({
    mutationFn: () => tripService.complete(Number(id), { end_odometer: 0 }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trip', id] }),
  });

  if (isLoading) return <LoadingPage />;
  if (!trip) return <div className="text-center py-16 text-gray-400">Trip not found</div>;

  return (
    <div className="space-y-5">
      <nav className="breadcrumb">
        <Link to="/dashboard">Dashboard</Link>
        <ChevronRight size={14} className="breadcrumb-separator" />
        <Link to="/trips">Trips</Link>
        <ChevronRight size={14} className="breadcrumb-separator" />
        <span className="text-gray-900 font-medium">{trip.trip_number}</span>
      </nav>
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/trips')} className="btn-icon"><ArrowLeft size={18} /></button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="page-title">{trip.trip_number}</h1>
            <StatusBadge status={trip.status} />
          </div>
          <p className="text-gray-500">
            {trip.vehicle?.registration_number} | Driver: {trip.driver?.full_name}
          </p>
        </div>
        <div className="flex gap-2">
          {trip.status === 'planned' && hasPermission('trips:update') && (
            <button onClick={() => startMutation.mutate()} className="btn-success flex items-center gap-2" disabled={startMutation.isPending}>
              <Play size={16} /> Start Trip
            </button>
          )}
          {['started', 'in_transit'].includes(trip.status) && (
            <button onClick={() => completeMutation.mutate()} className="btn-danger flex items-center gap-2" disabled={completeMutation.isPending}>
              <Square size={16} /> Complete Trip
            </button>
          )}
          {['started', 'in_transit'].includes(trip.status) && (
            <button onClick={() => navigate('/tracking')} className="btn-primary flex items-center gap-2">
              <Navigation size={16} /> Track Live
            </button>
          )}
        </div>
      </div>

      {/* Trip progress */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Trip Progress</h3>
        </div>
        <div className="flex items-center gap-2">
          {['planned', 'started', 'loading', 'in_transit', 'unloading', 'completed'].map((step, _i) => {
            const statusOrder = ['planned', 'started', 'loading', 'in_transit', 'unloading', 'completed'];
            const currentIndex = statusOrder.indexOf(trip.status);
            const stepIndex = statusOrder.indexOf(step);
            const isActive = stepIndex <= currentIndex;
            return (
              <div key={step} className="flex-1">
                <div className={`h-2 rounded-full ${isActive ? 'bg-primary-600' : 'bg-gray-200'}`} />
                <p className={`text-xs mt-1 capitalize ${isActive ? 'text-primary-600 font-medium' : 'text-gray-400'}`}>
                  {step.replace('_', ' ')}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><MapPin size={18} /> Route</h3>
          <div className="space-y-3 text-sm">
            <div><p className="text-gray-500 text-xs">Origin</p><p className="font-medium">{trip.origin}</p></div>
            <div></div>
            <div><p className="text-gray-500 text-xs">Destination</p><p className="font-medium">{trip.destination}</p></div>
            <hr />
            <div className="flex justify-between"><span className="text-gray-500">Distance</span><span>{trip.total_distance || '—'} km</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Planned Start</span><span>{new DateNumber((trip.planned_start) ?? 0).toLocaleString('en-IN')}</span></div>
            {trip.actual_start && <div className="flex justify-between"><span className="text-gray-500">Actual Start</span><span>{new DateNumber((trip.actual_start) ?? 0).toLocaleString('en-IN')}</span></div>}
            {trip.actual_end && <div className="flex justify-between"><span className="text-gray-500">Actual End</span><span>{new DateNumber((trip.actual_end) ?? 0).toLocaleString('en-IN')}</span></div>}
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Fuel size={18} /> Fuel & Odometer</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Start Odometer</span><span>{trip.start_odometer || '—'} km</span></div>
            <div className="flex justify-between"><span className="text-gray-500">End Odometer</span><span>{trip.end_odometer || '—'} km</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Fuel Issued</span><span>{trip.fuel_issued || '—'} L</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Fuel Consumed</span><span>{trip.fuel_consumed || '—'} L</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Fuel Cost</span><span>₹{Number((trip.total_fuel_cost || 0) ?? 0).toLocaleString('en-IN')}</span></div>
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><DollarSign size={18} /> Financials</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Advance</span><span>₹{Number((trip.advance_amount || 0) ?? 0).toLocaleString('en-IN')}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Total Expenses</span><span>₹{Number((trip.total_expenses || 0) ?? 0).toLocaleString('en-IN')}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Revenue</span><span className="text-green-600 font-medium">₹{Number((trip.revenue || 0) ?? 0).toLocaleString('en-IN')}</span></div>
            <hr />
            <div className="flex justify-between"><span className="text-gray-500 font-medium">Profit</span><span className={`font-bold ${(trip.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>₹{Number((trip.profit || 0) ?? 0).toLocaleString('en-IN')}</span></div>
          </div>
        </div>
      </div>

      {/* Expenses table */}
      <div className="card p-0">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Expenses</h3>
          <button className="btn-primary text-sm">Add Expense</button>
        </div>
        <table className="w-full">
          <thead><tr className="bg-gray-50">
            <th className="table-header">Category</th>
            <th className="table-header">Description</th>
            <th className="table-header">Amount</th>
            <th className="table-header">Date</th>
            <th className="table-header">Status</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {(expenses || []).length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">No expenses recorded</td></tr>
            ) : (
              (expenses || []).map((exp) => (
                <tr key={exp.id} className="hover:bg-gray-50">
                  <td className="table-cell capitalize">{exp.category.replace('_', ' ')}</td>
                  <td className="table-cell">{exp.description}</td>
                  <td className="table-cell font-medium">₹{(exp.amount ?? 0).toLocaleString('en-IN')}</td>
                  <td className="table-cell">{new Date(exp.date).toLocaleDateString('en-IN')}</td>
                  <td className="table-cell">
                    {exp.is_verified ? <span className="badge-success">Verified</span> : <span className="badge-warning">Pending</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
