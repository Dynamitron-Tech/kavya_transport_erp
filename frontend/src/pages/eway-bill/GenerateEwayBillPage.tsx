// ============================================================
// Generate E-Way Bill — Enterprise-Grade Transport ERP
// Indian GST E-way Bill Compliance (Rule 138 CGST Rules)
//
// Sections: Reference, Supplier, Recipient, Goods, Transport,
//           Validity & Tracking
// Actions:  Save Draft, Generate, Cancel, Extend, Print, Download
// ============================================================

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ewayBillService } from '@/services/dataService';
import { useAuthStore } from '@/store/authStore';
import { safeArray } from '@/utils/helpers';
import {
  ChevronRight, Save, FileCheck, ArrowLeft, FileText, Package,
  MapPin, Truck, IndianRupee, Printer, Download,
  AlertCircle, CheckCircle2, XCircle, User, Phone, Hash,
  Loader2, Calendar, Building2, Search, X, Shield,
  ChevronDown, Plus, Trash2, Copy, Clock,
  Navigation, Route, Info, Timer, Ban, RefreshCcw
} from 'lucide-react';

// ── Types ──
interface FormErrors { [key: string]: string; }

interface JobOption {
  id: number; job_number: string; client_name: string; client_gstin: string;
  origin_city: string; origin_state: string; origin_state_code: string;
  origin_address: string; origin_pincode: string;
  destination_city: string; destination_state: string; destination_state_code: string;
  destination_address: string; destination_pincode: string;
  material_type: string; quantity: number; quantity_unit: string;
  agreed_rate: number; status: string; distance_km: number;
}

interface LROption {
  id: number; lr_number: string; job_id: number; origin: string;
  destination: string; status: string; consignor_name: string;
}

interface VehicleOption {
  id: number; registration_number: string; vehicle_type: string;
  capacity_tons: number; status: string;
}

interface GoodsItem {
  id: string;
  product_name: string;
  product_description: string;
  hsn_code: string;
  quantity: number;
  quantity_unit: string;
  taxable_value: number;
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
  cess_rate: number;
  // Computed
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  cess_amount: number;
  total_item_value: number;
  invoice_number: string;
  invoice_date: string;
}

