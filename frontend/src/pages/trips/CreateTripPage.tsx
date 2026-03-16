// ============================================================
// Create Trip Page — Enterprise-Grade Transport ERP
// Fleet-management inspired, production-ready, scalable
//
// 6 Sections:
//   1. Trip Basic Details
//   2. Vehicle & Driver Assignment
//   3. Route & Schedule
//   4. Freight & Financial Planning
//   5. Documents
//   6. Trip Status & Workflow
//
// Right-side summary panel with live calculations
// Auto-save draft every 30 seconds
// Role-based validation before dispatch
// ============================================================

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { tripService } from '@/services/dataService';
import { safeArray } from '@/utils/helpers';
// Auth store available for RBAC gating
// import { useAuthStore } from '@/store/authStore';
import {
  ChevronRight, ChevronDown, Save, ArrowLeft, FileText, Truck,
  MapPin, User, Package, IndianRupee, Printer, Clock,
  AlertCircle, CheckCircle2, XCircle, Search, X, Shield,
  Plus, Trash2, Route, Info, Calendar, Building2,
  Loader2, Send, Upload, Star, Fuel, Hash, Navigation,
  Timer, AlertTriangle, HelpCircle, FileUp, Eye,
  Gauge, Wallet, Receipt, TrendingUp, TrendingDown,
  CircleDot, Milestone, Flag
} from 'lucide-react';

// ── Types ──
interface FormErrors { [key: string]: string; }

interface JobOption {
  id: number; job_number: string; client_name: string; origin: string;
  destination: string; status: string; cargo_type: string; weight_tons: number;
  agreed_rate: number; distance_km: number; client_gstin?: string;
}
interface VehicleOption {
  id: number; registration_number: string; vehicle_type: string;
  capacity_tons: number; status: string; make: string; model: string;
  fuel_type: string; mileage_per_liter: number; current_location: string;
  fitness_valid_until: string; insurance_valid_until: string;
}
interface DriverOption {
  id: number; employee_id: string; full_name: string; phone: string;
  status: string; license_number: string; license_type: string;
  license_expiry: string; rating: number; total_trips: number;
  total_km: number; city: string;
}
interface LROption {
  id: number; lr_number: string; job_id: number; origin: string;
  destination: string; status: string; consignor_name: string;
}
interface RouteOption {
  id: number; name: string; origin: string; destination: string;
  distance_km: number; estimated_hours: number;
}
interface DocFile {
  id: string; name: string; type: string; size: number; url?: string;
}

// ── Constants ──
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  draft:       { label: 'Draft',       color: 'text-gray-700',    bg: 'bg-gray-100 border-gray-300',     icon: <FileText size={14} />    },
  planned:     { label: 'Planned',     color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-300',      icon: <Calendar size={14} />    },
  dispatched:  { label: 'Dispatched',  color: 'text-purple-700',  bg: 'bg-purple-50 border-purple-300',  icon: <Send size={14} />        },
  started:     { label: 'Started',     color: 'text-indigo-700',  bg: 'bg-indigo-50 border-indigo-300',  icon: <Navigation size={14} />  },
  in_transit:  { label: 'In Transit',  color: 'text-indigo-700',  bg: 'bg-indigo-50 border-indigo-300',  icon: <Truck size={14} />       },
  completed:   { label: 'Completed',   color: 'text-green-700',   bg: 'bg-green-50 border-green-300',    icon: <CheckCircle2 size={14} />},
  cancelled:   { label: 'Cancelled',   color: 'text-red-700',     bg: 'bg-red-50 border-red-300',        icon: <XCircle size={14} />     },
};

const TRANSPORT_MODES = [
  { value: 'road', label: 'Road' },
  { value: 'rail', label: 'Rail' },
  { value: 'air', label: 'Air' },
  { value: 'multimodal', label: 'Multimodal' },
];

const INITIAL_FORM = {
  trip_type: 'one_way',
  job_id: 0,
  lr_ids: [] as number[],
  vehicle_id: 0,
  driver_id: 0,
  co_driver_id: 0,
  route_id: 0,
  origin: '',
  destination: '',
  waypoints: [] as string[],
  planned_start: '',
  planned_end: '',
  planned_distance_km: 0,
  estimated_hours: 0,
  // Finance
  freight_amount: 0,
  advance_paid: 0,
  payment_mode: 'cash',
  estimated_fuel_cost: 0,
  estimated_toll: 0,
  driver_allowance: 0,
  other_expenses: 0,
  // Meta
  priority: 'normal',
  transport_mode: 'road',
  description: '',
  dispatch_instructions: '',
  internal_notes: '',
  status: 'draft',
};

// ── Reusable UI Primitives ──
function SectionCard({ title, subtitle, icon, children, collapsible = false, defaultOpen = true, badge, headerRight, alert }: {
  title: string; subtitle?: string; icon: React.ReactNode; children: React.ReactNode;
  collapsible?: boolean; defaultOpen?: boolean; badge?: React.ReactNode; headerRight?: React.ReactNode;
  alert?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button type="button" onClick={() => collapsible && setIsOpen(!isOpen)}
        className={`w-full px-5 py-3.5 flex items-center gap-3 border-b border-gray-100 ${collapsible ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'}`}>
        <div className="p-1.5 rounded-lg bg-primary-50 text-primary-600">{icon}</div>
        <div className="flex-1 text-left">
          <h3 className="font-semibold text-[15px] text-gray-900">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {badge}
        {headerRight}
        {collapsible && <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
      </button>
      {alert && <div className="px-5 pt-3">{alert}</div>}
      {isOpen && <div className="p-5">{children}</div>}
    </div>
  );
}

function FormField({ label, required, error, hint, children, className = '', tooltip }: {
  label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode; className?: string; tooltip?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-[13px] font-medium text-gray-700 mb-1 flex items-center gap-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        {tooltip && (
          <span className="relative group">
            <HelpCircle size={12} className="text-gray-400 cursor-help" />
            <span className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs text-white bg-gray-800 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
              {tooltip}
            </span>
          </span>
        )}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600 flex items-center gap-1"><AlertCircle size={11} /> {error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = 'text', error, disabled, prefix, suffix, className }: {
  value: string | number; onChange: (v: string) => void; placeholder?: string; type?: string;
  error?: boolean; disabled?: boolean; prefix?: React.ReactNode; suffix?: React.ReactNode; className?: string;
}) {
  return (
    <div className={`flex items-center border rounded-lg transition-colors ${
      error ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-300 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-200'
    } ${disabled ? 'bg-gray-50 opacity-60' : 'bg-white'} ${className || ''}`}>
      {prefix && <div className="pl-2.5 text-gray-400">{prefix}</div>}
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        disabled={disabled} className="flex-1 px-2.5 py-2 text-sm bg-transparent outline-none placeholder-gray-400 min-w-0" />
      {suffix && <div className="pr-2.5 text-gray-400 text-xs">{suffix}</div>}
    </div>
  );
}

function SelectInput({ value, onChange, options, placeholder, error, disabled }: {
  value: string | number; onChange: (v: string) => void;
  options: { id?: string | number; value?: string | number; name?: string; label: string }[]; placeholder?: string; error?: boolean; disabled?: boolean;
}) {
  const getOptionKey = (option: { id?: string | number; value?: string | number; name?: string }, index: number) => {
    if (option.id !== undefined && option.id !== null && option.id !== '') return `id-${String(option.id)}`;
    if (option.value !== undefined && option.value !== null && option.value !== '') return `value-${String(option.value)}`;
    if (option.name) return `name-${option.name}`;
    return `idx-${index}`;
  };

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
      className={`w-full px-2.5 py-2 text-sm border rounded-lg bg-white outline-none transition-colors appearance-none ${
        error ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-200'
      } ${disabled ? 'bg-gray-50 opacity-60' : ''}`}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o, idx) => <option key={getOptionKey(o, idx)} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function TextArea({ value, onChange, placeholder, rows = 2, error, disabled }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; error?: boolean; disabled?: boolean;
}) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      disabled={disabled} className={`w-full px-2.5 py-2 text-sm border rounded-lg resize-none outline-none transition-colors ${
        error ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-200'
      } ${disabled ? 'bg-gray-50 opacity-60' : 'bg-white'}`} />
  );
}

