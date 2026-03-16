import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { clientService, jobService } from '@/services/dataService';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import DataTable, { Column } from '@/components/common/DataTable';
import { StatusBadge, TabPills, Modal } from '@/components/common/Modal';
import { SubmitButton } from '@/components/common/SubmitButton';
import { useAuthStore } from '@/store/authStore';
import type { Job, FilterParams } from '@/types';
import { CheckCircle2, MapPin, Pencil, Send, Trash2 } from 'lucide-react';
import { safeArray } from '@/utils/helpers';
import { handleApiError } from '../../utils/handleApiError';
import api from '@/services/api';

const JOB_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  VEHICLE_ASSIGNED: 'bg-blue-100 text-blue-700',
  LR_CREATED: 'bg-purple-100 text-purple-700',
  TRIP_CREATED: 'bg-yellow-100 text-yellow-700',
  IN_TRANSIT: 'bg-orange-100 text-orange-700',
  DELIVERED: 'bg-green-100 text-green-700',
  INVOICED: 'bg-teal-100 text-teal-700',
};

const normalizeJobStatus = (status?: string) => {
  const value = (status || '').toLowerCase();
  if (value === 'draft' || value === 'pending_approval') return 'PENDING';
  if (value === 'approved') return 'VEHICLE_ASSIGNED';
  if (value === 'lr_created') return 'LR_CREATED';
  if (value === 'trip_created') return 'TRIP_CREATED';
  if (value === 'in_progress' || value === 'in_transit') return 'IN_TRANSIT';
  if (value === 'completed' || value === 'delivered') return 'DELIVERED';
  if (value === 'invoiced') return 'INVOICED';
  return 'PENDING';
};

