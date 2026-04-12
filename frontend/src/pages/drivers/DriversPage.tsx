import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { driverService } from '@/services/dataService';
import api from '@/services/api';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import DataTable, { Column } from '@/components/common/DataTable';
import { StatusBadge, KPICard, Modal } from '@/components/common/Modal';
import { SubmitButton } from '@/components/common/SubmitButton';
import type { Driver, DriverDashboard, FilterParams } from '@/types';
import { Star, Users, UserCheck, Truck, Clock, AlertTriangle, LayoutDashboard, Camera } from 'lucide-react';
import { safeArray } from '@/utils/helpers';
import { handleApiError } from '../../utils/handleApiError';
import { DocumentChecklist } from '@/components/documents/DocumentChecklist';
import type { ExtractionResult } from '@/components/documents/DocumentUploadWithExtraction';
import { DocAutoFill } from '@/components/documents/DocAutoFill';

// Upload driver_photo document and sync driver.photo_url + user.avatar_url via backend
async function uploadDriverPhoto(driverId: number, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('document_type', 'driver_photo');
  await api.post(`/drivers/${driverId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

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
  const [filters, setFilters] = useState<FilterParams>({ page: 1, page_size: 20 });
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteDriver, setDeleteDriver] = useState<Driver | null>(null);
  const [editDriver, setEditDriver] = useState<Driver | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const editPhotoRef = useRef<HTMLInputElement>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [createdDriverId, setCreatedDriverId] = useState<number | null>(null);
  const [createPhotoFile, setCreatePhotoFile] = useState<File | null>(null);
  const [createPhotoPreview, setCreatePhotoPreview] = useState<string | null>(null);
  const createPhotoRef = useRef<HTMLInputElement>(null);
  const [createForm, setCreateForm] = useState({
    employee_id: '',
    full_name: '',
    phone: '',
    license_number: '',
    license_expiry: '',
    security_pin: '',
  });

  const { data: dashboard } = useQuery<DriverDashboard>({
    queryKey: ['driver-dashboard'],
    queryFn: () => driverService.getDashboard(),
  });

  const { data: usersData } = useQuery({
    queryKey: ['drivers-users-catalog'],
    queryFn: () => api.get('/users', { suppressErrorToast: true } as any),
    retry: false,
    throwOnError: false,
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['drivers', filters, statusFilter],
    queryFn: () => driverService.list({ ...filters, status: statusFilter || undefined }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Driver> }) => driverService.update(id, payload),
    onSuccess: async (_, { id }) => {
      if (editPhotoFile) {
        try { await uploadDriverPhoto(id, editPhotoFile); } catch { /* non-critical */ }
      }
      qc.invalidateQueries({ queryKey: ['drivers'] });
      toast.success('Driver updated successfully.');
      setEditDriver(null);
      setEditName('');
      setEditPhotoFile(null);
      setEditPhotoPreview(null);
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const createMutation = useMutation({
    mutationFn: () => driverService.create({
      employee_id: createForm.employee_id,
      first_name: createForm.full_name,
      last_name: '',
      full_name: createForm.full_name,
      phone: createForm.phone,
      joining_date: new Date().toISOString().slice(0, 10),
      license_number: createForm.license_number,
      license_type: 'HMV',
      license_expiry: createForm.license_expiry,
      security_pin: createForm.security_pin || undefined,
      status: 'available',
      salary_base: 0,
      total_trips: 0,
      total_km: 0,
      rating: 0,
      is_active: true,
    }),
    onSuccess: async (data: any) => {
      qc.invalidateQueries({ queryKey: ['drivers'] });
      qc.invalidateQueries({ queryKey: ['admin-employees'] });
      const driverId = data?.id ?? data?.data?.id;
      const email = data?.login_email || data?.data?.login_email;
      const password = data?.login_password || data?.data?.login_password;
      if (email && password) {
        const pinMsg = createForm.security_pin ? `\nSecurity PIN: ${createForm.security_pin}` : '';
        toast.success(`Driver created!\nLogin: ${email}\nPassword: ${password}${pinMsg}`, { duration: 10000 });
      }
      if (driverId) {
        setCreatedDriverId(driverId);
        // Upload photo if selected
        if (createPhotoFile) {
          try { await uploadDriverPhoto(driverId, createPhotoFile); } catch { /* non-critical */ }
        }
        setCreateStep(2);
      } else {
        resetCreate();
      }
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

  const resetCreate = () => {
    setCreateForm({ employee_id: '', full_name: '', phone: '', license_number: '', license_expiry: '', security_pin: '' });
    setCreateStep(1);
    setCreatedDriverId(null);
    setIsCreateOpen(false);
    setCreatePhotoFile(null);
    setCreatePhotoPreview(null);
  };

  const handleDriverExtracted = (result: ExtractionResult) => {
    const d = result.data;
    setCreateForm(prev => ({
      ...prev,
      license_number: d.license_number || prev.license_number,
      full_name: (!prev.full_name && d.holder_name) ? d.holder_name : prev.full_name,
    }));
  };

  // Called by DocAutoFill inline widget (raw extraction data)
  const ddmmToISO = (dd: string): string => {
    const parts = String(dd || '').split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
    return '';
  };

  const handleDLDocAutoFill = (d: Record<string, any>) => {
    setCreateForm(prev => ({
      ...prev,
      license_number: d.license_number || prev.license_number,
      full_name: (!prev.full_name && d.holder_name) ? d.holder_name : prev.full_name,
      license_expiry: d.expiry_date ? ddmmToISO(d.expiry_date) || prev.license_expiry : prev.license_expiry,
    }));
  };

  const kpis = dashboard?.kpis;

  const normalizePhone = (value?: string) => String(value || '').replace(/\D/g, '').slice(-10);
  const normalizeStatus = (value?: string) => String(value || '').trim().toLowerCase();
  const rawDrivers = safeArray<Driver>(data);
  const allUsers = safeArray<any>(usersData);
  const driverUsers = allUsers.filter((u: any) => {
    const role = String(u?.role || '').toLowerCase();
    const roles = safeArray<string>(u?.roles).map((r) => String(r || '').toLowerCase());
    return role === 'driver' || roles.includes('driver');
  });
  const hasUsersCatalog = allUsers.length > 0;
  const driverUserIds = new Set(driverUsers.map((u: any) => Number(u?.id)).filter((id) => Number.isFinite(id) && id > 0));
  const driverUserPhones = new Set(driverUsers.map((u: any) => normalizePhone(u?.phone)).filter(Boolean));
  const driverUserEmails = new Set(driverUsers.map((u: any) => String(u?.email || '').trim().toLowerCase()).filter(Boolean));

  const visibleDrivers = hasUsersCatalog
    ? rawDrivers.filter((d: any) => {
        const userId = Number(d?.user_id);
        if (Number.isFinite(userId) && driverUserIds.has(userId)) return true;
        const phone = normalizePhone(d?.phone);
        if (phone && driverUserPhones.has(phone)) return true;
        const email = String(d?.email || '').trim().toLowerCase();
        if (email && driverUserEmails.has(email)) return true;
        return false;
      })
    : rawDrivers;

  const computedKpis = {
    total_drivers: visibleDrivers.length,
    available: visibleDrivers.filter((d) => normalizeStatus((d as any)?.status) === 'available').length,
    on_trip: visibleDrivers.filter((d) => normalizeStatus((d as any)?.status) === 'on_trip').length,
    on_leave: visibleDrivers.filter((d) => normalizeStatus((d as any)?.status) === 'on_leave').length,
    license_expiring_soon: visibleDrivers.filter((d) => {
      const expiry = (d as any)?.license_expiry;
      if (!expiry) return false;
      const dt = new Date(expiry);
      if (isNaN(dt.getTime())) return false;
      const daysLeft = Math.ceil((dt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return daysLeft >= 0 && daysLeft <= 30;
    }).length,
    avg_rating: visibleDrivers.length
      ? Number((visibleDrivers.reduce((sum, d) => sum + Number((d as any)?.rating || 0), 0) / visibleDrivers.length).toFixed(1))
      : 0,
  };
  const kpiView = hasUsersCatalog
    ? {
        ...computedKpis,
        active_drivers: computedKpis.available + computedKpis.on_trip,
      }
    : kpis;

  const columns: Column<Driver>[] = [
    {
      key: 'employee_id',
      header: 'Emp ID',
      sortable: true,
      render: (d) => <span className="font-mono text-sm font-medium text-primary-600">{d.employee_id || d.id}</span>,
    },
    {
      key: 'full_name',
      header: 'Driver Name',
      sortable: true,
      render: (d) => {
        const fullName = d.full_name || `${d.first_name || ''} ${d.last_name || ''}`.trim() || 'Unknown';
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
      key: 'status',
      header: 'Status',
      render: (d) => <StatusBadge status={d.status} />,
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
      {kpiView && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPICard title="Total" value={kpiView.total_drivers} icon={<Users size={18} />} color="blue" />
          <KPICard title="Active" value={kpiView.active_drivers} icon={<UserCheck size={18} />} color="green" />
          <KPICard title="On Trip" value={kpiView.on_trip} icon={<Truck size={18} />} color="purple" />
          <KPICard title="Available" value={kpiView.available} icon={<Clock size={18} />} color="blue" />
          <KPICard title="License Expiring" value={kpiView.license_expiring_soon} icon={<AlertTriangle size={18} />} color="yellow" />
          <KPICard title="Avg Rating" value={kpiView.avg_rating} icon={<Star size={18} />} color="yellow" />
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
        data={visibleDrivers}
        total={hasUsersCatalog ? visibleDrivers.length : (data?.total || 0)}
        page={filters.page}
        pageSize={filters.page_size}
        isLoading={isLoading}
        searchPlaceholder="Search drivers by name, ID, phone, license..."
        onSearch={(q) => setFilters({ ...filters, search: q, page: 1 })}
        onPageChange={(p) => setFilters({ ...filters, page: p })}
        onSort={(key, order) => setFilters({ ...filters, sort_by: key, sort_order: order })}
        onRowClick={(d) => navigate(`/drivers/${d.id}`)}
        onRefresh={() => refetch()}
      />

      <ConfirmDialog
        isOpen={!!deleteDriver}
        title="Delete Driver"
        message={deleteDriver ? `Delete driver ${deleteDriver.full_name || deleteDriver.employee_id}? This action cannot be undone.` : ''}
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
        onClose={() => { setEditDriver(null); setEditName(''); setEditPhotoFile(null); setEditPhotoPreview(null); }}
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
          {/* Profile Photo */}
          <div>
            <label className="label">Profile Photo</label>
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 rounded-full overflow-hidden bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                {editPhotoPreview || editDriver?.photo_url ? (
                  <img src={editPhotoPreview || editDriver?.photo_url || ''} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Camera size={22} className="text-gray-400" />
                )}
              </div>
              <div>
                <input
                  ref={editPhotoRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setEditPhotoFile(f);
                    setEditPhotoPreview(URL.createObjectURL(f));
                  }}
                />
                <button type="button" className="btn-secondary text-sm" onClick={() => editPhotoRef.current?.click()}>
                  {editPhotoPreview ? 'Change Photo' : 'Upload Photo'}
                </button>
                {editPhotoPreview && (
                  <button type="button" className="ml-2 text-xs text-red-500 hover:underline" onClick={() => { setEditPhotoFile(null); setEditPhotoPreview(null); }}>Remove</button>
                )}
              </div>
            </div>
          </div>
          <div>
            <label className="label">Employee ID</label>
            <input className="input-field" value={editDriver?.employee_id || ''} disabled />
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
        onClose={resetCreate}
        title={createStep === 1 ? 'Create Driver' : 'Upload Documents'}
        subtitle={createStep === 1 ? 'Step 1 of 2 — Driver details' : 'Step 2 of 2 — Attach compliance documents'}
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
            {/* AI Auto-fill from Driving License */}
            <DocAutoFill
              documentType="driving_license"
              entityType="driver"
              onExtracted={handleDLDocAutoFill}
            />
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
            {/* Profile Photo */}
            <div>
              <label className="label">Profile Photo <span className="text-gray-400 font-normal">(optional)</span></label>
              <div className="flex items-center gap-4">
                <div className="relative w-14 h-14 rounded-full overflow-hidden bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                  {createPhotoPreview ? (
                    <img src={createPhotoPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Camera size={20} className="text-gray-400" />
                  )}
                </div>
                <div>
                  <input
                    ref={createPhotoRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setCreatePhotoFile(f);
                      setCreatePhotoPreview(URL.createObjectURL(f));
                    }}
                  />
                  <button type="button" className="btn-secondary text-sm" onClick={() => createPhotoRef.current?.click()}>
                    {createPhotoPreview ? 'Change Photo' : 'Upload Photo'}
                  </button>
                  {createPhotoPreview && (
                    <button type="button" className="ml-2 text-xs text-red-500 hover:underline" onClick={() => { setCreatePhotoFile(null); setCreatePhotoPreview(null); }}>Remove</button>
                  )}
                </div>
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">License Expiry</label>
                <input type="date" className="input-field" value={createForm.license_expiry} onChange={(e) => setCreateForm((p) => ({ ...p, license_expiry: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Security PIN (6 digits)</label>
                <input
                  className="input-field"
                  value={createForm.security_pin}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setCreateForm((p) => ({ ...p, security_pin: v }));
                  }}
                  placeholder="e.g. 482910"
                  maxLength={6}
                  pattern="\\d{6}"
                  inputMode="numeric"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
              <button type="button" className="btn-secondary" onClick={resetCreate}>Cancel</button>
              <SubmitButton
                isLoading={createMutation.isPending}
                label="Next: Documents →"
                loadingLabel="Creating..."
                disabled={!createForm.employee_id.trim() || !createForm.full_name.trim() || !createForm.phone.trim() || !createForm.license_number.trim() || !createForm.license_expiry || createForm.security_pin.length !== 6}
              />
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <DocumentChecklist
              entityType="driver"
              entityId={createdDriverId ?? undefined}
              onExtracted={(_req, result) => handleDriverExtracted(result)}
            />
            <div className="flex justify-between items-center pt-3 border-t border-gray-100">
              <button className="btn-secondary" onClick={() => setCreateStep(1)}>← Back</button>
              <button
                className="px-5 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                onClick={() => {
                  toast.success('Driver created successfully.');
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

