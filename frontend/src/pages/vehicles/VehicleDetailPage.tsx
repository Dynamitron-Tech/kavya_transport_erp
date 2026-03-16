import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { vehicleService } from '@/services/dataService';
import { StatusBadge, LoadingPage } from '@/components/common/Modal';
import { ArrowLeft, Edit, Wrench, FileText, MapPin, ChevronRight } from 'lucide-react';

export default function VehicleDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: vehicle, isLoading } = useQuery({
    queryKey: ['vehicle', id],
    queryFn: () => vehicleService.get(Number(id)),
    enabled: !!id,
  });

  if (isLoading) return <LoadingPage />;
  if (!vehicle) return <div className="text-center py-16 text-gray-400">Vehicle not found</div>;

  return (
    <div className="space-y-5">
      <nav className="breadcrumb">
        <Link to="/dashboard">Dashboard</Link>
        <ChevronRight size={14} className="breadcrumb-separator" />
        <Link to="/vehicles">Vehicles</Link>
        <ChevronRight size={14} className="breadcrumb-separator" />
        <span className="text-gray-900 font-medium">{vehicle.registration_number}</span>
      </nav>
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/vehicles')} className="btn-icon">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="page-title">{vehicle.registration_number}</h1>
            <StatusBadge status={vehicle.status} />
          </div>
          <p className="text-gray-500">{vehicle.make} {vehicle.model} ({vehicle.year}) | {vehicle.vehicle_type}</p>
        </div>
        <button className="btn-secondary flex items-center gap-2"><Edit size={16} /> Edit</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Vehicle Details</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Chassis No.</span><span>{vehicle.chassis_number || '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Engine No.</span><span>{vehicle.engine_number || '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Capacity</span><span>{vehicle.capacity_tons} Tons</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Fuel Type</span><span className="capitalize">{vehicle.fuel_type}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Mileage</span><span>{vehicle.mileage_per_liter || '—'} km/L</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Total KM</span><span>{Number((vehicle.total_km_run || 0) ?? 0).toLocaleString('en-IN')} km</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Ownership</span><span className="capitalize">{vehicle.ownership_type}</span></div>
            <div className="flex justify-between">
              <span className="text-gray-500">GPS</span>
              <span className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${vehicle.gps_enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                {vehicle.gps_enabled ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Compliance</h3>
          <div className="space-y-3 text-sm">
            {[
              { label: 'Fitness', date: vehicle.fitness_valid_until },
              { label: 'Insurance', date: vehicle.insurance_valid_until },
              { label: 'Permit', date: vehicle.permit_valid_until },
              { label: 'PUC', date: vehicle.puc_valid_until },
            ].map(({ label, date }) => {
              const isExpired = date && new Date(date) < new Date();
              const isExpiringSoon = date && !isExpired && new Date(date) < new Date(Date.now() + 30 * 86400000);
              return (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-gray-500">{label}</span>
                  <span className={`font-medium ${isExpired ? 'text-red-600' : isExpiringSoon ? 'text-amber-600' : 'text-gray-900'}`}>
                    {date ? new Date(date).toLocaleDateString('en-IN') : '—'}
                    {isExpired && <span className="ml-1 text-xs">(Expired)</span>}
                    {isExpiringSoon && <span className="ml-1 text-xs">(Expiring)</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <button className="btn-primary w-full text-sm">Assign to Trip</button>
            <button className="btn-secondary w-full text-sm flex items-center justify-center gap-2"><Wrench size={16} /> Add Maintenance</button>
            <button className="btn-secondary w-full text-sm flex items-center justify-center gap-2"><FileText size={16} /> View Documents</button>
            <button className="btn-secondary w-full text-sm flex items-center justify-center gap-2"><MapPin size={16} /> Track Vehicle</button>
          </div>
        </div>
      </div>
    </div>
  );
}
