import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { clientService, jobService } from '@/services/dataService';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import DataTable, { Column } from '@/components/common/DataTable';
import { TabPills, Modal } from '@/components/common/Modal';
import { SubmitButton } from '@/components/common/SubmitButton';
import { useAuthStore } from '@/store/authStore';
import type { Job, FilterParams } from '@/types';
import { CheckCircle2, MapPin, Pencil, Send, Trash2, LayoutGrid, List } from 'lucide-react';
import { safeArray } from '@/utils/helpers';
import { exportTableToPdf } from '@/utils/pdfExport';
import { handleApiError } from '../../utils/handleApiError';
import api from '@/services/api';

const JOB_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_approval: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  on_hold: 'bg-purple-100 text-purple-700',
};

const JOB_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  on_hold: 'On Hold',
};

export default function JobsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { hasPermission } = useAuthStore();
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
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
    priority: 'normal',
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

  const handleEdit = (job: any) => {
    setEditItem(job);
    setEditForm({
      origin: job.origin_city || job.origin || '',
      destination: job.destination_city || job.destination || '',
      cargo_type: job.material_type || job.cargo_type || '',
      pickup_date: (job.pickup_date || job.expected_delivery_date || '')?.toString().slice(0, 10) || '',
      rate: String(job.agreed_rate || job.rate || ''),
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
      render: (j: any) => (
        <div>
          <p className="font-medium text-gray-900">{j.client_name || j.client?.name || `Client #${j.client_id}`}</p>
          <p className="text-[11px] text-gray-400 capitalize mt-0.5">{j.contract_type?.replace('_', ' ')}</p>
        </div>
      ),
    },
    {
      key: 'route',
      header: 'Route',
      render: (j: any) => (
        <div className="flex items-center gap-1.5 text-sm">
          <MapPin size={13} className="text-green-500 flex-shrink-0" />
          <span className="truncate max-w-[80px]">{j.origin_city || j.origin || '—'}</span>
          <span className="text-gray-300">→</span>
          <MapPin size={13} className="text-red-500 flex-shrink-0" />
          <span className="truncate max-w-[80px]">{j.destination_city || j.destination || '—'}</span>
        </div>
      ),
    },
    {
      key: 'cargo_type',
      header: 'Cargo',
      render: (j: any) => (
        <div>
          <p className="text-sm">{j.material_type || j.cargo_type || '—'}</p>
          {(j.quantity || j.weight_tons) && <p className="text-[11px] text-gray-400 mt-0.5">{j.quantity || j.weight_tons} {j.quantity_unit || 'Tons'}</p>}
        </div>
      ),
    },
    {
      key: 'pickup_date',
      header: 'Pickup',
      sortable: true,
      width: '110px',
      render: (j: any) => (
        <span className="text-sm text-gray-600">
          {(() => { const d = j.pickup_date || j.expected_delivery_date; return d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'; })()}
        </span>
      ),
    },
    {
      key: 'rate',
      header: 'Rate',
      sortable: true,
      width: '100px',
      render: (j: any) => <span className="font-semibold text-gray-900">₹{Number((j.agreed_rate || j.total_amount || j.rate || 0) ?? 0).toLocaleString('en-IN')}</span>,
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
        const status = j.status || 'draft';
        const color = JOB_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700';
        return <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${color}`}>{JOB_STATUS_LABELS[status] || status}</span>;
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
          {j.status === 'pending_approval' && (
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

  const rows = safeArray<Job>(data);

  const handleExportPdf = () => {
    exportTableToPdf({
      title: 'Jobs Report',
      fileName: `jobs-${new Date().toISOString().slice(0, 10)}.pdf`,
      rows,
      columns: [
        { header: 'Job No.', accessor: (j: any) => j.job_number },
        { header: 'Client', accessor: (j: any) => j.client_name || j.client?.name || `Client #${j.client_id}` },
        { header: 'Origin', accessor: (j: any) => j.origin_city || j.origin },
        { header: 'Destination', accessor: (j: any) => j.destination_city || j.destination },
        { header: 'Cargo', accessor: (j: any) => j.material_type || j.cargo_type },
        { header: 'Rate', accessor: (j: any) => `INR ${Number(j.agreed_rate || j.total_amount || j.rate || 0).toLocaleString('en-IN')}` },
        { header: 'Priority', accessor: (j: any) => j.priority },
        { header: 'Status', accessor: (j: any) => JOB_STATUS_LABELS[j.status] || j.status || 'Draft' },
      ],
    });
  };

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Jobs / Orders</h1>
          <p className="page-subtitle">Manage transport jobs and client orders</p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
            title="Table view"
          >
            <List size={16} />
          </button>
          <button
            onClick={() => setViewMode('kanban')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'kanban' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
            title="Kanban view"
          >
            <LayoutGrid size={16} />
          </button>
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
          { key: 'on_hold', label: 'On Hold' },
          { key: 'cancelled', label: 'Cancelled' },
        ]}
        activeTab={statusFilter}
        onChange={(key) => { setStatusFilter(key); setFilters({ ...filters, page: 1 }); }}
      />

      {viewMode === 'table' && (
      <DataTable
        columns={columns}
        data={rows}
        total={data?.total || 0}
        page={filters.page}
        pageSize={filters.page_size}
        isLoading={isLoading}
        searchPlaceholder="Search jobs..."
        onSearch={(q) => setFilters({ ...filters, search: q, page: 1 })}
        onPageChange={(p) => setFilters({ ...filters, page: p })}
        onSort={(key, order) => setFilters({ ...filters, sort_by: key, sort_order: order })}
        onRowClick={(j) => navigate(`/jobs/${j.id}`)}
        onAdd={hasPermission('jobs:create') ? () => navigate('/lr/new') : undefined}
        addLabel="Create LR"
        onRefresh={() => refetch()}
        onExport={handleExportPdf}
      />
      )}

      {/* Kanban Board View */}
      {viewMode === 'kanban' && (
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2">
          {(['draft', 'pending_approval', 'approved', 'in_progress', 'completed', 'on_hold', 'cancelled'] as const).map((status) => {
            const jobsInColumn = safeArray<Job>(data).filter((j) => j.status === status);
            const color = JOB_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700';
            return (
              <div key={status} className="flex-shrink-0 w-[260px]">
                <div className={`flex items-center gap-2 mb-2 px-3 py-2 rounded-lg ${color}`}>
                  <span className="text-xs font-bold">{JOB_STATUS_LABELS[status]}</span>
                  <span className="ml-auto text-[10px] font-bold bg-white/60 rounded-full px-1.5 py-0.5">{jobsInColumn.length}</span>
                </div>
                <div className="space-y-2 min-h-[200px]">
                  {jobsInColumn.length === 0 && (
                    <div className="text-center py-8 text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg">
                      No jobs
                    </div>
                  )}
                  {jobsInColumn.map((j: any) => (
                    <div
                      key={j.id}
                      onClick={() => navigate(`/jobs/${j.id}`)}
                      className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono text-xs font-semibold text-primary-600">{j.job_number}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                          j.priority === 'urgent' ? 'bg-red-100 text-red-700'
                          : j.priority === 'high' ? 'bg-orange-100 text-orange-700'
                          : 'bg-gray-100 text-gray-600'
                        }`}>{j.priority}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate">{j.client_name || `Client #${j.client_id}`}</p>
                      <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                        <MapPin size={10} className="text-green-500" />
                        <span className="truncate max-w-[80px]">{j.origin_city || j.origin || '—'}</span>
                        <span className="text-gray-300">→</span>
                        <span className="truncate max-w-[80px]">{j.destination_city || j.destination || '—'}</span>
                      </div>
                      {j.agreed_rate && (
                        <p className="text-xs font-semibold text-gray-700 mt-1">₹{Number(j.agreed_rate).toLocaleString('en-IN')}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
                origin_city: editForm.origin,
                destination_city: editForm.destination,
                material_type: editForm.cargo_type,
                expected_delivery_date: editForm.pickup_date,
                agreed_rate: Number(editForm.rate || 0),
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
        title={`Assign — ${assignJob?.job_number || ''}`}
        size="lg"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            assignMutation.mutate({
              vehicle_id: assignForm.vehicle_id ? Number(assignForm.vehicle_id) : undefined,
              driver_id: assignForm.driver_id ? Number(assignForm.driver_id) : undefined,
            });
          }}
        >
          {/* Job summary */}
          {assignJob && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm grid grid-cols-2 gap-2">
              <div><span className="text-gray-400">Route:</span> <span className="font-medium">{(assignJob as any).origin_city || '—'} → {(assignJob as any).destination_city || '—'}</span></div>
              <div><span className="text-gray-400">Material:</span> <span className="font-medium">{(assignJob as any).material_type || '—'}</span></div>
              <div><span className="text-gray-400">Rate:</span> <span className="font-medium">₹{Number((assignJob as any).agreed_rate || 0).toLocaleString('en-IN')}</span></div>
              <div><span className="text-gray-400">Client:</span> <span className="font-medium">{(assignJob as any).client_name || '—'}</span></div>
            </div>
          )}

          {/* Vehicle selection */}
          <div>
            <label className="label">Vehicle</label>
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {safeArray<any>((vehiclesData as any)?.items ?? vehiclesData).map((v: any) => {
                const isAvailable = (v.status || '').toLowerCase() === 'available';
                const isSelected = assignForm.vehicle_id === String(v.id);
                return (
                  <div
                    key={v.id}
                    onClick={() => isAvailable && setAssignForm(p => ({ ...p, vehicle_id: isSelected ? '' : String(v.id) }))}
                    className={`px-3 py-2 flex items-center gap-3 text-sm cursor-pointer transition-colors ${
                      isSelected ? 'bg-primary-50 border-l-2 border-l-primary-500' : isAvailable ? 'hover:bg-gray-50' : 'opacity-40 cursor-not-allowed bg-gray-50'
                    }`}
                  >
                    <div className="flex-1">
                      <span className="font-medium">{v.rc_number || v.registration_number || `Vehicle #${v.id}`}</span>
                      <span className="text-gray-400 ml-2">{v.vehicle_type || ''}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${isAvailable ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                      {(v.status || '').replace('_', ' ')}
                    </span>
                    {isSelected && <CheckCircle2 size={16} className="text-primary-600" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Driver selection */}
          <div>
            <label className="label">Driver</label>
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {safeArray<any>((driversData as any)?.items ?? driversData).map((d: any) => {
                const isAvailable = (d.status || '').toLowerCase() === 'available';
                const isSelected = assignForm.driver_id === String(d.id);
                return (
                  <div
                    key={d.id}
                    onClick={() => isAvailable && setAssignForm(p => ({ ...p, driver_id: isSelected ? '' : String(d.id) }))}
                    className={`px-3 py-2 flex items-center gap-3 text-sm cursor-pointer transition-colors ${
                      isSelected ? 'bg-primary-50 border-l-2 border-l-primary-500' : isAvailable ? 'hover:bg-gray-50' : 'opacity-40 cursor-not-allowed bg-gray-50'
                    }`}
                  >
                    <div className="flex-1">
                      <span className="font-medium">{d.name || d.full_name || `Driver #${d.id}`}</span>
                      <span className="text-gray-400 ml-2">{d.phone || ''}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${isAvailable ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                      {(d.status || '').replace('_', ' ')}
                    </span>
                    {isSelected && <CheckCircle2 size={16} className="text-primary-600" />}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setAssignJob(null)}>Cancel</button>
            <SubmitButton
              isLoading={assignMutation.isPending}
              label="Assign & Start"
              disabled={!assignForm.vehicle_id || !assignForm.driver_id}
            />
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create LR"
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
              origin_city: payload.origin.split(',').pop()?.trim() || payload.origin,
              destination_address: payload.destination,
              destination_city: payload.destination.split(',').pop()?.trim() || payload.destination,
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
            <SubmitButton isLoading={createMutation.isPending} label="Create LR" loadingLabel="Creating..." disabled={!createForm.client_id || !createForm.origin || !createForm.destination || !createForm.material_type} />
          </div>
        </form>
      </Modal>
    </div>
  );
}

