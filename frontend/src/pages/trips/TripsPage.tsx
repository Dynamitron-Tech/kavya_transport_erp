import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { tripService } from '@/services/dataService';
import api from '@/services/api';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import DataTable, { Column } from '@/components/common/DataTable';
import { Modal, TabPills } from '@/components/common/Modal';
import { SubmitButton } from '@/components/common/SubmitButton';
import { useAuthStore } from '@/store/authStore';
import type { Trip, FilterParams } from '@/types';
import { MapPin, Pencil, Trash2, Truck } from 'lucide-react';
import { safeArray } from '@/utils/helpers';
import { exportTableToPdf } from '@/utils/pdfExport';
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
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<Trip | null>(null);
  const [editForm, setEditForm] = useState({
    origin: '',
    destination: '',
    planned_start: '',
    total_distance: '',
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['trips', filters, statusFilter],
    queryFn: () => tripService.list({ ...filters, status: statusFilter !== 'all' ? statusFilter : undefined }),
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
      setEditItem(null);
    },
    onError: (error: any) => handleApiError(error, 'Failed to update trip.'),
  });

  const updateTripStatus = (id: string, action: string) => {
    statusMutation.mutate({ id, action });
  };

  const vehicleRows = safeArray<any>((vehiclesData as any)?.items ?? vehiclesData);
  const driverRows = safeArray<any>((driversData as any)?.items ?? driversData);

  const getVehicleLabel = (trip: any) => {
    if (trip?.vehicle?.registration_number) return trip.vehicle.registration_number;
    if (trip?.vehicle_registration) return trip.vehicle_registration;
    const v = vehicleRows.find((row: any) => Number(row.id) === Number(trip?.vehicle_id));
    return v?.registration_number || v?.rc_number || (trip?.vehicle_id ? `#${trip.vehicle_id}` : '—');
  };

  const getDriverLabel = (trip: any) => {
    if (trip?.driver?.full_name) return trip.driver.full_name;
    if (trip?.driver_name) return trip.driver_name;
    const d = driverRows.find((row: any) => Number(row.id) === Number(trip?.driver_id));
    return d?.full_name || d?.name || [d?.first_name, d?.last_name].filter(Boolean).join(' ') || (trip?.driver_id ? `#${trip.driver_id}` : '—');
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
          <span className="text-sm">{getVehicleLabel(t)}</span>
        </div>
      ),
    },
    {
      key: 'driver',
      header: 'Driver',
      render: (t) => <span className="text-sm">{getDriverLabel(t)}</span>,
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

  const rows = safeArray<Trip>(data);

  const handleExportPdf = () => {
    exportTableToPdf({
      title: 'Trips Report',
      fileName: `trips-${new Date().toISOString().slice(0, 10)}.pdf`,
      rows,
      columns: [
        { header: 'Trip No.', accessor: (t: any) => t.trip_number },
        { header: 'Vehicle', accessor: (t: any) => getVehicleLabel(t) },
        { header: 'Driver', accessor: (t: any) => getDriverLabel(t) },
        { header: 'Origin', accessor: (t: any) => t.origin },
        { header: 'Destination', accessor: (t: any) => t.destination },
        { header: 'Start Date', accessor: (t: any) => (t.planned_start ? new Date(t.planned_start).toLocaleDateString('en-IN') : '-') },
        { header: 'Distance', accessor: (t: any) => (t.total_distance ? `${t.total_distance} km` : '-') },
        { header: 'Expenses', accessor: (t: any) => (t.total_expenses ? `INR ${Number(t.total_expenses).toLocaleString('en-IN')}` : '-') },
        { header: 'Status', accessor: (t: any) => normalizeTripStatus(t.status).replace('_', ' ') },
      ],
    });
  };

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
        data={rows}
        total={data?.total || 0}
        page={filters.page}
        pageSize={filters.page_size}
        isLoading={isLoading}
        searchPlaceholder="Search trips..."
        onSearch={(q) => setFilters({ ...filters, search: q, page: 1 })}
        onPageChange={(p) => setFilters({ ...filters, page: p })}
        onSort={(key, order) => setFilters({ ...filters, sort_by: key, sort_order: order })}
        onRowClick={(t) => navigate(`/trips/${t.id}`)}
        onAdd={hasPermission('trips:create') ? () => navigate('/trips/new') : undefined}
        addLabel="Create Trip"
        onRefresh={() => refetch()}
        onExport={handleExportPdf}
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

    </div>
  );
}

