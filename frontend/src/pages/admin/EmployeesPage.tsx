import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Search, Plus, Shield, X, Trash2, Mail, Lock, Phone, User, BadgeCheck, Eye, EyeOff, Pencil, Upload, ExternalLink, FileText } from 'lucide-react';
import DataTable, { Column } from '@/components/common/DataTable';
import { KPICard, StatusBadge } from '@/components/common/Modal';
import { DocAutoFill } from '@/components/documents/DocAutoFill';
import api from '@/services/api';
import { safeArray } from '@/utils/helpers';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

interface Employee {
  id: number;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  avatar_url?: string;
  roles: string[];
  role: string;
  status: string;
  joined_date: string;
  date_of_birth?: string;
  gender?: string;
  address?: string;
  joining_date?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  bank_account_holder?: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  account_type?: string;
  upi_id?: string;
  salary_amount?: string;
  pay_type?: string;
  aadhaar_file_url?: string;
  aadhaar_file_name?: string;
  dl_file_url?: string;
  dl_file_name?: string;
  dl_number?: string;
  dl_issue_date?: string;
  dl_expiry_date?: string;
}

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin', description: 'Full system access', color: 'bg-red-50 border-red-200 text-red-700' },
  { value: 'manager', label: 'Manager', description: 'Operations & team management', color: 'bg-blue-50 border-blue-200 text-blue-700' },
  { value: 'fleet_manager', label: 'Fleet Manager', description: 'Vehicle & driver oversight', color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
  { value: 'accountant', label: 'Accountant', description: 'Finance & billing access', color: 'bg-green-50 border-green-200 text-green-700' },
  { value: 'project_associate', label: 'Project Associate', description: 'Job & trip coordination', color: 'bg-amber-50 border-amber-200 text-amber-700' },
  { value: 'driver', label: 'Driver', description: 'Trip execution & mobile app', color: 'bg-purple-50 border-purple-200 text-purple-700' },
  { value: 'pump_operator', label: 'Pump Operator', description: 'Fuel dispensing & stock management', color: 'bg-orange-50 border-orange-200 text-orange-700' },
] as const;

