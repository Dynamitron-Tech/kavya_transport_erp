import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Search, Plus, Shield, X, Trash2, Mail, Lock, Phone, User, BadgeCheck, Eye, EyeOff, Pencil } from 'lucide-react';
import DataTable, { Column } from '@/components/common/DataTable';
import { KPICard, StatusBadge } from '@/components/common/Modal';
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
  });
  const qc = useQueryClient();

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

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
      return api.post('/users', createForm);
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
      setCreateForm({ email: '', password: '', first_name: '', last_name: '', phone: '', role_names: ['manager'] });
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="relative bg-gradient-to-r from-slate-700 to-slate-900 px-6 py-5">
              <div className="flex items-center gap-3">
                {selectedEmployee.avatar_url ? (
                  <img src={selectedEmployee.avatar_url} alt={selectedEmployee.name} className="w-10 h-10 rounded-xl object-cover border border-white/40" />
                ) : (
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <span className="text-base font-semibold text-white">{selectedEmployee.name.charAt(0)}</span>
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-semibold text-white">Employee Details</h2>
                  <p className="text-slate-200 text-sm">{selectedEmployee.name}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEmployee(null)}
                className="absolute top-4 right-4 p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X size={18} className="text-white" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Employee ID</p>
                <p className="text-sm font-semibold text-slate-900">{selectedEmployee.id}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Role</p>
                <div><StatusBadge status={selectedEmployee.role} /></div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 sm:col-span-2">
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Email</p>
                <p className="text-sm font-semibold text-slate-900 break-all">{selectedEmployee.email}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Phone</p>
                <p className="text-sm font-semibold text-slate-900">{selectedEmployee.phone}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Status</p>
                <div><StatusBadge status={selectedEmployee.status} /></div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 sm:col-span-2">
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Joined Date</p>
                <p className="text-sm font-semibold text-slate-900">{formatJoinedDate(selectedEmployee.joined_date)}</p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="relative bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-5">
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
              className="p-6 space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                editMutation.mutate();
              }}
            >
              <div className="flex items-center gap-4">
                {editForm.avatar_url ? (
                  <img src={editForm.avatar_url} alt="Avatar" className="w-16 h-16 rounded-full object-cover border border-gray-200" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-semibold">
                    {(editForm.first_name || 'U').charAt(0)}
                  </div>
                )}
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Profile Photo</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="input w-full"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const dataUrl = await fileToDataUrl(file);
                      setEditForm((p) => ({ ...p, avatar_url: dataUrl }));
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">First Name <span className="text-red-500">*</span></label>
                  <input
                    className="input w-full"
                    value={editForm.first_name}
                    onChange={(e) => setEditForm((p) => ({ ...p, first_name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Last Name</label>
                  <input
                    className="input w-full"
                    value={editForm.last_name}
                    onChange={(e) => setEditForm((p) => ({ ...p, last_name: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
                <input
                  className="input w-full"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
                  <select
                    className="input w-full"
                    value={editForm.role_name}
                    onChange={(e) => setEditForm((p) => ({ ...p, role_name: e.target.value }))}
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                  <select
                    className="input w-full"
                    value={editForm.is_active ? 'active' : 'inactive'}
                    onChange={(e) => setEditForm((p) => ({ ...p, is_active: e.target.value === 'active' }))}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {isAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Reset Password (Admin only)</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type={showEditPassword ? 'text' : 'password'}
                      className="input w-full pl-10 pr-10"
                      placeholder="Leave empty to keep current password"
                      value={editForm.password}
                      onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
                      minLength={6}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowEditPassword(!showEditPassword)}
                      tabIndex={-1}
                    >
                      {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {editForm.password && editForm.password.length < 6 && (
                    <p className="text-xs text-amber-600 mt-1">Password must be at least 6 characters</p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  onClick={() => { setIsEditOpen(false); setShowEditPassword(false); }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
                  disabled={editMutation.isPending || !editForm.first_name || (!!editForm.password && editForm.password.length < 6)}
                >
                  {editMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Employee Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Add New Employee</h2>
                  <p className="text-blue-100 text-sm">Fill in the details to create a new team member</p>
                </div>
              </div>
              <button
                onClick={() => { setIsCreateOpen(false); setShowPassword(false); }}
                className="absolute top-4 right-4 p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X size={18} className="text-white" />
              </button>
            </div>

            <form
              className="p-6 space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate();
              }}
            >
              {/* Name Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">First Name <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      className="input w-full pl-10"
                      placeholder="John"
                      value={createForm.first_name}
                      onChange={(e) => setCreateForm((p) => ({ ...p, first_name: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Last Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      className="input w-full pl-10"
                      placeholder="Doe"
                      value={createForm.last_name}
                      onChange={(e) => setCreateForm((p) => ({ ...p, last_name: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    className="input w-full pl-10"
                    placeholder="john@kavyatransports.com"
                    value={createForm.email}
                    onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input w-full pl-10 pr-10"
                    placeholder="Min 6 characters"
                    value={createForm.password}
                    onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {createForm.password && createForm.password.length < 6 && (
                  <p className="text-xs text-amber-600 mt-1">Password must be at least 6 characters</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    className="input w-full pl-10"
                    placeholder="9876543210"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm((p) => ({ ...p, phone: e.target.value }))}
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <BadgeCheck className="inline w-4 h-4 mr-1 -mt-0.5" />
                  Assign Role <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLE_OPTIONS.map((role) => {
                    const isSelected = createForm.role_names[0] === role.value;
                    return (
                      <button
                        key={role.value}
                        type="button"
                        className={`text-left px-3 py-2.5 rounded-lg border-2 transition-all ${
                          isSelected
                            ? `${role.color} border-current ring-1 ring-current/20 shadow-sm`
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                        onClick={() => setCreateForm((p) => ({ ...p, role_names: [role.value] }))}
                      >
                        <p className={`text-sm font-medium ${isSelected ? '' : 'text-gray-800'}`}>{role.label}</p>
                        <p className={`text-xs mt-0.5 ${isSelected ? 'opacity-80' : 'text-gray-500'}`}>{role.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  onClick={() => { setIsCreateOpen(false); setShowPassword(false); }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
                  disabled={createMutation.isPending || !createForm.email || !createForm.password || !createForm.first_name || createForm.password.length < 6}
                >
                  {createMutation.isPending ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus size={16} /> Create Employee
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