// ── Constants & Config ──
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  draft:     { label: 'Draft',     color: 'text-gray-700',    bg: 'bg-gray-100 border-gray-300',      icon: <FileText size={14} /> },
  generated: { label: 'Generated', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-300',  icon: <CheckCircle2 size={14} /> },
  active:    { label: 'Active',    color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-300',       icon: <Navigation size={14} /> },
  in_transit:{ label: 'In Transit',color: 'text-purple-700',  bg: 'bg-purple-50 border-purple-300',   icon: <Truck size={14} /> },
  extended:  { label: 'Extended',  color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-300',     icon: <RefreshCcw size={14} /> },
  completed: { label: 'Completed', color: 'text-green-700',   bg: 'bg-green-50 border-green-300',     icon: <CheckCircle2 size={14} /> },
  cancelled: { label: 'Cancelled', color: 'text-red-700',     bg: 'bg-red-50 border-red-300',         icon: <XCircle size={14} /> },
  expired:   { label: 'Expired',   color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-300',   icon: <Timer size={14} /> },
};

const TRANSPORT_MODES = [
  { value: 'road', label: 'Road' },
  { value: 'rail', label: 'Rail' },
  { value: 'air', label: 'Air' },
  { value: 'ship', label: 'Ship / Inland Waterway' },
];

const VEHICLE_CATEGORIES = [
  { value: 'regular', label: 'Regular' },
  { value: 'over_dimensional_cargo', label: 'Over Dimensional Cargo (ODC)' },
];

const EMPTY_ITEM: GoodsItem = {
  id: crypto.randomUUID(),
  product_name: '', product_description: '', hsn_code: '',
  quantity: 0, quantity_unit: 'KGS', taxable_value: 0,
  cgst_rate: 0, sgst_rate: 0, igst_rate: 0, cess_rate: 0,
  cgst_amount: 0, sgst_amount: 0, igst_amount: 0, cess_amount: 0,
  total_item_value: 0, invoice_number: '', invoice_date: '',
};

const INITIAL_FORM = {
  eway_bill_date: new Date().toISOString().split('T')[0],
  transaction_type: 'outward',
  transaction_sub_type: 'supply',
  document_type: 'tax_invoice',
  document_number: '',
  document_date: '',
  job_id: 0,
  lr_id: 0,
  // Supplier
  supplier_name: '', supplier_gstin: '', supplier_address: '',
  supplier_city: '', supplier_state: '', supplier_state_code: '',
  supplier_pincode: '', supplier_phone: '',
  // Recipient
  recipient_name: '', recipient_gstin: '', recipient_address: '',
  recipient_city: '', recipient_state: '', recipient_state_code: '',
  recipient_pincode: '', recipient_phone: '',
  // Transport
  transport_mode: 'road',
  vehicle_number: '', vehicle_type: 'regular',
  transporter_name: '', transporter_gstin: '',
  distance_km: 0, approximate_distance: false,
  // Remarks
  remarks: '',
  status: 'draft',
};

// ── Reusable UI Primitives ──
function SectionCard({ title, subtitle, icon, children, collapsible = false, defaultOpen = true, badge, headerRight }: {
  title: string; subtitle?: string; icon: React.ReactNode; children: React.ReactNode;
  collapsible?: boolean; defaultOpen?: boolean; badge?: React.ReactNode; headerRight?: React.ReactNode;
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
      {isOpen && <div className="p-5">{children}</div>}
    </div>
  );
}

function FormField({ label, required, error, hint, children, className = '' }: {
  label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-[13px] font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600 flex items-center gap-1"><AlertCircle size={11} /> {error}</p>}
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
      {prefix && <div className="pl-2.5 text-gray-400">{prefix}</div>}
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        disabled={disabled} className="flex-1 px-2.5 py-2 text-sm bg-transparent outline-none placeholder-gray-400" />
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

// ── GSTIN Validator ──
function validateGSTIN(gstin: string): boolean {
  if (!gstin || !gstin.trim()) return true;
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin.trim().toUpperCase());
}

// ═══════════════════════════════════════════════════════════════
// Main Page Component
// ═══════════════════════════════════════════════════════════════
export default function GenerateEwayBillPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  useAuthStore();

  // ── State ──
  const [form, setForm] = useState({ ...INITIAL_FORM });
  const [items, setItems] = useState<GoodsItem[]>([{ ...EMPTY_ITEM, id: crypto.randomUUID() }]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);

  // Job lookup
  const [selectedJob, setSelectedJob] = useState<JobOption | null>(null);
  const [jobSearch, setJobSearch] = useState('');
  const [showJobDropdown, setShowJobDropdown] = useState(false);

  // LR lookup
  const [selectedLR, setSelectedLR] = useState<LROption | null>(null);
  const [showLRDropdown, setShowLRDropdown] = useState(false);

  // Vehicle lookup
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);

  // Modals
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [extendReason, setExtendReason] = useState('');
  const [extendDistance, setExtendDistance] = useState(0);

  // ── Queries ──
  const { data: nextNumber } = useQuery({
    queryKey: ['next-eway-number'],
    queryFn: () => ewayBillService.getNextEwayNumber(),
    enabled: !isEdit,
  });

  const { data: jobsData } = useQuery({
    queryKey: ['eway-lookup-jobs', jobSearch],
    queryFn: () => ewayBillService.getJobs(jobSearch),
    enabled: showJobDropdown,
  });

  const { data: lrsData } = useQuery({
    queryKey: ['eway-lookup-lrs', form.job_id],
    queryFn: () => ewayBillService.getLRs(form.job_id || undefined),
    enabled: form.job_id > 0,
  });

  const { data: statesData } = useQuery({
    queryKey: ['eway-lookup-states'],
    queryFn: () => ewayBillService.getStates(),
  });

  const { data: hsnData } = useQuery({
    queryKey: ['eway-lookup-hsn'],
    queryFn: () => ewayBillService.getHSNCodes(),
  });

  const { data: uqcData } = useQuery({
    queryKey: ['eway-lookup-uqc'],
    queryFn: () => ewayBillService.getUQCCodes(),
  });

  const { data: docTypesData } = useQuery({
    queryKey: ['eway-lookup-doc-types'],
    queryFn: () => ewayBillService.getDocumentTypes(),
  });

  const { data: txnTypesData } = useQuery({
    queryKey: ['eway-lookup-txn-types'],
    queryFn: () => ewayBillService.getTransactionTypes(),
  });

  const { data: gstRatesData } = useQuery({
    queryKey: ['eway-lookup-gst-rates'],
    queryFn: () => ewayBillService.getGSTRates(),
  });

  const { data: vehiclesData } = useQuery({
    queryKey: ['eway-lookup-vehicles', vehicleSearch],
    queryFn: () => ewayBillService.getVehicles(vehicleSearch),
    enabled: showVehicleDropdown,
  });

  const jobs: JobOption[] = safeArray(jobsData);
  const lrs: LROption[] = safeArray(lrsData);
  const states = safeArray(statesData);
  const hsnCodes = safeArray(hsnData);
  const uqcCodes = safeArray(uqcData);
  const docTypes = safeArray(docTypesData);
  const txnTypes = safeArray(txnTypesData);
  const gstRates = safeArray(gstRatesData);
  const vehicles: VehicleOption[] = safeArray(vehiclesData);

  // ── Load existing E-way Bill for edit ──
  useEffect(() => {
    if (isEdit && id) {
      ewayBillService.get(parseInt(id)).then((eway: any) => {
        setForm({
          eway_bill_date: eway.eway_bill_date || INITIAL_FORM.eway_bill_date,
          transaction_type: eway.transaction_type || 'outward',
          transaction_sub_type: eway.transaction_sub_type || 'supply',
          document_type: eway.document_type || 'tax_invoice',
          document_number: eway.document_number || '',
          document_date: eway.document_date || '',
          job_id: eway.job_id || 0,
          lr_id: eway.lr_id || 0,
          supplier_name: eway.supplier_name || '',
          supplier_gstin: eway.supplier_gstin || '',
          supplier_address: eway.supplier_address || '',
          supplier_city: eway.supplier_city || '',
          supplier_state: eway.supplier_state || '',
          supplier_state_code: eway.supplier_state_code || '',
          supplier_pincode: eway.supplier_pincode || '',
          supplier_phone: eway.supplier_phone || '',
          recipient_name: eway.recipient_name || '',
          recipient_gstin: eway.recipient_gstin || '',
          recipient_address: eway.recipient_address || '',
          recipient_city: eway.recipient_city || '',
          recipient_state: eway.recipient_state || '',
          recipient_state_code: eway.recipient_state_code || '',
          recipient_pincode: eway.recipient_pincode || '',
          recipient_phone: eway.recipient_phone || '',
          transport_mode: eway.transport_mode || 'road',
          vehicle_number: eway.vehicle_number || '',
          vehicle_type: eway.vehicle_type || 'regular',
          transporter_name: eway.transporter_name || '',
          transporter_gstin: eway.transporter_gstin || '',
          distance_km: eway.distance_km || 0,
          approximate_distance: eway.approximate_distance || false,
          remarks: eway.remarks || '',
          status: eway.status || 'draft',
        });
        if (eway.items?.length) {
          setItems(eway.items.map((it: any) => ({
            id: crypto.randomUUID(),
            product_name: it.product_name || '',
            product_description: it.product_description || '',
            hsn_code: it.hsn_code || '',
            quantity: it.quantity || 0,
            quantity_unit: it.quantity_unit || 'KGS',
            taxable_value: it.taxable_value || 0,
            cgst_rate: it.cgst_rate || 0, sgst_rate: it.sgst_rate || 0,
            igst_rate: it.igst_rate || 0, cess_rate: it.cess_rate || 0,
            cgst_amount: it.cgst_amount || 0, sgst_amount: it.sgst_amount || 0,
            igst_amount: it.igst_amount || 0, cess_amount: it.cess_amount || 0,
            total_item_value: it.total_item_value || 0,
            invoice_number: it.invoice_number || '',
            invoice_date: it.invoice_date || '',
          })));
        }
        setCreatedId(parseInt(id));
      }).catch(() => navigate('/lr/eway-bill'));
    }
  }, [isEdit, id, navigate]);

  // ── Derived State ──
  const isInterstate = useMemo(() => {
    return form.supplier_state_code !== form.recipient_state_code &&
      !!form.supplier_state_code && !!form.recipient_state_code;
  }, [form.supplier_state_code, form.recipient_state_code]);

  const isDraft = form.status === 'draft';
  const isReadOnly = !isDraft && isEdit;

  // ── Field Helpers ──
  const updateField = useCallback((field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  }, []);

  const updateItem = useCallback((itemId: string, field: string, value: any) => {
    setItems(prev => prev.map(it => {
      if (it.id !== itemId) return it;
      const updated = { ...it, [field]: value };
      // Auto-recalculate taxes
      const tv = parseFloat(String(updated.taxable_value)) || 0;
      if (isInterstate) {
        const igstR = parseFloat(String(updated.igst_rate)) || 0;
        updated.cgst_rate = 0; updated.sgst_rate = 0;
        updated.cgst_amount = 0; updated.sgst_amount = 0;
        updated.igst_amount = Math.round(tv * igstR / 100 * 100) / 100;
      } else {
        const cgstR = parseFloat(String(updated.cgst_rate)) || 0;
        const sgstR = parseFloat(String(updated.sgst_rate)) || cgstR;
        updated.sgst_rate = sgstR;
        updated.igst_rate = 0; updated.igst_amount = 0;
        updated.cgst_amount = Math.round(tv * cgstR / 100 * 100) / 100;
        updated.sgst_amount = Math.round(tv * sgstR / 100 * 100) / 100;
      }
      const cessR = parseFloat(String(updated.cess_rate)) || 0;
      updated.cess_amount = Math.round(tv * cessR / 100 * 100) / 100;
      updated.total_item_value = Math.round((tv + updated.cgst_amount + updated.sgst_amount + updated.igst_amount + updated.cess_amount) * 100) / 100;
      return updated;
    }));
  }, [isInterstate]);

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

  // ── Computed Totals ──
  const totals = useMemo(() => {
    const taxable = items.reduce((s, i) => s + (parseFloat(String(i.taxable_value)) || 0), 0);
    const cgst = items.reduce((s, i) => s + (i.cgst_amount || 0), 0);
    const sgst = items.reduce((s, i) => s + (i.sgst_amount || 0), 0);
    const igst = items.reduce((s, i) => s + (i.igst_amount || 0), 0);
    const cess = items.reduce((s, i) => s + (i.cess_amount || 0), 0);
    const total = items.reduce((s, i) => s + (i.total_item_value || 0), 0);
    return {
      total_taxable_value: Math.round(taxable * 100) / 100,
      cgst_amount: Math.round(cgst * 100) / 100,
      sgst_amount: Math.round(sgst * 100) / 100,
      igst_amount: Math.round(igst * 100) / 100,
      cess_amount: Math.round(cess * 100) / 100,
      total_invoice_value: Math.round(total * 100) / 100,
    };
  }, [items]);

  const validityDays = useMemo(() => {
    const dist = form.distance_km || 0;
    if (dist <= 0) return 0;
    return form.vehicle_type === 'over_dimensional_cargo'
      ? Math.max(1, Math.ceil(dist / 20))
      : Math.max(1, Math.ceil(dist / 200));
  }, [form.distance_km, form.vehicle_type]);

  // ── Auto-fill from Job ──
  const selectJob = useCallback((job: JobOption) => {
    setSelectedJob(job);
    setShowJobDropdown(false);
    setJobSearch('');
    updateField('job_id', job.id);
    // Auto-fill supplier from origin
    setForm(prev => ({
      ...prev,
      job_id: job.id,
      supplier_name: job.client_name,
      supplier_gstin: job.client_gstin || '',
      supplier_address: job.origin_address || '',
      supplier_city: job.origin_city || '',
      supplier_state: job.origin_state || '',
      supplier_state_code: job.origin_state_code || '',
      supplier_pincode: job.origin_pincode || '',
      // Recipient from destination
      recipient_address: job.destination_address || '',
      recipient_city: job.destination_city || '',
      recipient_state: job.destination_state || '',
      recipient_state_code: job.destination_state_code || '',
      recipient_pincode: job.destination_pincode || '',
      distance_km: job.distance_km || 0,
    }));
  }, [updateField]);

  const selectLR = useCallback((lr: LROption) => {
    setSelectedLR(lr);
    setShowLRDropdown(false);
    updateField('lr_id', lr.id);
  }, [updateField]);

  const selectVehicle = useCallback((v: VehicleOption) => {
    setShowVehicleDropdown(false);
    setVehicleSearch('');
    updateField('vehicle_number', v.registration_number);
  }, [updateField]);

  // ── State change handler for supplier/recipient ──
  const handleStateChange = useCallback((field: 'supplier' | 'recipient', stateCode: string) => {
    const st: any = states.find((s: any) => s.code === stateCode);
    if (st) {
      setForm(prev => ({
        ...prev,
        [`${field}_state`]: st.name,
        [`${field}_state_code`]: st.code,
      }));
    }
  }, [states]);

  // ── Validation ──
  const validate = useCallback((): boolean => {
    const errs: FormErrors = {};
    if (!form.job_id) errs.job_id = 'Job is required';
    if (!form.supplier_name.trim()) errs.supplier_name = 'Supplier name is required';
    if (form.supplier_gstin && !validateGSTIN(form.supplier_gstin)) errs.supplier_gstin = 'Invalid GSTIN format';
    if (!form.recipient_name.trim()) errs.recipient_name = 'Recipient name is required';
    if (form.recipient_gstin && !validateGSTIN(form.recipient_gstin)) errs.recipient_gstin = 'Invalid GSTIN format';
    if (form.transporter_gstin && !validateGSTIN(form.transporter_gstin)) errs.transporter_gstin = 'Invalid GSTIN format';
    if (items.length === 0) errs.items = 'At least one goods item is required';
    items.forEach((it, idx) => {
      if (!it.product_name.trim()) errs[`item_${idx}_product_name`] = `Item ${idx + 1}: Product name required`;
      if (!it.hsn_code.trim()) errs[`item_${idx}_hsn_code`] = `Item ${idx + 1}: HSN code required`;
      if (it.taxable_value <= 0) errs[`item_${idx}_taxable_value`] = `Item ${idx + 1}: Taxable value must be > 0`;
    });
    if (form.transport_mode === 'road' && !form.vehicle_number.trim()) errs.vehicle_number = 'Vehicle number required for road transport';
    if (!form.distance_km || form.distance_km <= 0) errs.distance_km = 'Distance is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [form, items]);

  // ── Save ──
  const handleSave = useCallback(async (generateAfter = false) => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        items: items.map((it, idx) => ({
          item_number: idx + 1,
          product_name: it.product_name,
          product_description: it.product_description,
          hsn_code: it.hsn_code,
          quantity: it.quantity,
          quantity_unit: it.quantity_unit,
          taxable_value: it.taxable_value,
          cgst_rate: it.cgst_rate,
          sgst_rate: it.sgst_rate,
          igst_rate: it.igst_rate,
          cess_rate: it.cess_rate,
          invoice_number: it.invoice_number,
          invoice_date: it.invoice_date || null,
        })),
      };

      let result;
      if (isEdit && createdId) {
        result = await ewayBillService.update(createdId, payload);
      } else {
        result = await ewayBillService.create(payload);
        setCreatedId(result.id);
      }

      if (generateAfter && result.id) {
        await ewayBillService.generate(result.id);
        navigate(`/lr/eway-bill/${result.id}`);
      } else if (!isEdit) {
        navigate(`/lr/eway-bill/${result.id}/edit`);
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
  }, [form, items, isEdit, createdId, validate, navigate]);

  // ── Cancel ──
  const handleCancel = useCallback(async () => {
    if (!createdId || cancelReason.length < 10) return;
    try {
      await ewayBillService.cancel(createdId, { reason: cancelReason });
      setShowCancelModal(false);
      navigate(`/lr/eway-bill/${createdId}`);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Cancel failed');
    }
  }, [createdId, cancelReason, navigate]);

  // ── Extend ──
  const handleExtend = useCallback(async () => {
    if (!createdId || extendReason.length < 10) return;
    try {
      await ewayBillService.extend(createdId, { reason: extendReason, remaining_distance_km: extendDistance || undefined });
      setShowExtendModal(false);
      navigate(`/lr/eway-bill/${createdId}`);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Extend failed');
    }
  }, [createdId, extendReason, extendDistance, navigate]);

  // ── Print ──
  const handlePrint = useCallback(async () => {
    if (!createdId) return;
    try {
      const data = await ewayBillService.print(createdId);
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(`<pre style="font-family:monospace;font-size:12px">${JSON.stringify(data, null, 2)}</pre>`);
      }
    } catch { /* ignore */ }
  }, [createdId]);

  // ── Sub-types for selected transaction type ──
  const subTypes = useMemo(() => {
    const t: any = txnTypes.find((t: any) => t.value === form.transaction_type);
    return t?.sub_types || [];
  }, [txnTypes, form.transaction_type]);

  // ── INR Formatter ──
  const fmt = (v: number) => (v ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  const statusCfg = STATUS_CONFIG[form.status] || STATUS_CONFIG.draft;

  return (
    <div className="max-w-[1100px] mx-auto pb-8">
      {/* ── Breadcrumb ── */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-4">
        <Link to="/dashboard" className="hover:text-primary-600 transition-colors">Dashboard</Link>
        <ChevronRight size={14} className="text-gray-300" />
        <Link to="/lr/eway-bill" className="hover:text-primary-600 transition-colors">E-Way Bills</Link>
        <ChevronRight size={14} className="text-gray-300" />
        <span className="text-gray-900 font-semibold">{isEdit ? 'Edit E-Way Bill' : 'Generate E-Way Bill'}</span>
      </nav>

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              {isEdit ? 'Edit E-Way Bill' : 'Generate E-Way Bill'}
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold border rounded-full ${statusCfg.bg} ${statusCfg.color}`}>
                {statusCfg.icon} {statusCfg.label}
              </span>
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {isEdit ? `Editing ${nextNumber?.eway_bill_number || ''}` : `New: ${nextNumber?.eway_bill_number || 'EWB-XXXX'}`}
              {isInterstate && <span className="ml-2 text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded">Inter-State (IGST)</span>}
              {!isInterstate && form.supplier_state_code && form.recipient_state_code && (
                <span className="ml-2 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Intra-State (CGST+SGST)</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isEdit && !isDraft && (
            <>
              <button onClick={handlePrint} className="btn-ghost flex items-center gap-1.5 text-sm"><Printer size={15} /> Print</button>
              <button onClick={() => {}} className="btn-ghost flex items-center gap-1.5 text-sm"><Download size={15} /> Download</button>
            </>
          )}
          {isEdit && ['generated', 'active'].includes(form.status) && (
            <button onClick={() => setShowExtendModal(true)} className="btn-secondary flex items-center gap-1.5 text-sm"><RefreshCcw size={15} /> Extend</button>
          )}
          {isEdit && ['draft', 'generated', 'active'].includes(form.status) && (
            <button onClick={() => setShowCancelModal(true)} className="btn-danger flex items-center gap-1.5 text-sm !py-2"><Ban size={15} /> Cancel</button>
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

      <div className="space-y-4">

        {/* ═══════════════ SECTION 1: Reference Details ═══════════════ */}
        <SectionCard title="Reference Details" subtitle="E-Way Bill reference, job linking, document info" icon={<FileText size={18} />}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Job Selector */}
            <FormField label="Job / Order" required error={errors.job_id} className="md:col-span-2">
              <div className="relative">
                <div onClick={() => !isReadOnly && setShowJobDropdown(!showJobDropdown)}
                  className={`flex items-center border rounded-lg px-2.5 py-2 cursor-pointer transition-colors ${
                    errors.job_id ? 'border-red-300' : 'border-gray-300 hover:border-gray-400'
                  } ${isReadOnly ? 'bg-gray-50 opacity-60 pointer-events-none' : 'bg-white'}`}>
                  <Search size={15} className="text-gray-400 mr-2" />
                  {selectedJob ? (
                    <span className="text-sm font-medium text-gray-800">
                      {selectedJob.job_number} — {selectedJob.client_name}
                      <span className="text-gray-400 ml-2 font-normal">{selectedJob.origin_city} → {selectedJob.destination_city}</span>
                    </span>
                  ) : (
                    <input type="text" value={jobSearch} onChange={(e) => { setJobSearch(e.target.value); setShowJobDropdown(true); }}
                      placeholder="Search jobs by number, client, city…"
                      className="flex-1 bg-transparent outline-none text-sm placeholder-gray-400" readOnly={isReadOnly} />
                  )}
                  {selectedJob && !isReadOnly && (
                    <button onClick={(e) => { e.stopPropagation(); setSelectedJob(null); updateField('job_id', 0); }} className="ml-auto text-gray-400 hover:text-gray-600"><X size={14} /></button>
                  )}
                </div>
                {showJobDropdown && !isReadOnly && (
                  <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-dropdown max-h-56 overflow-y-auto">
                    {jobs.length === 0 ? (
                      <p className="p-3 text-sm text-gray-400">No approved jobs found</p>
                    ) : (
                      jobs.map(j => (
                        <button key={j.id} onClick={() => selectJob(j)}
                          className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-800">{j.job_number}</span>
                            <span className="text-xs text-gray-400">{j.distance_km} km</span>
                          </div>
                          <p className="text-xs text-gray-500">{j.client_name} — {j.origin_city} → {j.destination_city}</p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </FormField>

            {/* LR Selector */}
            <FormField label="Lorry Receipt (LR)" hint="Optional — link to an LR">
              <div className="relative">
                <div onClick={() => form.job_id > 0 && !isReadOnly && setShowLRDropdown(!showLRDropdown)}
                  className={`flex items-center border rounded-lg px-2.5 py-2 transition-colors ${
                    form.job_id > 0 && !isReadOnly ? 'cursor-pointer border-gray-300 hover:border-gray-400 bg-white' : 'bg-gray-50 opacity-60 border-gray-200 cursor-not-allowed'
                  }`}>
                  {selectedLR ? (
                    <span className="text-sm text-gray-800">{selectedLR.lr_number}</span>
                  ) : (
                    <span className="text-sm text-gray-400">Select LR…</span>
                  )}
                  {selectedLR && !isReadOnly && (
                    <button onClick={(e) => { e.stopPropagation(); setSelectedLR(null); updateField('lr_id', 0); }} className="ml-auto text-gray-400 hover:text-gray-600"><X size={14} /></button>
                  )}
                </div>
                {showLRDropdown && (
                  <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-dropdown max-h-48 overflow-y-auto">
                    {lrs.length === 0 ? (
                      <p className="p-3 text-sm text-gray-400">No LRs for this Job</p>
                    ) : (
                      lrs.map(lr => (
                        <button key={lr.id} onClick={() => selectLR(lr)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b border-gray-50 last:border-0">
                          <span className="font-medium text-gray-800">{lr.lr_number}</span>
                          <span className="text-xs text-gray-400 ml-2">{lr.origin} → {lr.destination}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </FormField>

            <FormField label="E-Way Bill Date" required>
              <TextInput value={form.eway_bill_date} onChange={(v) => updateField('eway_bill_date', v)} type="date" disabled={isReadOnly} prefix={<Calendar size={15} />} />
            </FormField>

            <FormField label="Transaction Type" required>
              <SelectInput value={form.transaction_type} onChange={(v) => { updateField('transaction_type', v); updateField('transaction_sub_type', 'supply'); }}
                options={txnTypes.map((t: any) => ({ value: t.value, label: t.label }))} disabled={isReadOnly} />
            </FormField>

            <FormField label="Sub Type" required>
              <SelectInput value={form.transaction_sub_type} onChange={(v) => updateField('transaction_sub_type', v)}
                options={subTypes.map((s: any) => ({ value: s.value, label: s.label }))} disabled={isReadOnly} />
            </FormField>

            <FormField label="Document Type" required>
              <SelectInput value={form.document_type} onChange={(v) => updateField('document_type', v)}
                options={docTypes.map((d: any) => ({ value: d.value, label: d.label }))} disabled={isReadOnly} />
            </FormField>

            <FormField label="Document / Invoice Number">
              <TextInput value={form.document_number} onChange={(v) => updateField('document_number', v)}
                placeholder="INV-2026-0001" disabled={isReadOnly} prefix={<Hash size={15} />} />
            </FormField>

            <FormField label="Document Date">
              <TextInput value={form.document_date} onChange={(v) => updateField('document_date', v)} type="date" disabled={isReadOnly} prefix={<Calendar size={15} />} />
            </FormField>
          </div>
        </SectionCard>

        {/* ═══════════════ SECTION 2: Supplier Details ═══════════════ */}
        <SectionCard title="Supplier Details (From)" subtitle="Place of dispatch — auto-filled from Job origin" icon={<Building2 size={18} />}
          headerRight={form.supplier_gstin && (
            <span className={`text-xs font-mono px-2 py-0.5 rounded ${validateGSTIN(form.supplier_gstin) ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {form.supplier_gstin.toUpperCase()}
            </span>
          )}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Supplier Name" required error={errors.supplier_name}>
              <TextInput value={form.supplier_name} onChange={(v) => updateField('supplier_name', v)} placeholder="Business or individual name" disabled={isReadOnly} prefix={<User size={15} />} />
            </FormField>
            <FormField label="GSTIN" error={errors.supplier_gstin}>
              <TextInput value={form.supplier_gstin} onChange={(v) => updateField('supplier_gstin', v.toUpperCase())}
                placeholder="22AAAAA0000A1Z5" error={!!errors.supplier_gstin} disabled={isReadOnly} prefix={<Shield size={15} />} />
            </FormField>
            <FormField label="Phone">
              <TextInput value={form.supplier_phone} onChange={(v) => updateField('supplier_phone', v)} placeholder="+91 XXXXX XXXXX" disabled={isReadOnly} prefix={<Phone size={15} />} />
            </FormField>
            <FormField label="Address" className="md:col-span-2">
              <TextArea value={form.supplier_address} onChange={(v) => updateField('supplier_address', v)} placeholder="Full address" rows={2} disabled={isReadOnly} />
            </FormField>
            <FormField label="Pincode">
              <TextInput value={form.supplier_pincode} onChange={(v) => updateField('supplier_pincode', v)} placeholder="400001" disabled={isReadOnly} prefix={<MapPin size={15} />} />
            </FormField>
            <FormField label="State" required>
              <SelectInput value={form.supplier_state_code} onChange={(v) => handleStateChange('supplier', v)}
                options={states.map((s: any) => ({ value: s.code, label: `${s.name} (${s.code})` }))} placeholder="Select state" disabled={isReadOnly} />
            </FormField>
            <FormField label="City">
              <TextInput value={form.supplier_city} onChange={(v) => updateField('supplier_city', v)} placeholder="City" disabled={isReadOnly} />
            </FormField>
          </div>
        </SectionCard>

        {/* ═══════════════ SECTION 3: Recipient Details ═══════════════ */}
        <SectionCard title="Recipient Details (To)" subtitle="Place of delivery — destination details" icon={<MapPin size={18} />}
          headerRight={form.recipient_gstin && (
            <span className={`text-xs font-mono px-2 py-0.5 rounded ${validateGSTIN(form.recipient_gstin) ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {form.recipient_gstin.toUpperCase()}
            </span>
          )}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Recipient Name" required error={errors.recipient_name}>
              <TextInput value={form.recipient_name} onChange={(v) => updateField('recipient_name', v)} placeholder="Business or individual name" disabled={isReadOnly} prefix={<User size={15} />} />
            </FormField>
            <FormField label="GSTIN" error={errors.recipient_gstin}>
              <TextInput value={form.recipient_gstin} onChange={(v) => updateField('recipient_gstin', v.toUpperCase())}
                placeholder="22AAAAA0000A1Z5" error={!!errors.recipient_gstin} disabled={isReadOnly} prefix={<Shield size={15} />} />
            </FormField>
            <FormField label="Phone">
              <TextInput value={form.recipient_phone} onChange={(v) => updateField('recipient_phone', v)} placeholder="+91 XXXXX XXXXX" disabled={isReadOnly} prefix={<Phone size={15} />} />
            </FormField>
            <FormField label="Address" className="md:col-span-2">
              <TextArea value={form.recipient_address} onChange={(v) => updateField('recipient_address', v)} placeholder="Full address" rows={2} disabled={isReadOnly} />
            </FormField>
            <FormField label="Pincode">
              <TextInput value={form.recipient_pincode} onChange={(v) => updateField('recipient_pincode', v)} placeholder="560001" disabled={isReadOnly} prefix={<MapPin size={15} />} />
            </FormField>
            <FormField label="State" required>
              <SelectInput value={form.recipient_state_code} onChange={(v) => handleStateChange('recipient', v)}
                options={states.map((s: any) => ({ value: s.code, label: `${s.name} (${s.code})` }))} placeholder="Select state" disabled={isReadOnly} />
            </FormField>
            <FormField label="City">
              <TextInput value={form.recipient_city} onChange={(v) => updateField('recipient_city', v)} placeholder="City" disabled={isReadOnly} />
            </FormField>
          </div>
        </SectionCard>

        {/* ═══════════════ SECTION 4: Goods Details ═══════════════ */}
        <SectionCard title="Goods Details" subtitle={`${items.length} item(s) — HSN, quantity, tax calculations`} icon={<Package size={18} />}
          badge={
            <span className="text-xs font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full">
              ₹{fmt(totals.total_invoice_value)}
            </span>
          }
          headerRight={!isReadOnly ? (
            <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-2.5 py-1 rounded-md transition-colors">
              <Plus size={13} /> Add Item
            </button>
          ) : undefined}>

          {errors.items && <p className="text-xs text-red-600 flex items-center gap-1 mb-3"><AlertCircle size={12} /> {errors.items}</p>}

          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={item.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50/50 relative group">
                {/* Item header */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Item #{idx + 1}</span>
                  {!isReadOnly && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => duplicateItem(item.id)} className="p-1 text-gray-400 hover:text-primary-600 rounded" title="Duplicate"><Copy size={13} /></button>
                      <button onClick={() => removeItem(item.id)} className="p-1 text-gray-400 hover:text-red-600 rounded" title="Remove"><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  <FormField label="Product Name" required error={errors[`item_${idx}_product_name`]} className="md:col-span-2">
                    <TextInput value={item.product_name} onChange={(v) => updateItem(item.id, 'product_name', v)} placeholder="Product name" disabled={isReadOnly} />
                  </FormField>
                  <FormField label="HSN Code" required error={errors[`item_${idx}_hsn_code`]}>
                    <SelectInput value={item.hsn_code} onChange={(v) => updateItem(item.id, 'hsn_code', v)}
                      options={hsnCodes.map((h: any) => ({ value: h.code, label: `${h.code} — ${h.description}` }))} placeholder="Select" disabled={isReadOnly} />
                  </FormField>
                  <FormField label="Quantity">
                    <TextInput value={item.quantity} onChange={(v) => updateItem(item.id, 'quantity', parseFloat(v) || 0)} type="number" disabled={isReadOnly} />
                  </FormField>
                  <FormField label="Unit">
                    <SelectInput value={item.quantity_unit} onChange={(v) => updateItem(item.id, 'quantity_unit', v)}
                      options={uqcCodes.map((u: any) => ({ value: u.value, label: u.label }))} disabled={isReadOnly} />
                  </FormField>
                  <FormField label="Taxable Value (₹)" required error={errors[`item_${idx}_taxable_value`]}>
                    <TextInput value={item.taxable_value} onChange={(v) => updateItem(item.id, 'taxable_value', parseFloat(v) || 0)} type="number" disabled={isReadOnly} prefix={<IndianRupee size={14} />} />
                  </FormField>
                </div>

                {/* Tax row */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-3">
                  {isInterstate ? (
                    <FormField label="IGST Rate (%)">
                      <SelectInput value={item.igst_rate} onChange={(v) => updateItem(item.id, 'igst_rate', parseFloat(v))}
                        options={gstRates.map((r: any) => ({ value: r.value, label: r.label }))} disabled={isReadOnly} />
                    </FormField>
                  ) : (
                    <>
                      <FormField label="CGST Rate (%)">
                        <SelectInput value={item.cgst_rate} onChange={(v) => { updateItem(item.id, 'cgst_rate', parseFloat(v)); updateItem(item.id, 'sgst_rate', parseFloat(v)); }}
                          options={gstRates.map((r: any) => ({ value: r.value, label: r.label }))} disabled={isReadOnly} />
                      </FormField>
                      <FormField label="SGST Rate (%)">
                        <TextInput value={item.sgst_rate} onChange={() => {}} disabled={true} suffix="%" />
                      </FormField>
                    </>
                  )}
                  <FormField label="Cess Rate (%)">
                    <TextInput value={item.cess_rate} onChange={(v) => updateItem(item.id, 'cess_rate', parseFloat(v) || 0)} type="number" disabled={isReadOnly} suffix="%" />
                  </FormField>
                  <FormField label="Invoice No.">
                    <TextInput value={item.invoice_number} onChange={(v) => updateItem(item.id, 'invoice_number', v)} placeholder="INV-XXX" disabled={isReadOnly} />
                  </FormField>
                  <FormField label="Invoice Date">
                    <TextInput value={item.invoice_date} onChange={(v) => updateItem(item.id, 'invoice_date', v)} type="date" disabled={isReadOnly} />
                  </FormField>
                  <div className="flex flex-col justify-end">
                    <p className="text-xs text-gray-500">Item Total</p>
                    <p className="text-sm font-bold text-gray-900">₹{fmt(item.total_item_value)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Totals Summary */}
          <div className="mt-4 border-t border-gray-200 pt-4">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div><p className="text-xs text-gray-500">Taxable Value</p><p className="text-sm font-semibold text-gray-900">₹{fmt(totals.total_taxable_value)}</p></div>
              {!isInterstate && (
                <>
                  <div><p className="text-xs text-gray-500">CGST</p><p className="text-sm font-semibold text-gray-900">₹{fmt(totals.cgst_amount)}</p></div>
                  <div><p className="text-xs text-gray-500">SGST</p><p className="text-sm font-semibold text-gray-900">₹{fmt(totals.sgst_amount)}</p></div>
                </>
              )}
              {isInterstate && (
                <div><p className="text-xs text-gray-500">IGST</p><p className="text-sm font-semibold text-gray-900">₹{fmt(totals.igst_amount)}</p></div>
              )}
              <div><p className="text-xs text-gray-500">Cess</p><p className="text-sm font-semibold text-gray-900">₹{fmt(totals.cess_amount)}</p></div>
              <div className="md:col-span-1">
                <p className="text-xs text-gray-500">Total Invoice Value</p>
                <p className="text-lg font-bold text-primary-700">₹{fmt(totals.total_invoice_value)}</p>
              </div>
            </div>
            {totals.total_invoice_value < 50000 && totals.total_invoice_value > 0 && (
              <div className="mt-3 flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <Info size={14} className="flex-shrink-0" /> Invoice value is below ₹50,000. E-Way Bill may not be mandatory per GST rules.
              </div>
            )}
          </div>
        </SectionCard>

        {/* ═══════════════ SECTION 5: Transport Details ═══════════════ */}
        <SectionCard title="Transport Details" subtitle="Vehicle, transporter, and mode of transport" icon={<Truck size={18} />}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Transport Mode">
              <SelectInput value={form.transport_mode} onChange={(v) => updateField('transport_mode', v)}
                options={TRANSPORT_MODES} disabled={isReadOnly} />
            </FormField>

            <FormField label="Vehicle Number" required={form.transport_mode === 'road'} error={errors.vehicle_number}>
              <div className="relative">
                <TextInput value={form.vehicle_number} onChange={(v) => { updateField('vehicle_number', v.toUpperCase()); setVehicleSearch(v); !isReadOnly && setShowVehicleDropdown(true); }}
                  placeholder="MH-04-AB-1234" error={!!errors.vehicle_number} disabled={isReadOnly} prefix={<Truck size={15} />} />
                {showVehicleDropdown && vehicles.length > 0 && (
                  <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-dropdown max-h-40 overflow-y-auto">
                    {vehicles.map(v => (
                      <button key={v.id} onClick={() => selectVehicle(v)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b border-gray-50 last:border-0">
                        <span className="font-medium">{v.registration_number}</span>
                        <span className="text-xs text-gray-400 ml-2">{v.vehicle_type} • {v.capacity_tons}T</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </FormField>

            <FormField label="Vehicle Category">
              <SelectInput value={form.vehicle_type} onChange={(v) => updateField('vehicle_type', v)}
                options={VEHICLE_CATEGORIES} disabled={isReadOnly} />
            </FormField>

            <FormField label="Transporter Name">
              <TextInput value={form.transporter_name} onChange={(v) => updateField('transporter_name', v)} placeholder="Transport company" disabled={isReadOnly} prefix={<Building2 size={15} />} />
            </FormField>
            <FormField label="Transporter GSTIN" error={errors.transporter_gstin}>
              <TextInput value={form.transporter_gstin} onChange={(v) => updateField('transporter_gstin', v.toUpperCase())}
                placeholder="22AAAAA0000A1Z5" error={!!errors.transporter_gstin} disabled={isReadOnly} prefix={<Shield size={15} />} />
            </FormField>
            <FormField label="Distance (km)" required error={errors.distance_km}>
              <TextInput value={form.distance_km} onChange={(v) => updateField('distance_km', parseInt(v) || 0)} type="number"
                disabled={isReadOnly} prefix={<Route size={15} />} suffix="km" />
            </FormField>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input type="checkbox" id="approx-dist" checked={form.approximate_distance}
              onChange={(e) => updateField('approximate_distance', e.target.checked)} disabled={isReadOnly}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            <label htmlFor="approx-dist" className="text-sm text-gray-600">Approximate distance (may differ from actual)</label>
          </div>
        </SectionCard>

        {/* ═══════════════ SECTION 6: Validity & Tracking ═══════════════ */}
        <SectionCard title="Validity & Tracking" subtitle="Auto-calculated validity per GST rules" icon={<Clock size={18} />}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-primary-50 rounded-lg p-3.5 text-center">
              <p className="text-xs font-medium text-primary-600 uppercase tracking-wide">Validity Period</p>
              <p className="text-2xl font-bold text-primary-700 mt-1">{validityDays}</p>
              <p className="text-xs text-primary-500">day{validityDays !== 1 ? 's' : ''}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3.5 text-center">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Distance</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{form.distance_km || '—'}</p>
              <p className="text-xs text-gray-500">km</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3.5 text-center">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Rate</p>
              <p className="text-lg font-bold text-gray-800 mt-1">
                {form.vehicle_type === 'over_dimensional_cargo' ? '20 km/day' : '200 km/day'}
              </p>
              <p className="text-xs text-gray-500">{form.vehicle_type === 'over_dimensional_cargo' ? 'ODC' : 'Regular'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3.5 text-center">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tax Type</p>
              <p className="text-lg font-bold text-gray-800 mt-1">{isInterstate ? 'IGST' : 'CGST + SGST'}</p>
              <p className="text-xs text-gray-500">{isInterstate ? 'Inter-State' : 'Intra-State'}</p>
            </div>
          </div>

          {/* GST Compliance Notes */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs font-medium text-blue-800 flex items-center gap-1.5"><Info size={13} /> E-Way Bill Rules (Rule 138, CGST)</p>
            <ul className="mt-1.5 text-xs text-blue-700 space-y-0.5 list-disc pl-4">
              <li>Mandatory for consignment value exceeding ₹50,000</li>
              <li>Validity: Regular vehicle — 200 km/day; ODC — 20 km/day</li>
              <li>Can be extended before or within 8 hours of expiry</li>
              <li>Cannot be cancelled after 24 hours of generation</li>
            </ul>
          </div>

          {/* Remarks */}
          <div className="mt-4">
            <FormField label="Remarks / Notes">
              <TextArea value={form.remarks} onChange={(v) => updateField('remarks', v)} placeholder="Any additional notes for this E-Way Bill…" rows={2} disabled={isReadOnly} />
            </FormField>
          </div>
        </SectionCard>

      </div>

      {/* ═══════════════ Action Bar ═══════════════ */}
      {!isReadOnly && (
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-5 py-3 -mx-6 mt-6 flex items-center justify-between gap-3 rounded-b-xl shadow-sm z-10">
          <button onClick={() => navigate(-1)} className="btn-ghost text-sm flex items-center gap-1.5"><ArrowLeft size={15} /> Cancel</button>
          <div className="flex items-center gap-2">
            <button onClick={() => handleSave(false)} disabled={saving} className="btn-secondary flex items-center gap-1.5 text-sm">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Save Draft
            </button>
            <button onClick={() => handleSave(true)} disabled={saving} className="btn-primary flex items-center gap-1.5 text-sm">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <FileCheck size={15} />}
              Generate E-Way Bill
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════ Cancel Modal ═══════════════ */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 animate-fade-in">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Ban size={18} className="text-red-500" /> Cancel E-Way Bill</h3>
            <p className="text-sm text-gray-500 mt-1">This action cannot be undone after 24 hours of generation (GST Rule).</p>
            <div className="mt-4">
              <FormField label="Reason for Cancellation" required error={cancelReason.length > 0 && cancelReason.length < 10 ? 'Minimum 10 characters' : undefined}>
                <TextArea value={cancelReason} onChange={setCancelReason} placeholder="Enter detailed reason (min 10 characters)…" rows={3} />
              </FormField>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={() => setShowCancelModal(false)} className="btn-ghost text-sm">Dismiss</button>
              <button onClick={handleCancel} disabled={cancelReason.length < 10} className="btn-danger text-sm flex items-center gap-1.5">
                <XCircle size={15} /> Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ Extend Modal ═══════════════ */}
      {showExtendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 animate-fade-in">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><RefreshCcw size={18} className="text-amber-500" /> Extend Validity</h3>
            <p className="text-sm text-gray-500 mt-1">Must be done before or within 8 hours of expiry.</p>
            <div className="mt-4 space-y-3">
              <FormField label="Reason for Extension" required error={extendReason.length > 0 && extendReason.length < 10 ? 'Minimum 10 characters' : undefined}>
                <TextArea value={extendReason} onChange={setExtendReason} placeholder="Enter reason for extension…" rows={3} />
              </FormField>
              <FormField label="Remaining Distance (km)" hint="Optional — for recalculating validity">
                <TextInput value={extendDistance} onChange={(v) => setExtendDistance(parseInt(v) || 0)} type="number" prefix={<Route size={15} />} suffix="km" />
              </FormField>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={() => setShowExtendModal(false)} className="btn-ghost text-sm">Dismiss</button>
              <button onClick={handleExtend} disabled={extendReason.length < 10} className="btn-primary text-sm flex items-center gap-1.5">
                <RefreshCcw size={15} /> Confirm Extension
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
