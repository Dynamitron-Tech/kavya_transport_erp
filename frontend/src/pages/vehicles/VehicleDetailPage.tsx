import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vehicleService } from '@/services/dataService';
import { StatusBadge, LoadingPage, Modal } from '@/components/common/Modal';
import { SubmitButton } from '@/components/common/SubmitButton';
import { ArrowLeft, Edit, Wrench, FileText, MapPin, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import type { OwnershipType, VehicleStatus } from '@/types';
import { DocumentChecklist } from '@/components/documents/DocumentChecklist';

export default function VehicleDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    make: '',
    model: '',
    fuel_type: 'diesel',
    capacity_tons: 0,
    ownership_type: 'owned' as OwnershipType,
    status: 'available' as VehicleStatus,
  });

  const { data: vehicle, isLoading } = useQuery({
    queryKey: ['vehicle', id],
    queryFn: () => vehicleService.get(Number(id)),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: () => vehicleService.update(Number(id), editForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicle', id] });
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      toast.success('Vehicle updated successfully');
      setIsEditOpen(false);
    },
    onError: () => {
      toast.error('Failed to update vehicle');
    },
  });

  useEffect(() => {
    if (!vehicle) return;
    setEditForm({
      make: vehicle.make || '',
      model: vehicle.model || '',
      fuel_type: vehicle.fuel_type || 'diesel',
      capacity_tons: Number(vehicle.capacity_tons || 0),
      ownership_type: (vehicle.ownership_type || 'owned') as OwnershipType,
      status: (vehicle.status || 'available') as VehicleStatus,
    });
  }, [vehicle]);

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
        <button onClick={() => setIsEditOpen(true)} className="btn-secondary flex items-center gap-2"><Edit size={16} /> Edit</button>
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
            <button onClick={() => navigate('/vehicles/' + id + '/maintenance')} className="btn-secondary w-full text-sm flex items-center justify-center gap-2"><Wrench size={16} /> Add Maintenance</button>
            <button onClick={() => navigate('/vehicles/' + id + '/documents')} className="btn-secondary w-full text-sm flex items-center justify-center gap-2"><FileText size={16} /> View Documents</button>
            <button onClick={() => navigate('/vehicles/' + id + '/tracking')} className="btn-secondary w-full text-sm flex items-center justify-center gap-2"><MapPin size={16} /> Track Vehicle</button>
          </div>
        </div>
      </div>

      {/* ── Documents Section ── */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FileText size={16} className="text-gray-500" />
          Compliance Documents
        </h3>
        <DocumentChecklist entityType="vehicle" entityId={Number(id)} />
      </div>

      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Vehicle" size="md">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate();
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Make</label>
              <input className="input-field" value={editForm.make} onChange={(e) => setEditForm((p) => ({ ...p, make: e.target.value }))} />
            </div>
            <div>
              <label className="label">Model</label>
              <input className="input-field" value={editForm.model} onChange={(e) => setEditForm((p) => ({ ...p, model: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fuel Type</label>
              <input className="input-field" value={editForm.fuel_type} onChange={(e) => setEditForm((p) => ({ ...p, fuel_type: e.target.value }))} />
            </div>
            <div>
              <label className="label">Capacity (Tons)</label>
              <input type="number" className="input-field" value={editForm.capacity_tons} onChange={(e) => setEditForm((p) => ({ ...p, capacity_tons: Number(e.target.value) || 0 }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Ownership</label>
              <select className="input-field" value={editForm.ownership_type} onChange={(e) => setEditForm((p) => ({ ...p, ownership_type: e.target.value as OwnershipType }))}>
                <option value="owned">Owned</option>
                <option value="leased">Leased</option>
                <option value="attached">Attached</option>
                <option value="market">Market</option>
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input-field" value={editForm.status} onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value as VehicleStatus }))}>
                <option value="available">Available</option>
                <option value="on_trip">On Trip</option>
                <option value="maintenance">Maintenance</option>
                <option value="breakdown">Breakdown</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setIsEditOpen(false)}>Cancel</button>
            <SubmitButton isLoading={updateMutation.isPending} label="Save Changes" />
          </div>
        </form>
      </Modal>
    </div>
  );
}
