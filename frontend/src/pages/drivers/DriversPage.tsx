import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { driverService } from '@/services/dataService';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import DataTable, { Column } from '@/components/common/DataTable';
import { StatusBadge, KPICard, Modal } from '@/components/common/Modal';
import { SubmitButton } from '@/components/common/SubmitButton';
import { useAuthStore } from '@/store/authStore';
import type { Driver, DriverDashboard, FilterParams } from '@/types';
import { Star, Users, UserCheck, Truck, Clock, AlertTriangle, LayoutDashboard, Shield, Pencil, Trash2, Play } from 'lucide-react';
import { safeArray } from '@/utils/helpers';
import { handleApiError } from '../../utils/handleApiError';

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'available', label: 'Available' },
  { key: 'on_trip', label: 'On Trip' },
  { key: 'on_leave', label: 'On Leave' },
  { key: 'rest', label: 'Resting' },
  { key: 'inactive', label: 'Inactive' },
];

export default function DriversPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { hasPermission } = useAuthStore();
  const [filters, setFilters] = useState<FilterParams>({ page: 1, page_size: 20 });
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteDriver, setDeleteDriver] = useState<Driver | null>(null);
  const [editDriver, setEditDriver] = useState<Driver | null>(null);
  const [editName, setEditName] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    employee_id: '',
    full_name: '',
    phone: '',
    license_number: '',
    license_expiry: '',
  });

  const { data: dashboard } = useQuery<DriverDashboard>({
    queryKey: ['driver-dashboard'],
    queryFn: () => driverService.getDashboard(),
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['drivers', filters, statusFilter],
    queryFn: () => driverService.list({ ...filters, status: statusFilter || undefined }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Driver> }) => driverService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('Driver updated successfully.');
      setEditDriver(null);
      setEditName('');
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const createMutation = useMutation({
    mutationFn: () => driverService.create({
      employee_code: createForm.employee_id,
      first_name: createForm.full_name,
      last_name: '',
      phone: createForm.phone,
      date_of_joining: new Date().toISOString().slice(0, 10),
      licenses: [
        {
          license_number: createForm.license_number,
          license_type: 'hmv',
          expiry_date: createForm.license_expiry,
        },
      ],
      status: 'available',
      base_salary: 0,
      total_trips: 0,
      total_km: 0,
      rating: 0,
      is_active: true,
      license_type: 'HMV',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('Driver created successfully.');
      setCreateForm({
        employee_id: '',
        full_name: '',
        phone: '',
        license_number: '',
        license_expiry: '',
      });
      setIsCreateOpen(false);
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => driverService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('Driver deleted successfully.');
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => driverService.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('Driver status updated.');
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const handleEdit = (driver: Driver) => {
    setEditDriver(driver);
    setEditName(driver.full_name || driver.name || `${driver.first_name || ''} ${driver.last_name || ''}`.trim() || '');
  };

  const handleDelete = (driver: Driver) => setDeleteDriver(driver);

  const kpis = dashboard?.kpis;

  const columns: Column<Driver>[] = [
    {
      key: 'employee_id',
      header: 'Emp ID',
      sortable: true,
      render: (d) => <span className="font-mono text-sm font-medium text-primary-600">{d.employee_id || d.employee_code || d.id}</span>,
    },
    {
      key: 'full_name',
      header: 'Driver Name',
      sortable: true,
      render: (d) => {
        const fullName = d.full_name || d.name || `${d.first_name || ''} ${d.last_name || ''}`.trim() || 'Unknown';
        return (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              {d.photo_url ? (
                <img src={d.photo_url} alt="" className="w-9 h-9 rounded-full object-cover" />
              ) : (
                <span className="text-primary-700 font-semibold text-sm">{fullName.charAt(0)}</span>
              )}
            </div>
            <div>
              <p className="font-medium text-gray-900">{fullName}</p>
              <p className="text-xs text-gray-400">{d.license_type} License · {d.city}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (d) => <span className="text-sm">{d.phone}</span>,
    },
    {
      key: 'assigned_vehicle',
      header: 'Vehicle',
      render: (d) => d.assigned_vehicle
        ? <span className="font-mono text-sm text-purple-600">{d.assigned_vehicle}</span>
        : <span className="text-gray-300 text-sm">—</span>,
    },
    {
      key: 'license_expiry',
      header: 'License Expiry',
      sortable: true,
      render: (d) => {
        if (!d.license_expiry) return <span className="text-gray-400">Not set</span>;
        const exp = new Date(d.license_expiry);
        if (isNaN(exp.getTime())) return <span className="text-gray-400">Not set</span>;
        const now = new Date();
        const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const isExpired = daysLeft < 0;
        const isExpiring = daysLeft >= 0 && daysLeft <= 30;
        return (
          <span className={isExpired ? 'text-red-600 font-medium' : isExpiring ? 'text-amber-600 font-medium' : ''}>
            {exp.toLocaleDateString('en-IN')}
            {isExpired && <span className="text-xs ml-1">(expired)</span>}
            {isExpiring && <span className="text-xs ml-1">({daysLeft}d left)</span>}
          </span>
        );
      },
    },
    {
      key: 'total_trips',
      header: 'Trips',
      sortable: true,
      render: (d) => <span className="font-semibold">{d.total_trips || 0}</span>,
    },
    {
      key: 'safety_score',
      header: 'Safety',
      sortable: true,
      render: (d) => {
        const score = d.safety_score ?? 0;
        const color = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-amber-600' : 'text-red-600';
        return (
          <div className="flex items-center gap-1">
            <Shield size={13} className={color} />
            <span className={`text-sm font-medium ${color}`}>{score}</span>
          </div>
        );
      },
    },
    {
      key: 'rating',
      header: 'Rating',
      sortable: true,
      render: (d) => (
        <div className="flex items-center gap-1">
          <Star size={14} className="text-amber-400 fill-amber-400" />
          <span className="text-sm font-medium">{Number((d.rating || 0) ?? 0).toFixed(1)}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (d) => <StatusBadge status={d.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (d) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => handleEdit(d)} className="p-1.5 rounded-md hover:bg-gray-100" title="Edit">
            <Pencil size={14} className="text-gray-600" />
          </button>
          <button onClick={() => statusMutation.mutate({ id: d.id, status: d.status === 'available' ? 'on_leave' : 'available' })} className="p-1.5 rounded-md hover:bg-blue-50" title="Toggle Status">
            <Play size={14} className="text-blue-600" />
          </button>
          <button onClick={() => handleDelete(d)} className="p-1.5 rounded-md hover:bg-red-50" title="Delete">
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
          <h1 className="page-title">Drivers</h1>
          <p className="page-subtitle">Manage your driver workforce</p>
        </div>
        <button onClick={() => navigate('/drivers/dashboard')} className="btn-secondary flex items-center gap-2">
          <LayoutDashboard size={16} /> Dashboard
        </button>
      </div>

      {/* KPI Strip */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPICard title="Total" value={kpis.total_drivers} icon={<Users size={18} />} color="blue" />
          <KPICard title="Active" value={kpis.active_drivers} icon={<UserCheck size={18} />} color="green" />
          <KPICard title="On Trip" value={kpis.on_trip} icon={<Truck size={18} />} color="purple" />
          <KPICard title="Available" value={kpis.available} icon={<Clock size={18} />} color="blue" />
          <KPICard title="License Expiring" value={kpis.license_expiring_soon} icon={<AlertTriangle size={18} />} color="yellow" />
          <KPICard title="Avg Rating" value={kpis.avg_rating} icon={<Star size={18} />} color="yellow" />
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setStatusFilter(tab.key); setFilters({ ...filters, page: 1 }); }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              statusFilter === tab.key
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={safeArray<Driver>(data)}
        total={data?.total || 0}
        page={filters.page}
        pageSize={filters.page_size}
        isLoading={isLoading}
        searchPlaceholder="Search drivers by name, ID, phone, license..."
        onSearch={(q) => setFilters({ ...filters, search: q, page: 1 })}
        onPageChange={(p) => setFilters({ ...filters, page: p })}
        onSort={(key, order) => setFilters({ ...filters, sort_by: key, sort_order: order })}
        onRowClick={(d) => navigate(`/drivers/${d.id}`)}
        onAdd={hasPermission('drivers:create') ? () => setIsCreateOpen(true) : undefined}
        addLabel="Add Driver"
        onRefresh={() => refetch()}
      />

      <ConfirmDialog
        isOpen={!!deleteDriver}
        title="Delete Driver"
        message={deleteDriver ? `Delete driver ${deleteDriver.full_name || deleteDriver.name || deleteDriver.employee_id || deleteDriver.employee_code}? This action cannot be undone.` : ''}
        confirmLabel="Delete"
        isDangerous={true}
        onConfirm={() => {
          if (!deleteDriver) return;
          deleteMutation.mutate(deleteDriver.id);
          setDeleteDriver(null);
        }}
        onCancel={() => setDeleteDriver(null)}
      />

      <Modal
        isOpen={!!editDriver}
        onClose={() => { setEditDriver(null); setEditName(''); }}
        title="Edit Driver"
        size="md"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!editDriver || !editName.trim()) return;
            updateMutation.mutate({ id: editDriver.id, payload: { full_name: editName.trim() } });
          }}
        >
          <div>
            <label className="label">Employee ID</label>
            <input className="input-field" value={editDriver?.employee_id || editDriver?.employee_code || ''} disabled />
          </div>
          <div>
            <label className="label">Full Name</label>
            <input
              className="input-field"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Driver full name"
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => { setEditDriver(null); setEditName(''); }}
            >
              Cancel
            </button>
            <SubmitButton isLoading={updateMutation.isPending} label="Save Changes" />
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Driver"
        size="lg"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Employee ID</label>
              <input className="input-field" value={createForm.employee_id} onChange={(e) => setCreateForm((p) => ({ ...p, employee_id: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Full Name</label>
              <input className="input-field" value={createForm.full_name} onChange={(e) => setCreateForm((p) => ({ ...p, full_name: e.target.value }))} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Phone</label>
              <input className="input-field" value={createForm.phone} onChange={(e) => setCreateForm((p) => ({ ...p, phone: e.target.value }))} required />
            </div>
            <div>
              <label className="label">License Number</label>
              <input className="input-field" value={createForm.license_number} onChange={(e) => setCreateForm((p) => ({ ...p, license_number: e.target.value }))} required />
            </div>
          </div>
          <div>
            <label className="label">License Expiry</label>
            <input type="date" className="input-field" value={createForm.license_expiry} onChange={(e) => setCreateForm((p) => ({ ...p, license_expiry: e.target.value }))} required />
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setIsCreateOpen(false)}>Cancel</button>
            <SubmitButton
              isLoading={createMutation.isPending}
              label="Create Driver"
              loadingLabel="Creating..."
              disabled={!createForm.employee_id.trim() || !createForm.full_name.trim() || !createForm.phone.trim() || !createForm.license_number.trim() || !createForm.license_expiry}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}