export default function JobsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { hasPermission } = useAuthStore();
  const [filters, setFilters] = useState<FilterParams>({ page: 1, page_size: 20 });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<Job | null>(null);
  const [assignJob, setAssignJob] = useState<Job | null>(null);
  const [assignForm, setAssignForm] = useState({ vehicle_id: '', driver_id: '' });
  const [createForm, setCreateForm] = useState({
    client_id: '',
    origin: '',
    destination: '',
    material_type: '',
    weight_tonnes: '',
    vehicle_type_required: 'TRUCK',
    agreed_freight_amount: '',
    expected_completion_date: new Date().toISOString().slice(0, 10),
  });
  const [editForm, setEditForm] = useState({
    origin: '',
    destination: '',
    cargo_type: '',
    pickup_date: '',
    rate: '',
    priority: 'medium',
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['jobs', filters, statusFilter],
    queryFn: () => jobService.list({ ...filters, status: statusFilter !== 'all' ? statusFilter : undefined }),
  });

  const { data: clientsData } = useQuery({
    queryKey: ['jobs-create-clients'],
    queryFn: () => clientService.list({ page: 1, page_size: 500 }),
  });

  const { data: vehiclesData } = useQuery({
    queryKey: ['jobs-assign-vehicles'],
    queryFn: () => api.get('/vehicles', { params: { page: 1, limit: 100 }, suppressErrorToast: true } as any),
    retry: false,
    throwOnError: false,
  });

  const { data: driversData } = useQuery({
    queryKey: ['jobs-assign-drivers'],
    queryFn: () => api.get('/drivers', { params: { page: 1, limit: 100 }, suppressErrorToast: true } as any),
    retry: false,
    throwOnError: false,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => jobService.delete(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job deleted successfully.');
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => jobService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job updated successfully.');
      setEditItem(null);
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => jobService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job created successfully.');
      setIsCreateOpen(false);
      setCreateForm({
        client_id: '',
        origin: '',
        destination: '',
        material_type: '',
        weight_tonnes: '',
        vehicle_type_required: 'TRUCK',
        agreed_freight_amount: '',
        expected_completion_date: new Date().toISOString().slice(0, 10),
      });
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const submitMutation = useMutation({
    mutationFn: (id: number) => jobService.submitForApproval(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job submitted for approval.');
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => jobService.approve(id, { action: 'approve' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job approved successfully.');
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const assignMutation = useMutation({
    mutationFn: (payload: any) => api.put(`/jobs/${assignJob?.id}/assign`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Vehicle and driver assigned');
      setAssignJob(null);
      setAssignForm({ vehicle_id: '', driver_id: '' });
    },
    onError: (error) => {
      handleApiError(error, 'Assign failed');
    },
  });

  const handleDelete = (job: Job) => setDeleteId(String(job.id));

  const handleEdit = (job: Job) => {
    setEditItem(job);
    setEditForm({
      origin: job.origin || '',
      destination: job.destination || '',
      cargo_type: job.cargo_type || '',
      pickup_date: job.pickup_date?.toString().slice(0, 10) || '',
      rate: String(job.rate || ''),
      priority: job.priority || 'medium',
    });
  };

  const columns: Column<Job>[] = [
    {
      key: 'job_number',
      header: 'Job No.',
      sortable: true,
      width: '120px',
      render: (j) => <span className="font-mono text-sm font-semibold text-primary-600">{j.job_number}</span>,
    },
    {
      key: 'client',
      header: 'Client',
      render: (j) => (
        <div>
          <p className="font-medium text-gray-900">{j.client?.name || `Client #${j.client_id}`}</p>
          <p className="text-[11px] text-gray-400 capitalize mt-0.5">{j.contract_type?.replace('_', ' ')}</p>
        </div>
      ),
    },
    {
      key: 'route',
      header: 'Route',
      render: (j) => (
        <div className="flex items-center gap-1.5 text-sm">
          <MapPin size={13} className="text-green-500 flex-shrink-0" />
          <span className="truncate max-w-[80px]">{j.origin}</span>
          <span className="text-gray-300">→</span>
          <MapPin size={13} className="text-red-500 flex-shrink-0" />
          <span className="truncate max-w-[80px]">{j.destination}</span>
        </div>
      ),
    },
    {
      key: 'cargo_type',
      header: 'Cargo',
      render: (j) => (
        <div>
          <p className="text-sm">{j.cargo_type}</p>
          {j.weight_tons && <p className="text-[11px] text-gray-400 mt-0.5">{j.weight_tons} Tons</p>}
        </div>
      ),
    },
    {
      key: 'pickup_date',
      header: 'Pickup',
      sortable: true,
      width: '110px',
      render: (j) => (
        <span className="text-sm text-gray-600">
          {new Date(j.pickup_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
        </span>
      ),
    },
    {
      key: 'rate',
      header: 'Rate',
      sortable: true,
      width: '100px',
      render: (j) => <span className="font-semibold text-gray-900">₹{Number((j.rate || 0) ?? 0).toLocaleString('en-IN')}</span>,
    },
    {
      key: 'priority',
      header: 'Priority',
      width: '90px',
      render: (j) => {
        const colors: Record<string, { bg: string; text: string; ring: string }> = {
          urgent: { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-600/20' },
          high: { bg: 'bg-orange-50', text: 'text-orange-700', ring: 'ring-orange-600/20' },
          medium: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-600/20' },
          low: { bg: 'bg-gray-50', text: 'text-gray-600', ring: 'ring-gray-500/20' },
        };
        const c = colors[j.priority] || colors.medium;
        return (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${c.bg} ${c.text} ${c.ring}`}>
            {j.priority}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      width: '130px',
      render: (j) => {
        const normalized = normalizeJobStatus(j.status);
        const color = JOB_STATUS_COLORS[normalized] || 'bg-gray-100 text-gray-700';
        return <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${color}`}>{normalized.replace('_', ' ')}</span>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (j) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(j);
            }}
            className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit"
          >
            <Pencil size={14} className="text-gray-600" />
          </button>
          {j.status === 'draft' && (
            <button onClick={() => submitMutation.mutate(j.id)} className="p-1.5 rounded-md hover:bg-blue-50" title="Submit">
              <Send size={14} className="text-blue-600" />
            </button>
          )}
          {normalizeJobStatus(j.status) === 'PENDING' && (
            <button type="button" onClick={() => setAssignJob(j)} className="text-xs px-2 py-1 bg-blue-600 text-white rounded-full hover:bg-blue-700" title="Assign">
              Assign
            </button>
          )}
          {j.status === 'pending_approval' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                approveMutation.mutate(j.id);
              }}
              className="p-1.5 rounded-md hover:bg-green-50"
              title="Approve"
            >
              <CheckCircle2 size={14} className="text-green-600" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(j);
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

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Jobs / Orders</h1>
          <p className="page-subtitle">Manage transport jobs and client orders</p>
        </div>
      </div>

      <TabPills
        tabs={[
          { key: 'all', label: 'All Jobs' },
          { key: 'draft', label: 'Draft' },
          { key: 'pending_approval', label: 'Pending' },
          { key: 'approved', label: 'Approved' },
          { key: 'in_progress', label: 'In Progress' },
          { key: 'completed', label: 'Completed' },
        ]}
        activeTab={statusFilter}
        onChange={(key) => { setStatusFilter(key); setFilters({ ...filters, page: 1 }); }}
      />

      <DataTable
        columns={columns}
        data={safeArray<Job>(data)}
        total={data?.total || 0}
        page={filters.page}
        pageSize={filters.page_size}
        isLoading={isLoading}
        searchPlaceholder="Search jobs..."
        onSearch={(q) => setFilters({ ...filters, search: q, page: 1 })}
        onPageChange={(p) => setFilters({ ...filters, page: p })}
        onSort={(key, order) => setFilters({ ...filters, sort_by: key, sort_order: order })}
        onRowClick={(j) => navigate(`/jobs/${j.id}`)}
        onAdd={hasPermission('jobs:create') ? () => setIsCreateOpen(true) : undefined}
        addLabel="Create Job"
        onRefresh={() => refetch()}
        onExport={() => {}}
      />

      <ConfirmDialog
        isOpen={!!deleteId}
        title="Delete Job"
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
        title="Edit Job"
        size="lg"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!editItem) return;
            editMutation.mutate({
              id: editItem.id,
              payload: {
                origin: editForm.origin,
                destination: editForm.destination,
                cargo_type: editForm.cargo_type,
                pickup_date: editForm.pickup_date,
                rate: Number(editForm.rate || 0),
                priority: editForm.priority,
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
              <label className="label">Cargo Type</label>
              <input className="input-field" value={editForm.cargo_type} onChange={(e) => setEditForm((p) => ({ ...p, cargo_type: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Pickup Date</label>
              <input type="date" className="input-field" value={editForm.pickup_date} onChange={(e) => setEditForm((p) => ({ ...p, pickup_date: e.target.value }))} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Rate</label>
              <input type="number" className="input-field" value={editForm.rate} onChange={(e) => setEditForm((p) => ({ ...p, rate: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="input-field" value={editForm.priority} onChange={(e) => setEditForm((p) => ({ ...p, priority: e.target.value }))}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setEditItem(null)}>Cancel</button>
            <SubmitButton isLoading={editMutation.isPending} label="Save Changes" />
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!assignJob}
        onClose={() => setAssignJob(null)}
        title="Assign Vehicle & Driver"
        size="md"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            assignMutation.mutate({
              vehicle_id: Number(assignForm.vehicle_id),
              driver_id: Number(assignForm.driver_id),
            });
          }}
        >
          <div>
            <label className="label">Vehicle</label>
            <select
              className="input-field"
              value={assignForm.vehicle_id}
              onChange={(e) => setAssignForm((p) => ({ ...p, vehicle_id: e.target.value }))}
              required
            >
              <option value="">Select Vehicle</option>
              {safeArray<any>((vehiclesData as any)?.items ?? vehiclesData).map((v: any) => (
                <option key={v.id} value={v.id}>{v.rc_number || v.registration_number || `Vehicle #${v.id}`} - {v.vehicle_type || 'NA'}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Driver</label>
            <select
              className="input-field"
              value={assignForm.driver_id}
              onChange={(e) => setAssignForm((p) => ({ ...p, driver_id: e.target.value }))}
              required
            >
              <option value="">Select Driver</option>
              {safeArray<any>((driversData as any)?.items ?? driversData).map((d: any) => (
                <option key={d.id} value={d.id}>{d.name || d.full_name || `Driver #${d.id}`}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setAssignJob(null)}>Cancel</button>
            <SubmitButton isLoading={assignMutation.isPending} label="Assign" />
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Job"
        size="lg"
      >
        {/** Keep create fields aligned with required backend create contract. */}
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const payload = {
              client_id: Number(createForm.client_id),
              origin: createForm.origin,
              destination: createForm.destination,
              material_type: createForm.material_type || 'GENERAL',
              weight_tonnes: Number(createForm.weight_tonnes) || 0,
              vehicle_type_required: createForm.vehicle_type_required || 'TRUCK',
              agreed_freight_amount: Number(createForm.agreed_freight_amount) || 0,
              expected_completion_date: createForm.expected_completion_date || null,
            };

            createMutation.mutate({
              job_date: new Date().toISOString().slice(0, 10),
              client_id: payload.client_id,
              origin_address: payload.origin,
              origin_city: payload.origin,
              destination_address: payload.destination,
              destination_city: payload.destination,
              material_type: payload.material_type,
              quantity: payload.weight_tonnes,
              quantity_unit: 'tonnes',
              vehicle_type_required: payload.vehicle_type_required,
              agreed_rate: payload.agreed_freight_amount,
              expected_delivery_date: payload.expected_completion_date ? `${payload.expected_completion_date}T00:00:00` : null,
              rate_type: 'per_trip',
              num_vehicles_required: 1,
            });
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Client</label>
              <select className="input-field" value={createForm.client_id} onChange={(e) => setCreateForm((p) => ({ ...p, client_id: e.target.value }))} required>
                <option value="">Select client</option>
                {safeArray<any>((clientsData as any)?.items ?? clientsData).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name || `Client #${c.id}`}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Origin</label>
              <input className="input-field" value={createForm.origin} onChange={(e) => setCreateForm((p) => ({ ...p, origin: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Destination</label>
              <input className="input-field" value={createForm.destination} onChange={(e) => setCreateForm((p) => ({ ...p, destination: e.target.value }))} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Material Type</label>
              <input className="input-field" value={createForm.material_type} onChange={(e) => setCreateForm((p) => ({ ...p, material_type: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Weight (Tonnes)</label>
              <input type="number" min="0" step="0.01" className="input-field" value={createForm.weight_tonnes} onChange={(e) => setCreateForm((p) => ({ ...p, weight_tonnes: e.target.value }))} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Vehicle Type Required</label>
              <select className="input-field" value={createForm.vehicle_type_required} onChange={(e) => setCreateForm((p) => ({ ...p, vehicle_type_required: e.target.value }))}>
                <option value="TRUCK">TRUCK</option>
                <option value="MINI_TRUCK">MINI_TRUCK</option>
                <option value="CONTAINER">CONTAINER</option>
                <option value="TANKER">TANKER</option>
                <option value="TRAILER">TRAILER</option>
              </select>
            </div>
            <div>
              <label className="label">Agreed Freight Amount</label>
              <input type="number" min="0" step="0.01" className="input-field" value={createForm.agreed_freight_amount} onChange={(e) => setCreateForm((p) => ({ ...p, agreed_freight_amount: e.target.value }))} required />
            </div>
          </div>
          <div>
            <label className="label">Expected Completion Date</label>
            <input type="date" className="input-field" value={createForm.expected_completion_date} onChange={(e) => setCreateForm((p) => ({ ...p, expected_completion_date: e.target.value }))} required />
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setIsCreateOpen(false)}>Cancel</button>
            <SubmitButton isLoading={createMutation.isPending} label="Create Job" loadingLabel="Creating..." disabled={!createForm.client_id || !createForm.origin || !createForm.destination || !createForm.material_type} />
          </div>
        </form>
      </Modal>
    </div>
  );
}