export default function EmployeesPage() {
  const authUser = useAuthStore((s) => s.user);
  const isAdmin = Boolean(authUser?.roles?.includes('admin'));
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
    role_names: ['manager'] as string[],
    // Extended fields
    dob: '',
    joining_date: '',
    gender: 'male',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    salary_amount: '',
    pay_type: 'monthly',
    bank_account_holder: '',
    bank_name: '',
    account_number: '',
    confirm_account_number: '',
    ifsc_code: '',
    account_type: '',
    upi_id: '',
    aadhaar_file_url: '',
    aadhaar_file_name: '',
    dl_file_url: '',
    dl_file_name: '',
    dl_number: '',
    dl_issue_date: '',
    dl_expiry_date: '',
  });
  const [editForm, setEditForm] = useState({
    id: 0,
    first_name: '',
    last_name: '',
    phone: '',
    role_name: 'manager',
    is_active: true,
    avatar_url: '',
    password: '',
    date_of_birth: '',
    joining_date: '',
    gender: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    bank_account_holder: '',
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    account_type: '',
    upi_id: '',
    aadhaar_file_url: '',
    aadhaar_file_name: '',
    dl_file_url: '',
    dl_file_name: '',
    dl_number: '',
    dl_issue_date: '',
    dl_expiry_date: '',
  });
  const qc = useQueryClient();

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  /** Convert DD/MM/YYYY or DD-MM-YYYY to YYYY-MM-DD for <input type="date"> */
  const toISODate = (v?: string | null): string => {
    if (!v) return '';
    const s = v.trim();
    // Already ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // DD/MM/YYYY or DD-MM-YYYY
    const m = s.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    return s;
  };

  const openEditModal = (employee: Employee) => {
    setEditForm({
      id: employee.id,
      first_name: employee.first_name,
      last_name: employee.last_name,
      phone: employee.phone === '-' ? '' : employee.phone,
      role_name: employee.role || 'manager',
      is_active: employee.status === 'active',
      avatar_url: employee.avatar_url || '',
      password: '',
      date_of_birth: employee.date_of_birth || '',
      joining_date: employee.joining_date || '',
      gender: employee.gender || '',
      address: employee.address || '',
      emergency_contact_name: employee.emergency_contact_name || '',
      emergency_contact_phone: employee.emergency_contact_phone || '',
      bank_account_holder: employee.bank_account_holder || '',
      bank_name: employee.bank_name || '',
      account_number: employee.account_number || '',
      ifsc_code: employee.ifsc_code || '',
      account_type: employee.account_type || '',
      upi_id: employee.upi_id || '',
      aadhaar_file_url: employee.aadhaar_file_url || '',
      aadhaar_file_name: employee.aadhaar_file_name || '',
      dl_file_url: employee.dl_file_url || '',
      dl_file_name: employee.dl_file_name || '',
      dl_number: employee.dl_number || '',
      dl_issue_date: employee.dl_issue_date || '',
      dl_expiry_date: employee.dl_expiry_date || '',
    });
    setShowEditPassword(false);
    setIsEditOpen(true);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['admin-employees', search],
    queryFn: async () => {
      const res = await api.get('/users', { params: { search: search || undefined } });
      return res;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return api.post('/users', {
        email: createForm.email,
        password: createForm.password,
        first_name: createForm.first_name,
        last_name: createForm.last_name || undefined,
        phone: createForm.phone || undefined,
        role_names: createForm.role_names,
        date_of_birth: createForm.dob || undefined,
        joining_date: createForm.joining_date || undefined,
        gender: createForm.gender || undefined,
        address: createForm.address || undefined,
        emergency_contact_name: createForm.emergency_contact_name || undefined,
        emergency_contact_phone: createForm.emergency_contact_phone || undefined,
        bank_account_holder: createForm.bank_account_holder || undefined,
        bank_name: createForm.bank_name || undefined,
        account_number: createForm.account_number || undefined,
        ifsc_code: createForm.ifsc_code || undefined,
        account_type: createForm.account_type || undefined,
        upi_id: createForm.upi_id || undefined,
        salary_amount: createForm.salary_amount || undefined,
        pay_type: createForm.pay_type || undefined,
        aadhaar_file_url: createForm.aadhaar_file_url || undefined,
        aadhaar_file_name: createForm.aadhaar_file_name || undefined,
        dl_file_url: createForm.dl_file_url || undefined,
        dl_file_name: createForm.dl_file_name || undefined,
        dl_number: createForm.dl_number || undefined,
        dl_issue_date: createForm.dl_issue_date || undefined,
        dl_expiry_date: createForm.dl_expiry_date || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-employees'] });
      qc.invalidateQueries({ queryKey: ['jobs-assign-drivers'] });
      qc.invalidateQueries({ queryKey: ['trips-create-drivers'] });
      qc.invalidateQueries({ queryKey: ['trip-lookup-drivers'] });
      qc.invalidateQueries({ queryKey: ['lr-lookup-drivers'] });
      toast.success('Employee created successfully');
      setIsCreateOpen(false);
      setShowPassword(false);
      setCreateForm({ email: '', password: '', first_name: '', last_name: '', phone: '', role_names: ['manager'], dob: '', joining_date: '', gender: 'male', address: '', emergency_contact_name: '', emergency_contact_phone: '', salary_amount: '', pay_type: 'monthly', bank_account_holder: '', bank_name: '', account_number: '', confirm_account_number: '', ifsc_code: '', account_type: '', upi_id: '', aadhaar_file_url: '', aadhaar_file_name: '', dl_file_url: '', dl_file_name: '', dl_number: '', dl_issue_date: '', dl_expiry_date: '' });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to create employee';
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return api.delete(`/users/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-employees'] });
      qc.invalidateQueries({ queryKey: ['jobs-assign-drivers'] });
      qc.invalidateQueries({ queryKey: ['trips-create-drivers'] });
      qc.invalidateQueries({ queryKey: ['trip-lookup-drivers'] });
      qc.invalidateQueries({ queryKey: ['lr-lookup-drivers'] });
      toast.success('Employee deleted successfully');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to delete employee';
      toast.error(msg);
    },
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {
        first_name: editForm.first_name,
        last_name: editForm.last_name || null,
        phone: editForm.phone || null,
        role_names: [editForm.role_name],
        is_active: editForm.is_active,
        avatar_url: editForm.avatar_url || null,
        date_of_birth: editForm.date_of_birth || null,
        joining_date: editForm.joining_date || null,
        gender: editForm.gender || null,
        address: editForm.address || null,
        emergency_contact_name: editForm.emergency_contact_name || null,
        emergency_contact_phone: editForm.emergency_contact_phone || null,
        bank_account_holder: editForm.bank_account_holder || null,
        bank_name: editForm.bank_name || null,
        account_number: editForm.account_number || null,
        ifsc_code: editForm.ifsc_code || null,
        account_type: editForm.account_type || null,
        upi_id: editForm.upi_id || null,
        aadhaar_file_url: editForm.aadhaar_file_url || null,
        aadhaar_file_name: editForm.aadhaar_file_name || null,
        dl_file_url: editForm.dl_file_url || null,
        dl_file_name: editForm.dl_file_name || null,
        dl_number: editForm.dl_number || null,
        dl_issue_date: editForm.dl_issue_date || null,
        dl_expiry_date: editForm.dl_expiry_date || null,
      };
      const trimmedPassword = editForm.password.trim();
      if (isAdmin && trimmedPassword) {
        payload.password = trimmedPassword;
      }
      return api.put(`/users/${editForm.id}`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-employees'] });
      qc.invalidateQueries({ queryKey: ['jobs-assign-drivers'] });
      qc.invalidateQueries({ queryKey: ['trips-create-drivers'] });
      qc.invalidateQueries({ queryKey: ['trip-lookup-drivers'] });
      qc.invalidateQueries({ queryKey: ['lr-lookup-drivers'] });
      toast.success('Employee updated successfully');
      setIsEditOpen(false);
      setShowEditPassword(false);
      setSelectedEmployee(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to update employee';
      toast.error(msg);
    },
  });

  const employees: Employee[] = safeArray(data).map((u: any) => ({
    id: u.id,
    name: u.full_name || u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
    first_name: u.first_name || '',
    last_name: u.last_name || '',
    email: u.email,
    phone: u.phone || '-',
    avatar_url: u.avatar_url || undefined,
    roles: safeArray(u.roles),
    role: u.role || (u.roles && u.roles[0]) || 'user',
    status: u.is_active === false ? 'inactive' : 'active',
    joined_date: u.created_at || '-',
    date_of_birth: u.date_of_birth || undefined,
    gender: u.gender || undefined,
    address: u.address || undefined,
    joining_date: u.joining_date || undefined,
    emergency_contact_name: u.emergency_contact_name || undefined,
    emergency_contact_phone: u.emergency_contact_phone || undefined,
    bank_account_holder: u.bank_account_holder || undefined,
    bank_name: u.bank_name || undefined,
    account_number: u.account_number || undefined,
    ifsc_code: u.ifsc_code || undefined,
    account_type: u.account_type || undefined,
    upi_id: u.upi_id || undefined,
    salary_amount: u.salary_amount || undefined,
    pay_type: u.pay_type || undefined,
    aadhaar_file_url: u.aadhaar_file_url || undefined,
    aadhaar_file_name: u.aadhaar_file_name || undefined,
  }));

  const formatJoinedDate = (value: string) => {
    if (!value || value === '-') return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' });
  };

  const columns: Column<Employee>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (e) => (
        <div className="flex items-center gap-3">
          {e.avatar_url ? (
            <img src={e.avatar_url} alt={e.name} className="w-8 h-8 rounded-full object-cover border border-gray-200" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-sm font-medium text-blue-600">{e.name.charAt(0)}</span>
            </div>
          )}
          <div>
            <p className="font-medium text-gray-900">{e.name}</p>
            <p className="text-xs text-gray-500">{e.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', render: (e) => <span className="text-sm">{e.phone}</span> },
    { key: 'role', header: 'Role', render: (e) => <StatusBadge status={e.role} /> },
    { key: 'status', header: 'Status', render: (e) => <StatusBadge status={e.status} /> },
    {
      key: 'actions',
      header: 'Actions',
      render: (e) => (
        <div className="inline-flex items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm"
            onClick={(ev) => {
              ev.stopPropagation();
              openEditModal(e);
            }}
            title="Edit employee"
          >
            <Pencil size={14} /> Edit
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 text-sm"
            onClick={(ev) => {
              ev.stopPropagation();
              if (deleteMutation.isPending) return;
              const ok = window.confirm(`Delete employee \"${e.name}\"?`);
              if (!ok) return;
              deleteMutation.mutate(e.id);
            }}
            disabled={deleteMutation.isPending}
            title="Delete employee"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="page-subtitle">Manage all system users and employees</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setIsCreateOpen(true)}>
          <Plus size={16} /> Add Employee
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard title="Total Employees" value={employees.length} icon={<Users className="w-5 h-5" />} color="blue" />
        <KPICard title="Active" value={employees.filter(e => e.status === 'active').length} icon={<Shield className="w-5 h-5" />} color="green" />
        <KPICard title="Inactive" value={employees.filter(e => e.status === 'inactive').length} icon={<Users className="w-5 h-5" />} color="gray" />
      </div>

      <div className="card">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search employees..."
              className="input pl-10 w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <DataTable
          columns={columns}
          data={employees}
          isLoading={isLoading}
          emptyMessage="No employees found"
          onRowClick={(employee) => setSelectedEmployee(employee)}
        />
      </div>

      {/* Employee Detail Modal */}
      {selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="relative bg-gradient-to-r from-slate-700 to-slate-900 px-6 py-5 shrink-0">
              <div className="flex items-center gap-4">
                {selectedEmployee.avatar_url ? (
                  <img src={selectedEmployee.avatar_url} alt={selectedEmployee.name} className="w-14 h-14 rounded-2xl object-cover border-2 border-white/40" />
                ) : (
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center border-2 border-white/30">
                    <span className="text-2xl font-bold text-white">{selectedEmployee.name.charAt(0).toUpperCase()}</span>
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedEmployee.first_name} {selectedEmployee.last_name}</h2>
                  <p className="text-slate-300 text-sm mt-0.5">{selectedEmployee.email}</p>
                  <div className="mt-1.5"><StatusBadge status={selectedEmployee.status} /></div>
                </div>
              </div>
              <button
                onClick={() => setSelectedEmployee(null)}
                className="absolute top-4 right-4 p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X size={18} className="text-white" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-6 space-y-6">

              {/* Section: Personal Information */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Personal Information</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">First Name</p>
                    <p className="text-sm font-semibold text-slate-900">{selectedEmployee.first_name || '—'}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Last Name</p>
                    <p className="text-sm font-semibold text-slate-900">{selectedEmployee.last_name || '—'}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Date of Birth</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {selectedEmployee.date_of_birth ? formatJoinedDate(selectedEmployee.date_of_birth) : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Gender</p>
                    <p className="text-sm font-semibold text-slate-900 capitalize">{selectedEmployee.gender || '—'}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Date of Joining</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {selectedEmployee.joining_date ? formatJoinedDate(selectedEmployee.joining_date) : formatJoinedDate(selectedEmployee.joined_date)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Employee ID</p>
                    <p className="text-sm font-semibold text-slate-900">EMP-{String(selectedEmployee.id).padStart(4, '0')}</p>
                  </div>
                </div>
                {/* Address full width */}
                <div className="rounded-xl bg-slate-50 p-4 mt-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Address</p>
                  <p className="text-sm font-semibold text-slate-900">{selectedEmployee.address || '—'}</p>
                </div>
              </div>

              {/* Section: Contact Details */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Contact Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Email</p>
                    <p className="text-sm font-semibold text-slate-900 break-all">{selectedEmployee.email || '—'}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Phone</p>
                    <p className="text-sm font-semibold text-slate-900">{selectedEmployee.phone || '—'}</p>
                  </div>
                </div>
                {/* Emergency Contact */}
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-3">Emergency Contact</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Contact Name</p>
                      <p className="text-sm font-semibold text-slate-900">{selectedEmployee.emergency_contact_name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Contact Phone</p>
                      <p className="text-sm font-semibold text-slate-900">{selectedEmployee.emergency_contact_phone || '—'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: Role & Account */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Role & Account</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Role</p>
                    <StatusBadge status={selectedEmployee.role} />
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Status</p>
                    <StatusBadge status={selectedEmployee.status} />
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4 col-span-2">
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Account Created</p>
                    <p className="text-sm font-semibold text-slate-900">{formatJoinedDate(selectedEmployee.joined_date)}</p>
                  </div>
                </div>
              </div>

              {/* Section: Bank Details */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Bank Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Account Holder</p>
                    <p className="text-sm font-semibold text-slate-900">{selectedEmployee.bank_account_holder || '—'}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Bank Name</p>
                    <p className="text-sm font-semibold text-slate-900">{selectedEmployee.bank_name || '—'}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Account Number</p>
                    <p className="text-sm font-semibold text-slate-900">{selectedEmployee.account_number || '—'}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">IFSC Code</p>
                    <p className="text-sm font-semibold text-slate-900">{selectedEmployee.ifsc_code || '—'}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Account Type</p>
                    <p className="text-sm font-semibold text-slate-900 capitalize">{selectedEmployee.account_type || '—'}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">UPI ID</p>
                    <p className="text-sm font-semibold text-slate-900">{selectedEmployee.upi_id || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Section: Aadhaar Document */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Aadhaar Document</p>
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                  {selectedEmployee.aadhaar_file_url ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Uploaded File</p>
                          <p className="text-sm font-semibold text-slate-900 break-all">{selectedEmployee.aadhaar_file_name || 'aadhaar-file'}</p>
                        </div>
                        <a
                          href={selectedEmployee.aadhaar_file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100"
                        >
                          <ExternalLink size={14} /> View File
                        </a>
                      </div>
                      {selectedEmployee.aadhaar_file_url.startsWith('data:image') && (
                        <img src={selectedEmployee.aadhaar_file_url} alt="Aadhaar" className="w-full max-h-64 object-contain rounded-lg border border-slate-200 bg-white" />
                      )}
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-slate-900">—</p>
                  )}
                </div>
              </div>

              {/* Section: Driving License */}
              {selectedEmployee.roles?.some((r: string) => r.toLowerCase() === 'driver') && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Driving License</p>
                  <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
                    {selectedEmployee.dl_file_url ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Uploaded File</p>
                            <p className="text-sm font-semibold text-slate-900 break-all">{selectedEmployee.dl_file_name || 'dl-file'}</p>
                          </div>
                          <a
                            href={selectedEmployee.dl_file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100"
                          >
                            <ExternalLink size={14} /> View File
                          </a>
                        </div>
                        {selectedEmployee.dl_file_url.startsWith('data:image') && (
                          <img src={selectedEmployee.dl_file_url} alt="Driving License" className="w-full max-h-64 object-contain rounded-lg border border-slate-200 bg-white" />
                        )}
                        <div className="grid grid-cols-3 gap-3 pt-2">
                          <div className="rounded-lg bg-white p-3 border border-slate-100">
                            <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">License Number</p>
                            <p className="text-sm font-semibold text-slate-900">{selectedEmployee.dl_number || '—'}</p>
                          </div>
                          <div className="rounded-lg bg-white p-3 border border-slate-100">
                            <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Issue Date</p>
                            <p className="text-sm font-semibold text-slate-900">{selectedEmployee.dl_issue_date ? new Date(selectedEmployee.dl_issue_date).toLocaleDateString('en-IN') : '—'}</p>
                          </div>
                          <div className="rounded-lg bg-white p-3 border border-slate-100">
                            <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Expiry Date</p>
                            <p className="text-sm font-semibold text-slate-900">{selectedEmployee.dl_expiry_date ? new Date(selectedEmployee.dl_expiry_date).toLocaleDateString('en-IN') : '—'}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm font-semibold text-slate-900">—</p>
                    )}
                  </div>
                </div>
              )}

            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                className="px-4 py-2.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                onClick={() => openEditModal(selectedEmployee)}
              >
                Edit
              </button>
              <button
                type="button"
                className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                onClick={() => setSelectedEmployee(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
            <div className="relative bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Pencil className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Edit Employee</h2>
                  <p className="text-emerald-100 text-sm">Update profile, role and status</p>
                </div>
              </div>
              <button
                onClick={() => { setIsEditOpen(false); setShowEditPassword(false); }}
                className="absolute top-4 right-4 p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X size={18} className="text-white" />
              </button>
            </div>

            <form
              className="overflow-y-auto flex-1 px-6 py-5 space-y-5"
              onSubmit={(e) => { e.preventDefault(); editMutation.mutate(); }}
            >
              {/* Avatar */}
              <div className="flex items-center gap-4">
                {editForm.avatar_url ? (
                  <img src={editForm.avatar_url} alt="Avatar" className="w-14 h-14 rounded-full object-cover border border-gray-200" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-semibold text-lg">
                    {(editForm.first_name || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Profile Photo</label>
                  <input type="file" accept="image/*" className="input w-full"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const dataUrl = await fileToDataUrl(file);
                      setEditForm((p) => ({ ...p, avatar_url: dataUrl }));
                    }} />
                </div>
              </div>

              {/* Personal Information */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-600">Personal Information</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-emerald-200 to-transparent" />
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">First Name <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input className="input w-full pl-9 text-sm" value={editForm.first_name}
                        onChange={(e) => setEditForm((p) => ({ ...p, first_name: e.target.value }))} required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Last Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input className="input w-full pl-9 text-sm" value={editForm.last_name}
                        onChange={(e) => setEditForm((p) => ({ ...p, last_name: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Date of Birth</label>
                    <input type="date" className="input w-full text-sm" value={editForm.date_of_birth}
                      onChange={(e) => setEditForm((p) => ({ ...p, date_of_birth: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Date of Joining</label>
                    <input type="date" className="input w-full text-sm" value={editForm.joining_date}
                      onChange={(e) => setEditForm((p) => ({ ...p, joining_date: e.target.value }))} />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Gender</label>
                  <div className="flex gap-2">
                    {['male', 'female', 'other'].map((g) => (
                      <button key={g} type="button"
                        className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium capitalize transition-all ${editForm.gender === g ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:border-emerald-300'}`}
                        onClick={() => setEditForm((p) => ({ ...p, gender: g }))}>
                        {g === 'male' ? '♂ Male' : g === 'female' ? '♀ Female' : '⚧ Other'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Address</label>
                  <textarea className="input w-full text-sm resize-none" rows={2} placeholder="Street, City, State, PIN"
                    value={editForm.address}
                    onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))} />
                </div>
              </div>

              {/* Contact Details */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-600">Contact Details</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-emerald-200 to-transparent" />
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="col-span-2">
                    <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input type="tel" className="input w-full pl-9 text-sm" placeholder="9876543210"
                        value={editForm.phone}
                        onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Emergency Contact Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input className="input w-full pl-9 text-sm" placeholder="Contact person name"
                        value={editForm.emergency_contact_name}
                        onChange={(e) => setEditForm((p) => ({ ...p, emergency_contact_name: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Emergency Contact Phone</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input type="tel" className="input w-full pl-9 text-sm" placeholder="9876543210"
                        value={editForm.emergency_contact_phone}
                        onChange={(e) => setEditForm((p) => ({ ...p, emergency_contact_phone: e.target.value }))} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Role & Status */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-600">Role & Status</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-emerald-200 to-transparent" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Role</label>
                    <select className="input w-full text-sm" value={editForm.role_name}
                      onChange={(e) => setEditForm((p) => ({ ...p, role_name: e.target.value }))}>
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role.value} value={role.value}>{role.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Status</label>
                    <select className="input w-full text-sm"
                      value={editForm.is_active ? 'active' : 'inactive'}
                      onChange={(e) => setEditForm((p) => ({ ...p, is_active: e.target.value === 'active' }))}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Bank Details */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-600">Bank Details</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-emerald-200 to-transparent" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Account Holder Name</label>
                    <input className="input w-full" placeholder="Full name on bank account"
                      value={editForm.bank_account_holder}
                      onChange={(e) => setEditForm((p) => ({ ...p, bank_account_holder: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Bank Name</label>
                    <input className="input w-full" placeholder="e.g. SBI, HDFC, ICICI"
                      value={editForm.bank_name}
                      onChange={(e) => setEditForm((p) => ({ ...p, bank_name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Account Number</label>
                    <input className="input w-full" placeholder="Account number"
                      value={editForm.account_number}
                      onChange={(e) => setEditForm((p) => ({ ...p, account_number: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">IFSC Code</label>
                    <input className="input w-full" placeholder="e.g. SBIN0001234"
                      value={editForm.ifsc_code}
                      onChange={(e) => setEditForm((p) => ({ ...p, ifsc_code: e.target.value.toUpperCase() }))} />
                  </div>
                  <div>
                    <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Account Type</label>
                    <select className="input w-full"
                      value={editForm.account_type}
                      onChange={(e) => setEditForm((p) => ({ ...p, account_type: e.target.value }))}>
                      <option value="">Select type</option>
                      <option value="savings">Savings</option>
                      <option value="current">Current</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">UPI ID</label>
                    <input className="input w-full" placeholder="e.g. name@upi"
                      value={editForm.upi_id}
                      onChange={(e) => setEditForm((p) => ({ ...p, upi_id: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Aadhaar File */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-600">Aadhaar File</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-emerald-200 to-transparent" />
                </div>
                <div className="space-y-3">
                  {editForm.aadhaar_file_url && (
                    <a
                      href={editForm.aadhaar_file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100"
                    >
                      <ExternalLink size={14} />
                      {editForm.aadhaar_file_name || 'View existing Aadhaar file'}
                    </a>
                  )}
                  <label className="w-full flex items-center justify-between gap-3 border border-emerald-200 bg-emerald-50/40 rounded-xl px-3 py-2.5 cursor-pointer hover:bg-emerald-50 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <Upload className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm text-gray-700 truncate">{editForm.aadhaar_file_name || 'Choose Aadhaar file (image or PDF)'}</span>
                    </div>
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-md">Browse</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const dataUrl = await fileToDataUrl(file);
                          setEditForm((p) => ({
                            ...p,
                            aadhaar_file_url: dataUrl,
                            aadhaar_file_name: file.name,
                          }));
                        } catch {
                          toast.error('Failed to read Aadhaar file');
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Driving License (shown when driver role) */}
              {editForm.role_name === 'driver' && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-600">Driving License</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-emerald-200 to-transparent" />
                  </div>
                  <div className="mb-3">
                    <DocAutoFill
                      documentType="driving_license"
                      entityType="driver"
                      label="Driving License"
                      onExtracted={(data) => {
                        setEditForm((p) => ({
                          ...p,
                          dl_number: data.license_number || data.dl_number || p.dl_number,
                          dl_issue_date: toISODate(data.issue_date || data.doi) || p.dl_issue_date,
                          dl_expiry_date: toISODate(data.expiry_date || data.validity || data.valid_till) || p.dl_expiry_date,
                        }));
                      }}
                    />
                  </div>
                  <div className="space-y-3">
                    {editForm.dl_file_url && (
                      <a
                        href={editForm.dl_file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100"
                      >
                        <ExternalLink size={14} />
                        {editForm.dl_file_name || 'View existing DL file'}
                      </a>
                    )}
                    <label className="w-full flex items-center justify-between gap-3 border border-emerald-200 bg-emerald-50/40 rounded-xl px-3 py-2.5 cursor-pointer hover:bg-emerald-50 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm text-gray-700 truncate">{editForm.dl_file_name || 'Choose DL file (image or PDF)'}</span>
                      </div>
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-md">Browse</span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const dataUrl = await fileToDataUrl(file);
                            setEditForm((p) => ({
                              ...p,
                              dl_file_url: dataUrl,
                              dl_file_name: file.name,
                            }));
                          } catch {
                            toast.error('Failed to read DL file');
                          }
                        }}
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    <div>
                      <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">License Number</label>
                      <input className="input w-full text-sm uppercase" placeholder="e.g. KA0120200012345"
                        value={editForm.dl_number}
                        onChange={(e) => setEditForm((p) => ({ ...p, dl_number: e.target.value.toUpperCase() }))} />
                    </div>
                    <div>
                      <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Issue Date</label>
                      <input type="date" className="input w-full text-sm"
                        value={editForm.dl_issue_date}
                        onChange={(e) => setEditForm((p) => ({ ...p, dl_issue_date: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Expiry Date</label>
                      <input type="date" className="input w-full text-sm"
                        value={editForm.dl_expiry_date}
                        onChange={(e) => setEditForm((p) => ({ ...p, dl_expiry_date: e.target.value }))} />
                    </div>
                  </div>
                </div>
              )}

              {/* Account Security */}
              {isAdmin && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-600">Account Security</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-emerald-200 to-transparent" />
                  </div>
                  <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Reset Password (Admin only)</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type={showEditPassword ? 'text' : 'password'}
                      className="input w-full pl-10 pr-10"
                      placeholder="Leave empty to keep current password"
                      value={editForm.password}
                      onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
                      minLength={6} />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowEditPassword(!showEditPassword)} tabIndex={-1}>
                      {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {editForm.password && editForm.password.length < 6 && (
                    <p className="text-xs text-amber-600 mt-1">Password must be at least 6 characters</p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button"
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  onClick={() => { setIsEditOpen(false); setShowEditPassword(false); }}>
                  Cancel
                </button>
                <button type="submit"
                  className="px-5 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
                  disabled={editMutation.isPending || !editForm.first_name || (!!editForm.password && editForm.password.length < 6)}>
                  {editMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Employee Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">

            {/* Header */}
            <div className="relative bg-gradient-to-r from-indigo-600 to-violet-600 px-7 py-5 flex items-center justify-between shrink-0 overflow-hidden">
              <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/10" />
              <div className="absolute -bottom-10 left-[40%] w-24 h-24 rounded-full bg-white/5" />
              <div className="flex items-center gap-3 z-10">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-[17px] font-bold text-white">Add New Employee</h2>
                  <p className="text-indigo-100 text-xs mt-0.5">Fill in the details to create a new team member</p>
                </div>
              </div>
              <button
                onClick={() => { setIsCreateOpen(false); setShowPassword(false); }}
                className="z-10 w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              >
                <X size={16} className="text-white" />
              </button>
            </div>

            {/* Auto-generated Employee ID strip */}
            <div className="bg-indigo-50 border-b border-indigo-100 px-7 py-2.5 flex items-center gap-2.5 shrink-0">
              <span className="text-xs text-indigo-600 font-medium">Employee ID</span>
              <span className="bg-indigo-600 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full tracking-wide">
                KT-{new Date().getFullYear()}-{String(Math.floor(1000 + Math.random() * 9000))}
              </span>
              <span className="text-[11px] text-gray-400 italic">Auto-generated</span>
            </div>

            {/* Scrollable body */}
            <form
              className="overflow-y-auto flex-1 px-7 py-5 space-y-6"
              id="create-employee-form"
              onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
            >

              {/* ── Personal Information ── */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[10px] font-bold tracking-widest uppercase text-indigo-600">Personal Information</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-indigo-200 to-transparent" />
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">First Name <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input className="input w-full pl-9 text-sm" placeholder="John"
                        value={createForm.first_name}
                        onChange={(e) => setCreateForm((p) => ({ ...p, first_name: e.target.value }))}
                        required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Last Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input className="input w-full pl-9 text-sm" placeholder="Doe"
                        value={createForm.last_name}
                        onChange={(e) => setCreateForm((p) => ({ ...p, last_name: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Date of Birth</label>
                    <input type="date" className="input w-full text-sm"
                      value={createForm.dob}
                      onChange={(e) => setCreateForm((p) => ({ ...p, dob: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Date of Joining</label>
                    <input type="date" className="input w-full text-sm"
                      value={createForm.joining_date}
                      onChange={(e) => setCreateForm((p) => ({ ...p, joining_date: e.target.value }))} />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Gender</label>
                  <div className="flex gap-2">
                    {['male', 'female', 'other'].map((g) => (
                      <button key={g} type="button"
                        className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium capitalize transition-all ${createForm.gender === g ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-indigo-300'}`}
                        onClick={() => setCreateForm((p) => ({ ...p, gender: g }))}>
                        {g === 'male' ? '♂ Male' : g === 'female' ? '♀ Female' : '⚧ Other'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Address</label>
                  <textarea className="input w-full text-sm resize-none" rows={2} placeholder="Street, City, State, PIN"
                    value={createForm.address}
                    onChange={(e) => setCreateForm((p) => ({ ...p, address: e.target.value }))} />
                </div>
                <div className="mt-4">
                  <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Upload Aadhaar Card <span className="text-red-500">*</span></label>
                  <label className="w-full flex items-center justify-between gap-3 border border-indigo-200 bg-indigo-50/40 rounded-xl px-3 py-2.5 cursor-pointer hover:bg-indigo-50 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <Upload className="w-4 h-4 text-indigo-600" />
                      <span className="text-sm text-gray-700 truncate">{createForm.aadhaar_file_name || 'Choose Aadhaar file (image or PDF)'}</span>
                    </div>
                    <span className="text-xs font-semibold text-indigo-700 bg-indigo-100 px-2 py-1 rounded-md">Browse</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const dataUrl = await fileToDataUrl(file);
                          setCreateForm((p) => ({
                            ...p,
                            aadhaar_file_url: dataUrl,
                            aadhaar_file_name: file.name,
                          }));
                        } catch {
                          toast.error('Failed to read Aadhaar file');
                        }
                      }}
                    />
                  </label>
                  {!createForm.aadhaar_file_url && <p className="text-xs text-amber-600 mt-1">Aadhaar upload is required.</p>}
                </div>
              </div>

              {/* ── Contact Details ── */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[10px] font-bold tracking-widest uppercase text-indigo-600">Contact Details</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-indigo-200 to-transparent" />
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Email Address <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input type="email" className="input w-full pl-9 text-sm" placeholder="john@kavyatransports.com"
                        value={createForm.email}
                        onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                        required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input type="tel" className="input w-full pl-9 text-sm" placeholder="9876543210"
                        value={createForm.phone}
                        onChange={(e) => setCreateForm((p) => ({ ...p, phone: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Emergency Contact Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input className="input w-full pl-9 text-sm" placeholder="Contact person name"
                        value={createForm.emergency_contact_name}
                        onChange={(e) => setCreateForm((p) => ({ ...p, emergency_contact_name: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Emergency Contact Phone</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input type="tel" className="input w-full pl-9 text-sm" placeholder="9876543210"
                        value={createForm.emergency_contact_phone}
                        onChange={(e) => setCreateForm((p) => ({ ...p, emergency_contact_phone: e.target.value }))} />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Account Security ── */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[10px] font-bold tracking-widest uppercase text-indigo-600">Account Security</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-indigo-200 to-transparent" />
                </div>
                <div>
                  <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Password <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="input w-full pl-9 pr-10 text-sm"
                      placeholder="Min 6 characters"
                      value={createForm.password}
                      onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                      required minLength={6}
                    />
                    <button type="button" tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {createForm.password && createForm.password.length < 6 && (
                    <p className="text-xs text-amber-600 mt-1">Password must be at least 6 characters</p>
                  )}
                </div>
              </div>

              {/* ── Assign Role ── */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[10px] font-bold tracking-widest uppercase text-indigo-600">Assign Role</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-indigo-200 to-transparent" />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {ROLE_OPTIONS.map((role) => {
                    const isSelected = createForm.role_names[0] === role.value;
                    const isLast = role.value === 'pump_operator';
                    return (
                      <button key={role.value} type="button"
                        className={`text-left px-3.5 py-3 rounded-xl border-2 transition-all ${isLast ? 'col-span-2' : ''} ${isSelected ? `${role.color} border-current shadow-sm` : 'border-gray-200 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50/40'}`}
                        onClick={() => setCreateForm((p) => ({ ...p, role_names: [role.value] }))}>
                        <p className={`text-sm font-semibold ${isSelected ? '' : 'text-gray-800'}`}>{role.label}</p>
                        <p className={`text-[11.5px] mt-0.5 ${isSelected ? 'opacity-80' : 'text-gray-500'}`}>{role.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Driving License (shown when driver role selected) ── */}
              {createForm.role_names[0] === 'driver' && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-indigo-600">Driving License</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-indigo-200 to-transparent" />
                  </div>

                  {/* OCR Auto-fill zone */}
                  <div className="mb-4">
                    <DocAutoFill
                      documentType="driving_license"
                      entityType="driver"
                      label="Driving License"
                      onExtracted={(data) => {
                        setCreateForm((p) => ({
                          ...p,
                          dl_number: data.license_number || data.dl_number || p.dl_number,
                          dl_issue_date: toISODate(data.issue_date || data.doi) || p.dl_issue_date,
                          dl_expiry_date: toISODate(data.expiry_date || data.validity || data.valid_till) || p.dl_expiry_date,
                        }));
                      }}
                    />
                  </div>

                  {/* DL file upload */}
                  <div className="mb-4">
                    <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Upload Driving License <span className="text-red-500">*</span></label>
                    <label className="w-full flex items-center justify-between gap-3 border border-indigo-200 bg-indigo-50/40 rounded-xl px-3 py-2.5 cursor-pointer hover:bg-indigo-50 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-indigo-600" />
                        <span className="text-sm text-gray-700 truncate">{createForm.dl_file_name || 'Choose DL file (image or PDF)'}</span>
                      </div>
                      <span className="text-xs font-semibold text-indigo-700 bg-indigo-100 px-2 py-1 rounded-md">Browse</span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const dataUrl = await fileToDataUrl(file);
                            setCreateForm((p) => ({
                              ...p,
                              dl_file_url: dataUrl,
                              dl_file_name: file.name,
                            }));
                          } catch {
                            toast.error('Failed to read DL file');
                          }
                        }}
                      />
                    </label>
                    {!createForm.dl_file_url && <p className="text-xs text-amber-600 mt-1">Driving license upload is required for drivers.</p>}
                  </div>

                  {/* Extracted / manual DL fields */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">License Number</label>
                      <input className="input w-full text-sm uppercase" placeholder="e.g. KA0120200012345"
                        value={createForm.dl_number}
                        onChange={(e) => setCreateForm((p) => ({ ...p, dl_number: e.target.value.toUpperCase() }))} />
                    </div>
                    <div>
                      <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Issue Date</label>
                      <input type="date" className="input w-full text-sm"
                        value={createForm.dl_issue_date}
                        onChange={(e) => setCreateForm((p) => ({ ...p, dl_issue_date: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Expiry Date</label>
                      <input type="date" className="input w-full text-sm"
                        value={createForm.dl_expiry_date}
                        onChange={(e) => setCreateForm((p) => ({ ...p, dl_expiry_date: e.target.value }))} />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Salary Details ── */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[10px] font-bold tracking-widest uppercase text-indigo-600">Salary Details</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-indigo-200 to-transparent" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Salary Amount (₹)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">₹</span>
                      <input type="number" className="input w-full pl-7 text-sm" placeholder="e.g. 25000"
                        value={createForm.salary_amount}
                        onChange={(e) => setCreateForm((p) => ({ ...p, salary_amount: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Pay Type</label>
                    <div className="flex gap-2">
                      {['monthly', 'weekly', 'daily'].map((pt) => (
                        <button key={pt} type="button"
                          className={`flex-1 py-2 rounded-lg border-2 text-xs font-semibold capitalize transition-all ${createForm.pay_type === pt ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-indigo-300'}`}
                          onClick={() => setCreateForm((p) => ({ ...p, pay_type: pt }))}>
                          {pt.charAt(0).toUpperCase() + pt.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Bank & Payment Details ── */}
              <div className="bg-gradient-to-br from-indigo-50/60 to-violet-50/60 border border-indigo-100 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[10px] font-bold tracking-widest uppercase text-indigo-600">Bank & Payment Details</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-indigo-200 to-transparent" />
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Account Holder Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input className="input w-full pl-9 text-sm bg-white" placeholder="As per bank records"
                        value={createForm.bank_account_holder}
                        onChange={(e) => setCreateForm((p) => ({ ...p, bank_account_holder: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Bank Name</label>
                    <select className="input w-full text-sm bg-white"
                      value={createForm.bank_name}
                      onChange={(e) => setCreateForm((p) => ({ ...p, bank_name: e.target.value }))}>
                      <option value="">Select Bank</option>
                      {['State Bank of India','HDFC Bank','ICICI Bank','Axis Bank','Bank of Baroda','Punjab National Bank','Kotak Mahindra Bank','Canara Bank','Indian Bank','Other'].map((b) => (
                        <option key={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Account Number</label>
                    <input className="input w-full text-sm bg-white" placeholder="Enter account number"
                      value={createForm.account_number}
                      onChange={(e) => setCreateForm((p) => ({ ...p, account_number: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Confirm Account Number</label>
                    <input className={`input w-full text-sm bg-white ${createForm.confirm_account_number && createForm.confirm_account_number !== createForm.account_number ? 'border-red-400' : ''}`}
                      placeholder="Re-enter account number"
                      value={createForm.confirm_account_number}
                      onChange={(e) => setCreateForm((p) => ({ ...p, confirm_account_number: e.target.value }))} />
                    {createForm.confirm_account_number && createForm.confirm_account_number !== createForm.account_number && (
                      <p className="text-xs text-red-500 mt-1">Account numbers do not match</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">IFSC Code</label>
                    <input className="input w-full text-sm bg-white uppercase" placeholder="e.g. SBIN0001234" maxLength={11}
                      value={createForm.ifsc_code}
                      onChange={(e) => setCreateForm((p) => ({ ...p, ifsc_code: e.target.value.toUpperCase() }))} />
                  </div>
                  <div>
                    <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">Account Type</label>
                    <select className="input w-full text-sm bg-white"
                      value={createForm.account_type}
                      onChange={(e) => setCreateForm((p) => ({ ...p, account_type: e.target.value }))}>
                      <option value="">Select type</option>
                      <option>Savings Account</option>
                      <option>Current Account</option>
                    </select>
                  </div>
                </div>
                <div className="border-t border-indigo-100 pt-4">
                  <label className="block text-[12.5px] font-medium text-gray-700 mb-1.5">UPI ID</label>
                  <input className="input w-full text-sm bg-white" placeholder="e.g. john@upi or 9876543210@paytm"
                    value={createForm.upi_id}
                    onChange={(e) => setCreateForm((p) => ({ ...p, upi_id: e.target.value }))} />
                  <p className="text-[11px] text-gray-400 mt-1">Used for quick salary transfers via UPI</p>
                </div>
              </div>

            </form>

            {/* Footer */}
            <div className="shrink-0 px-7 py-4 border-t border-gray-100 flex justify-end gap-3 bg-white">
              <button
                type="button"
                className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors border border-gray-200"
                onClick={() => { setIsCreateOpen(false); setShowPassword(false); }}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="create-employee-form"
                className="px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-all flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:shadow-lg hover:shadow-indigo-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
                disabled={
                  createMutation.isPending ||
                  !createForm.email ||
                  !createForm.password ||
                  !createForm.first_name ||
                  !createForm.aadhaar_file_url ||
                  (createForm.role_names[0] === 'driver' && !createForm.dl_file_url) ||
                  createForm.password.length < 6 ||
                  (!!createForm.confirm_account_number && createForm.confirm_account_number !== createForm.account_number)
                }
              >
                {createMutation.isPending ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Creating...
                  </>
                ) : (
                  <><Plus size={16} /> Create Employee</>
                )}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
