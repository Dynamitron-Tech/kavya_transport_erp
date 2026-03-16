import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { tripService } from '@/services/dataService';
import api from '@/services/api';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import DataTable, { Column } from '@/components/common/DataTable';
import { Modal, StatusBadge, TabPills } from '@/components/common/Modal';
import { SubmitButton } from '@/components/common/SubmitButton';
import { useAuthStore } from '@/store/authStore';
import type { Trip, FilterParams } from '@/types';
import { MapPin, Pencil, Trash2, Truck } from 'lucide-react';
import { safeArray } from '@/utils/helpers';
import { handleApiError } from '../../utils/handleApiError';

const TRIP_STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'bg-gray-100 text-gray-700',
  DEPARTED: 'bg-blue-100 text-blue-700',
  IN_TRANSIT: 'bg-orange-100 text-orange-700',
  REACHED_DESTINATION: 'bg-purple-100 text-purple-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-teal-100 text-teal-700',
};

const normalizeTripStatus = (status?: string) => {
  const value = (status || '').toLowerCase();
  if (value === 'planned') return 'SCHEDULED';
  if (value === 'started' || value === 'loading') return 'DEPARTED';
  if (value === 'in_transit') return 'IN_TRANSIT';
  if (value === 'unloading') return 'REACHED_DESTINATION';
  if (value === 'completed') return 'CLOSED';
  if (value === 'delivered') return 'DELIVERED';
  return 'SCHEDULED';
};