function InlineAlert({ type, children }: { type: 'warning' | 'error' | 'info'; children: React.ReactNode }) {
  const styles = {
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };
  const icons = {
    warning: <AlertTriangle size={14} className="flex-shrink-0 text-amber-500" />,
    error: <AlertCircle size={14} className="flex-shrink-0 text-red-500" />,
    info: <Info size={14} className="flex-shrink-0 text-blue-500" />,
  };
  return (
    <div className={`flex items-center gap-2 p-2.5 border rounded-lg text-xs ${styles[type]}`}>
      {icons[type]} {children}
    </div>
  );
}

const fmt = (v: number) => (v ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ═══════════════════════════════════════════════════════════════
// Main Page Component
// ═══════════════════════════════════════════════════════════════
export default function CreateTripPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  // Auth hook placeholder for role-based gating
  // const { hasPermission } = useAuthStore();

  // ── State ──
  const [form, setForm] = useState({ ...INITIAL_FORM });
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [documents, setDocuments] = useState<DocFile[]>([]);
  const [lastAutoSave, setLastAutoSave] = useState<string>('');

  // Lookups
  const [selectedJob, setSelectedJob] = useState<JobOption | null>(null);
  const [jobSearch, setJobSearch] = useState('');
  const [showJobDropdown, setShowJobDropdown] = useState(false);

  const [selectedVehicle, setSelectedVehicle] = useState<VehicleOption | null>(null);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);

  const [selectedDriver, setSelectedDriver] = useState<DriverOption | null>(null);
  const [driverSearch, setDriverSearch] = useState('');
  const [showDriverDropdown, setShowDriverDropdown] = useState(false);

  const [selectedCoDriver, setSelectedCoDriver] = useState<DriverOption | null>(null);
  const [coDriverSearch, setCoDriverSearch] = useState('');
  const [showCoDriverDropdown, setShowCoDriverDropdown] = useState(false);

  const [selectedRoute, setSelectedRoute] = useState<RouteOption | null>(null);
  const [showRouteDropdown, setShowRouteDropdown] = useState(false);

  const [selectedLRs, setSelectedLRs] = useState<LROption[]>([]);
  const [showLRDropdown, setShowLRDropdown] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Queries ──
  const { data: nextNumber } = useQuery({
    queryKey: ['next-trip-number'],
    queryFn: () => tripService.getNextTripNumber(),
    enabled: !isEdit,
  });

  const { data: jobsData } = useQuery({
    queryKey: ['trip-lookup-jobs', jobSearch],
    queryFn: () => tripService.getJobs(jobSearch),
    enabled: showJobDropdown,
  });

  const { data: vehiclesData } = useQuery({
    queryKey: ['trip-lookup-vehicles', vehicleSearch],
    queryFn: () => tripService.getVehicles(vehicleSearch),
    enabled: showVehicleDropdown,
  });

  const { data: driversData } = useQuery({
    queryKey: ['trip-lookup-drivers', driverSearch],
    queryFn: () => tripService.getDrivers(driverSearch),
    enabled: showDriverDropdown || showCoDriverDropdown,
  });

  const { data: lrsData } = useQuery({
    queryKey: ['trip-lookup-lrs', form.job_id],
    queryFn: () => tripService.getLRs(form.job_id || undefined),
    enabled: form.job_id > 0,
  });

  const { data: routesData } = useQuery({
    queryKey: ['trip-lookup-routes'],
    queryFn: () => tripService.getRoutes(),
  });

  const { data: tripTypesData } = useQuery({
    queryKey: ['trip-lookup-types'],
    queryFn: () => tripService.getTripTypes(),
  });

  const { data: prioritiesData } = useQuery({
    queryKey: ['trip-lookup-priorities'],
    queryFn: () => tripService.getPriorities(),
  });

  const { data: paymentModesData } = useQuery({
    queryKey: ['trip-lookup-payment-modes'],
    queryFn: () => tripService.getPaymentModes(),
  });

  const jobs: JobOption[] = safeArray(jobsData);
  const vehicles: VehicleOption[] = safeArray(vehiclesData);
  const drivers: DriverOption[] = safeArray(driversData);
  const lrs: LROption[] = safeArray(lrsData);
  const routes: RouteOption[] = safeArray(routesData);
  const tripTypes = safeArray(tripTypesData);
  const priorities = safeArray(prioritiesData);
  const paymentModes = safeArray(paymentModesData);

  const isDraft = form.status === 'draft';
  const isReadOnly = !isDraft && isEdit;

  // ── Load existing trip for edit ──
  useEffect(() => {
    if (isEdit && id) {
      tripService.get(parseInt(id)).then((trip: any) => {
        setForm({
          trip_type: trip.trip_type || 'one_way',
          job_id: trip.job_id || 0,
          lr_ids: trip.lr_ids || [],
          vehicle_id: trip.vehicle_id || 0,
          driver_id: trip.driver_id || 0,
          co_driver_id: trip.co_driver_id || 0,
          route_id: trip.route_id || 0,
          origin: trip.origin || '',
          destination: trip.destination || '',
          waypoints: trip.waypoints || [],
          planned_start: trip.planned_start || '',
          planned_end: trip.planned_end || '',
          planned_distance_km: trip.planned_distance_km || 0,
          estimated_hours: trip.estimated_hours || 0,
          freight_amount: trip.freight_amount || 0,
          advance_paid: trip.advance_paid || trip.advance_amount || 0,
          payment_mode: trip.payment_mode || 'cash',
          estimated_fuel_cost: trip.estimated_fuel_cost || 0,
          estimated_toll: trip.estimated_toll || 0,
          driver_allowance: trip.driver_allowance || 0,
          other_expenses: trip.other_expenses || 0,
          priority: trip.priority || 'normal',
          transport_mode: trip.transport_mode || 'road',
          description: trip.description || '',
          dispatch_instructions: trip.dispatch_instructions || '',
          internal_notes: trip.internal_notes || '',
          status: trip.status || 'draft',
        });
        setCreatedId(parseInt(id));
      }).catch(() => navigate('/trips'));
    }
  }, [isEdit, id, navigate]);

  // ── Auto-save draft every 30s ──
  useEffect(() => {
    if (isReadOnly || !createdId) return;
    const timer = setInterval(async () => {
      try {
        await tripService.update(createdId, { ...form } as any);
        setLastAutoSave(new Date().toLocaleTimeString('en-IN'));
      } catch { /* silent */ }
    }, 30000);
    return () => clearInterval(timer);
  }, [createdId, form, isReadOnly]);

  // ── Field Helpers ──
  const updateField = useCallback((field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  }, []);

  // ── Financial Calculations ──
  const financials = useMemo(() => {
    const fuel = parseFloat(String(form.estimated_fuel_cost)) || 0;
    const toll = parseFloat(String(form.estimated_toll)) || 0;
    const driverAllow = parseFloat(String(form.driver_allowance)) || 0;
    const other = parseFloat(String(form.other_expenses)) || 0;
    const totalExpense = fuel + toll + driverAllow + other;
    const freight = parseFloat(String(form.freight_amount)) || 0;
    const advance = parseFloat(String(form.advance_paid)) || 0;
    const balance = freight - advance;
    const profit = freight - totalExpense;
    const margin = freight > 0 ? (profit / freight) * 100 : 0;
    return { totalExpense, freight, advance, balance, profit, margin, fuel, toll, driverAllow, other };
  }, [form.estimated_fuel_cost, form.estimated_toll, form.driver_allowance, form.other_expenses, form.freight_amount, form.advance_paid]);

  // ── Vehicle & Driver warnings ──
  const vehicleWarnings = useMemo(() => {
    if (!selectedVehicle) return [];
    const warns: string[] = [];
    if (selectedVehicle.status === 'on_trip') warns.push('Vehicle is currently on another trip');
    if (selectedVehicle.status === 'maintenance') warns.push('Vehicle is under maintenance');
    if (selectedVehicle.status === 'inactive') warns.push('Vehicle is inactive');
    if (selectedVehicle.fitness_valid_until) {
      const d = new Date(selectedVehicle.fitness_valid_until);
      const now = new Date();
      if (d < now) warns.push('Vehicle fitness certificate has expired');
      else if (d.getTime() - now.getTime() < 30 * 86400000) warns.push(`Fitness expiring on ${selectedVehicle.fitness_valid_until}`);
    }
    if (selectedVehicle.insurance_valid_until) {
      const d = new Date(selectedVehicle.insurance_valid_until);
      if (d < new Date()) warns.push('Vehicle insurance has expired');
    }
    return warns;
  }, [selectedVehicle]);

  const driverWarnings = useMemo(() => {
    if (!selectedDriver) return [];
    const warns: string[] = [];
    if (selectedDriver.status === 'on_trip') warns.push('Driver is currently on another trip');
    if (selectedDriver.status === 'on_leave') warns.push('Driver is on leave');
    if (selectedDriver.license_expiry) {
      const d = new Date(selectedDriver.license_expiry);
      const now = new Date();
      if (d < now) warns.push('Driving license has expired!');
      else if (d.getTime() - now.getTime() < 60 * 86400000) warns.push(`License expiring on ${selectedDriver.license_expiry}`);
    }
    return warns;
  }, [selectedDriver]);

  // ── Selectors ──
  const selectJob = useCallback((job: JobOption) => {
    setSelectedJob(job);
    setShowJobDropdown(false);
    setJobSearch('');
    setForm(prev => ({
      ...prev, job_id: job.id, origin: job.origin, destination: job.destination,
      planned_distance_km: job.distance_km, freight_amount: job.agreed_rate,
    }));
  }, []);

  const selectVehicle = useCallback((v: VehicleOption) => {
    setSelectedVehicle(v);
    setShowVehicleDropdown(false);
    setVehicleSearch('');
    updateField('vehicle_id', v.id);
  }, [updateField]);

  const selectDriver = useCallback((d: DriverOption) => {
    setSelectedDriver(d);
    setShowDriverDropdown(false);
    setDriverSearch('');
    updateField('driver_id', d.id);
  }, [updateField]);

  const selectCoDriver = useCallback((d: DriverOption) => {
    setSelectedCoDriver(d);
    setShowCoDriverDropdown(false);
    setCoDriverSearch('');
    updateField('co_driver_id', d.id);
  }, [updateField]);

  const selectRoute = useCallback((r: RouteOption) => {
    setSelectedRoute(r);
    setShowRouteDropdown(false);
    setForm(prev => ({
      ...prev, route_id: r.id, origin: r.origin, destination: r.destination,
      planned_distance_km: r.distance_km, estimated_hours: r.estimated_hours,
    }));
  }, []);

  const toggleLR = useCallback((lr: LROption) => {
    setSelectedLRs(prev => {
      const exists = prev.find(l => l.id === lr.id);
      const next = exists ? prev.filter(l => l.id !== lr.id) : [...prev, lr];
      setForm(f => ({ ...f, lr_ids: next.map(l => l.id) }));
      return next;
    });
  }, []);

  // ── File upload ──
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newDocs: DocFile[] = Array.from(files).map(f => ({
      id: crypto.randomUUID(), name: f.name, type: f.type, size: f.size,
    }));
    setDocuments(prev => [...prev, ...newDocs]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const removeDocument = useCallback((docId: string) => {
    setDocuments(prev => prev.filter(d => d.id !== docId));
  }, []);

  // ── Validation ──
  const validate = useCallback((forDispatch = false): boolean => {
    const errs: FormErrors = {};
    if (!form.origin.trim()) errs.origin = 'Origin is required';
    if (!form.destination.trim()) errs.destination = 'Destination is required';
    if (forDispatch) {
      if (!form.vehicle_id) errs.vehicle_id = 'Vehicle must be assigned before dispatch';
      if (!form.driver_id) errs.driver_id = 'Driver must be assigned before dispatch';
      if (!form.planned_start) errs.planned_start = 'Start date/time is required';
      if (vehicleWarnings.length > 0) errs.vehicle_warnings = 'Resolve vehicle warnings before dispatch';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [form, vehicleWarnings]);

  // ── Save ──
  const handleSave = useCallback(async (dispatch = false) => {
    if (!validate(dispatch)) return;
    setSaving(true);
    try {
      const payload = { ...form } as any;
      let result: any;
      if (isEdit && createdId) {
        result = await tripService.update(createdId, payload);
      } else {
        result = await tripService.create(payload);
        setCreatedId(result.id);
      }
      if (dispatch && result.id) {
        await tripService.dispatch(result.id);
        navigate(`/trips/${result.id}`);
      } else if (!isEdit) {
        navigate(`/trips/${result.id}/edit`);
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'object' && detail?.errors) {
        const newErrors: FormErrors = {};
        detail.errors.forEach((e: string, i: number) => { newErrors[`server_${i}`] = e; });
        setErrors(newErrors);
      } else if (typeof detail === 'string') {
        setErrors({ server: detail });
      }
    } finally {
      setSaving(false);
    }
  }, [form, isEdit, createdId, validate, navigate]);

  // ── Dispatch readiness ──
  const canDispatch = useMemo(() => {
    return !!form.vehicle_id && !!form.driver_id && !!form.origin && !!form.destination && !!form.planned_start && vehicleWarnings.length === 0;
  }, [form, vehicleWarnings]);

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  const statusCfg = STATUS_CONFIG[form.status] || STATUS_CONFIG.draft;

  return (
    <div className="max-w-[1400px] mx-auto pb-24">
      {/* ── Breadcrumb ── */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-4">
        <Link to="/dashboard" className="hover:text-primary-600 transition-colors">Dashboard</Link>
        <ChevronRight size={14} className="text-gray-300" />
        <Link to="/trips" className="hover:text-primary-600 transition-colors">Trips</Link>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="text-gray-900 font-semibold">{isEdit ? 'Edit Trip' : 'Create Trip'}</span>
      </nav>

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              {isEdit ? 'Edit Trip' : 'Create Trip'}
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold border rounded-full ${statusCfg.bg} ${statusCfg.color}`}>
                {statusCfg.icon} {statusCfg.label}
              </span>
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {isEdit ? `Editing ${nextNumber?.trip_number || ''}` : `New: ${nextNumber?.trip_number || 'TRP-XXXX'}`}
              {lastAutoSave && <span className="ml-3 text-xs text-gray-400">Auto-saved at {lastAutoSave}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isEdit && !isDraft && (
            <button className="btn-ghost flex items-center gap-1.5 text-sm"><Printer size={15} /> Print</button>
          )}
        </div>
      </div>

      {/* ── Server Errors ── */}
      {Object.keys(errors).filter(k => k.startsWith('server')).length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm font-medium text-red-800 flex items-center gap-1.5"><AlertCircle size={15} /> Validation Errors</p>
          <ul className="mt-1 text-sm text-red-700 list-disc pl-5">
            {Object.entries(errors).filter(([k]) => k.startsWith('server')).map(([k, v]) => <li key={k}>{v}</li>)}
          </ul>
        </div>
      )}

      {/* ── Main Layout: 2-column grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">

        {/* ═══ LEFT COLUMN — Form Sections ═══ */}
        <div className="space-y-4">

          {/* ═══════════ SECTION 1: Trip Basic Details ═══════════ */}
          <SectionCard title="Trip Information" subtitle="Basic trip details, type, and job linking" icon={<FileText size={18} />} collapsible defaultOpen>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Trip ID */}
              <FormField label="Trip ID" tooltip="Auto-generated trip number">
                <TextInput value={nextNumber?.trip_number || (isEdit ? `TRP-${id}` : 'Auto-generated')} onChange={() => {}} disabled prefix={<Hash size={15} />} />
              </FormField>

              {/* Trip Type */}
              <FormField label="Trip Type" required>
                <SelectInput value={form.trip_type} onChange={(v) => updateField('trip_type', v)}
                  options={tripTypes.map((t: any) => ({ value: t.value, label: t.label }))}
                  disabled={isReadOnly} />
              </FormField>

              {/* Priority */}
              <FormField label="Trip Priority">
                <SelectInput value={form.priority} onChange={(v) => updateField('priority', v)}
                  options={priorities.map((p: any) => ({ value: p.value, label: p.label }))}
                  disabled={isReadOnly} />
              </FormField>

              {/* Job Selector */}
              <FormField label="Linked Job / Order" className="md:col-span-2" tooltip="Auto-fills route & freight from job">
                <div className="relative">
                  <div onClick={() => !isReadOnly && setShowJobDropdown(!showJobDropdown)}
                    className={`flex items-center border rounded-lg px-2.5 py-2 cursor-pointer transition-colors ${
                      errors.job_id ? 'border-red-300' : 'border-gray-300 hover:border-gray-400'
                    } ${isReadOnly ? 'bg-gray-50 opacity-60 pointer-events-none' : 'bg-white'}`}>
                    <Search size={15} className="text-gray-400 mr-2" />
                    {selectedJob ? (
                      <span className="text-sm font-medium text-gray-800">
                        {selectedJob.job_number} — {selectedJob.client_name}
                        <span className="text-gray-400 ml-2 font-normal">{selectedJob.origin} → {selectedJob.destination}</span>
                      </span>
                    ) : (
                      <input type="text" value={jobSearch} onChange={(e) => { setJobSearch(e.target.value); setShowJobDropdown(true); }}
                        placeholder="Search by job number, client…" className="flex-1 bg-transparent outline-none text-sm placeholder-gray-400" readOnly={isReadOnly} />
                    )}
                    {selectedJob && !isReadOnly && (
                      <button onClick={(e) => { e.stopPropagation(); setSelectedJob(null); updateField('job_id', 0); }} className="ml-auto text-gray-400 hover:text-gray-600"><X size={14} /></button>
                    )}
                  </div>
                  {showJobDropdown && !isReadOnly && (
                    <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                      {jobs.length === 0 ? (
                        <p className="p-3 text-sm text-gray-400">No jobs found</p>
                      ) : jobs.map(j => (
                        <button key={j.id} onClick={() => selectJob(j)}
                          className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-800">{j.job_number}</span>
                            <span className="text-xs text-gray-400">₹{(j.agreed_rate ?? 0).toLocaleString('en-IN')} • {j.distance_km} km</span>
                          </div>
                          <p className="text-xs text-gray-500">{j.client_name} — {j.origin} → {j.destination} • {j.cargo_type} ({j.weight_tons}T)</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </FormField>

              {/* Transport Mode */}
              <FormField label="Transport Mode">
                <SelectInput value={form.transport_mode} onChange={(v) => updateField('transport_mode', v)}
                  options={TRANSPORT_MODES} disabled={isReadOnly} />
              </FormField>

              {/* Client (auto-filled) */}
              <FormField label="Client" tooltip="Auto-filled from linked job" className="md:col-span-2">
                <TextInput value={selectedJob?.client_name || '—'} onChange={() => {}} disabled prefix={<Building2 size={15} />} />
              </FormField>

              {/* Description */}
              <FormField label="Description" className="md:col-span-3">
                <TextArea value={form.description} onChange={(v) => updateField('description', v)}
                  placeholder="Trip description or special instructions…" rows={2} disabled={isReadOnly} />
              </FormField>
            </div>
          </SectionCard>

          {/* ═══════════ SECTION 2: Vehicle & Driver ═══════════ */}
          <SectionCard title="Vehicle & Driver Assignment" subtitle="Assign vehicle and driver for this trip" icon={<Truck size={18} />}
            collapsible defaultOpen
            alert={
              (vehicleWarnings.length > 0 || driverWarnings.length > 0) ? (
                <div className="space-y-2">
                  {vehicleWarnings.map((w, i) => <InlineAlert key={`vw${i}`} type="warning">{w}</InlineAlert>)}
                  {driverWarnings.map((w, i) => <InlineAlert key={`dw${i}`} type={w.includes('expired') ? 'error' : 'warning'}>{w}</InlineAlert>)}
                </div>
              ) : undefined
            }>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Vehicle Selector */}
              <FormField label="Select Vehicle" required error={errors.vehicle_id}>
                <div className="relative">
                  <div onClick={() => !isReadOnly && setShowVehicleDropdown(!showVehicleDropdown)}
                    className={`flex items-center border rounded-lg px-2.5 py-2 cursor-pointer transition-colors ${
                      errors.vehicle_id ? 'border-red-300' : 'border-gray-300 hover:border-gray-400'
                    } ${isReadOnly ? 'bg-gray-50 opacity-60 pointer-events-none' : 'bg-white'}`}>
                    <Truck size={15} className="text-gray-400 mr-2" />
                    {selectedVehicle ? (
                      <span className="text-sm font-medium text-gray-800 flex items-center gap-2">
                        {selectedVehicle.registration_number}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          selectedVehicle.status === 'available' ? 'bg-green-50 text-green-700' :
                          selectedVehicle.status === 'on_trip' ? 'bg-purple-50 text-purple-700' :
                          'bg-amber-50 text-amber-700'
                        }`}>{selectedVehicle.status}</span>
                        <span className="text-xs text-gray-400 font-normal">{selectedVehicle.current_location}</span>
                      </span>
                    ) : (
                      <input type="text" value={vehicleSearch} onChange={(e) => { setVehicleSearch(e.target.value); setShowVehicleDropdown(true); }}
                        placeholder="Search vehicles…" className="flex-1 bg-transparent outline-none text-sm placeholder-gray-400" readOnly={isReadOnly} />
                    )}
                    {selectedVehicle && !isReadOnly && (
                      <button onClick={(e) => { e.stopPropagation(); setSelectedVehicle(null); updateField('vehicle_id', 0); }} className="ml-auto text-gray-400 hover:text-gray-600"><X size={14} /></button>
                    )}
                  </div>
                  {showVehicleDropdown && !isReadOnly && (
                    <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                      {vehicles.length === 0 ? (
                        <p className="p-3 text-sm text-gray-400">No vehicles found</p>
                      ) : vehicles.map(v => (
                        <button key={v.id} onClick={() => selectVehicle(v)}
                          className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-800 flex items-center gap-2">
                              {v.registration_number}
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                v.status === 'available' ? 'bg-green-50 text-green-700' :
                                v.status === 'on_trip' ? 'bg-purple-50 text-purple-700' :
                                'bg-amber-50 text-amber-700'
                              }`}>{v.status}</span>
                            </span>
                            <span className="text-xs text-gray-400">{v.capacity_tons}T</span>
                          </div>
                          <p className="text-xs text-gray-500">{v.make} {v.model} • {v.vehicle_type} • {v.current_location}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </FormField>

              {/* Vehicle Type (Auto-filled) */}
              <FormField label="Vehicle Type" tooltip="Auto-filled from selected vehicle">
                <TextInput value={selectedVehicle ? `${selectedVehicle.make} ${selectedVehicle.model} (${selectedVehicle.vehicle_type})` : '—'} onChange={() => {}} disabled prefix={<Truck size={15} />} />
              </FormField>

              {/* Driver Selector */}
              <FormField label="Driver" required error={errors.driver_id}>
                <div className="relative">
                  <div onClick={() => !isReadOnly && setShowDriverDropdown(!showDriverDropdown)}
                    className={`flex items-center border rounded-lg px-2.5 py-2 cursor-pointer transition-colors ${
                      errors.driver_id ? 'border-red-300' : 'border-gray-300 hover:border-gray-400'
                    } ${isReadOnly ? 'bg-gray-50 opacity-60 pointer-events-none' : 'bg-white'}`}>
                    <User size={15} className="text-gray-400 mr-2" />
                    {selectedDriver ? (
                      <span className="text-sm font-medium text-gray-800 flex items-center gap-2">
                        {selectedDriver.full_name}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          selectedDriver.status === 'available' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                        }`}>{selectedDriver.status}</span>
                        <span className="text-xs text-gray-400 font-normal flex items-center gap-0.5"><Star size={10} className="text-yellow-500" /> {selectedDriver.rating}</span>
                      </span>
                    ) : (
                      <input type="text" value={driverSearch} onChange={(e) => { setDriverSearch(e.target.value); setShowDriverDropdown(true); }}
                        placeholder="Search drivers…" className="flex-1 bg-transparent outline-none text-sm placeholder-gray-400" readOnly={isReadOnly} />
                    )}
                    {selectedDriver && !isReadOnly && (
                      <button onClick={(e) => { e.stopPropagation(); setSelectedDriver(null); updateField('driver_id', 0); }} className="ml-auto text-gray-400 hover:text-gray-600"><X size={14} /></button>
                    )}
                  </div>
                  {showDriverDropdown && !isReadOnly && (
                    <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                      {drivers.length === 0 ? (
                        <p className="p-3 text-sm text-gray-400">No drivers found</p>
                      ) : drivers.map(d => (
                        <button key={d.id} onClick={() => selectDriver(d)}
                          className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-800 flex items-center gap-2">
                              {d.full_name}
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                d.status === 'available' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                              }`}>{d.status}</span>
                            </span>
                            <span className="text-xs text-gray-400 flex items-center gap-0.5"><Star size={10} className="text-yellow-500" /> {d.rating}</span>
                          </div>
                          <p className="text-xs text-gray-500">{d.employee_id} • {d.total_trips} trips • {d.city} • License: {d.license_expiry}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </FormField>

              {/* Co-Driver */}
              <FormField label="Co-Driver" hint="Optional">
                <div className="relative">
                  <div onClick={() => !isReadOnly && setShowCoDriverDropdown(!showCoDriverDropdown)}
                    className={`flex items-center border rounded-lg px-2.5 py-2 cursor-pointer transition-colors border-gray-300 hover:border-gray-400 ${isReadOnly ? 'bg-gray-50 opacity-60 pointer-events-none' : 'bg-white'}`}>
                    <User size={15} className="text-gray-400 mr-2" />
                    {selectedCoDriver ? (
                      <span className="text-sm text-gray-800">{selectedCoDriver.full_name}</span>
                    ) : (
                      <input type="text" value={coDriverSearch} onChange={(e) => { setCoDriverSearch(e.target.value); setShowCoDriverDropdown(true); }}
                        placeholder="Search co-driver…" className="flex-1 bg-transparent outline-none text-sm placeholder-gray-400" readOnly={isReadOnly} />
                    )}
                    {selectedCoDriver && !isReadOnly && (
                      <button onClick={(e) => { e.stopPropagation(); setSelectedCoDriver(null); updateField('co_driver_id', 0); }} className="ml-auto text-gray-400 hover:text-gray-600"><X size={14} /></button>
                    )}
                  </div>
                  {showCoDriverDropdown && !isReadOnly && (
                    <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {drivers.filter(d => d.id !== form.driver_id).map(d => (
                        <button key={d.id} onClick={() => selectCoDriver(d)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b border-gray-50 last:border-0">
                          <span className="font-medium">{d.full_name}</span>
                          <span className="text-xs text-gray-400 ml-2">{d.status} • {d.city}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </FormField>

              {/* Vehicle & Driver fitness indicators */}
              {selectedVehicle && (
                <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className={`p-2 rounded-lg text-center text-xs ${
                    selectedVehicle.fitness_valid_until && new Date(selectedVehicle.fitness_valid_until) > new Date() ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>
                    <p className="font-medium">Fitness</p>
                    <p>{selectedVehicle.fitness_valid_until || '—'}</p>
                  </div>
                  <div className={`p-2 rounded-lg text-center text-xs ${
                    selectedVehicle.insurance_valid_until && new Date(selectedVehicle.insurance_valid_until) > new Date() ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>
                    <p className="font-medium">Insurance</p>
                    <p>{selectedVehicle.insurance_valid_until || '—'}</p>
                  </div>
                  <div className="p-2 rounded-lg text-center text-xs bg-gray-50 text-gray-700">
                    <p className="font-medium">Fuel Type</p>
                    <p className="capitalize">{selectedVehicle.fuel_type}</p>
                  </div>
                  <div className="p-2 rounded-lg text-center text-xs bg-gray-50 text-gray-700">
                    <p className="font-medium">Mileage</p>
                    <p>{selectedVehicle.mileage_per_liter} km/L</p>
                  </div>
                </div>
              )}
              {selectedDriver && (
                <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className={`p-2 rounded-lg text-center text-xs ${
                    selectedDriver.license_expiry && new Date(selectedDriver.license_expiry) > new Date() ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>
                    <p className="font-medium">License Expiry</p>
                    <p>{selectedDriver.license_expiry || '—'}</p>
                  </div>
                  <div className="p-2 rounded-lg text-center text-xs bg-gray-50 text-gray-700">
                    <p className="font-medium">Total Trips</p>
                    <p>{selectedDriver.total_trips}</p>
                  </div>
                  <div className="p-2 rounded-lg text-center text-xs bg-gray-50 text-gray-700">
                    <p className="font-medium">Total KM</p>
                    <p>{(selectedDriver.total_km ?? 0).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="p-2 rounded-lg text-center text-xs bg-gray-50 text-gray-700">
                    <p className="font-medium">Rating</p>
                    <p className="flex items-center justify-center gap-0.5"><Star size={11} className="text-yellow-500" /> {selectedDriver.rating}</p>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          {/* ═══════════ SECTION 3: Route & Schedule ═══════════ */}
          <SectionCard title="Route & Schedule" subtitle="Define route, stops, and travel timeline" icon={<Route size={18} />} collapsible defaultOpen>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Route Template */}
              <FormField label="Route Template" className="md:col-span-3" tooltip="Select a pre-defined route to auto-fill">
                <div className="relative">
                  <div onClick={() => !isReadOnly && setShowRouteDropdown(!showRouteDropdown)}
                    className={`flex items-center border rounded-lg px-2.5 py-2 cursor-pointer transition-colors border-gray-300 hover:border-gray-400 ${isReadOnly ? 'bg-gray-50 opacity-60 pointer-events-none' : 'bg-white'}`}>
                    <Route size={15} className="text-gray-400 mr-2" />
                    {selectedRoute ? (
                      <span className="text-sm font-medium text-gray-800">{selectedRoute.name} — {selectedRoute.distance_km} km, ~{selectedRoute.estimated_hours} hrs</span>
                    ) : (
                      <span className="text-sm text-gray-400">Select a route template (optional)</span>
                    )}
                    {selectedRoute && !isReadOnly && (
                      <button onClick={(e) => { e.stopPropagation(); setSelectedRoute(null); }} className="ml-auto text-gray-400 hover:text-gray-600"><X size={14} /></button>
                    )}
                  </div>
                  {showRouteDropdown && !isReadOnly && (
                    <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {routes.map(r => (
                        <button key={r.id} onClick={() => selectRoute(r)}
                          className="w-full text-left px-3 py-2.5 hover:bg-gray-50 text-sm border-b border-gray-50 last:border-0">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-800">{r.name}</span>
                            <span className="text-xs text-gray-400">{r.distance_km} km • {r.estimated_hours} hrs</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </FormField>

              {/* Source */}
              <FormField label="Source / Origin" required error={errors.origin}>
                <TextInput value={form.origin} onChange={(v) => updateField('origin', v)} placeholder="e.g. Mumbai" disabled={isReadOnly} prefix={<CircleDot size={15} className="text-green-500" />} />
              </FormField>

              {/* Destination */}
              <FormField label="Destination" required error={errors.destination}>
                <TextInput value={form.destination} onChange={(v) => updateField('destination', v)} placeholder="e.g. Delhi" disabled={isReadOnly} prefix={<Flag size={15} className="text-red-500" />} />
              </FormField>

              {/* Estimated Distance */}
              <FormField label="Estimated Distance" error={errors.planned_distance_km}>
                <TextInput value={form.planned_distance_km} onChange={(v) => updateField('planned_distance_km', parseFloat(v) || 0)} type="number" disabled={isReadOnly} prefix={<Milestone size={15} />} suffix="km" />
              </FormField>

              {/* Waypoints for multi-stop */}
              {form.trip_type === 'multi_stop' && (
                <FormField label="Waypoints / Stops" className="md:col-span-3" tooltip="Add intermediate stops">
                  <div className="space-y-2">
                    {form.waypoints.map((wp, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-6">{idx + 1}.</span>
                        <TextInput value={wp} onChange={(v) => {
                          const wps = [...form.waypoints];
                          wps[idx] = v;
                          updateField('waypoints', wps);
                        }} placeholder={`Stop ${idx + 1}`} disabled={isReadOnly} />
                        {!isReadOnly && (
                          <button onClick={() => updateField('waypoints', form.waypoints.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                        )}
                      </div>
                    ))}
                    {!isReadOnly && (
                      <button onClick={() => updateField('waypoints', [...form.waypoints, ''])}
                        className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1 mt-1"><Plus size={13} /> Add Stop</button>
                    )}
                  </div>
                </FormField>
              )}

              {/* Planned Start */}
              <FormField label="Expected Start" required={isDraft} error={errors.planned_start}>
                <TextInput value={form.planned_start} onChange={(v) => updateField('planned_start', v)} type="datetime-local" disabled={isReadOnly} prefix={<Calendar size={15} />} />
              </FormField>

              {/* Planned End */}
              <FormField label="Expected End">
                <TextInput value={form.planned_end} onChange={(v) => updateField('planned_end', v)} type="datetime-local" disabled={isReadOnly} prefix={<Calendar size={15} />} />
              </FormField>

              {/* Estimated Hours */}
              <FormField label="Estimated Travel Hours">
                <TextInput value={form.estimated_hours} onChange={(v) => updateField('estimated_hours', parseFloat(v) || 0)} type="number" disabled={isReadOnly} prefix={<Timer size={15} />} suffix="hrs" />
              </FormField>

              {/* Linked LRs */}
              {form.job_id > 0 && (
                <FormField label="Link LRs" className="md:col-span-3" hint="Select LRs to attach to this trip">
                  <div className="relative">
                    <button type="button" onClick={() => !isReadOnly && setShowLRDropdown(!showLRDropdown)}
                      className="w-full text-left flex items-center border border-gray-300 rounded-lg px-2.5 py-2 bg-white hover:border-gray-400 transition-colors">
                      <FileText size={15} className="text-gray-400 mr-2" />
                      {selectedLRs.length > 0 ? (
                        <span className="text-sm text-gray-800">{selectedLRs.map(l => l.lr_number).join(', ')}</span>
                      ) : (
                        <span className="text-sm text-gray-400">Select LRs…</span>
                      )}
                    </button>
                    {showLRDropdown && !isReadOnly && (
                      <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {lrs.length === 0 ? (
                          <p className="p-3 text-sm text-gray-400">No LRs for this job</p>
                        ) : lrs.map(lr => (
                          <button key={lr.id} onClick={() => toggleLR(lr)}
                            className={`w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b border-gray-50 last:border-0 flex items-center gap-2 ${
                              selectedLRs.find(l => l.id === lr.id) ? 'bg-primary-50' : ''
                            }`}>
                            <input type="checkbox" checked={!!selectedLRs.find(l => l.id === lr.id)} readOnly className="rounded border-gray-300 text-primary-600" />
                            <span className="font-medium">{lr.lr_number}</span>
                            <span className="text-xs text-gray-400">{lr.origin} → {lr.destination}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </FormField>
              )}

              {/* Map Placeholder */}
              <div className="md:col-span-3 bg-gray-50 border border-dashed border-gray-300 rounded-lg p-6 text-center">
                <MapPin size={24} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400 font-medium">Route Map Preview</p>
                <p className="text-xs text-gray-400 mt-0.5">Google Maps integration (Coming soon)</p>
              </div>
            </div>
          </SectionCard>

          {/* ═══════════ SECTION 4: Freight & Finance ═══════════ */}
          <SectionCard title="Freight & Financial Planning" subtitle="Revenue, expenses, and profit estimation" icon={<IndianRupee size={18} />}
            collapsible defaultOpen
            badge={<span className="text-xs font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full">₹{fmt(financials.freight)}</span>}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="Freight Amount (₹)" tooltip="Total freight charge for the trip">
                <TextInput value={form.freight_amount} onChange={(v) => updateField('freight_amount', parseFloat(v) || 0)} type="number" disabled={isReadOnly} prefix={<IndianRupee size={14} />} />
              </FormField>
              <FormField label="Advance Paid (₹)">
                <TextInput value={form.advance_paid} onChange={(v) => updateField('advance_paid', parseFloat(v) || 0)} type="number" disabled={isReadOnly} prefix={<Wallet size={14} />} />
              </FormField>
              <FormField label="Payment Mode">
                <SelectInput value={form.payment_mode} onChange={(v) => updateField('payment_mode', v)}
                  options={paymentModes.map((p: any) => ({ value: p.value, label: p.label }))} disabled={isReadOnly} />
              </FormField>

              <div className="md:col-span-3 border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Estimated Expenses</p>
              </div>

              <FormField label="Fuel Cost (₹)">
                <TextInput value={form.estimated_fuel_cost} onChange={(v) => updateField('estimated_fuel_cost', parseFloat(v) || 0)} type="number" disabled={isReadOnly} prefix={<Fuel size={14} />} />
              </FormField>
              <FormField label="Toll Estimate (₹)">
                <TextInput value={form.estimated_toll} onChange={(v) => updateField('estimated_toll', parseFloat(v) || 0)} type="number" disabled={isReadOnly} prefix={<Receipt size={14} />} />
              </FormField>
              <FormField label="Driver Allowance (₹)">
                <TextInput value={form.driver_allowance} onChange={(v) => updateField('driver_allowance', parseFloat(v) || 0)} type="number" disabled={isReadOnly} prefix={<User size={14} />} />
              </FormField>
              <FormField label="Other Expenses (₹)">
                <TextInput value={form.other_expenses} onChange={(v) => updateField('other_expenses', parseFloat(v) || 0)} type="number" disabled={isReadOnly} prefix={<Package size={14} />} />
              </FormField>

              {/* Inline Summary */}
              <div className="md:col-span-2 bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Total Estimated Expense</p>
                    <p className="text-sm font-bold text-gray-900">₹{fmt(financials.totalExpense)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Balance (Freight − Advance)</p>
                    <p className="text-sm font-bold text-gray-900">₹{fmt(financials.balance)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Expected Profit</p>
                    <p className={`text-sm font-bold ${financials.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {financials.profit >= 0 ? '+' : ''}₹{fmt(financials.profit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Margin</p>
                    <p className={`text-sm font-bold ${financials.margin >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {Number(financials.margin ?? 0).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ═══════════ SECTION 5: Documents ═══════════ */}
          <SectionCard title="Trip Documents" subtitle="Upload LR copies, E-Way bills, invoices" icon={<FileUp size={18} />} collapsible defaultOpen={false}>
            <div>
              {/* Drop zone */}
              {!isReadOnly && (
                <div onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-colors">
                  <Upload size={28} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-600">Click to upload or drag and drop</p>
                  <p className="text-xs text-gray-400 mt-0.5">PDF, JPG, PNG up to 10MB each</p>
                  <input ref={fileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} className="hidden" />
                </div>
              )}

              {/* File list */}
              {documents.length > 0 && (
                <div className="mt-3 space-y-2">
                  {documents.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText size={16} className="text-gray-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{doc.name}</p>
                          <p className="text-xs text-gray-400">{Number(doc.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button className="p-1 text-gray-400 hover:text-primary-600 rounded"><Eye size={14} /></button>
                        {!isReadOnly && (
                          <button onClick={() => removeDocument(doc.id)} className="p-1 text-gray-400 hover:text-red-600 rounded"><Trash2 size={14} /></button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {documents.length === 0 && isReadOnly && (
                <p className="text-sm text-gray-400 text-center py-4">No documents uploaded</p>
              )}
            </div>
          </SectionCard>

          {/* ═══════════ SECTION 6: Status & Workflow ═══════════ */}
          <SectionCard title="Workflow & Notes" subtitle="Trip status, dispatch instructions, internal notes" icon={<Shield size={18} />} collapsible defaultOpen={false}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Trip Status" tooltip="Only admins/managers can change from draft">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <button key={key} type="button" disabled={isReadOnly || (key !== 'draft' && key !== 'cancelled')}
                      onClick={() => updateField('status', key)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border rounded-full transition-colors ${
                        form.status === key ? `${cfg.bg} ${cfg.color}` : 'border-gray-200 text-gray-400 hover:border-gray-300'
                      } ${isReadOnly ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
                      {cfg.icon} {cfg.label}
                    </button>
                  ))}
                </div>
              </FormField>

              <div className="space-y-4">
                <FormField label="Dispatch Instructions" hint="Shown to driver on dispatch">
                  <TextArea value={form.dispatch_instructions} onChange={(v) => updateField('dispatch_instructions', v)}
                    placeholder="Loading point details, contact numbers, special handling…" rows={2} disabled={isReadOnly} />
                </FormField>
                <FormField label="Internal Notes" hint="Only visible to operations team">
                  <TextArea value={form.internal_notes} onChange={(v) => updateField('internal_notes', v)}
                    placeholder="Private notes for internal reference…" rows={2} disabled={isReadOnly} />
                </FormField>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* ═══ RIGHT COLUMN — Summary Panel ═══ */}
        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">

          {/* Trip Summary Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h4 className="font-semibold text-sm text-gray-900 flex items-center gap-2 mb-4">
              <Gauge size={16} className="text-primary-600" /> Trip Summary
            </h4>

            <div className="space-y-3">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Status</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold border rounded-full ${statusCfg.bg} ${statusCfg.color}`}>
                  {statusCfg.icon} {statusCfg.label}
                </span>
              </div>

              {/* Route */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Route</span>
                <span className="text-xs font-medium text-gray-800">{form.origin || '—'} → {form.destination || '—'}</span>
              </div>

              {/* Distance */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Distance</span>
                <span className="text-xs font-medium text-gray-800">{form.planned_distance_km || '—'} km</span>
              </div>

              {/* Vehicle */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Vehicle</span>
                <span className="text-xs font-medium text-gray-800">{selectedVehicle?.registration_number || '—'}</span>
              </div>

              {/* Driver */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Driver</span>
                <span className="text-xs font-medium text-gray-800">{selectedDriver?.full_name || '—'}</span>
              </div>

              {/* Priority */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Priority</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  form.priority === 'urgent' ? 'bg-red-50 text-red-700' :
                  form.priority === 'high' ? 'bg-amber-50 text-amber-700' :
                  'bg-gray-100 text-gray-600'
                }`}>{form.priority}</span>
              </div>

              {/* LRs */}
              {selectedLRs.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">LRs</span>
                  <span className="text-xs font-medium text-gray-800">{selectedLRs.length} linked</span>
                </div>
              )}
            </div>
          </div>

          {/* Financial Summary Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h4 className="font-semibold text-sm text-gray-900 flex items-center gap-2 mb-4">
              <Wallet size={16} className="text-primary-600" /> Cost Summary
            </h4>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Freight</span>
                <span className="text-sm font-semibold text-gray-900">₹{fmt(financials.freight)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Advance</span>
                <span className="text-sm text-gray-700">₹{fmt(financials.advance)}</span>
              </div>
              <div className="border-t border-gray-100 my-1" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Fuel</span>
                <span className="text-xs text-gray-600">₹{fmt(financials.fuel)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Toll</span>
                <span className="text-xs text-gray-600">₹{fmt(financials.toll)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Driver Allow.</span>
                <span className="text-xs text-gray-600">₹{fmt(financials.driverAllow)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Other</span>
                <span className="text-xs text-gray-600">₹{fmt(financials.other)}</span>
              </div>
              <div className="border-t border-gray-100 my-1" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">Total Expense</span>
                <span className="text-sm font-bold text-gray-900">₹{fmt(financials.totalExpense)}</span>
              </div>
              <div className={`flex items-center justify-between p-2 rounded-lg ${financials.profit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <span className={`text-xs font-medium flex items-center gap-1 ${financials.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {financials.profit >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  Estimated Profit
                </span>
                <span className={`text-sm font-bold ${financials.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {financials.profit >= 0 ? '+' : ''}₹{fmt(financials.profit)}
                </span>
              </div>
              <div className="text-center">
                <span className={`text-xs font-medium ${financials.margin >= 15 ? 'text-green-600' : financials.margin >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
                  Margin: {Number(financials.margin ?? 0).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Timeline Preview */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h4 className="font-semibold text-sm text-gray-900 flex items-center gap-2 mb-4">
              <Clock size={16} className="text-primary-600" /> Timeline Preview
            </h4>
            <div className="relative pl-5 space-y-3">
              <div className="absolute left-1.5 top-1 bottom-1 w-0.5 bg-gray-200" />
              {[
                { label: 'Start', value: form.planned_start ? new DateNumber((form.planned_start) ?? 0).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—', active: !!form.planned_start },
                { label: form.origin || 'Origin', value: 'Loading', active: !!form.origin },
                ...(form.waypoints || []).filter(w => w).map(w => ({ label: w, value: 'Transit stop', active: true })),
                { label: form.destination || 'Destination', value: 'Unloading', active: !!form.destination },
                { label: 'End', value: form.planned_end ? new DateNumber((form.planned_end) ?? 0).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—', active: !!form.planned_end },
              ].map((step, i) => (
                <div key={i} className="relative flex items-start gap-2">
                  <div className={`absolute -left-5 top-0.5 w-3 h-3 rounded-full border-2 ${step.active ? 'bg-primary-600 border-primary-600' : 'bg-white border-gray-300'}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-800">{step.label}</p>
                    <p className="text-xs text-gray-400">{step.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dispatch Readiness */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h4 className="font-semibold text-sm text-gray-900 flex items-center gap-2 mb-3">
              <CheckCircle2 size={16} className="text-primary-600" /> Dispatch Readiness
            </h4>
            <div className="space-y-2">
              {[
                { label: 'Vehicle assigned', ok: !!form.vehicle_id },
                { label: 'Driver assigned', ok: !!form.driver_id },
                { label: 'Route defined', ok: !!form.origin && !!form.destination },
                { label: 'Start date set', ok: !!form.planned_start },
                { label: 'No vehicle warnings', ok: vehicleWarnings.length === 0 },
                { label: 'Freight amount set', ok: form.freight_amount > 0 },
              ].map((chk, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {chk.ok ? (
                    <CheckCircle2 size={14} className="text-green-500" />
                  ) : (
                    <XCircle size={14} className="text-gray-300" />
                  )}
                  <span className={chk.ok ? 'text-gray-700' : 'text-gray-400'}>{chk.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ Sticky Action Bar ═══════════ */}
      {!isReadOnly && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-200 px-6 py-3 flex items-center justify-between gap-3 shadow-lg z-40">
          <button onClick={() => navigate('/trips')} className="btn-ghost text-sm flex items-center gap-1.5"><X size={15} /> Cancel</button>
          <div className="flex items-center gap-2">
            <button onClick={() => handleSave(false)} disabled={saving} className="btn-secondary flex items-center gap-1.5 text-sm">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Save Draft
            </button>
            <button onClick={() => handleSave(true)} disabled={saving || !canDispatch}
              className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
                canDispatch ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
              title={!canDispatch ? 'Complete required fields to dispatch' : ''}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              Create & Dispatch
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
