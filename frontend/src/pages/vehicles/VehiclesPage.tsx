import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { vehicleService } from '@/services/dataService';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import DataTable, { Column } from '@/components/common/DataTable';
import { StatusBadge, KPICard, Modal } from '@/components/common/Modal';
import { SubmitButton } from '@/components/common/SubmitButton';
import { useAuthStore } from '@/store/authStore';
import type { Vehicle, FilterParams, VehicleStatus } from '@/types';
import { Truck, Wrench, Navigation, CheckCircle2, Pencil, Trash2 } from 'lucide-react';
import { safeArray } from '@/utils/helpers';
import { handleApiError } from '../../utils/handleApiError';
import { DocumentChecklist } from '@/components/documents/DocumentChecklist';
import type { ExtractionResult } from '@/components/documents/DocumentUploadWithExtraction';

export default function VehiclesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { hasPermission } = useAuthStore();
  const [filters, setFilters] = useState<FilterParams>({ page: 1, page_size: 20 });
  const [deleteVehicle, setDeleteVehicle] = useState<Vehicle | null>(null);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [editStatus, setEditStatus] = useState<VehicleStatus>('available');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [createdVehicleId, setCreatedVehicleId] = useState<number | null>(null);
  const [createForm, setCreateForm] = useState({
    registration_number: '',
    vehicle_type: 'truck',
    fuel_type: 'diesel',
    capacity_tons: '0',
    ownership_type: 'owned',
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vehicles', filters],
    queryFn: () => vehicleService.list(filters),
  });

  const { data: summary } = useQuery({
    queryKey: ['vehicle-summary'],
    queryFn: () => vehicleService.getSummary(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Vehicle> }) => vehicleService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      toast.success('Vehicle updated successfully.');
      setEditVehicle(null);
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const createMutation = useMutation({
    mutationFn: () => vehicleService.create({
      registration_number: createForm.registration_number,
      vehicle_type: createForm.vehicle_type as any,
      fuel_type: createForm.fuel_type,
      capacity_tons: Number(createForm.capacity_tons || 0),
      ownership_type: createForm.ownership_type as any,
      status: 'available',
      gps_enabled: false,
      make: '',
      model: '',
      year: new Date().getFullYear(),
      total_km_run: 0,
      is_active: true,
    }),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      const vehicleId = data?.id ?? data?.data?.id;
      if (vehicleId) {
        setCreatedVehicleId(vehicleId);
        setCreateStep(2);
      } else {
        toast.success('Vehicle created successfully.');
        resetCreate();
      }
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const resetCreate = () => {
    setCreateForm({
      registration_number: '',
      vehicle_type: 'truck',
      fuel_type: 'diesel',
      capacity_tons: '0',
      ownership_type: 'owned',
    });
    setCreateStep(1);
    setCreatedVehicleId(null);
    setIsCreateOpen(false);
  };

  const handleVehicleExtracted = (result: ExtractionResult) => {
    const d = result.data;
    setCreateForm(prev => ({
      ...prev,
      registration_number: d.registration_number || prev.registration_number,
      fuel_type: d.fuel_type_extracted
        ? d.fuel_type_extracted.toLowerCase().includes('petrol') ? 'petrol'
          : d.fuel_type_extracted.toLowerCase().includes('cng') ? 'cng'
          : 'diesel'
        : prev.fuel_type,
    }));
  };

  const deleteMutation = useMutation({
    mutationFn: (id: number) => vehicleService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      toast.success('Vehicle deleted successfully.');
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const handleEdit = (vehicle: Vehicle) => {
    setEditVehicle(vehicle);
    setEditStatus((vehicle.status || 'available') as VehicleStatus);
  };

  const handleDelete = (vehicle: Vehicle) => setDeleteVehicle(vehicle);
  const rows = safeArray<Vehicle>(data);
  const paginationTotal = (data as any)?.pagination?.total ?? rows.length;

  const columns: Column<Vehicle>[] = [
    {
      key: 'registration_number',
      header: 'Vehicle',
      sortable: true,
      render: (v) => (
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
            v.status === 'available' ? 'bg-green-50' : v.status === 'on_trip' ? 'bg-blue-50' : 'bg-orange-50'
          }`}>
            <Truck size={16} className={
              v.status === 'available' ? 'text-green-600' : v.status === 'on_trip' ? 'text-blue-600' : 'text-orange-600'
            } />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{v.registration_number}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{v.make} {v.model}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'vehicle_type',
      header: 'Type',
      width: '100px',
      render: (v) => <span className="capitalize text-sm">{v.vehicle_type.replace('_', ' ')}</span>,
    },
    {
      key: 'capacity_tons',
      header: 'Capacity',
      sortable: true,
      width: '90px',
      render: (v) => <span className="font-medium">{v.capacity_tons} T</span>,
    },
    {
      key: 'ownership_type',
      header: 'Ownership',
      width: '100px',
      render: (v) => <span className="capitalize text-sm">{v.ownership_type}</span>,
    },
    {
      key: 'gps_enabled',
      header: 'GPS',
      width: '80px',
      render: (v) => (
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${v.gps_enabled ? 'bg-green-500 animate-pulse-dot' : 'bg-gray-300'}`} />
          <span className="text-sm text-gray-600">{v.gps_enabled ? 'Active' : 'Off'}</span>
        </div>
      ),
    },
    {
      key: 'total_km_run',
      header: 'Total KM',
      sortable: true,
      width: '110px',
      render: (v) => <span className="text-sm text-gray-600">{Number((v.total_km_run || 0) ?? 0).toLocaleString('en-IN')} km</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '120px',
      render: (v) => <StatusBadge status={v.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '110px',
      render: (v) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => handleEdit(v)} className="p-1.5 rounded-md hover:bg-gray-100" title="Edit">
            <Pencil size={14} className="text-gray-600" />
          </button>
          <button onClick={() => handleDelete(v)} className="p-1.5 rounded-md hover:bg-red-50" title="Delete">
            <Trash2 size={14} className="text-red-600" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Vehicles</h1>
          <p className="page-subtitle">Manage your fleet of vehicles</p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Total Fleet" value={summary?.total_vehicles ?? paginationTotal} icon={<Truck size={18} className="text-gray-600" />} color="bg-gray-50" />
        <KPICard title="Available" value={summary?.available ?? 0} icon={<CheckCircle2 size={18} className="text-green-600" />} color="bg-green-50" />
        <KPICard title="On Trip" value={summary?.on_trip ?? 0} icon={<Navigation size={18} className="text-blue-600" />} color="bg-blue-50" />
        <KPICard title="Maintenance" value={summary?.maintenance ?? 0} icon={<Wrench size={18} className="text-orange-600" />} color="bg-orange-50" />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        total={paginationTotal}
        page={filters.page}
        pageSize={filters.page_size}
        isLoading={isLoading}
        searchPlaceholder="Search vehicles..."
        onSearch={(q) => setFilters({ ...filters, search: q, page: 1 })}
        onPageChange={(p) => setFilters({ ...filters, page: p })}
        onSort={(key, order) => setFilters({ ...filters, sort_by: key, sort_order: order })}
        onRowClick={(v) => navigate(`/vehicles/${v.id}`)}
        onAdd={hasPermission('vehicles:create') ? () => setIsCreateOpen(true) : undefined}
        addLabel="Add Vehicle"
        onRefresh={() => refetch()}
      />

      <ConfirmDialog
        isOpen={!!deleteVehicle}
        title="Delete Vehicle"
        message={deleteVehicle ? `Delete vehicle ${deleteVehicle.registration_number}? This action cannot be undone.` : ''}
        confirmLabel="Delete"
        isDangerous={true}
        onConfirm={() => {
          if (!deleteVehicle) return;
          deleteMutation.mutate(deleteVehicle.id);
          setDeleteVehicle(null);
        }}
        onCancel={() => setDeleteVehicle(null)}
      />

      <Modal
        isOpen={!!editVehicle}
        onClose={() => setEditVehicle(null)}
        title="Edit Vehicle"
        size="md"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!editVehicle) return;
            updateMutation.mutate({ id: editVehicle.id, payload: { status: editStatus } });
          }}
        >
          <div>
            <label className="label">Registration Number</label>
            <input className="input-field" value={editVehicle?.registration_number || ''} disabled />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input-field" value={editStatus} onChange={(e) => setEditStatus(e.target.value as VehicleStatus)}>
              <option value="available">Available</option>
              <option value="on_trip">On Trip</option>
              <option value="maintenance">Maintenance</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setEditVehicle(null)}>Cancel</button>
            <SubmitButton isLoading={updateMutation.isPending} label="Save Changes" />
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isCreateOpen}
        onClose={resetCreate}
        title={createStep === 1 ? 'Create Vehicle' : 'Upload Documents'}
        subtitle={createStep === 1 ? 'Step 1 of 2 — Vehicle details' : 'Step 2 of 2 — Attach compliance documents'}
        size="lg"
      >
        {createStep === 1 ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <div>
              <label className="label">Registration Number</label>
              <input className="input-field" value={createForm.registration_number} onChange={(e) => setCreateForm((p) => ({ ...p, registration_number: e.target.value.toUpperCase() }))} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Vehicle Type</label>
                <select className="input-field" value={createForm.vehicle_type} onChange={(e) => setCreateForm((p) => ({ ...p, vehicle_type: e.target.value }))}>
                  <option value="truck">Truck</option>
                  <option value="trailer">Trailer</option>
                  <option value="tanker">Tanker</option>
                  <option value="container">Container</option>
                  <option value="mini_truck">Mini Truck</option>
                  <option value="pickup">Pickup</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="label">Fuel Type</label>
                <input className="input-field" value={createForm.fuel_type} onChange={(e) => setCreateForm((p) => ({ ...p, fuel_type: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Capacity (Tons)</label>
                <input type="number" className="input-field" value={createForm.capacity_tons} onChange={(e) => setCreateForm((p) => ({ ...p, capacity_tons: e.target.value }))} />
              </div>
              <div>
                <label className="label">Ownership</label>
                <select className="input-field" value={createForm.ownership_type} onChange={(e) => setCreateForm((p) => ({ ...p, ownership_type: e.target.value }))}>
                  <option value="owned">Owned</option>
                  <option value="leased">Leased</option>
                  <option value="attached">Attached</option>
                  <option value="market">Market</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
              <button type="button" className="btn-secondary" onClick={resetCreate}>Cancel</button>
              <SubmitButton isLoading={createMutation.isPending} label="Next: Documents →" loadingLabel="Creating..." disabled={!createForm.registration_number.trim()} />
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <DocumentChecklist
              entityType="vehicle"
              entityId={createdVehicleId ?? undefined}
              onExtracted={(_req, result) => handleVehicleExtracted(result)}
            />
            <div className="flex justify-between items-center pt-3 border-t border-gray-100">
              <button className="btn-secondary" onClick={() => setCreateStep(1)}>← Back</button>
              <button
                className="px-5 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                onClick={() => {
                  toast.success('Vehicle created successfully.');
                  resetCreate();
                }}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

