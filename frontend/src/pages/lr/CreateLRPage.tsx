// ============================================================
// Create LR Page — Enterprise-Grade Transport ERP
// Lorry Receipt / Consignment Note creation with multi-item
// support, auto-calculations, GST, Print/PDF, validation,
// Draft/Generate workflow, permission-based rendering
// ============================================================

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { lrService } from '@/services/dataService';
import { useAuthStore } from '@/store/authStore';
import { safeArray } from '@/utils/helpers';
import {
  ChevronRight, Save, FileCheck, ArrowLeft, FileText, Package,
  MapPin, Truck, IndianRupee, StickyNote, Printer, Download,
  AlertCircle, CheckCircle2, XCircle, User, Phone, Hash,
  Loader2, Calendar, Building2, Search, X, Shield,
  ChevronDown, Plus, Trash2, Copy, ReceiptText
} from 'lucide-react';

// ── Types ──
interface FormErrors { [key: string]: string; }

interface JobOption {
  id: number;
  job_number: string;
  client_name: string;
  client_gstin: string;
  origin_city: string;
  origin_state: string;
  origin_address: string;
  destination_city: string;
  destination_state: string;
  destination_address: string;
  material_type: string;
  quantity: number;
  quantity_unit: string;
  agreed_rate: number;
  status: string;
  vehicle_type_required: string;
}

interface VehicleOption {
  id: number;
  registration_number: string;
  vehicle_type: string;
  capacity_tons: number;
  status: string;
}

interface DriverOption {
  id: number;
  name: string;
  phone: string;
  license_number: string;
  license_type: string;
  status: string;
}

interface ConsignmentItem {
  id: string;
  description: string;
  hsn_code: string;
  packages: number;
  package_type: string;
  quantity: number;
  quantity_unit: string;
  actual_weight: number;
  charged_weight: number;
  rate: number;
  amount: number;
  invoice_number: string;
  invoice_date: string;
  invoice_value: number;
}

// ── Constants ──
const PAYMENT_MODES = [
  { value: 'to_pay', label: 'To Pay', description: 'Receiver pays freight' },
  { value: 'paid', label: 'Paid', description: 'Sender paid freight' },
  { value: 'to_be_billed', label: 'To Be Billed', description: 'Invoice later' },
  { value: 'fod', label: 'FOD', description: 'Freight on Delivery' },
];

const GST_OPTIONS = [
  { value: 0, label: 'No GST (0%)' },
  { value: 5, label: 'GST 5%' },
  { value: 12, label: 'GST 12%' },
  { value: 18, label: 'GST 18%' },
  { value: 28, label: 'GST 28%' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  draft:     { label: 'Draft',          color: 'text-gray-700',    bg: 'bg-gray-100 border-gray-300',    icon: <FileText size={14} /> },
  generated: { label: 'Generated',      color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-300', icon: <CheckCircle2 size={14} /> },
  in_transit:{ label: 'In Transit',     color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-300',     icon: <Truck size={14} /> },
  delivered: { label: 'Delivered',       color: 'text-green-700',   bg: 'bg-green-50 border-green-300',   icon: <CheckCircle2 size={14} /> },
  cancelled: { label: 'Cancelled',      color: 'text-red-700',     bg: 'bg-red-50 border-red-300',       icon: <XCircle size={14} /> },
  linked:    { label: 'Linked to Trip', color: 'text-purple-700',  bg: 'bg-purple-50 border-purple-300', icon: <Truck size={14} /> },
};

const EMPTY_ITEM: ConsignmentItem = {
  id: crypto.randomUUID(),
  description: '',
  hsn_code: '',
  packages: 1,
  package_type: 'boxes',
  quantity: 0,
  quantity_unit: 'kgs',
  actual_weight: 0,
  charged_weight: 0,
  rate: 0,
  amount: 0,
  invoice_number: '',
  invoice_date: '',
  invoice_value: 0,
};

const INITIAL_FORM = {
  lr_date: new Date().toISOString().split('T')[0],
  job_id: 0,

  // Consignor
  consignor_name: '',
  consignor_address: '',
  consignor_gstin: '',
  consignor_phone: '',

  // Consignee
  consignee_name: '',
  consignee_address: '',
  consignee_gstin: '',
  consignee_phone: '',

  // Route (auto-fetched from job)
  origin: '',
  origin_state: '',
  destination: '',
  destination_state: '',

  // E-way Bill
  eway_bill_number: '',
  eway_bill_date: '',
  eway_bill_valid_until: '',

  // Vehicle & Driver
  vehicle_id: 0,
  vehicle_number: '',
  driver_name: '',
  driver_phone: '',
  driver_license: '',

  // Freight & Charges
  payment_mode: 'to_be_billed',
  freight_amount: 0,
  loading_charges: 0,
  unloading_charges: 0,
  detention_charges: 0,
  other_charges: 0,
  gst_percentage: 5,

  // Insurance
  insurance_company: '',
  insurance_policy_number: '',
  insurance_amount: 0,

  // Declared value
  declared_value: 0,

  // Notes
  remarks: '',
  special_instructions: '',

  // Status
  status: 'draft',
};

// ── Section Card Component ──
function SectionCard({
  title, subtitle, icon, children, collapsible = false, defaultOpen = true, badge,
}: {
  title: string; subtitle?: string; icon: React.ReactNode; children: React.ReactNode;
  collapsible?: boolean; defaultOpen?: boolean; badge?: React.ReactNode;
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
          <ChevronDown size={18} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>
      {isOpen && <div className="p-6">{children}</div>}
    </div>
  );
}

// ── Form Field Components ──
function FormField({ label, required, error, hint, children, className = '' }: {
  label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600 flex items-center gap-1"><AlertCircle size={12} /> {error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = 'text', error, disabled, prefix, suffix }: {
  value: string | number; onChange: (v: string) => void; placeholder?: string; type?: string;
  error?: boolean; disabled?: boolean; prefix?: React.ReactNode; suffix?: React.ReactNode;
}) {
  return (
    <div className={`flex items-center border rounded-lg transition-colors ${
      error ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-300 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-200'
    } ${disabled ? 'bg-gray-50 opacity-60' : 'bg-white'}`}>
      {prefix && <div className="pl-3 text-gray-400">{prefix}</div>}
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        disabled={disabled} className="flex-1 px-3 py-2.5 text-sm bg-transparent outline-none placeholder-gray-400" />
      {suffix && <div className="pr-3 text-gray-400 text-sm">{suffix}</div>}
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
      className={`w-full px-3 py-2.5 text-sm border rounded-lg bg-white outline-none transition-colors appearance-none ${
        error ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-200'
      } ${disabled ? 'bg-gray-50 opacity-60' : ''}`}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o, idx) => <option key={getOptionKey(o, idx)} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function TextArea({ value, onChange, placeholder, rows = 3, error, disabled }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; error?: boolean; disabled?: boolean;
}) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} disabled={disabled}
      className={`w-full px-3 py-2.5 text-sm border rounded-lg resize-none outline-none transition-colors ${
        error ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-200'
      } ${disabled ? 'bg-gray-50 opacity-60' : 'bg-white'}`} />
  );
}

