import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Plus, Search, MapPin, Users,
  Truck, UserCheck, Briefcase, ToggleRight,
  ChevronRight,
} from 'lucide-react';
import { KPICard, LoadingSpinner, EmptyState, Modal } from '@/components/common/Modal';
import { branchService } from '@/services/dataService';
import type { Branch } from '@/types';
import { safeArray } from '@/utils/helpers';

export default function BranchesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data: branchesRaw, isLoading } = useQuery({
    queryKey: ['branches', search],
    queryFn: () => branchService.list({ search: search || undefined }),
  });
  const branches = safeArray<Branch>(branchesRaw);

  const { data: comparison } = useQuery({
    queryKey: ['branches-comparison'],
    queryFn: () => branchService.getComparison(),
  });
  const compData = safeArray<any>(comparison);

  // KPIs
  const totalBranches = branches.length;
  const activeBranches = branches.filter(b => b.is_active).length;
  const totalVehicles = compData.reduce((s: number, c: any) => s + (c.vehicles || 0), 0);
  const totalRevenue = compData.reduce((s: number, c: any) => s + (c.revenue || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Branch Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage branches, resources, and cross-branch performance</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" /> Add Branch
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Branches" value={totalBranches} icon={<Building2 className="w-5 h-5" />} color="bg-blue-100 text-blue-600" />
        <KPICard title="Active Branches" value={activeBranches} icon={<ToggleRight className="w-5 h-5" />} color="bg-green-100 text-green-600" />
        <KPICard title="Total Vehicles" value={totalVehicles} icon={<Truck className="w-5 h-5" />} color="bg-purple-100 text-purple-600" />
        <KPICard title="Total Revenue" value={`₹${totalRevenue.toLocaleString()}`} icon={<Briefcase className="w-5 h-5" />} color="bg-yellow-100 text-yellow-600" />
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search branches..."
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>

      {/* Branch Cards */}
      {isLoading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : branches.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-12 h-12" />}
          title="No branches found"
          description="Create your first branch to get started."
          action={
            <button onClick={() => setShowCreate(true)} className="text-sm text-blue-600 font-medium hover:text-blue-800">
              + Add Branch
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map(branch => {
            const comp = compData.find((c: any) => c.id === branch.id);
            return (
              <BranchCard
                key={branch.id}
                branch={branch}
                resources={comp}
                onClick={() => navigate(`/admin/branches/${branch.id}`)}
              />
            );
          })}
        </div>
      )}

      {/* Cross-Branch Comparison Table */}
      {compData.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Cross-Branch Comparison</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left p-3 font-medium text-gray-600">Branch</th>
                  <th className="text-center p-3 font-medium text-gray-600">Vehicles</th>
                  <th className="text-center p-3 font-medium text-gray-600">Drivers</th>
                  <th className="text-center p-3 font-medium text-gray-600">Staff</th>
                  <th className="text-center p-3 font-medium text-gray-600">Jobs</th>
                  <th className="text-right p-3 font-medium text-gray-600">Revenue</th>
                  <th className="text-right p-3 font-medium text-gray-600">Collected</th>
                  <th className="text-right p-3 font-medium text-gray-600">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {compData.map((c: any) => (
                  <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/admin/branches/${c.id}`)}>
                    <td className="p-3">
                      <div className="font-medium text-gray-900">{c.name}</div>
                      <div className="text-xs text-gray-500">{c.city || c.code}</div>
                    </td>
                    <td className="p-3 text-center">{c.vehicles}</td>
                    <td className="p-3 text-center">{c.drivers}</td>
                    <td className="p-3 text-center">{c.staff}</td>
                    <td className="p-3 text-center">{c.jobs}</td>
                    <td className="p-3 text-right font-medium">₹{(c.revenue || 0).toLocaleString()}</td>
                    <td className="p-3 text-right text-green-700">₹{(c.collected || 0).toLocaleString()}</td>
                    <td className="p-3 text-right text-red-700">₹{(c.outstanding || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreateBranchModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            queryClient.invalidateQueries({ queryKey: ['branches'] });
            queryClient.invalidateQueries({ queryKey: ['branches-comparison'] });
          }}
        />
      )}
    </div>
  );
}

/* ── Branch Card ───────────────────────────────────────────── */

function BranchCard({ branch, resources, onClick }: { branch: Branch; resources?: any; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-blue-200 transition cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition">{branch.name}</h3>
            <p className="text-xs text-gray-500">{branch.code}</p>
          </div>
        </div>
        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
          branch.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {branch.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {branch.city && (
        <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-3">
          <MapPin className="w-3.5 h-3.5" /> {branch.city}{branch.state ? `, ${branch.state}` : ''}
        </div>
      )}

      {resources && (
        <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-gray-100">
          <ResourceBadge icon={<Truck className="w-3.5 h-3.5" />} label="Vehicles" value={resources.vehicles || 0} />
          <ResourceBadge icon={<UserCheck className="w-3.5 h-3.5" />} label="Drivers" value={resources.drivers || 0} />
          <ResourceBadge icon={<Users className="w-3.5 h-3.5" />} label="Staff" value={resources.staff || 0} />
          <ResourceBadge icon={<Briefcase className="w-3.5 h-3.5" />} label="Clients" value={resources.clients || 0} />
        </div>
      )}

      <div className="flex items-center justify-end mt-3 text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition">
        View Details <ChevronRight className="w-3 h-3 ml-0.5" />
      </div>
    </div>
  );
}

function ResourceBadge({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center text-gray-400 mb-0.5">{icon}</div>
      <p className="text-sm font-semibold text-gray-900">{value}</p>
      <p className="text-[10px] text-gray-400">{label}</p>
    </div>
  );
}

/* ── Create Branch Modal ───────────────────────────────────── */

function CreateBranchModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    name: '', code: '', city: '', state: '', address: '',
    pincode: '', phone: '', email: '', tenant_id: 1,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const update = (field: string, value: string | number) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.code) { setError('Name and code are required'); return; }
    setError('');
    setSubmitting(true);
    try {
      await branchService.create(form);
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to create branch');
    }
    setSubmitting(false);
  };

  return (
    <Modal isOpen onClose={onClose} title="Create New Branch" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Branch Name *" value={form.name} onChange={v => update('name', v)} placeholder="e.g. Chennai Branch" />
          <Field label="Branch Code *" value={form.code} onChange={v => update('code', v)} placeholder="e.g. CHN" />
          <Field label="City" value={form.city} onChange={v => update('city', v)} placeholder="Chennai" />
          <Field label="State" value={form.state} onChange={v => update('state', v)} placeholder="Tamil Nadu" />
          <Field label="Phone" value={form.phone} onChange={v => update('phone', v)} placeholder="+91..." />
          <Field label="Email" value={form.email} onChange={v => update('email', v)} placeholder="branch@company.com" />
          <div className="sm:col-span-2">
            <Field label="Address" value={form.address} onChange={v => update('address', v)} placeholder="Full address" />
          </div>
          <Field label="Pincode" value={form.pincode} onChange={v => update('pincode', v)} placeholder="600001" />
        </div>

        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {submitting ? 'Creating...' : 'Create Branch'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
      />
    </div>
  );
}
