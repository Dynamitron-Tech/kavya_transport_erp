// ============================================================
// Create Job Page — Enterprise-Grade Transport ERP
// Multi-section card form with validation, GST calculation,
// Draft/Submit workflow, breadcrumb, and status indicator
// ============================================================

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { jobService } from '@/services/dataService';
import { useAuthStore } from '@/store/authStore';
import { safeArray } from '@/utils/helpers';
import {
  ChevronRight, Save, Send, ArrowLeft, FileText, Package,
  MapPin, Truck, IndianRupee, StickyNote, Paperclip,
  AlertCircle, CheckCircle2, Clock, XCircle,
  Loader2, Calendar, Hash, Building2, Search, X,
  AlertTriangle, ChevronDown, Upload
} from 'lucide-react';

// ── Types ──
interface FormErrors {
  [key: string]: string;
}

interface ClientOption {
  id: number;
  name: string;
  code: string;
  gstin?: string;
  city?: string;
  state?: string;
  credit_days?: number;
  credit_limit?: number;
  outstanding?: number;
}

interface RouteOption {
  id: number;
  name: string;
  origin_city: string;
  origin_state: string;
  dest_city: string;
  dest_state: string;
  distance_km: number;
  estimated_hours: number;
}

interface VehicleTypeOption {
  value: string;
  label: string;
  capacity_tons: number;
}

// ── Constants ──
const RATE_TYPES = [
  { value: 'per_trip', label: 'Per Trip' },
  { value: 'per_ton', label: 'Per Ton' },
  { value: 'per_km', label: 'Per Km' },
  { value: 'fixed', label: 'Fixed Rate' },
  { value: 'monthly', label: 'Monthly Contract' },
];