export default function TripsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { hasPermission } = useAuthStore();
  const [filters, setFilters] = useState<FilterParams>({ page: 1, page_size: 20 });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<Trip | null>(null);
  const [createForm, setCreateForm] = useState({
    job_id: '',
    lr_id: '',
    vehicle_id: '',
    driver_id: '',
    planned_departure: new Date().toISOString().slice(0, 16),
    planned_arrival: new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16),
    route_id: '',
    advance_paid: '',
    fuel_advance: '',
  });
  const [editForm, setEditForm] = useState({
    origin: '',
    destination: '',
    planned_start: '',
    total_distance: '',
  });

  const buildTripCreatePayload = () => {
    const selectedJob = safeArray<any>((jobsData as any)?.items ?? jobsData).find((job: any) => String(job.id) === createForm.job_id);
    const browserPayload = {
      job_id: Number(createForm.job_id),
      lr_id: createForm.lr_id ? Number(createForm.lr_id) : null,
      vehicle_id: Number(createForm.vehicle_id),
      driver_id: Number(createForm.driver_id),
      planned_departure: createForm.planned_departure,
      planned_arrival: createForm.planned_arrival,
      route_id: createForm.route_id ? Number(createForm.route_id) : null,
      advance_paid: Number(createForm.advance_paid) || 0,
      fuel_advance: Number(createForm.fuel_advance) || 0,
    };

    const backendPayload = {
      trip_date: createForm.planned_departure.slice(0, 10),
      job_id: browserPayload.job_id,
      vehicle_id: browserPayload.vehicle_id,
      driver_id: browserPayload.driver_id,
      origin: selectedJob?.origin || selectedJob?.origin_city || 'Origin',
      destination: selectedJob?.destination || selectedJob?.destination_city || 'Destination',
      planned_start: new Date(createForm.planned_departure).toISOString(),
      planned_end: new Date(createForm.planned_arrival).toISOString(),
      route_id: browserPayload.route_id ?? undefined,
      driver_advance: browserPayload.advance_paid,
      lr_ids: browserPayload.lr_id ? [browserPayload.lr_id] : [],
      remarks: browserPayload.fuel_advance ? `Fuel advance: ${browserPayload.fuel_advance}` : undefined,
    } as Partial<Trip>;

    // eslint-disable-next-line no-console
    console.log('Trip create payload (browser contract):', browserPayload);
    // eslint-disable-next-line no-console
    console.log('Trip create payload (backend contract):', backendPayload);

    return backendPayload;
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['trips', filters, statusFilter],
    queryFn: () => tripService.list({ ...filters, status: statusFilter !== 'all' ? statusFilter : undefined }),
    throwOnError: false,
  });

  const selectedJobId = createForm.job_id ? Number(createForm.job_id) : null;

  const { data: jobsData } = useQuery({
    queryKey: ['trips-create-jobs'],
    queryFn: () => api.get('/jobs', { params: { page: 1, limit: 100 }, suppressErrorToast: true } as any),
    retry: false,
    throwOnError: false,
  });

  const { data: vehiclesData } = useQuery({
    queryKey: ['trips-create-vehicles'],
    queryFn: () => api.get('/vehicles', { params: { page: 1, limit: 100 }, suppressErrorToast: true } as any),
    retry: false,
    throwOnError: false,
  });

  const { data: driversData } = useQuery({
    queryKey: ['trips-create-drivers'],
    queryFn: () => api.get('/drivers', { params: { page: 1, limit: 100 }, suppressErrorToast: true } as any),
    retry: false,
    throwOnError: false,
  });

  const { data: routesData } = useQuery({
    queryKey: ['trips-create-routes'],
    queryFn: () => api.get('/routes', { params: { page: 1, limit: 100 }, suppressErrorToast: true } as any),
    retry: false,
    throwOnError: false,
  });

  const { data: lrsData } = useQuery({
    queryKey: ['trips-create-lrs', selectedJobId],
    queryFn: () => api.get('/lr', {
      params: { page: 1, limit: 100, job_id: selectedJobId },
      suppressErrorToast: true,
    } as any),
    enabled: Boolean(selectedJobId),
    retry: false,
    throwOnError: false,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/trips/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trips'] });
      toast.success('Trip deleted successfully.');
    },
    onError: (error: any) => handleApiError(error, 'Failed to delete trip.'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => api.put(`/trips/${id}/${action}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trips'] });
      toast.success('Trip status updated');
    },
    onError: (error: any) => handleApiError(error, 'Status update failed'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Trip> }) => tripService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trips'] });
      toast.success('Trip updated successfully.');
      setEditTrip(null);
    },
    onError: (error: any) => handleApiError(error, 'Failed to update trip.'),
  });

  const createMutation = useMutation({
    mutationFn: (payload: Partial<Trip>) => api.post('/trips', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trips'] });
      toast.success('Trip created successfully.');
      setIsCreateOpen(false);
      setCreateForm({
        job_id: '',
        lr_id: '',
        vehicle_id: '',
        driver_id: '',
        planned_departure: new Date().toISOString().slice(0, 16),
        planned_arrival: new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16),
        route_id: '',
        advance_paid: '',
        fuel_advance: '',
      });
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const updateTripStatus = (id: string, action: string) => {
    statusMutation.mutate({ id, action });
  };

  const handleDelete = (trip: Trip) => setDeleteId(String(trip.id));

  const handleEdit = (trip: Trip) => {
    setEditItem(trip);
    setEditForm({
      origin: trip.origin || '',
      destination: trip.destination || '',
      planned_start: trip.planned_start?.toString().slice(0, 10) || '',
      total_distance: String(trip.total_distance || ''),
    });
  };

  const columns: Column<Trip>[] = [
    {
      key: 'trip_number',
      header: 'Trip No.',
      sortable: true,
      render: (t) => <span className="font-mono text-sm font-medium text-primary-600">{t.trip_number}</span>,
    },
    {
      key: 'vehicle',
      header: 'Vehicle',
      render: (t) => (
        <div className="flex items-center gap-2">
          <Truck size={16} className="text-gray-400" />
          <span className="text-sm">{t.vehicle?.registration_number || `#${t.vehicle_id}`}</span>
        </div>
      ),
    },
    {
      key: 'driver',
      header: 'Driver',
      render: (t) => <span className="text-sm">{t.driver?.full_name || `#${t.driver_id}`}</span>,
    },
    {
      key: 'route',
      header: 'Route',
      render: (t) => (
        <div className="flex items-center gap-1 text-sm">
          <MapPin size={14} className="text-green-500" />
          <span>{t.origin}</span>
          <span className="text-gray-300">→</span>
          <MapPin size={14} className="text-red-500" />
          <span>{t.destination}</span>
        </div>
      ),
    },
    {
      key: 'planned_start',
      header: 'Start Date',
      sortable: true,
      render: (t) => new Date(t.planned_start).toLocaleDateString('en-IN'),
    },
    {
      key: 'total_distance',
      header: 'Distance',
      sortable: true,
      render: (t) => t.total_distance ? `${t.total_distance} km` : '—',
    },
    {
      key: 'total_expenses',
      header: 'Expenses',
      render: (t) => t.total_expenses ? `₹${(t.total_expenses ?? 0).toLocaleString('en-IN')}` : '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (t) => {
        const normalized = normalizeTripStatus(t.status);
        const color = TRIP_STATUS_COLORS[normalized] || 'bg-gray-100 text-gray-700';
        return <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${color}`}>{normalized.replace('_', ' ')}</span>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (t) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(t);
            }}
            className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit"
          >
            <Pencil size={14} className="text-gray-600" />
          </button>
          {normalizeTripStatus(t.status) === 'SCHEDULED' && (
            <button type="button" onClick={() => updateTripStatus(String(t.id), 'start')} className="text-xs px-2 py-1 bg-green-600 text-white rounded-full" title="Start">
              Start
            </button>
          )}
          {normalizeTripStatus(t.status) === 'IN_TRANSIT' && (
            <button type="button" onClick={() => updateTripStatus(String(t.id), 'reach')} className="text-xs px-2 py-1 bg-orange-600 text-white rounded-full" title="Mark Reached">
              Mark Reached
            </button>
          )}
          {normalizeTripStatus(t.status) === 'REACHED_DESTINATION' && (
            <button type="button" onClick={() => updateTripStatus(String(t.id), 'close')} className="text-xs px-2 py-1 bg-purple-600 text-white rounded-full" title="Close Trip">
              Close Trip
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(t);
            }}
            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 size={14} className="text-red-600" />
          </button>
        </div>
      ),
    },
  ];

  const statusTabs = [
    { key: 'all', label: 'All' },
    { key: 'planned', label: 'Planned' },
    { key: 'started', label: 'Started' },
    { key: 'in_transit', label: 'In Transit' },
    { key: 'unloading', label: 'Reached' },
    { key: 'completed', label: 'Completed' },
  ];

  return (
    <div className="space-y-5">
      <div className="page-header"><div>
        <h1 className="page-title">Trips</h1>
        <p className="page-subtitle">Track and manage vehicle trips</p>
      </div></div>

      <TabPills
        tabs={statusTabs}
        activeTab={statusFilter}
        onChange={(key) => { setStatusFilter(key); setFilters({ ...filters, page: 1 }); }}
      />

      <DataTable
        columns={columns}
        data={safeArray<Trip>(data)}
        total={data?.total || 0}
        page={filters.page}
        pageSize={filters.page_size}
        isLoading={isLoading}
        searchPlaceholder="Search trips..."
        onSearch={(q) => setFilters({ ...filters, search: q, page: 1 })}
        onPageChange={(p) => setFilters({ ...filters, page: p })}
        onSort={(key, order) => setFilters({ ...filters, sort_by: key, sort_order: order })}
        onRowClick={(t) => navigate(`/trips/${t.id}`)}
        onAdd={hasPermission('trips:create') ? () => setIsCreateOpen(true) : undefined}
        addLabel="Create Trip"
        onRefresh={() => refetch()}
        onExport={() => {}}
      />

      <ConfirmDialog
        isOpen={!!deleteId}
        title="Delete Trip"
        message="This action cannot be undone."
        confirmLabel="Delete"
        isDangerous={true}
        onConfirm={() => {
          if (!deleteId) return;
          deleteMutation.mutate(deleteId);
          setDeleteId(null);
        }}
        onCancel={() => setDeleteId(null)}
      />

      <Modal
        isOpen={!!editItem}
        onClose={() => setEditItem(null)}
        title="Edit Trip"
        size="md"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!editItem) return;
            updateMutation.mutate({
              id: editItem.id,
              payload: {
                origin: editForm.origin,
                destination: editForm.destination,
                planned_start: editForm.planned_start,
                total_distance: Number(editForm.total_distance || 0),
              },
            });
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Origin</label>
              <input className="input-field" value={editForm.origin} onChange={(e) => setEditForm((p) => ({ ...p, origin: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Destination</label>
              <input className="input-field" value={editForm.destination} onChange={(e) => setEditForm((p) => ({ ...p, destination: e.target.value }))} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Planned Start Date</label>
              <input type="date" className="input-field" value={editForm.planned_start} onChange={(e) => setEditForm((p) => ({ ...p, planned_start: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Total Distance (km)</label>
              <input type="number" className="input-field" value={editForm.total_distance} onChange={(e) => setEditForm((p) => ({ ...p, total_distance: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setEditItem(null)}>Cancel</button>
            <SubmitButton isLoading={updateMutation.isPending} label="Save Changes" />
          </div>
        </form>
      </Modal>

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create Trip" size="lg">
        <form className="space-y-4" onSubmit={(e) => {
          e.preventDefault();
          const payload = buildTripCreatePayload();
          createMutation.mutate(payload);
        }}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Job</label>
              <select
                className="input-field"
                value={createForm.job_id}
                onChange={(e) => {
                  const selectedJob = safeArray<any>((jobsData as any)?.items ?? jobsData).find((job: any) => String(job.id) === e.target.value);
                  setCreateForm((p) => ({
                    ...p,
                    job_id: e.target.value,
                    lr_id: '',
                    vehicle_id: selectedJob?.vehicle_id ? String(selectedJob.vehicle_id) : p.vehicle_id,
                    driver_id: selectedJob?.driver_id ? String(selectedJob.driver_id) : p.driver_id,
                  }));
                }}
                required
              >
                <option value="">Select job</option>
                {safeArray<any>((jobsData as any)?.items ?? jobsData).map((job: any) => (
                  <option key={job.id} value={job.id}>{job.job_number || `Job #${job.id}`}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">LR</label>
              <select className="input-field" value={createForm.lr_id} onChange={(e) => setCreateForm((p) => ({ ...p, lr_id: e.target.value }))} disabled={!selectedJobId}>
                <option value="">Select LR</option>
                {safeArray<any>((lrsData as any)?.items ?? lrsData).map((lr: any) => (
                  <option key={lr.id} value={lr.id}>{lr.lr_number || `LR #${lr.id}`}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Vehicle</label>
              <select className="input-field" value={createForm.vehicle_id} onChange={(e) => setCreateForm((p) => ({ ...p, vehicle_id: e.target.value }))} required>
                <option value="">Select vehicle</option>
                {safeArray<any>((vehiclesData as any)?.items ?? vehiclesData).map((v: any) => (
                  <option key={v.id} value={v.id}>{v.registration_number || `Vehicle #${v.id}`}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Driver</label>
              <select className="input-field" value={createForm.driver_id} onChange={(e) => setCreateForm((p) => ({ ...p, driver_id: e.target.value }))} required>
                <option value="">Select driver</option>
                {safeArray<any>((driversData as any)?.items ?? driversData).map((d: any) => (
                  <option key={d.id} value={d.id}>{d.full_name || d.first_name || `Driver #${d.id}`}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Planned Departure</label><input type="datetime-local" className="input-field" value={createForm.planned_departure} onChange={(e) => setCreateForm((p) => ({ ...p, planned_departure: e.target.value }))} required /></div>
            <div><label className="label">Planned Arrival</label><input type="datetime-local" className="input-field" value={createForm.planned_arrival} onChange={(e) => setCreateForm((p) => ({ ...p, planned_arrival: e.target.value }))} required /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Route</label>
              <select className="input-field" value={createForm.route_id} onChange={(e) => setCreateForm((p) => ({ ...p, route_id: e.target.value }))}>
                <option value="">Select route</option>
                {safeArray<any>((routesData as any)?.items ?? routesData).map((r: any) => (
                  <option key={r.id} value={r.id}>{r.route_name || `${r.origin_city || ''} - ${r.destination_city || ''}` || `Route #${r.id}`}</option>
                ))}
              </select>
            </div>
            <div><label className="label">Advance Paid</label><input type="number" min="0" step="0.01" className="input-field" value={createForm.advance_paid} onChange={(e) => setCreateForm((p) => ({ ...p, advance_paid: e.target.value }))} required /></div>
            <div><label className="label">Fuel Advance</label><input type="number" min="0" step="0.01" className="input-field" value={createForm.fuel_advance} onChange={(e) => setCreateForm((p) => ({ ...p, fuel_advance: e.target.value }))} required /></div>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setIsCreateOpen(false)}>Cancel</button>
            <SubmitButton isLoading={createMutation.isPending} label="Create Trip" loadingLabel="Creating..." disabled={!createForm.job_id || !createForm.vehicle_id || !createForm.driver_id} />
          </div>
        </form>
      </Modal>
    </div>
  );
}

