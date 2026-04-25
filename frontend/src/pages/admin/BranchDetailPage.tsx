import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2, ArrowLeft, MapPin, Save,
  Truck, UserCheck, Users, Briefcase, IndianRupee,
  AlertCircle, BarChart3, Settings,
} from 'lucide-react';
import { KPICard, LoadingSpinner } from '@/components/common/Modal';
import { branchService } from '@/services/dataService';
import type { Branch, BranchResources, BranchPnL } from '@/types';

type Tab = 'overview' | 'resources' | 'pnl' | 'settings';

export default function BranchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const branchId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const { data: branch, isLoading } = useQuery<Branch>({
    queryKey: ['branch', branchId],
    queryFn: () => branchService.get(branchId),
    enabled: !!branchId,
  });

  const { data: resources } = useQuery<BranchResources>({
    queryKey: ['branch-resources', branchId],
    queryFn: () => branchService.getResources(branchId),
    enabled: !!branchId,
  });

  const { data: pnl } = useQuery<BranchPnL>({
    queryKey: ['branch-pnl', branchId],
    queryFn: () => branchService.getPnL(branchId),
    enabled: !!branchId,
  });

  if (isLoading) {
    return <div className="flex justify-center py-20"><LoadingSpinner /></div>;
  }

  if (!branch) {
    return (
      <div className="text-center py-20 text-gray-500">
        <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <p className="font-medium">Branch not found</p>
        <button onClick={() => navigate('/admin/branches')} className="text-blue-600 text-sm mt-2">
          ← Back to Branches
        </button>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <Building2 className="w-4 h-4" /> },
    { key: 'resources', label: 'Resources', icon: <Truck className="w-4 h-4" /> },
    { key: 'pnl', label: 'P&L', icon: <BarChart3 className="w-4 h-4" /> },
    { key: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => navigate('/admin/branches')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 mb-3 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Branches
        </button>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center">
              <Building2 className="w-7 h-7 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{branch.name}</h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{branch.code}</span>
                {branch.city && (
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {branch.city}{branch.state ? `, ${branch.state}` : ''}</span>
                )}
                <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                  branch.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {branch.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Vehicles" value={resources?.vehicles ?? 0} icon={<Truck className="w-5 h-5" />} color="bg-blue-100 text-blue-600" />
        <KPICard title="Drivers" value={resources?.drivers ?? 0} icon={<UserCheck className="w-5 h-5" />} color="bg-green-100 text-green-600" />
        <KPICard title="Revenue" value={`₹${(pnl?.revenue ?? 0).toLocaleString()}`} icon={<IndianRupee className="w-5 h-5" />} color="bg-yellow-100 text-yellow-600" />
        <KPICard title="Outstanding" value={`₹${(pnl?.outstanding ?? 0).toLocaleString()}`} icon={<AlertCircle className="w-5 h-5" />} color="bg-red-100 text-red-600" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-gray-200 p-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition ${
              activeTab === t.key ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-gray-200">
        {activeTab === 'overview' && <OverviewTab branch={branch} />}
        {activeTab === 'resources' && <ResourcesTab resources={resources} />}
        {activeTab === 'pnl' && <PnLTab pnl={pnl} branchId={branchId} />}
        {activeTab === 'settings' && (
          <SettingsTab
            branch={branch}
            onUpdate={() => {
              queryClient.invalidateQueries({ queryKey: ['branch', branchId] });
            }}
          />
        )}
      </div>
    </div>
  );
}

/* ── Overview Tab ──────────────────────────────────────────── */

function OverviewTab({ branch }: { branch: Branch }) {
  const fields = [
    { label: 'Name', value: branch.name },
    { label: 'Code', value: branch.code },
    { label: 'City', value: branch.city },
    { label: 'State', value: branch.state },
    { label: 'Address', value: branch.address },
    { label: 'Pincode', value: branch.pincode },
    { label: 'Phone', value: branch.phone },
    { label: 'Email', value: branch.email },
    { label: 'Created', value: branch.created_at ? new Date(branch.created_at).toLocaleDateString() : '—' },
  ];

  return (
    <div className="p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Branch Information</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {fields.map(f => (
          <div key={f.label}>
            <p className="text-xs text-gray-500">{f.label}</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">{f.value || '—'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Resources Tab ─────────────────────────────────────────── */

function ResourcesTab({ resources }: { resources?: BranchResources }) {
  if (!resources) return <div className="p-6 text-gray-500">Loading resources...</div>;

  const items = [
    { icon: <Truck className="w-6 h-6 text-blue-600" />, label: 'Vehicles', value: resources.vehicles, color: 'bg-blue-50' },
    { icon: <UserCheck className="w-6 h-6 text-green-600" />, label: 'Drivers', value: resources.drivers, color: 'bg-green-50' },
    { icon: <Users className="w-6 h-6 text-purple-600" />, label: 'Staff', value: resources.staff, color: 'bg-purple-50' },
    { icon: <Briefcase className="w-6 h-6 text-yellow-600" />, label: 'Clients', value: resources.clients, color: 'bg-yellow-50' },
  ];

  return (
    <div className="p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Branch Resources</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map(item => (
          <div key={item.label} className={`${item.color} rounded-xl p-5 text-center`}>
            <div className="flex justify-center mb-2">{item.icon}</div>
            <p className="text-3xl font-bold text-gray-900">{item.value}</p>
            <p className="text-sm text-gray-600 mt-1">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── P&L Tab ───────────────────────────────────────────────── */

function PnLTab({ pnl, branchId }: { pnl?: BranchPnL; branchId: number }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: filteredPnl } = useQuery<BranchPnL>({
    queryKey: ['branch-pnl', branchId, startDate, endDate],
    queryFn: () => branchService.getPnL(branchId, {
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    }),
    enabled: !!branchId,
  });

  const data = filteredPnl ?? pnl;
  if (!data) return <div className="p-6 text-gray-500">Loading P&L...</div>;

  const collectedPct = data.revenue > 0 ? Math.round((data.collected / data.revenue) * 100) : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Profit & Loss</h3>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          />
          <span className="text-gray-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={`₹${data.revenue.toLocaleString()}`} color="text-blue-700" />
        <StatCard label="Collected" value={`₹${data.collected.toLocaleString()}`} color="text-green-700" />
        <StatCard label="Outstanding" value={`₹${data.outstanding.toLocaleString()}`} color="text-red-700" />
        <StatCard label="Jobs" value={data.jobs.toString()} color="text-gray-900" />
      </div>

      {/* Collection Progress */}
      {data.revenue > 0 && (
        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Collection Progress</span>
            <span>{collectedPct}%</span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${Math.min(100, collectedPct)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

/* ── Settings Tab ──────────────────────────────────────────── */

function SettingsTab({ branch, onUpdate }: { branch: Branch; onUpdate: () => void }) {
  const [form, setForm] = useState({
    name: branch.name,
    address: branch.address || '',
    city: branch.city || '',
    state: branch.state || '',
    pincode: branch.pincode || '',
    phone: branch.phone || '',
    email: branch.email || '',
    is_active: branch.is_active,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const update = (field: string, value: string | boolean) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      await branchService.update(branch.id, form);
      setMessage('Branch updated successfully');
      onUpdate();
    } catch (err: any) {
      setMessage(err?.response?.data?.detail || 'Failed to update');
    }
    setSaving(false);
  };

  return (
    <div className="p-6 max-w-2xl space-y-4">
      <h3 className="font-semibold text-gray-900">Branch Settings</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SettingsField label="Name" value={form.name} onChange={v => update('name', v)} />
        <SettingsField label="City" value={form.city} onChange={v => update('city', v)} />
        <SettingsField label="State" value={form.state} onChange={v => update('state', v)} />
        <SettingsField label="Pincode" value={form.pincode} onChange={v => update('pincode', v)} />
        <SettingsField label="Phone" value={form.phone} onChange={v => update('phone', v)} />
        <SettingsField label="Email" value={form.email} onChange={v => update('email', v)} />
        <div className="sm:col-span-2">
          <SettingsField label="Address" value={form.address} onChange={v => update('address', v)} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Active Status</label>
        <button
          type="button"
          onClick={() => update('is_active', !form.is_active)}
          className={`relative w-11 h-6 rounded-full transition ${form.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition ${form.is_active ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
        <span className="text-sm text-gray-500">{form.is_active ? 'Active' : 'Inactive'}</span>
      </div>

      {message && (
        <div className={`text-sm p-3 rounded-lg ${message.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {message}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
      >
        <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}

function SettingsField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
      />
    </div>
  );
}