const CONTRACT_TYPES = [
  { value: 'spot', label: 'Spot', description: 'One-time booking' },
  { value: 'contract', label: 'Contract', description: 'Long-term agreement' },
  { value: 'dedicated', label: 'Dedicated', description: 'Dedicated vehicle' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-700' },
  { value: 'normal', label: 'Normal', color: 'bg-blue-100 text-blue-700' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-700' },
];

const QUANTITY_UNITS = ['tons', 'kg', 'quintals', 'pieces', 'bags', 'boxes', 'pallets', 'litres', 'kl'];

const GST_OPTIONS = [
  { value: 0, label: 'No GST (0%)' },
  { value: 5, label: 'GST 5%' },
  { value: 12, label: 'GST 12%' },
  { value: 18, label: 'GST 18%' },
  { value: 28, label: 'GST 28%' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  draft: { label: 'Draft', color: 'text-gray-700', bg: 'bg-gray-100 border-gray-300', icon: <FileText size={14} /> },
  pending_approval: { label: 'Pending Approval', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-300', icon: <Clock size={14} /> },
  approved: { label: 'Approved', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-300', icon: <CheckCircle2 size={14} /> },
  cancelled: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-50 border-red-300', icon: <XCircle size={14} /> },
};

// ── Initial Form State ──
const INITIAL_FORM = {
  // Job Details
  job_date: new Date().toISOString().split('T')[0],
  client_ref_number: '',
  contract_type: 'spot',
  priority: 'normal',
  
  // Client
  client_id: 0,
  
  // Route
  origin_address: '',
  origin_city: '',
  origin_state: '',
  origin_pincode: '',
  destination_address: '',
  destination_city: '',
  destination_state: '',
  destination_pincode: '',
  route_id: 0,
  estimated_distance_km: 0,
  
  // Cargo
  material_type: '',
  material_description: '',
  quantity: 0,
  quantity_unit: 'tons',
  declared_value: 0,
  is_hazardous: false,
  num_packages: 0,
  
  // Vehicle
  vehicle_type_required: '',
  num_vehicles_required: 1,
  special_requirements: '',
  
  // Schedule
  pickup_date: '',
  expected_delivery_date: '',
  
  // Pricing
  rate_type: 'per_trip',
  agreed_rate: 0,
  loading_charges: 0,
  unloading_charges: 0,
  other_charges: 0,
  gst_percentage: 5,
  
  // Notes
  notes: '',
  
  // Status
  status: 'draft',
};

// ── Section Card Component ──
function SectionCard({
  title,
  subtitle,
  icon,
  children,
  collapsible = false,
  defaultOpen = true,
  badge,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => collapsible && setIsOpen(!isOpen)}
        className={`w-full px-6 py-4 flex items-center gap-3 border-b border-gray-100 ${
          collapsible ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'
        }`}
      >
        <div className="p-2 rounded-lg bg-primary-50 text-primary-600">{icon}</div>
        <div className="flex-1 text-left">
          <h3 className="font-bold text-gray-900">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {badge}
        {collapsible && (
          <ChevronDown
            size={18}
            className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        )}
      </button>
      {isOpen && <div className="p-6">{children}</div>}
    </div>
  );
}

// ── Form Field Components ──
function FormField({
  label,
  required,
  error,
  hint,
  children,
  className = '',
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
          <AlertCircle size={12} /> {error}
        </p>
      )}
      {hint && !error && (
        <p className="mt-1 text-xs text-gray-400">{hint}</p>
      )}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  error,
  disabled,
  prefix,
  suffix,
}: {
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  error?: boolean;
  disabled?: boolean;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}) {
  return (
    <div className={`flex items-center border rounded-lg transition-colors ${
      error ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-300 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-200'
    } ${disabled ? 'bg-gray-50 opacity-60' : 'bg-white'}`}>
      {prefix && <div className="pl-3 text-gray-400">{prefix}</div>}
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 px-3 py-2.5 text-sm bg-transparent outline-none placeholder-gray-400"
      />
      {suffix && <div className="pr-3 text-gray-400 text-sm">{suffix}</div>}
    </div>
  );
}

function SelectInput({
  value,
  onChange,
  options,
  placeholder,
  error,
  disabled,
}: {
  value: string | number;
  onChange: (v: string) => void;
  options: { id?: string | number; value?: string | number; name?: string; label: string }[];
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
}) {
  const getOptionKey = (option: { id?: string | number; value?: string | number; name?: string }, index: number) => {
    if (option.id !== undefined && option.id !== null && option.id !== '') return `id-${String(option.id)}`;
    if (option.value !== undefined && option.value !== null && option.value !== '') return `value-${String(option.value)}`;
    if (option.name) return `name-${option.name}`;
    return `idx-${index}`;
  };

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`w-full px-3 py-2.5 text-sm border rounded-lg bg-white outline-none transition-colors appearance-none ${
        error ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-200'
      } ${disabled ? 'bg-gray-50 opacity-60' : ''}`}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o, idx) => (
        <option key={getOptionKey(o, idx)} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  error?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={`w-full px-3 py-2.5 text-sm border rounded-lg bg-white outline-none transition-colors resize-none ${
        error ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-200'
      }`}
    />
  );
}