// ── Main Page Component ──
export default function CreateLRPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const { user } = useAuthStore();

  const [form, setForm] = useState({ ...INITIAL_FORM });
  const [items, setItems] = useState<ConsignmentItem[]>([{ ...EMPTY_ITEM }]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobOption | null>(null);
  const [jobSearch, setJobSearch] = useState('');
  const [showJobDropdown, setShowJobDropdown] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleOption | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<DriverOption | null>(null);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [driverSearch, setDriverSearch] = useState('');
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const [showDriverDropdown, setShowDriverDropdown] = useState(false);
  const [createdLrId, setCreatedLrId] = useState<number | null>(null);

  // ── Data Queries ──
  const { data: nextLrNumber } = useQuery({
    queryKey: ['next-lr-number'],
    queryFn: () => lrService.getNextLRNumber(),
    enabled: !isEdit,
  });

  const { data: jobsData } = useQuery({
    queryKey: ['lr-lookup-jobs', jobSearch],
    queryFn: () => lrService.getJobs(jobSearch),
    enabled: showJobDropdown,
  });

  const { data: vehiclesData } = useQuery({
    queryKey: ['lr-lookup-vehicles', vehicleSearch],
    queryFn: () => lrService.getVehicles(vehicleSearch),
    enabled: showVehicleDropdown,
  });

  const { data: driversData } = useQuery({
    queryKey: ['lr-lookup-drivers', driverSearch],
    queryFn: () => lrService.getDrivers(driverSearch),
    enabled: showDriverDropdown,
  });

  const { data: packageTypesData } = useQuery({
    queryKey: ['lr-lookup-package-types'],
    queryFn: () => lrService.getPackageTypes(),
  });

  const { data: quantityUnitsData } = useQuery({
    queryKey: ['lr-lookup-quantity-units'],
    queryFn: () => lrService.getQuantityUnits(),
  });

  // Load existing LR for edit
  useEffect(() => {
    if (isEdit && id) {
      lrService.get(parseInt(id)).then((lr: any) => {
        setForm({
          lr_date: lr.lr_date || INITIAL_FORM.lr_date,
          job_id: lr.job_id || 0,
          consignor_name: lr.consignor_name || '',
          consignor_address: lr.consignor_address || '',
          consignor_gstin: lr.consignor_gstin || '',
          consignor_phone: lr.consignor_phone || '',
          consignee_name: lr.consignee_name || '',
          consignee_address: lr.consignee_address || '',
          consignee_gstin: lr.consignee_gstin || '',
          consignee_phone: lr.consignee_phone || '',
          origin: lr.origin || '',
          origin_state: lr.origin_state || '',
          destination: lr.destination || '',
          destination_state: lr.destination_state || '',
          eway_bill_number: lr.eway_bill_number || '',
          eway_bill_date: lr.eway_bill_date || '',
          eway_bill_valid_until: lr.eway_bill_valid_until || '',
          vehicle_id: lr.vehicle_id || 0,
          vehicle_number: lr.vehicle_number || '',
          driver_name: lr.driver_name || '',
          driver_phone: lr.driver_phone || '',
          driver_license: lr.driver_license || '',
          payment_mode: lr.payment_mode || 'to_be_billed',
          freight_amount: lr.freight_amount || 0,
          loading_charges: lr.loading_charges || 0,
          unloading_charges: lr.unloading_charges || 0,
          detention_charges: lr.detention_charges || 0,
          other_charges: lr.other_charges || 0,
          gst_percentage: lr.gst_percentage ?? 5,
          insurance_company: lr.insurance_company || '',
          insurance_policy_number: lr.insurance_policy_number || '',
          insurance_amount: lr.insurance_amount || 0,
          declared_value: lr.declared_value || 0,
          remarks: lr.remarks || '',
          special_instructions: lr.special_instructions || '',
          status: lr.status || 'draft',
        });
        if (lr.items && lr.items.length > 0) {
          setItems(lr.items.map((it: any) => ({
            id: crypto.randomUUID(),
            description: it.description || '',
            hsn_code: it.hsn_code || '',
            packages: it.packages || 1,
            package_type: it.package_type || 'boxes',
            quantity: it.quantity || 0,
            quantity_unit: it.quantity_unit || 'kgs',
            actual_weight: it.actual_weight || 0,
            charged_weight: it.charged_weight || 0,
            rate: it.rate || 0,
            amount: it.amount || 0,
            invoice_number: it.invoice_number || '',
            invoice_date: it.invoice_date || '',
            invoice_value: it.invoice_value || 0,
          })));
        }
        setCreatedLrId(parseInt(id));
      }).catch(() => { navigate('/lr'); });
    }
  }, [isEdit, id, navigate]);

  // ── Helpers ──
  const updateField = useCallback((field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  }, []);

  const updateItem = useCallback((itemId: string, field: string, value: any) => {
    setItems(prev => prev.map(it => {
      if (it.id !== itemId) return it;
      const updated = { ...it, [field]: value };
      // Auto-calculate amount = rate * charged_weight
      if (field === 'rate' || field === 'charged_weight') {
        const rate = field === 'rate' ? parseFloat(String(value)) || 0 : it.rate;
        const cw = field === 'charged_weight' ? parseFloat(String(value)) || 0 : it.charged_weight;
        updated.amount = Math.round(rate * cw * 100) / 100;
      }
      return updated;
    }));
  }, []);

  const addItem = useCallback(() => {
    setItems(prev => [...prev, { ...EMPTY_ITEM, id: crypto.randomUUID() }]);
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setItems(prev => prev.length > 1 ? prev.filter(it => it.id !== itemId) : prev);
  }, []);

  const duplicateItem = useCallback((itemId: string) => {
    setItems(prev => {
      const src = prev.find(it => it.id === itemId);
      if (!src) return prev;
      return [...prev, { ...src, id: crypto.randomUUID() }];
    });
  }, []);

  // ── Select job and auto-fill route ──
  const selectJob = useCallback((job: JobOption) => {
    setSelectedJob(job);
    setShowJobDropdown(false);
    setJobSearch('');
    updateField('job_id', job.id);
    // Auto-fill route from job
    updateField('origin', job.origin_city);
    updateField('origin_state', job.origin_state);
    updateField('destination', job.destination_city);
    updateField('destination_state', job.destination_state);
    // Auto-fill consignor from client
    updateField('consignor_name', job.client_name);
    updateField('consignor_gstin', job.client_gstin);
    // Auto-fill freight from agreed rate
    updateField('freight_amount', job.agreed_rate);
  }, [updateField]);

  const selectVehicle = useCallback((vehicle: VehicleOption) => {
    setSelectedVehicle(vehicle);
    setShowVehicleDropdown(false);
    setVehicleSearch('');
    updateField('vehicle_id', vehicle.id);
    updateField('vehicle_number', vehicle.registration_number);
  }, [updateField]);

  const selectDriver = useCallback((driver: DriverOption) => {
    setSelectedDriver(driver);
    setShowDriverDropdown(false);
    setDriverSearch('');
    updateField('driver_name', driver.name);
    updateField('driver_phone', driver.phone);
    updateField('driver_license', driver.license_number);
  }, [updateField]);

  // ── Price Calculations ──
  const priceSummary = useMemo(() => {
    const freight = parseFloat(String(form.freight_amount)) || 0;
    const loading = parseFloat(String(form.loading_charges)) || 0;
    const unloading = parseFloat(String(form.unloading_charges)) || 0;
    const detention = parseFloat(String(form.detention_charges)) || 0;
    const other = parseFloat(String(form.other_charges)) || 0;
    const subtotal = freight + loading + unloading + detention + other;
    const gstPct = parseFloat(String(form.gst_percentage)) || 0;
    const gstAmount = Math.round(subtotal * gstPct) / 100;
    const total = Math.round((subtotal + gstAmount) * 100) / 100;
    return { freight, loading, unloading, detention, other, subtotal, gstPct, gstAmount, total };
  }, [form.freight_amount, form.loading_charges, form.unloading_charges, form.detention_charges, form.other_charges, form.gst_percentage]);

  // ── Item Totals ──
  const itemTotals = useMemo(() => {
    let totalPackages = 0, totalWeight = 0, totalChargedWeight = 0, totalInvoiceValue = 0;
    for (const item of items) {
      totalPackages += (parseFloat(String(item.packages)) || 0);
      totalWeight += (parseFloat(String(item.actual_weight)) || 0);
      totalChargedWeight += (parseFloat(String(item.charged_weight)) || 0);
      totalInvoiceValue += (parseFloat(String(item.invoice_value)) || 0);
    }
    return { totalPackages, totalWeight: Math.round(totalWeight * 1000) / 1000, totalChargedWeight: Math.round(totalChargedWeight * 1000) / 1000, totalInvoiceValue: Math.round(totalInvoiceValue * 100) / 100 };
  }, [items]);

  // ── Validation ──
  const validate = useCallback((asDraft: boolean): boolean => {
    const e: FormErrors = {};
    if (!form.job_id) e.job_id = 'Please select a job';
    if (!form.consignor_name.trim()) e.consignor_name = 'Consignor name is required';
    if (!form.consignee_name.trim()) e.consignee_name = 'Consignee name is required';
    if (!form.origin.trim()) e.origin = 'Origin is required';
    if (!form.destination.trim()) e.destination = 'Destination is required';

    if (!asDraft) {
      // Stricter validation for Generate
      if (items.length === 0 || !items[0].description.trim()) {
        e.items = 'At least one consignment item with description is required';
      }
      if (!form.freight_amount || form.freight_amount <= 0) {
        e.freight_amount = 'Freight amount must be greater than 0';
      }
      if (form.consignor_gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}[A-Z]{1}[A-Z\d]{1}$/.test(form.consignor_gstin)) {
        e.consignor_gstin = 'Invalid GSTIN format';
      }
      if (form.consignee_gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}[A-Z]{1}[A-Z\d]{1}$/.test(form.consignee_gstin)) {
        e.consignee_gstin = 'Invalid GSTIN format';
      }
      if (form.eway_bill_number && form.eway_bill_number.length < 12) {
        e.eway_bill_number = 'E-way bill number must be 12 digits';
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }, [form, items]);

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (payload: any) => lrService.create(payload),
    onSuccess: (data) => {
      setCreatedLrId(data.id);
      updateField('status', data.status);
    },
  });

  const generateMutation = useMutation({
    mutationFn: (lrId: number) => lrService.generate(lrId),
    onSuccess: () => {
      updateField('status', 'generated');
    },
  });

  // ── Save Handler ──
  const handleSave = useCallback(async (action: 'draft' | 'generate') => {
    const asDraft = action === 'draft';
    if (!validate(asDraft)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        items: items.filter(it => it.description.trim()).map((it, idx) => ({
          item_number: idx + 1,
          description: it.description,
          hsn_code: it.hsn_code || null,
          packages: it.packages,
          package_type: it.package_type || null,
          quantity: it.quantity || null,
          quantity_unit: it.quantity_unit || null,
          actual_weight: it.actual_weight || null,
          charged_weight: it.charged_weight || null,
          rate: it.rate || null,
          amount: it.amount || null,
          invoice_number: it.invoice_number || null,
          invoice_date: it.invoice_date || null,
          invoice_value: it.invoice_value || null,
        })),
        status: 'draft',
      };

      let lrId = createdLrId;

      if (isEdit && lrId) {
        await lrService.update(lrId, payload);
      } else {
        const result = await createMutation.mutateAsync(payload);
        lrId = result.id;
      }

      if (action === 'generate' && lrId) {
        await generateMutation.mutateAsync(lrId);
      }

      // Success — navigate or stay
      if (action === 'generate') {
        // Stay on page with generated status for print
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === 'string') {
        setErrors({ _server: detail });
      } else if (detail?.errors) {
        setErrors({ _server: detail.errors.join(', ') });
      }
    } finally {
      setSaving(false);
    }
  }, [form, items, validate, isEdit, createdLrId, createMutation, generateMutation]);

  // ── Print Handler ──
  const handlePrint = useCallback(async () => {
    if (!createdLrId) return;
    try {
      const printData = await lrService.print(createdLrId);
      // Open print window
      const printWindow = window.open('', '_blank', 'width=800,height=1100');
      if (!printWindow) return;
      printWindow.document.write(generatePrintHTML(printData));
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    } catch {
      alert('Failed to load print data');
    }
  }, [createdLrId]);

  // ── Permission Check ──
  const hasPermission = user?.permissions?.includes('lr:create') ||
    user?.roles?.some((r) => ['admin', 'manager', 'project_associate'].includes(r));

  if (!hasPermission) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield size={48} className="mx-auto text-red-400 mb-4" />
          <h2 className="text-xl font-bold text-gray-900">Access Denied</h2>
          <p className="text-gray-500 mt-2">You don't have permission to create Lorry Receipts.</p>
          <button onClick={() => navigate('/dashboard')} className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_CONFIG[form.status] || STATUS_CONFIG.draft;
  const isReadonly = form.status === 'generated' || form.status === 'cancelled';
  const packageTypes = safeArray(packageTypesData);
  const quantityUnits = safeArray(quantityUnitsData);

  return (
    <div className="min-h-screen bg-gray-50/50">
      <form onSubmit={(e) => e.preventDefault()} className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Breadcrumb ── */}
        <nav className="flex items-center gap-2 text-sm text-gray-500">
          <Link to="/dashboard" className="hover:text-primary-600">Dashboard</Link>
          <ChevronRight size={14} />
          <Link to="/lr" className="hover:text-primary-600">Lorry Receipts</Link>
          <ChevronRight size={14} />
          <span className="text-gray-900 font-medium">{isEdit ? 'Edit LR' : 'Create New LR'}</span>
        </nav>

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/lr')} className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50">
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">
                  {isEdit ? 'Edit Lorry Receipt' : 'Create Lorry Receipt'}
                </h1>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border ${statusInfo.bg} ${statusInfo.color}`}>
                  {statusInfo.icon} {statusInfo.label}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                <span className="font-mono font-semibold text-primary-600">
                  {isEdit ? `LR-${id}` : (nextLrNumber?.lr_number || 'LR-2026-XXXXX')}
                </span>
                <span className="mx-2">|</span>
                <span>{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              </p>
            </div>
          </div>

          {/* Print / Download when generated */}
          {(form.status === 'generated' && createdLrId) && (
            <div className="flex items-center gap-2">
              <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium">
                <Printer size={16} /> Print LR
              </button>
              <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
                <Download size={16} /> Download PDF
              </button>
            </div>
          )}
        </div>

        {/* Server error */}
        {errors._server && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle size={20} className="text-red-500 mt-0.5 shrink-0" />
            <div><p className="text-sm font-medium text-red-800">Error</p><p className="text-sm text-red-600">{errors._server}</p></div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
           SECTION 1: LR Basic Details
        ══════════════════════════════════════════════════════ */}
        <SectionCard title="LR Basic Details" subtitle="Link to job and set LR date" icon={<ReceiptText size={20} />}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Job Selection */}
            <FormField label="Job Reference" required error={errors.job_id} className="md:col-span-2">
              <div className="relative">
                {selectedJob ? (
                  <div className="flex items-center gap-3 border border-gray-300 rounded-lg px-3 py-2.5 bg-gray-50">
                    <div className="flex-1">
                      <span className="font-mono font-semibold text-primary-600">{selectedJob.job_number}</span>
                      <span className="mx-2 text-gray-400">|</span>
                      <span className="text-sm text-gray-700">{selectedJob.client_name}</span>
                      <span className="mx-2 text-gray-400">|</span>
                      <span className="text-xs text-gray-500">{selectedJob.origin_city} → {selectedJob.destination_city}</span>
                    </div>
                    {!isReadonly && (
                      <button type="button" onClick={() => { setSelectedJob(null); updateField('job_id', 0); }}
                        className="p-1 hover:bg-gray-200 rounded"><X size={16} className="text-gray-400" /></button>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <div className="flex items-center border border-gray-300 rounded-lg focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-200">
                      <div className="pl-3"><Search size={16} className="text-gray-400" /></div>
                      <input
                        type="text" value={jobSearch}
                        onChange={(e) => { setJobSearch(e.target.value); setShowJobDropdown(true); }}
                        onFocus={() => setShowJobDropdown(true)}
                        placeholder="Search by Job Number, Client, or City..."
                        disabled={isReadonly}
                        className="flex-1 px-3 py-2.5 text-sm bg-transparent outline-none placeholder-gray-400"
                      />
                    </div>
                    {showJobDropdown && (
                      <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-72 overflow-y-auto">
                        {jobsData?.items?.map((job: JobOption) => (
                          <button key={job.id} type="button" onClick={() => selectJob(job)}
                            className="w-full text-left px-4 py-3 hover:bg-primary-50 border-b border-gray-50 last:border-0">
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-semibold text-primary-600 text-sm">{job.job_number}</span>
                              <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{job.status}</span>
                            </div>
                            <p className="text-sm text-gray-700 mt-0.5">{job.client_name}</p>
                            <p className="text-xs text-gray-500">{job.origin_city} → {job.destination_city} | {job.material_type} | {job.quantity} {job.quantity_unit}</p>
                          </button>
                        ))}
                        {jobsData?.items?.length === 0 && (
                          <div className="px-4 py-6 text-center text-sm text-gray-400">No approved jobs found</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </FormField>

            <FormField label="LR Date" required>
              <TextInput type="date" value={form.lr_date} onChange={(v) => updateField('lr_date', v)}
                disabled={isReadonly} prefix={<Calendar size={16} />} />
            </FormField>
          </div>

          {/* Job info banner */}
          {selectedJob && (
            <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div><span className="text-blue-500 text-xs font-medium">Material</span><p className="font-semibold text-gray-800 mt-0.5">{selectedJob.material_type}</p></div>
              <div><span className="text-blue-500 text-xs font-medium">Quantity</span><p className="font-semibold text-gray-800 mt-0.5">{selectedJob.quantity} {selectedJob.quantity_unit}</p></div>
              <div><span className="text-blue-500 text-xs font-medium">Agreed Rate</span><p className="font-semibold text-gray-800 mt-0.5">₹{(selectedJob.agreed_rate ?? 0).toLocaleString('en-IN')}</p></div>
              <div><span className="text-blue-500 text-xs font-medium">Vehicle Type</span><p className="font-semibold text-gray-800 mt-0.5">{selectedJob.vehicle_type_required.replace(/_/g, ' ')}</p></div>
            </div>
          )}
        </SectionCard>

        {/* ══════════════════════════════════════════════════════
           SECTION 2: Consignment Details (Multi-item)
        ══════════════════════════════════════════════════════ */}
        <SectionCard
          title="Consignment Details"
          subtitle="Add multiple items per consignment"
          icon={<Package size={20} />}
          badge={
            <span className="text-xs font-semibold bg-primary-50 text-primary-700 px-2.5 py-1 rounded-full">
              {items.length} item{items.length > 1 ? 's' : ''}
            </span>
          }
        >
          {errors.items && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600 flex items-center gap-2">
              <AlertCircle size={16} /> {errors.items}
            </div>
          )}

          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={item.id} className="border border-gray-200 rounded-xl p-5 bg-gray-50/50 relative group">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold text-gray-700">Item #{index + 1}</h4>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" onClick={() => duplicateItem(item.id)} disabled={isReadonly}
                      className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="Duplicate">
                      <Copy size={14} />
                    </button>
                    <button type="button" onClick={() => removeItem(item.id)} disabled={isReadonly || items.length <= 1}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-30" title="Remove">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <FormField label="Description" required className="sm:col-span-2">
                    <TextInput value={item.description} onChange={(v) => updateItem(item.id, 'description', v)}
                      placeholder="e.g. Auto Parts, Electronics" disabled={isReadonly} />
                  </FormField>
                  <FormField label="HSN Code">
                    <TextInput value={item.hsn_code} onChange={(v) => updateItem(item.id, 'hsn_code', v)}
                      placeholder="e.g. 87089900" disabled={isReadonly} />
                  </FormField>
                  <FormField label="No. of Packages">
                    <TextInput type="number" value={item.packages} onChange={(v) => updateItem(item.id, 'packages', parseInt(v) || 0)}
                      disabled={isReadonly} />
                  </FormField>
                  <FormField label="Package Type">
                    <SelectInput value={item.package_type} onChange={(v) => updateItem(item.id, 'package_type', v)}
                      options={packageTypes.map((p: any) => ({ value: p.value, label: p.label }))}
                      placeholder="Select type" disabled={isReadonly} />
                  </FormField>
                  <FormField label="Quantity">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <TextInput type="number" value={item.quantity} onChange={(v) => updateItem(item.id, 'quantity', parseFloat(v) || 0)}
                          disabled={isReadonly} />
                      </div>
                      <div className="w-28">
                        <SelectInput value={item.quantity_unit} onChange={(v) => updateItem(item.id, 'quantity_unit', v)}
                          options={quantityUnits.map((u: any) => ({ value: u.value, label: u.label }))}
                          disabled={isReadonly} />
                      </div>
                    </div>
                  </FormField>
                  <FormField label="Actual Weight (Kgs)" hint="As measured">
                    <TextInput type="number" value={item.actual_weight} onChange={(v) => updateItem(item.id, 'actual_weight', parseFloat(v) || 0)}
                      disabled={isReadonly} suffix="Kgs" />
                  </FormField>
                  <FormField label="Charged Weight (Kgs)" hint="Weight for billing">
                    <TextInput type="number" value={item.charged_weight} onChange={(v) => updateItem(item.id, 'charged_weight', parseFloat(v) || 0)}
                      disabled={isReadonly} suffix="Kgs" />
                  </FormField>
                </div>

                {/* Invoice row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200">
                  <FormField label="Invoice Number">
                    <TextInput value={item.invoice_number} onChange={(v) => updateItem(item.id, 'invoice_number', v)}
                      placeholder="e.g. INV-2026-001" disabled={isReadonly} />
                  </FormField>
                  <FormField label="Invoice Date">
                    <TextInput type="date" value={item.invoice_date} onChange={(v) => updateItem(item.id, 'invoice_date', v)}
                      disabled={isReadonly} />
                  </FormField>
                  <FormField label="Invoice Value (₹)">
                    <TextInput type="number" value={item.invoice_value} onChange={(v) => updateItem(item.id, 'invoice_value', parseFloat(v) || 0)}
                      disabled={isReadonly} prefix={<IndianRupee size={14} />} />
                  </FormField>
                  <FormField label="Rate / Kg (₹)">
                    <TextInput type="number" value={item.rate} onChange={(v) => updateItem(item.id, 'rate', parseFloat(v) || 0)}
                      disabled={isReadonly} prefix={<IndianRupee size={14} />} />
                  </FormField>
                </div>

                {/* Item amount display */}
                {item.amount > 0 && (
                  <div className="mt-3 text-right">
                    <span className="text-xs text-gray-500">Item Amount: </span>
                    <span className="font-bold text-gray-900">₹{(item.amount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add item button */}
          {!isReadonly && (
            <button type="button" onClick={addItem}
              className="mt-4 w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50/50 transition-colors">
              <Plus size={18} /> Add Consignment Item
            </button>
          )}

          {/* Item totals summary */}
          <div className="mt-5 bg-gray-100 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-xs text-gray-500">Total Packages</p>
              <p className="text-lg font-bold text-gray-900">{itemTotals.totalPackages}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Total Actual Weight</p>
              <p className="text-lg font-bold text-gray-900">{(itemTotals.totalWeight ?? 0).toLocaleString('en-IN')} Kgs</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Total Charged Weight</p>
              <p className="text-lg font-bold text-gray-900">{(itemTotals.totalChargedWeight ?? 0).toLocaleString('en-IN')} Kgs</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Total Invoice Value</p>
              <p className="text-lg font-bold text-gray-900">₹{(itemTotals.totalInvoiceValue ?? 0).toLocaleString('en-IN')}</p>
            </div>
          </div>
        </SectionCard>

        {/* ══════════════════════════════════════════════════════
           SECTION 3: Route Details (Auto-fetched from Job)
        ══════════════════════════════════════════════════════ */}
        <SectionCard title="Route Details" subtitle="Origin & Destination — auto-fetched from Job" icon={<MapPin size={20} />}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Origin */}
            <div className="bg-green-50/50 border border-green-100 rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-2 text-green-700 font-semibold text-sm">
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                Origin (From)
              </div>
              <FormField label="City" required error={errors.origin}>
                <TextInput value={form.origin} onChange={(v) => updateField('origin', v)} placeholder="Origin city" disabled={isReadonly} />
              </FormField>
              <FormField label="State">
                <TextInput value={form.origin_state} onChange={(v) => updateField('origin_state', v)} placeholder="State" disabled={isReadonly} />
              </FormField>
            </div>

            {/* Destination */}
            <div className="bg-red-50/50 border border-red-100 rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
                <div className="w-3 h-3 bg-red-500 rounded-full" />
                Destination (To)
              </div>
              <FormField label="City" required error={errors.destination}>
                <TextInput value={form.destination} onChange={(v) => updateField('destination', v)} placeholder="Destination city" disabled={isReadonly} />
              </FormField>
              <FormField label="State">
                <TextInput value={form.destination_state} onChange={(v) => updateField('destination_state', v)} placeholder="State" disabled={isReadonly} />
              </FormField>
            </div>
          </div>

          {/* E-way Bill */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2"><Shield size={16} className="text-orange-500" /> E-way Bill Details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="E-way Bill Number" error={errors.eway_bill_number}>
                <TextInput value={form.eway_bill_number} onChange={(v) => updateField('eway_bill_number', v)}
                  placeholder="e.g. 121000000001" disabled={isReadonly} prefix={<Hash size={14} />} />
              </FormField>
              <FormField label="E-way Bill Date">
                <TextInput type="date" value={form.eway_bill_date} onChange={(v) => updateField('eway_bill_date', v)} disabled={isReadonly} />
              </FormField>
              <FormField label="Valid Until">
                <TextInput type="date" value={form.eway_bill_valid_until} onChange={(v) => updateField('eway_bill_valid_until', v)} disabled={isReadonly} />
              </FormField>
            </div>
          </div>
        </SectionCard>

        {/* ══════════════════════════════════════════════════════
           SECTION 4: Consignor & Consignee
        ══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Consignor */}
          <SectionCard title="Consignor (Sender)" subtitle="Party sending the goods" icon={<Building2 size={20} />}>
            <div className="space-y-4">
              <FormField label="Name" required error={errors.consignor_name}>
                <TextInput value={form.consignor_name} onChange={(v) => updateField('consignor_name', v)}
                  placeholder="Company / Person name" disabled={isReadonly} />
              </FormField>
              <FormField label="GSTIN" error={errors.consignor_gstin}>
                <TextInput value={form.consignor_gstin} onChange={(v) => updateField('consignor_gstin', v.toUpperCase())}
                  placeholder="e.g. 27AABCU9603R1ZM" disabled={isReadonly} />
              </FormField>
              <FormField label="Address">
                <TextArea value={form.consignor_address} onChange={(v) => updateField('consignor_address', v)}
                  placeholder="Full address" rows={2} disabled={isReadonly} />
              </FormField>
              <FormField label="Phone">
                <TextInput value={form.consignor_phone} onChange={(v) => updateField('consignor_phone', v)}
                  placeholder="Contact number" disabled={isReadonly} prefix={<Phone size={14} />} />
              </FormField>
            </div>
          </SectionCard>

          {/* Consignee */}
          <SectionCard title="Consignee (Receiver)" subtitle="Party receiving the goods" icon={<User size={20} />}>
            <div className="space-y-4">
              <FormField label="Name" required error={errors.consignee_name}>
                <TextInput value={form.consignee_name} onChange={(v) => updateField('consignee_name', v)}
                  placeholder="Company / Person name" disabled={isReadonly} />
              </FormField>
              <FormField label="GSTIN" error={errors.consignee_gstin}>
                <TextInput value={form.consignee_gstin} onChange={(v) => updateField('consignee_gstin', v.toUpperCase())}
                  placeholder="e.g. 07AABCB3456S1ZR" disabled={isReadonly} />
              </FormField>
              <FormField label="Address">
                <TextArea value={form.consignee_address} onChange={(v) => updateField('consignee_address', v)}
                  placeholder="Full address" rows={2} disabled={isReadonly} />
              </FormField>
              <FormField label="Phone">
                <TextInput value={form.consignee_phone} onChange={(v) => updateField('consignee_phone', v)}
                  placeholder="Contact number" disabled={isReadonly} prefix={<Phone size={14} />} />
              </FormField>
            </div>
          </SectionCard>
        </div>

        {/* ══════════════════════════════════════════════════════
           SECTION 5: Freight & Charges
        ══════════════════════════════════════════════════════ */}
        <SectionCard title="Freight & Charges" subtitle="Pricing, GST calculation, and payment mode" icon={<IndianRupee size={20} />}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left — Charges inputs */}
            <div className="lg:col-span-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Payment Mode" required>
                  <SelectInput value={form.payment_mode} onChange={(v) => updateField('payment_mode', v)}
                    options={PAYMENT_MODES.map(p => ({ value: p.value, label: `${p.label} — ${p.description}` }))}
                    disabled={isReadonly} />
                </FormField>
                <FormField label="GST Rate">
                  <SelectInput value={form.gst_percentage} onChange={(v) => updateField('gst_percentage', parseFloat(v))}
                    options={GST_OPTIONS.map(g => ({ value: g.value, label: g.label }))} disabled={isReadonly} />
                </FormField>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField label="Freight Amount (₹)" required error={errors.freight_amount}>
                  <TextInput type="number" value={form.freight_amount}
                    onChange={(v) => updateField('freight_amount', parseFloat(v) || 0)}
                    disabled={isReadonly} prefix={<IndianRupee size={14} />} />
                </FormField>
                <FormField label="Loading Charges (₹)">
                  <TextInput type="number" value={form.loading_charges}
                    onChange={(v) => updateField('loading_charges', parseFloat(v) || 0)}
                    disabled={isReadonly} prefix={<IndianRupee size={14} />} />
                </FormField>
                <FormField label="Unloading Charges (₹)">
                  <TextInput type="number" value={form.unloading_charges}
                    onChange={(v) => updateField('unloading_charges', parseFloat(v) || 0)}
                    disabled={isReadonly} prefix={<IndianRupee size={14} />} />
                </FormField>
                <FormField label="Detention Charges (₹)">
                  <TextInput type="number" value={form.detention_charges}
                    onChange={(v) => updateField('detention_charges', parseFloat(v) || 0)}
                    disabled={isReadonly} prefix={<IndianRupee size={14} />} />
                </FormField>
                <FormField label="Other Charges (₹)">
                  <TextInput type="number" value={form.other_charges}
                    onChange={(v) => updateField('other_charges', parseFloat(v) || 0)}
                    disabled={isReadonly} prefix={<IndianRupee size={14} />} />
                </FormField>
                <FormField label="Declared Value (₹)" hint="For insurance">
                  <TextInput type="number" value={form.declared_value}
                    onChange={(v) => updateField('declared_value', parseFloat(v) || 0)}
                    disabled={isReadonly} prefix={<IndianRupee size={14} />} />
                </FormField>
              </div>
            </div>

            {/* Right — Price Summary */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-white space-y-3">
              <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Price Summary</h4>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between"><span className="text-gray-400">Freight</span><span>₹{(priceSummary.freight ?? 0).toLocaleString('en-IN')}</span></div>
                {priceSummary.loading > 0 && <div className="flex justify-between"><span className="text-gray-400">Loading</span><span>₹{(priceSummary.loading ?? 0).toLocaleString('en-IN')}</span></div>}
                {priceSummary.unloading > 0 && <div className="flex justify-between"><span className="text-gray-400">Unloading</span><span>₹{(priceSummary.unloading ?? 0).toLocaleString('en-IN')}</span></div>}
                {priceSummary.detention > 0 && <div className="flex justify-between"><span className="text-gray-400">Detention</span><span>₹{(priceSummary.detention ?? 0).toLocaleString('en-IN')}</span></div>}
                {priceSummary.other > 0 && <div className="flex justify-between"><span className="text-gray-400">Other</span><span>₹{(priceSummary.other ?? 0).toLocaleString('en-IN')}</span></div>}
                <div className="border-t border-gray-700 pt-2 flex justify-between font-semibold">
                  <span className="text-gray-300">Subtotal</span><span>₹{(priceSummary.subtotal ?? 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">GST ({priceSummary.gstPct}%)</span>
                  <span>₹{(priceSummary.gstAmount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="border-t border-gray-600 pt-3 flex justify-between">
                  <span className="text-lg font-bold">Grand Total</span>
                  <span className="text-2xl font-black text-emerald-400">₹{(priceSummary.total ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ══════════════════════════════════════════════════════
           SECTION 6: Vehicle & Driver Details
        ══════════════════════════════════════════════════════ */}
        <SectionCard title="Vehicle & Driver Details" subtitle="Assign vehicle and driver to this LR" icon={<Truck size={20} />} collapsible defaultOpen={true}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Vehicle Selection */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-gray-700">Vehicle</h4>
              <div className="relative">
                {selectedVehicle ? (
                  <div className="flex items-center gap-3 border border-gray-300 rounded-lg px-3 py-2.5 bg-gray-50">
                    <Truck size={18} className="text-primary-600" />
                    <div className="flex-1">
                      <span className="font-mono font-bold text-gray-900">{selectedVehicle.registration_number}</span>
                      <span className="ml-2 text-xs text-gray-500">{selectedVehicle.vehicle_type} | {selectedVehicle.capacity_tons}T</span>
                    </div>
                    {!isReadonly && (
                      <button type="button" onClick={() => { setSelectedVehicle(null); updateField('vehicle_id', 0); updateField('vehicle_number', ''); }}
                        className="p-1 hover:bg-gray-200 rounded"><X size={16} className="text-gray-400" /></button>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <div className="flex items-center border border-gray-300 rounded-lg focus-within:border-primary-500">
                      <div className="pl-3"><Search size={16} className="text-gray-400" /></div>
                      <input type="text" value={vehicleSearch}
                        onChange={(e) => { setVehicleSearch(e.target.value); setShowVehicleDropdown(true); }}
                        onFocus={() => setShowVehicleDropdown(true)}
                        placeholder="Search vehicle number..."
                        disabled={isReadonly}
                        className="flex-1 px-3 py-2.5 text-sm bg-transparent outline-none" />
                    </div>
                    {showVehicleDropdown && (
                      <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                        {vehiclesData?.items?.map((v: VehicleOption) => (
                          <button key={v.id} type="button" onClick={() => selectVehicle(v)}
                            className="w-full text-left px-4 py-3 hover:bg-primary-50 border-b border-gray-50 last:border-0">
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-sm">{v.registration_number}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${v.status === 'available' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                {v.status}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{v.vehicle_type} | {v.capacity_tons}T capacity</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <FormField label="Vehicle Number" hint="Or enter manually">
                <TextInput value={form.vehicle_number} onChange={(v) => updateField('vehicle_number', v.toUpperCase())}
                  placeholder="e.g. MH-04-AB-1234" disabled={isReadonly} />
              </FormField>
            </div>

            {/* Driver Selection */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-gray-700">Driver</h4>
              <div className="relative">
                {selectedDriver ? (
                  <div className="flex items-center gap-3 border border-gray-300 rounded-lg px-3 py-2.5 bg-gray-50">
                    <User size={18} className="text-primary-600" />
                    <div className="flex-1">
                      <span className="font-semibold text-gray-900">{selectedDriver.name}</span>
                      <span className="ml-2 text-xs text-gray-500">{selectedDriver.phone}</span>
                    </div>
                    {!isReadonly && (
                      <button type="button" onClick={() => { setSelectedDriver(null); updateField('driver_name', ''); updateField('driver_phone', ''); updateField('driver_license', ''); }}
                        className="p-1 hover:bg-gray-200 rounded"><X size={16} className="text-gray-400" /></button>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <div className="flex items-center border border-gray-300 rounded-lg focus-within:border-primary-500">
                      <div className="pl-3"><Search size={16} className="text-gray-400" /></div>
                      <input type="text" value={driverSearch}
                        onChange={(e) => { setDriverSearch(e.target.value); setShowDriverDropdown(true); }}
                        onFocus={() => setShowDriverDropdown(true)}
                        placeholder="Search driver name or phone..."
                        disabled={isReadonly}
                        className="flex-1 px-3 py-2.5 text-sm bg-transparent outline-none" />
                    </div>
                    {showDriverDropdown && (
                      <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                        {driversData?.items?.map((d: DriverOption) => (
                          <button key={d.id} type="button" onClick={() => selectDriver(d)}
                            className="w-full text-left px-4 py-3 hover:bg-primary-50 border-b border-gray-50 last:border-0">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-sm">{d.name}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${d.status === 'available' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                {d.status}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{d.phone} | {d.license_type} — {d.license_number}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Driver Name">
                  <TextInput value={form.driver_name} onChange={(v) => updateField('driver_name', v)}
                    placeholder="Driver full name" disabled={isReadonly} />
                </FormField>
                <FormField label="Driver Phone">
                  <TextInput value={form.driver_phone} onChange={(v) => updateField('driver_phone', v)}
                    placeholder="Phone number" disabled={isReadonly} prefix={<Phone size={14} />} />
                </FormField>
              </div>
              <FormField label="License Number">
                <TextInput value={form.driver_license} onChange={(v) => updateField('driver_license', v)}
                  placeholder="DL number" disabled={isReadonly} />
              </FormField>
            </div>
          </div>
        </SectionCard>

        {/* ══════════════════════════════════════════════════════
           SECTION 7: Documents & Notes
        ══════════════════════════════════════════════════════ */}
        <SectionCard title="Documents & Notes" subtitle="Insurance, remarks, and special instructions" icon={<StickyNote size={20} />} collapsible defaultOpen={false}>
          <div className="space-y-6">
            {/* Insurance */}
            <div>
              <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><Shield size={16} className="text-blue-500" /> Insurance Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField label="Insurance Company">
                  <TextInput value={form.insurance_company} onChange={(v) => updateField('insurance_company', v)}
                    placeholder="e.g. New India Assurance" disabled={isReadonly} />
                </FormField>
                <FormField label="Policy Number">
                  <TextInput value={form.insurance_policy_number} onChange={(v) => updateField('insurance_policy_number', v)}
                    placeholder="Policy number" disabled={isReadonly} />
                </FormField>
                <FormField label="Insured Amount (₹)">
                  <TextInput type="number" value={form.insurance_amount}
                    onChange={(v) => updateField('insurance_amount', parseFloat(v) || 0)}
                    prefix={<IndianRupee size={14} />} disabled={isReadonly} />
                </FormField>
              </div>
            </div>

            {/* Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Remarks">
                <TextArea value={form.remarks} onChange={(v) => updateField('remarks', v)}
                  placeholder="Any general remarks..." rows={3} disabled={isReadonly} />
              </FormField>
              <FormField label="Special Instructions">
                <TextArea value={form.special_instructions} onChange={(v) => updateField('special_instructions', v)}
                  placeholder="Handling, delivery time, etc." rows={3} disabled={isReadonly} />
              </FormField>
            </div>
          </div>
        </SectionCard>

        {/* ══════════════════════════════════════════════════════
           Sticky Bottom Action Bar
        ══════════════════════════════════════════════════════ */}
        {!isReadonly && (
          <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-gray-200 -mx-4 sm:-mx-6 px-4 sm:px-6 py-4 flex items-center justify-between gap-4 rounded-t-xl shadow-lg z-30">
            <button type="button" onClick={() => navigate('/lr')}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50">
              Cancel
            </button>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => handleSave('draft')} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save as Draft
              </button>
              <button type="button" onClick={() => handleSave('generate')} disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 shadow-lg shadow-emerald-200">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <FileCheck size={16} />}
                Generate LR
              </button>
            </div>
          </div>
        )}

        {/* Generated success banner */}
        {form.status === 'generated' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-3">
            <CheckCircle2 size={48} className="mx-auto text-emerald-500" />
            <h3 className="text-lg font-bold text-emerald-800">LR Generated Successfully!</h3>
            <p className="text-sm text-emerald-600">This Lorry Receipt is now an official document. You can print or download the PDF.</p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button onClick={handlePrint} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-medium">
                <Printer size={16} /> Print LR
              </button>
              <button onClick={handlePrint} className="flex items-center gap-2 px-5 py-2.5 border border-emerald-300 text-emerald-700 rounded-xl hover:bg-emerald-100 text-sm font-medium">
                <Download size={16} /> Download PDF
              </button>
              <button onClick={() => navigate('/lr')} className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 text-sm font-medium">
                Back to LR List
              </button>
            </div>
          </div>
        )}

        {/* Bottom padding */}
        <div className="h-8" />
      </form>

      {/* Click outside to close dropdowns */}
      {(showJobDropdown || showVehicleDropdown || showDriverDropdown) && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowJobDropdown(false); setShowVehicleDropdown(false); setShowDriverDropdown(false); }} />
      )}
    </div>
  );
}


// ── Print HTML Generator ──
function generatePrintHTML(data: any): string {
  const items = data.items || [];
  const itemRows = items.map((item: any, idx: number) => `
    <tr>
      <td style="border:1px solid #ccc;padding:6px;text-align:center">${idx + 1}</td>
      <td style="border:1px solid #ccc;padding:6px">${item.description || ''}</td>
      <td style="border:1px solid #ccc;padding:6px;text-align:center">${item.packages || ''}</td>
      <td style="border:1px solid #ccc;padding:6px;text-align:center">${item.package_type || ''}</td>
      <td style="border:1px solid #ccc;padding:6px;text-align:right">${item.actual_weight || ''}</td>
      <td style="border:1px solid #ccc;padding:6px;text-align:right">${item.charged_weight || ''}</td>
      <td style="border:1px solid #ccc;padding:6px">${item.invoice_number || ''}</td>
      <td style="border:1px solid #ccc;padding:6px;text-align:right">${item.invoice_value ? '₹' + NumberNumber((item.invoice_value) ?? 0).toLocaleString('en-IN') : ''}</td>
    </tr>
  `).join('');

  const terms = (data.terms || []).map((t: string) => `<li style="margin-bottom:4px">${t}</li>`).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <title>Lorry Receipt - ${data.lr_number || ''}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; font-size: 13px; color: #333; }
    .header { text-align: center; border-bottom: 3px double #333; padding-bottom: 15px; margin-bottom: 15px; }
    .header h1 { margin: 0; font-size: 22px; letter-spacing: 2px; }
    .header p { margin: 3px 0; font-size: 12px; color: #666; }
    .lr-number { font-size: 16px; font-weight: bold; color: #1a56db; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
    .box { border: 1px solid #ccc; border-radius: 4px; padding: 12px; }
    .box h3 { margin: 0 0 8px 0; font-size: 13px; color: #666; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
    .box p { margin: 3px 0; }
    .box .label { color: #888; font-size: 11px; }
    .box .value { font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th { background: #f5f5f5; border: 1px solid #ccc; padding: 8px; font-size: 11px; text-transform: uppercase; }
    .summary { text-align: right; margin-top: 10px; }
    .summary td { padding: 4px 10px; }
    .total-row { font-size: 16px; font-weight: bold; border-top: 2px solid #333; }
    .terms { font-size: 11px; color: #666; margin-top: 20px; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 50px; text-align: center; }
    .signatures div { border-top: 1px solid #999; padding-top: 8px; font-size: 12px; }
    @media print { body { margin: 0; padding: 10px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${data.company_name || 'TRANSPORT ERP'}</h1>
    <p>${data.company_address || ''}</p>
    <p>GSTIN: ${data.company_gstin || ''} | Phone: ${data.company_phone || ''}</p>
    <div style="margin-top:10px">
      <span style="font-size:18px;font-weight:bold;letter-spacing:3px">LORRY RECEIPT / CONSIGNMENT NOTE</span>
    </div>
  </div>

  <div class="grid-2">
    <div>
      <span class="lr-number">${data.lr_number || ''}</span>
      <p><span class="label">Date:</span> <span class="value">${data.lr_date || ''}</span></p>
      <p><span class="label">Job Ref:</span> <span class="value">${data.job_number || ''}</span></p>
    </div>
    <div style="text-align:right">
      <p><span class="label">Vehicle No:</span> <span class="value">${data.vehicle_number || 'N/A'}</span></p>
      <p><span class="label">Driver:</span> <span class="value">${data.driver_name || 'N/A'}</span></p>
      <p><span class="label">E-way Bill:</span> <span class="value">${data.eway_bill_number || 'N/A'}</span></p>
    </div>
  </div>

  <div class="grid-2">
    <div class="box">
      <h3>Consignor (From)</h3>
      <p class="value">${data.consignor_name || ''}</p>
      <p>${data.consignor_address || ''}</p>
      <p><span class="label">GSTIN:</span> ${data.consignor_gstin || 'N/A'}</p>
      <p><span class="label">Phone:</span> ${data.consignor_phone || 'N/A'}</p>
      <p><span class="label">Origin:</span> ${data.origin || ''}, ${data.origin_state || ''}</p>
    </div>
    <div class="box">
      <h3>Consignee (To)</h3>
      <p class="value">${data.consignee_name || ''}</p>
      <p>${data.consignee_address || ''}</p>
      <p><span class="label">GSTIN:</span> ${data.consignee_gstin || 'N/A'}</p>
      <p><span class="label">Phone:</span> ${data.consignee_phone || 'N/A'}</p>
      <p><span class="label">Destination:</span> ${data.destination || ''}, ${data.destination_state || ''}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:40px">S.No</th>
        <th>Description</th>
        <th style="width:60px">Pkgs</th>
        <th style="width:80px">Type</th>
        <th style="width:90px">Act. Wt (Kg)</th>
        <th style="width:90px">Chg. Wt (Kg)</th>
        <th style="width:100px">Invoice No.</th>
        <th style="width:100px">Invoice Value</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows || '<tr><td colspan="8" style="text-align:center;padding:20px;color:#999">No items</td></tr>'}
    </tbody>
  </table>

  <div style="display:grid;grid-template-columns:1fr 300px;gap:20px">
    <div>
      <p><span class="label">Payment Mode:</span> <span class="value" style="text-transform:uppercase">${(data.payment_mode || '').replace(/_/g, ' ')}</span></p>
      ${data.remarks ? `<p><span class="label">Remarks:</span> ${data.remarks}</p>` : ''}
      ${data.insurance_company ? `<p><span class="label">Insurance:</span> ${data.insurance_company} (₹${NumberNumber((data.insurance_amount || 0) ?? 0).toLocaleString('en-IN')})</p>` : ''}
      ${data.declared_value ? `<p><span class="label">Declared Value:</span> ₹${NumberNumber((data.declared_value) ?? 0).toLocaleString('en-IN')}</p>` : ''}
    </div>
    <table class="summary">
      <tr><td class="label">Freight:</td><td>₹${NumberNumber((data.freight_amount || 0) ?? 0).toLocaleString('en-IN')}</td></tr>
      ${data.loading_charges ? `<tr><td class="label">Loading:</td><td>₹${NumberNumber((data.loading_charges) ?? 0).toLocaleString('en-IN')}</td></tr>` : ''}
      ${data.unloading_charges ? `<tr><td class="label">Unloading:</td><td>₹${NumberNumber((data.unloading_charges) ?? 0).toLocaleString('en-IN')}</td></tr>` : ''}
      ${data.detention_charges ? `<tr><td class="label">Detention:</td><td>₹${NumberNumber((data.detention_charges) ?? 0).toLocaleString('en-IN')}</td></tr>` : ''}
      ${data.other_charges ? `<tr><td class="label">Other:</td><td>₹${NumberNumber((data.other_charges) ?? 0).toLocaleString('en-IN')}</td></tr>` : ''}
      <tr><td class="label" style="border-top:1px solid #ccc;padding-top:6px"><strong>Subtotal:</strong></td><td style="border-top:1px solid #ccc;padding-top:6px"><strong>₹${NumberNumber((data.subtotal || 0) ?? 0).toLocaleString('en-IN')}</strong></td></tr>
      <tr><td class="label">GST (${data.gst_percentage || 5}%):</td><td>₹${NumberNumber((data.gst_amount || 0) ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
      <tr class="total-row"><td style="padding-top:8px"><strong>TOTAL:</strong></td><td style="padding-top:8px"><strong>₹${NumberNumber((data.total_amount || 0) ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td></tr>
    </table>
  </div>

  <div class="terms">
    <strong>Terms & Conditions:</strong>
    <ol style="padding-left:18px;margin-top:5px">${terms}</ol>
  </div>

  <div class="signatures">
    <div>Consignor's Signature</div>
    <div>Transport Company</div>
    <div>Consignee's Signature</div>
  </div>

  <p style="text-align:center;font-size:10px;color:#999;margin-top:30px">
    This is a computer-generated document. Printed on ${new Date().toLocaleString('en-IN')}
  </p>
</body>
</html>`;
}