// ══════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════
export default function CreateJobPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { hasPermission } = useAuthStore();
  const isEdit = !!id;

  const [form, setForm] = useState({ ...INITIAL_FORM });
  const [errors, setErrors] = useState<FormErrors>({});
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [, setSelectedRoute] = useState<RouteOption | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);

  // ── Fetch lookup data ──
  const { data: clientsData } = useQuery({
    queryKey: ['job-clients', clientSearch],
    queryFn: () => jobService.getClients(clientSearch),
    enabled: showClientDropdown,
  });

  const { data: routesData } = useQuery({
    queryKey: ['job-routes'],
    queryFn: () => jobService.getRoutes(),
  });

  const { data: vehicleTypesData } = useQuery({
    queryKey: ['vehicle-types'],
    queryFn: () => jobService.getVehicleTypes(),
  });

  const { data: statesData } = useQuery({
    queryKey: ['indian-states'],
    queryFn: () => jobService.getStates(),
  });

  const { data: nextJobNumber } = useQuery({
    queryKey: ['next-job-number'],
    queryFn: () => jobService.getNextJobNumber(),
    enabled: !isEdit,
  });

  // If editing, load existing job
  const { data: existingJob } = useQuery({
    queryKey: ['job', id],
    queryFn: () => jobService.get(Number(id)),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existingJob && isEdit) {
      const merged: Record<string, any> = { ...INITIAL_FORM };
      for (const [key, val] of Object.entries(existingJob)) {
        if (val !== undefined && val !== null) merged[key] = val;
      }
      setForm(merged as typeof INITIAL_FORM);
      if (existingJob.client) {
        setSelectedClient(existingJob.client);
      }
    }
  }, [existingJob, isEdit]);

  const clients: ClientOption[] = safeArray(clientsData);
  const routes: RouteOption[] = safeArray(routesData);
  const vehicleTypes: VehicleTypeOption[] = safeArray(vehicleTypesData);
  const states: string[] = safeArray(statesData);

  // ── Form update helper ──
  const updateField = useCallback((field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }, [errors]);

  // ── Price Calculation ──
  const pricing = useMemo(() => {
    const base = Number(form.agreed_rate) || 0;
    const loading = Number(form.loading_charges) || 0;
    const unloading = Number(form.unloading_charges) || 0;
    const other = Number(form.other_charges) || 0;
    const subtotal = base + loading + unloading + other;
    const gstPct = Number(form.gst_percentage) || 0;
    const gstAmount = Math.round(subtotal * gstPct / 100);
    const total = subtotal + gstAmount;
    return { subtotal, gstAmount, gstPct, total };
  }, [form.agreed_rate, form.loading_charges, form.unloading_charges, form.other_charges, form.gst_percentage]);

  // ── Validation ──
  const validate = (submitMode: boolean = false): boolean => {
    const errs: FormErrors = {};

    if (!form.client_id) errs.client_id = 'Client is required';
    if (!form.origin_city.trim()) errs.origin_city = 'Origin city is required';
    if (!form.origin_address.trim()) errs.origin_address = 'Origin address is required';
    if (!form.destination_city.trim()) errs.destination_city = 'Destination city is required';
    if (!form.destination_address.trim()) errs.destination_address = 'Destination address is required';

    if (submitMode) {
      if (!form.material_type.trim()) errs.material_type = 'Material type is required for submission';
      if (!form.pickup_date) errs.pickup_date = 'Pickup date is required for submission';
      if (!form.agreed_rate || Number(form.agreed_rate) <= 0) errs.agreed_rate = 'Agreed rate must be greater than 0';
      if (!form.vehicle_type_required) errs.vehicle_type_required = 'Vehicle type is required for submission';

      if (form.pickup_date && form.expected_delivery_date) {
        if (new Date(form.expected_delivery_date) <= new Date(form.pickup_date)) {
          errs.expected_delivery_date = 'Delivery date must be after pickup date';
        }
      }
    }

    // Numeric validations
    if (form.quantity && Number(form.quantity) < 0) errs.quantity = 'Quantity cannot be negative';
    if (form.declared_value && Number(form.declared_value) < 0) errs.declared_value = 'Value cannot be negative';
    if (form.agreed_rate && Number(form.agreed_rate) < 0) errs.agreed_rate = 'Rate cannot be negative';
    if (form.num_vehicles_required < 1) errs.num_vehicles_required = 'At least 1 vehicle required';

    // Pincode validation
    if (form.origin_pincode && !/^\d{6}$/.test(form.origin_pincode)) errs.origin_pincode = 'Invalid pincode (6 digits)';
    if (form.destination_pincode && !/^\d{6}$/.test(form.destination_pincode)) errs.destination_pincode = 'Invalid pincode (6 digits)';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Client selection ──
  const handleSelectClient = (client: ClientOption) => {
    setSelectedClient(client);
    updateField('client_id', client.id);
    setClientSearch('');
    setShowClientDropdown(false);
  };

  // ── Route selection ──
  const handleSelectRoute = (routeId: string) => {
    const route = routes.find((r) => r.id === Number(routeId));
    if (route) {
      setSelectedRoute(route);
      updateField('route_id', route.id);
      updateField('origin_city', route.origin_city || '');
      updateField('origin_state', route.origin_state || '');
      updateField('destination_city', route.dest_city || '');
      updateField('destination_state', route.dest_state || '');
      updateField('estimated_distance_km', route.distance_km || 0);
    } else {
      setSelectedRoute(null);
      updateField('route_id', 0);
    }
  };

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (data: any) => jobService.create(data),
    onSuccess: (res) => {
      setSaveSuccess(`Job ${res.job_number} saved as draft`);
      setTimeout(() => navigate('/jobs'), 1500);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => jobService.update(Number(id), data),
    onSuccess: (res) => {
      setSaveSuccess(`Job ${res.job_number} updated`);
      setTimeout(() => navigate('/jobs'), 1500);
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = isEdit
        ? await jobService.update(Number(id), data)
        : await jobService.create(data);
      await jobService.submitForApproval(res.id);
      return res;
    },
    onSuccess: (res) => {
      setSaveSuccess(`Job ${res.job_number} submitted for approval`);
      setTimeout(() => navigate('/jobs'), 1500);
    },
  });

  // ── Save as Draft ──
  const handleSaveDraft = async () => {
    if (!validate(false)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setIsSaving(true);
    const payload = { ...form, status: 'draft' };
    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
    setIsSaving(false);
  };

  // ── Submit for Approval ──
  const handleSubmitForApproval = async () => {
    if (!validate(true)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setIsSubmitting(true);
    const payload = { ...form, status: 'draft' };
    submitMutation.mutate(payload);
    setIsSubmitting(false);
  };

  // ── File attachment ──
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const jobNumber = isEdit ? existingJob?.job_number : nextJobNumber?.job_number || 'JB-2026-XXXX';
  const currentStatus = isEdit ? (existingJob?.status || 'draft') : 'draft';
  const statusCfg = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.draft;
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <div className="max-w-5xl mx-auto pb-32">
      {/* ── Breadcrumb ── */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link to="/dashboard" className="hover:text-primary-600 transition-colors">Dashboard</Link>
        <ChevronRight size={14} />
        <Link to="/jobs" className="hover:text-primary-600 transition-colors">Jobs</Link>
        <ChevronRight size={14} />
        <span className="text-gray-900 font-medium">{isEdit ? 'Edit Job' : 'Create New Job'}</span>
      </nav>

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/jobs')}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {isEdit ? 'Edit Job' : 'Create New Job'}
              </h1>
              {/* Status Badge */}
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border ${statusCfg.bg} ${statusCfg.color}`}>
                {statusCfg.icon}
                {statusCfg.label}
              </div>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-gray-500 flex items-center gap-1">
                <Hash size={14} /> Job ID: <span className="font-mono font-semibold text-gray-700">{jobNumber}</span>
              </span>
              <span className="text-gray-300">|</span>
              <span className="text-sm text-gray-500 flex items-center gap-1">
                <Calendar size={14} /> {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Error Summary ── */}
      {hasErrors && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Please fix the following errors:</p>
            <ul className="mt-1 text-sm text-red-600 list-disc list-inside">
              {Object.values(errors).map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ── Success Message ── */}
      {saveSuccess && (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 size={20} className="text-emerald-500" />
          <p className="text-sm font-medium text-emerald-800">{saveSuccess}</p>
        </div>
      )}

      <form onSubmit={(e) => e.preventDefault()} className="space-y-6">

        {/* ══════════════ SECTION 1: Job Details ══════════════ */}
        <SectionCard title="Job Details" subtitle="Basic job information and classification" icon={<FileText size={18} />}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <FormField label="Job Date" required error={errors.job_date}>
              <TextInput
                type="date"
                value={form.job_date}
                onChange={(v) => updateField('job_date', v)}
                error={!!errors.job_date}
              />
            </FormField>

            <FormField label="Client Reference No." hint="PO / Indent number from client">
              <TextInput
                value={form.client_ref_number}
                onChange={(v) => updateField('client_ref_number', v)}
                placeholder="e.g., PO-2026-0041"
              />
            </FormField>

            <FormField label="Contract Type" required>
              <div className="flex gap-2">
                {CONTRACT_TYPES.map((ct) => (
                  <button
                    key={ct.value}
                    type="button"
                    onClick={() => updateField('contract_type', ct.value)}
                    className={`flex-1 px-3 py-2.5 text-sm font-medium rounded-lg border transition-all ${
                      form.contract_type === ct.value
                        ? 'border-primary-500 bg-primary-50 text-primary-700 ring-1 ring-primary-200'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {ct.label}
                  </button>
                ))}
              </div>
            </FormField>

            <FormField label="Priority">
              <div className="flex gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => updateField('priority', p.value)}
                    className={`flex-1 px-3 py-2.5 text-xs font-semibold rounded-lg border transition-all ${
                      form.priority === p.value
                        ? `${p.color} border-current ring-1 ring-current/20`
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </FormField>
          </div>
        </SectionCard>

        {/* ══════════════ SECTION 2: Client Information ══════════════ */}
        <SectionCard title="Client Information" subtitle="Select the client for this booking" icon={<Building2 size={18} />}>
          <div className="space-y-4">
            <FormField label="Client" required error={errors.client_id}>
              <div className="relative">
                {selectedClient ? (
                  <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="w-10 h-10 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm">
                      {selectedClient.code?.slice(0, 2)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{selectedClient.name}</p>
                      <p className="text-xs text-gray-500">
                        {selectedClient.code} · {selectedClient.city}, {selectedClient.state}
                        {selectedClient.gstin && ` · GSTIN: ${selectedClient.gstin}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedClient(null);
                        updateField('client_id', 0);
                      }}
                      className="p-1 hover:bg-gray-200 rounded-lg text-gray-400"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center border border-gray-300 rounded-lg focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-200">
                      <Search size={16} className="ml-3 text-gray-400" />
                      <input
                        type="text"
                        value={clientSearch}
                        onChange={(e) => {
                          setClientSearch(e.target.value);
                          setShowClientDropdown(true);
                        }}
                        onFocus={() => setShowClientDropdown(true)}
                        placeholder="Search by client name or code..."
                        className="flex-1 px-3 py-2.5 text-sm bg-transparent outline-none"
                      />
                    </div>

                    {showClientDropdown && clients.length > 0 && (
                      <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                        {clients.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleSelectClient(c)}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 border-b border-gray-50 last:border-0"
                          >
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold">
                              {c.code?.slice(0, 2)}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{c.name}</p>
                              <p className="text-xs text-gray-500">{c.code} · {c.city}</p>
                            </div>
                            {c.outstanding && c.outstanding > 0 && (
                              <span className="text-xs text-amber-600 font-medium">
                                O/S: ₹{Number(c.outstanding / 100000).toFixed(1)}L
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </FormField>

            {selectedClient && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                <div>
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider">Credit Limit</p>
                  <p className="text-sm font-semibold text-gray-900">₹{Number((selectedClient.credit_limit || 0) / 100000).toFixed(1)}L</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider">Outstanding</p>
                  <p className="text-sm font-semibold text-amber-700">₹{Number((selectedClient.outstanding || 0) / 100000).toFixed(1)}L</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider">Credit Days</p>
                  <p className="text-sm font-semibold text-gray-900">{selectedClient.credit_days || 30} days</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider">GSTIN</p>
                  <p className="text-sm font-mono font-semibold text-gray-900">{selectedClient.gstin || 'N/A'}</p>
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        {/* ══════════════ SECTION 3: Route Details ══════════════ */}
        <SectionCard title="Route Details" subtitle="Origin, destination, and distance" icon={<MapPin size={18} />}>
          <div className="space-y-5">
            {/* Quick route selection */}
            <FormField label="Select Saved Route" hint="Auto-fills origin and destination">
              <SelectInput
                value={form.route_id || ''}
                onChange={handleSelectRoute}
                placeholder="— Select a saved route —"
                options={routes.map((r) => ({ value: r.id, label: `${r.name} (${r.distance_km} km)` }))}
              />
            </FormField>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Origin */}
              <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                    <span className="text-xs font-bold">A</span>
                  </div>
                  <h4 className="text-sm font-semibold text-emerald-800">Origin (Pickup)</h4>
                </div>
                <div className="space-y-3">
                  <FormField label="Address" required error={errors.origin_address}>
                    <TextArea
                      value={form.origin_address}
                      onChange={(v) => updateField('origin_address', v)}
                      placeholder="Full pickup address..."
                      rows={2}
                      error={!!errors.origin_address}
                    />
                  </FormField>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="City" required error={errors.origin_city}>
                      <TextInput
                        value={form.origin_city}
                        onChange={(v) => updateField('origin_city', v)}
                        placeholder="Mumbai"
                        error={!!errors.origin_city}
                      />
                    </FormField>
                    <FormField label="State" error={errors.origin_state}>
                      <SelectInput
                        value={form.origin_state}
                        onChange={(v) => updateField('origin_state', v)}
                        placeholder="Select state"
                        options={states.map((s) => ({ value: s, label: s }))}
                      />
                    </FormField>
                  </div>
                  <FormField label="Pincode" error={errors.origin_pincode}>
                    <TextInput
                      value={form.origin_pincode}
                      onChange={(v) => updateField('origin_pincode', v)}
                      placeholder="400001"
                      error={!!errors.origin_pincode}
                    />
                  </FormField>
                </div>
              </div>

              {/* Destination */}
              <div className="p-4 bg-red-50/50 rounded-xl border border-red-100">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center">
                    <span className="text-xs font-bold">B</span>
                  </div>
                  <h4 className="text-sm font-semibold text-red-800">Destination (Delivery)</h4>
                </div>
                <div className="space-y-3">
                  <FormField label="Address" required error={errors.destination_address}>
                    <TextArea
                      value={form.destination_address}
                      onChange={(v) => updateField('destination_address', v)}
                      placeholder="Full delivery address..."
                      rows={2}
                      error={!!errors.destination_address}
                    />
                  </FormField>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="City" required error={errors.destination_city}>
                      <TextInput
                        value={form.destination_city}
                        onChange={(v) => updateField('destination_city', v)}
                        placeholder="Delhi"
                        error={!!errors.destination_city}
                      />
                    </FormField>
                    <FormField label="State" error={errors.destination_state}>
                      <SelectInput
                        value={form.destination_state}
                        onChange={(v) => updateField('destination_state', v)}
                        placeholder="Select state"
                        options={states.map((s) => ({ value: s, label: s }))}
                      />
                    </FormField>
                  </div>
                  <FormField label="Pincode" error={errors.destination_pincode}>
                    <TextInput
                      value={form.destination_pincode}
                      onChange={(v) => updateField('destination_pincode', v)}
                      placeholder="110001"
                      error={!!errors.destination_pincode}
                    />
                  </FormField>
                </div>
              </div>
            </div>

            <FormField label="Estimated Distance" hint="Auto-calculated from saved route">
              <TextInput
                type="number"
                value={form.estimated_distance_km || ''}
                onChange={(v) => updateField('estimated_distance_km', Number(v))}
                placeholder="0"
                suffix="km"
              />
            </FormField>
          </div>
        </SectionCard>

        {/* ══════════════ SECTION 4: Cargo Details ══════════════ */}
        <SectionCard title="Cargo Details" subtitle="Material type, quantity, and special handling" icon={<Package size={18} />}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <FormField label="Material Type" required={form.status !== 'draft'} error={errors.material_type}>
              <TextInput
                value={form.material_type}
                onChange={(v) => updateField('material_type', v)}
                placeholder="e.g., Electronics, Textiles, FMCG"
                error={!!errors.material_type}
              />
            </FormField>

            <FormField label="Quantity" error={errors.quantity}>
              <div className="flex gap-2">
                <div className="flex-1">
                  <TextInput
                    type="number"
                    value={form.quantity || ''}
                    onChange={(v) => updateField('quantity', Number(v))}
                    placeholder="0"
                    error={!!errors.quantity}
                  />
                </div>
                <div className="w-28">
                  <SelectInput
                    value={form.quantity_unit}
                    onChange={(v) => updateField('quantity_unit', v)}
                    options={QUANTITY_UNITS.map((u) => ({ value: u, label: u }))}
                  />
                </div>
              </div>
            </FormField>

            <FormField label="No. of Packages">
              <TextInput
                type="number"
                value={form.num_packages || ''}
                onChange={(v) => updateField('num_packages', Number(v))}
                placeholder="0"
              />
            </FormField>

            <FormField label="Declared Value" error={errors.declared_value}>
              <TextInput
                type="number"
                value={form.declared_value || ''}
                onChange={(v) => updateField('declared_value', Number(v))}
                placeholder="0"
                prefix={<IndianRupee size={14} />}
                error={!!errors.declared_value}
              />
            </FormField>

            <FormField label="Material Description">
              <TextInput
                value={form.material_description}
                onChange={(v) => updateField('material_description', v)}
                placeholder="Additional details..."
              />
            </FormField>

            <FormField label="Hazardous Material">
              <button
                type="button"
                onClick={() => updateField('is_hazardous', !form.is_hazardous)}
                className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-lg border transition-colors ${
                  form.is_hazardous
                    ? 'bg-red-50 border-red-300 text-red-700'
                    : 'bg-white border-gray-300 text-gray-600'
                }`}
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                  form.is_hazardous ? 'bg-red-500 border-red-500' : 'border-gray-300'
                }`}>
                  {form.is_hazardous && <CheckCircle2 size={12} className="text-white" />}
                </div>
                <span className="text-sm font-medium flex items-center gap-1.5">
                  {form.is_hazardous && <AlertTriangle size={14} />}
                  {form.is_hazardous ? 'Hazardous — Special handling' : 'Not hazardous'}
                </span>
              </button>
            </FormField>
          </div>
        </SectionCard>

        {/* ══════════════ SECTION 5: Vehicle & Schedule ══════════════ */}
        <SectionCard title="Vehicle & Schedule" subtitle="Vehicle requirements and pickup/delivery dates" icon={<Truck size={18} />}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <FormField label="Vehicle Type" required={form.status !== 'draft'} error={errors.vehicle_type_required}>
              <SelectInput
                value={form.vehicle_type_required}
                onChange={(v) => updateField('vehicle_type_required', v)}
                placeholder="— Select vehicle type —"
                options={vehicleTypes.map((vt) => ({
                  value: vt.value,
                  label: `${vt.label} (${vt.capacity_tons}T)`,
                }))}
                error={!!errors.vehicle_type_required}
              />
            </FormField>

            <FormField label="No. of Vehicles" error={errors.num_vehicles_required}>
              <TextInput
                type="number"
                value={form.num_vehicles_required}
                onChange={(v) => updateField('num_vehicles_required', Math.max(1, Number(v)))}
                error={!!errors.num_vehicles_required}
              />
            </FormField>

            <FormField label="Special Requirements">
              <TextInput
                value={form.special_requirements}
                onChange={(v) => updateField('special_requirements', v)}
                placeholder="e.g., GPS, escort etc."
              />
            </FormField>

            <FormField label="Pickup Date" required={form.status !== 'draft'} error={errors.pickup_date}>
              <TextInput
                type="datetime-local"
                value={form.pickup_date}
                onChange={(v) => updateField('pickup_date', v)}
                error={!!errors.pickup_date}
              />
            </FormField>

            <FormField label="Expected Delivery Date" error={errors.expected_delivery_date}>
              <TextInput
                type="datetime-local"
                value={form.expected_delivery_date}
                onChange={(v) => updateField('expected_delivery_date', v)}
                error={!!errors.expected_delivery_date}
              />
            </FormField>
          </div>
        </SectionCard>

        {/* ══════════════ SECTION 6: Pricing & Budget ══════════════ */}
        <SectionCard
          title="Pricing & Budget"
          subtitle="Rate, charges, GST calculation, and total amount"
          icon={<IndianRupee size={18} />}
          badge={
            pricing.total > 0 && (
              <span className="text-lg font-bold text-emerald-700">
                ₹{(pricing.total ?? 0).toLocaleString('en-IN')}
              </span>
            )
          }
        >
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left: Input fields */}
            <div className="lg:col-span-3 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Rate Type">
                  <SelectInput
                    value={form.rate_type}
                    onChange={(v) => updateField('rate_type', v)}
                    options={RATE_TYPES}
                  />
                </FormField>

                <FormField label="Agreed Rate" required={form.status !== 'draft'} error={errors.agreed_rate}>
                  <TextInput
                    type="number"
                    value={form.agreed_rate || ''}
                    onChange={(v) => updateField('agreed_rate', Number(v))}
                    placeholder="0"
                    prefix={<IndianRupee size={14} />}
                    error={!!errors.agreed_rate}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField label="Loading Charges">
                  <TextInput
                    type="number"
                    value={form.loading_charges || ''}
                    onChange={(v) => updateField('loading_charges', Number(v))}
                    placeholder="0"
                    prefix={<IndianRupee size={14} />}
                  />
                </FormField>
                <FormField label="Unloading Charges">
                  <TextInput
                    type="number"
                    value={form.unloading_charges || ''}
                    onChange={(v) => updateField('unloading_charges', Number(v))}
                    placeholder="0"
                    prefix={<IndianRupee size={14} />}
                  />
                </FormField>
                <FormField label="Other Charges">
                  <TextInput
                    type="number"
                    value={form.other_charges || ''}
                    onChange={(v) => updateField('other_charges', Number(v))}
                    placeholder="0"
                    prefix={<IndianRupee size={14} />}
                  />
                </FormField>
              </div>

              <FormField label="GST Rate">
                <div className="flex gap-2 flex-wrap">
                  {GST_OPTIONS.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => updateField('gst_percentage', g.value)}
                      className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
                        form.gst_percentage === g.value
                          ? 'border-primary-500 bg-primary-50 text-primary-700 ring-1 ring-primary-200'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </FormField>
            </div>

            {/* Right: Calculation Summary */}
            <div className="lg:col-span-2">
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
                <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <IndianRupee size={14} /> Price Summary
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Agreed Rate</span>
                    <span className="text-gray-900 font-medium">₹{(Number(form.agreed_rate) || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Loading Charges</span>
                    <span className="text-gray-900">₹{(Number(form.loading_charges) || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Unloading Charges</span>
                    <span className="text-gray-900">₹{(Number(form.unloading_charges) || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Other Charges</span>
                    <span className="text-gray-900">₹{(Number(form.other_charges) || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="border-t border-gray-200 pt-3 flex justify-between text-sm">
                    <span className="text-gray-600 font-medium">Subtotal</span>
                    <span className="text-gray-900 font-semibold">₹{(pricing.subtotal ?? 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">GST ({pricing.gstPct}%)</span>
                    <span className="text-gray-900">₹{(pricing.gstAmount ?? 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="border-t-2 border-gray-300 pt-3 flex justify-between">
                    <span className="text-gray-900 font-bold">Total Amount</span>
                    <span className="text-xl font-bold text-emerald-700">₹{(pricing.total ?? 0).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ══════════════ SECTION 7: Additional Notes ══════════════ */}
        <SectionCard
          title="Additional Notes"
          subtitle="Internal notes and special instructions"
          icon={<StickyNote size={18} />}
          collapsible
          defaultOpen={false}
        >
          <FormField label="Notes / Special Instructions">
            <TextArea
              value={form.notes}
              onChange={(v) => updateField('notes', v)}
              placeholder="E.g., Delivery only between 9 AM - 6 PM. Unloading by client. Contact person: Ramesh (98765-43210)..."
              rows={4}
            />
          </FormField>
        </SectionCard>

        {/* ══════════════ SECTION 8: Attachments ══════════════ */}
        <SectionCard
          title="Attachments"
          subtitle="Upload PO, indent, or other documents"
          icon={<Paperclip size={18} />}
          collapsible
          defaultOpen={false}
          badge={attachments.length > 0 && (
            <span className="text-xs px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full font-semibold">
              {attachments.length} file{attachments.length > 1 ? 's' : ''}
            </span>
          )}
        >
          <div className="space-y-4">
            <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-colors">
              <Upload size={28} className="text-gray-400 mb-2" />
              <p className="text-sm font-medium text-gray-600">Click to upload or drag & drop</p>
              <p className="text-xs text-gray-400 mt-1">PDF, images, Excel (max 10MB each)</p>
              <input type="file" multiple className="hidden" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.doc,.docx" />
            </label>

            {attachments.length > 0 && (
              <div className="space-y-2">
                {attachments.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <FileText size={16} className="text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">{file.name}</p>
                      <p className="text-xs text-gray-400">{Number(file.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="p-1 text-gray-400 hover:text-red-500 rounded"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>
      </form>

      {/* ══════════════ STICKY BOTTOM ACTION BAR ══════════════ */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-2xl">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/jobs')}
              className="px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <div className="text-xs text-gray-400 hidden sm:block">
              {hasErrors && (
                <span className="text-red-500 flex items-center gap-1">
                  <AlertCircle size={12} /> {Object.keys(errors).length} error(s)
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Save as Draft */}
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isSaving || createMutation.isPending || updateMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm"
            >
              {(isSaving || createMutation.isPending || updateMutation.isPending) ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Save as Draft
            </button>

            {/* Submit for Approval */}
            {hasPermission('jobs:create') && (
              <button
                type="button"
                onClick={handleSubmitForApproval}
                disabled={isSubmitting || submitMutation.isPending}
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-sm shadow-primary-200"
              >
                {(isSubmitting || submitMutation.isPending) ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                Submit for Approval
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
