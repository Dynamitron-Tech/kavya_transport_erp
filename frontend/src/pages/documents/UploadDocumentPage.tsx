// ============================================================
// Upload Document Page — Enterprise DMS
// Transport ERP — Document creation/edit with 4 sections:
// 1. Document Information (type, entity, number)
// 2. File Upload (drag & drop, preview)
// 3. Compliance & Tracking (expiry, reminders)
// 4. Approval Workflow (status, reviewer)
// ============================================================

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { documentService } from '@/services/dataService';
import { runServerOCR } from '@/services/ocrService';
import {
  ChevronRight, Save, Upload, ArrowLeft, FileText, Shield,
  AlertCircle, CheckCircle2, XCircle, Calendar, Search,
  ChevronDown, Trash2, Clock,
  File, Image, FileSpreadsheet, FilePlus, Loader2,
  Link2, Tag, X, UploadCloud, RefreshCw, History,
  MessageSquare, Send, ScanLine
} from 'lucide-react';
import { DocumentScanner } from '@/components/DocumentScanner';

// ── Types ──
interface FormErrors { [key: string]: string; }

interface EntityOption {
  id: number;
  label: string;
  type: string;
}

const PERMIT_FIELDS: Array<{ key: string; label: string; multiline?: boolean }> = [
  { key: 'permit_number', label: 'Permit No' },
  { key: 'permit_type', label: 'Permit Type' },
  { key: 'permit_holder_name', label: 'Name of Permit Holder' },
  { key: 'father_name', label: "Father's Name" },
  { key: 'address', label: 'Address', multiline: true },
  { key: 'registration_number', label: 'Registration Number' },
  { key: 'type_of_vehicle', label: 'Type of Vehicle' },
  { key: 'valid_from', label: 'Valid From' },
  { key: 'valid_to', label: 'Valid To' },
  { key: 'states_uts_covered', label: 'States / UTs Covered' },
  { key: 'issued_date', label: 'Issued Date' },
  { key: 'issuing_authority', label: 'Issuing Authority' },
];

const PERMIT_SUMMARY_HIDDEN_FIELDS = new Set([
  'permit_type',
  'father_name',
  'address',
  'type_of_vehicle',
  'states_uts_covered',
  'issued_date',
  'issuing_authority',
]);

const HIDDEN_DOCUMENT_TYPES = new Set([
  'invoice',
  'eway_bill',
  'lr_copy',
  'contract',
  'pod',
  'other',
]);

const HIDDEN_DOCUMENT_LABELS = new Set([
  'invoice',
  'e-way bill',
  'lr copy',
  'contract',
  'proof of delivery (pod)',
  'proof of delivery',
  'other',
]);

// ── Constants ──
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];
const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png,.webp,.ppt,.pptx,.xlsx,.xls';

const FILE_ICONS: Record<string, React.ReactNode> = {
  'application/pdf': <FileText size={28} className="text-red-500" />,
  'image/jpeg': <Image size={28} className="text-blue-500" />,
  'image/png': <Image size={28} className="text-blue-500" />,
  'image/webp': <Image size={28} className="text-blue-500" />,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': <File size={28} className="text-amber-500" />,
  'application/vnd.ms-powerpoint': <File size={28} className="text-amber-500" />,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': <FileSpreadsheet size={28} className="text-green-500" />,
  'application/vnd.ms-excel': <FileSpreadsheet size={28} className="text-green-500" />,
};

const INITIAL_FORM = {
  title: '',
  document_type: '',
  entity_type: '',
  entity_id: 0,
  entity_label: '',
  document_number: '',
  issue_date: new Date().toISOString().split('T')[0],
  expiry_date: '',
  reminder_days: 30,
  compliance_category: 'optional',
  renewal_required: false,
  expiry_alert: true,
  auto_reminder: true,
  notes: '',
  approval_status: 'draft',
  reviewed_by: '',
  rejection_reason: '',
  file_name: '',
  file_size: 0,
  file_type: '',
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
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-visible">
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

function ToggleSwitch({ checked, onChange, label }: {
  checked: boolean; onChange: (v: boolean) => void; label: string;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div className={`relative w-10 h-5 rounded-full transition-colors ${checked ? 'bg-primary-500' : 'bg-gray-300'}`}
        onClick={() => onChange(!checked)}>
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </div>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

// ── Main Page Component ──
export default function UploadDocumentPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const [form, setForm] = useState({ ...INITIAL_FORM });
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [entitySearch, setEntitySearch] = useState('');
  const [showEntityDropdown, setShowEntityDropdown] = useState(false);
  const [createdDocId, setCreatedDocId] = useState<number | null>(null);
  const [extractingDoc, setExtractingDoc] = useState(false);
  const [extractionMessage, setExtractionMessage] = useState('');
  const [extractedData, setExtractedData] = useState<Record<string, any> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const normalizeDocType = useCallback((docType: string) => {
    if (docType === 'license') return 'driving_license';
    return docType;
  }, []);

  const getDocumentNumberField = useCallback((docType: string) => {
    switch (normalizeDocType(docType)) {
      case 'driving_license': return 'license_number';
      case 'rc': return 'registration_number';
      case 'insurance': return 'policy_number';
      case 'fitness':
      case 'puc': return 'certificate_number';
      case 'permit': return 'permit_number';
      case 'tax_receipt': return 'receipt_number';
      default: return 'document_number';
    }
  }, [normalizeDocType]);

  const normalizeDateToISO = useCallback((raw?: string | null) => {
    if (!raw) return '';
    const value = String(raw).trim();
    const ddmmyyyy = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (ddmmyyyy) {
      const [, dd, mm, yyyy] = ddmmyyyy;
      return `${yyyy}-${mm}-${dd}`;
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
    return '';
  }, []);

  // ── Helper ──
  const updateField = useCallback((field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  }, [errors]);

  const updateExtractedField = useCallback((field: string, value: string) => {
    setExtractedData((prev) => ({ ...(prev || {}), [field]: value }));

    if (field === 'permit_number' || field === 'registration_number') {
      updateField('document_number', value);
    }
    if (field === 'valid_from' || field === 'issued_date') {
      const normalized = normalizeDateToISO(value);
      if (normalized) updateField('issue_date', normalized);
    }
    if (field === 'valid_to') {
      const normalized = normalizeDateToISO(value);
      if (normalized) updateField('expiry_date', normalized);
    }
  }, [normalizeDateToISO, updateField]);

  // ── Queries ──
  const { data: nextDocNumber } = useQuery({
    queryKey: ['next-doc-number'],
    queryFn: () => documentService.getNextDocNumber(),
    enabled: !isEdit,
  });

  const { data: docTypes = [] } = useQuery({
    queryKey: ['doc-lookup-types'],
    queryFn: () => documentService.lookupDocumentTypes(),
  });

  const visibleDocTypes = useMemo(() => {
    return (docTypes || []).filter((opt: any) => {
      const value = String(opt?.value || opt?.id || '').trim().toLowerCase();
      const label = String(opt?.label || '').trim().toLowerCase();
      if (HIDDEN_DOCUMENT_TYPES.has(value)) return false;
      if (HIDDEN_DOCUMENT_LABELS.has(label)) return false;
      return true;
    });
  }, [docTypes]);

  const { data: entityTypes = [] } = useQuery({
    queryKey: ['doc-lookup-entity-types'],
    queryFn: () => documentService.lookupEntityTypes(),
  });

  const { data: entities = [] } = useQuery({
    queryKey: ['doc-lookup-entities', form.entity_type, entitySearch],
    queryFn: () => documentService.lookupEntities(form.entity_type, entitySearch),
    enabled: !!form.entity_type && showEntityDropdown,
  });

  const { data: _reviewers = [] } = useQuery({
    queryKey: ['doc-lookup-reviewers'],
    queryFn: () => documentService.lookupReviewers(),
  });

  // ── Existing doc (edit) ──
  const { data: existingDoc } = useQuery({
    queryKey: ['document', id],
    queryFn: () => documentService.get(Number(id)),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existingDoc) {
      setForm({
        title: existingDoc.title || '',
        document_type: existingDoc.document_type || '',
        entity_type: existingDoc.entity_type || '',
        entity_id: existingDoc.entity_id || 0,
        entity_label: existingDoc.entity_label || '',
        document_number: existingDoc.document_number || '',
        issue_date: existingDoc.issue_date || '',
        expiry_date: existingDoc.expiry_date || '',
        reminder_days: existingDoc.reminder_days ?? 30,
        compliance_category: existingDoc.compliance_category || 'optional',
        renewal_required: existingDoc.renewal_required ?? false,
        expiry_alert: existingDoc.expiry_alert ?? true,
        auto_reminder: existingDoc.auto_reminder ?? true,
        notes: existingDoc.notes || '',
        approval_status: existingDoc.approval_status || 'draft',
        reviewed_by: existingDoc.reviewed_by || '',
        rejection_reason: existingDoc.rejection_reason || '',
        file_name: existingDoc.file_name || '',
        file_size: existingDoc.file_size || 0,
        file_type: existingDoc.file_type || '',
      });
    }
  }, [existingDoc]);

  // ── Auto-generate title ──
  useEffect(() => {
    if (!form.title || form.title === '') {
      const typeLabel = docTypes.find((t: any) => t.value === form.document_type)?.label || '';
      const entityLabel = form.entity_label ? ` — ${form.entity_label.split(' — ')[0]}` : '';
      if (typeLabel) {
        updateField('title', `${typeLabel}${entityLabel}`);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.document_type, form.entity_label]);

  // ── File Handling ──
  const handleFileSelect = useCallback(async (file: File, forcedDocumentType?: string) => {
    const effectiveDocumentType = forcedDocumentType || form.document_type;

    if (file.size > MAX_FILE_SIZE) {
      setErrors((prev) => ({ ...prev, file: 'File size must be under 10 MB' }));
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setErrors((prev) => ({ ...prev, file: 'Unsupported file type. Use PDF, JPG, PNG, WEBP, or Excel.' }));
      return;
    }
    setSelectedFile(file);
    updateField('file_name', file.name);
    updateField('file_size', file.size);
    updateField('file_type', file.type);
    setExtractionMessage('');
    setErrors((prev) => { const n = { ...prev }; delete n.file; return n; });

    // Image preview
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview('');
    }

    if (!effectiveDocumentType) {
      setExtractionMessage('Select document type to auto-extract document fields.');
      return;
    }

    const normalizedDocType = normalizeDocType(effectiveDocumentType);

    const hasCoreLicenseFields = (data: Record<string, any>) => {
      const licenseNo = data.license_number || data.dl_number;
      const issue = normalizeDateToISO(data.issue_date || data.valid_from);
      const expiry = normalizeDateToISO(data.expiry_date || data.validity_date || data.valid_upto);
      return Boolean(licenseNo && issue && expiry);
    };

    const hasCoreFitnessFields = (data: Record<string, any>) => {
      const vehicleNo = data.vehicle_number || data.vehicle_no;
      const ownerName = data.owner_name;
      const fitnessValidity = normalizeDateToISO(
        data.expiry_date || data.valid_until || data.validity_date || data.valid_upto || data.valid_to || data.fitness_validity,
      );
      return Boolean(vehicleNo && ownerName && fitnessValidity);
    };

    const runLicenseFallbackOCR = async () => {
      const fallback = await runServerOCR(file, 'driving_license');
      const mapped = Object.entries(fallback.extractedFields || {}).reduce((acc, [key, value]) => {
        acc[key] = value?.value;
        return acc;
      }, {} as Record<string, any>);

      const raw = String(fallback.rawText || '');
      if (!raw) return mapped;

      // Generic Indian DL-like token (e.g. TN72 20240005499 / TN7220240005499)
      const dlMatch = raw.match(/\b([A-Z]{2}\d{2}[\s-]*\d{8,14})\b/i);
      if (!mapped.license_number && !mapped.dl_number && dlMatch?.[1]) {
        mapped.license_number = dlMatch[1].replace(/\s+/g, '');
      }

      // Pick first two DD-MM-YYYY style dates as issue + validity fallback.
      const dateMatches = [...raw.matchAll(/\b(\d{2}[\/-]\d{2}[\/-]\d{4})\b/g)].map((m) => m[1]);
      if (!mapped.issue_date && dateMatches[0]) mapped.issue_date = dateMatches[0];
      if (!mapped.expiry_date && !mapped.valid_upto && !mapped.validity_date && dateMatches[1]) {
        mapped.expiry_date = dateMatches[1];
      }

      return mapped;
    };

    const runFitnessFallbackOCR = async () => {
      const fallback = await runServerOCR(file, 'fitness');
      const mapped = Object.entries(fallback.extractedFields || {}).reduce((acc, [key, value]) => {
        acc[key] = value?.value;
        return acc;
      }, {} as Record<string, any>);

      if (!mapped.vehicle_number && mapped.vehicle_no) {
        mapped.vehicle_number = mapped.vehicle_no;
      }

      if (!mapped.expiry_date && (mapped.valid_upto || mapped.fitness_validity)) {
        mapped.expiry_date = mapped.valid_upto || mapped.fitness_validity;
      }

      return mapped;
    };

    const applyExtractedValues = (data: Record<string, any>) => {
      setExtractedData(data);

      const numberField = getDocumentNumberField(normalizedDocType);
      const extractedNumber = data[numberField] || data.dl_number || data.license_number;
      if (extractedNumber) updateField('document_number', String(extractedNumber));

      const parsedIssueDate = normalizeDateToISO(data.issue_date || data.valid_from);
      if (parsedIssueDate) updateField('issue_date', parsedIssueDate);

      const parsedExpiryDate = normalizeDateToISO(
        data.expiry_date || data.validity_date || data.valid_upto || data.valid_to || data.fitness_validity,
      );
      if (parsedExpiryDate) updateField('expiry_date', parsedExpiryDate);

      const holderName = data.holder_name || data.owner_name;
      if (holderName && !form.title.trim()) {
        updateField('title', String(holderName));
      }
    };

    setExtractingDoc(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('document_type', normalizedDocType);
      fd.append('entity_type', form.entity_type || 'driver');

      const result = await documentService.extract(fd);
      let data = (result?.data ?? {}) as Record<string, any>;

      // Camera scans may miss one or more key DL fields in the primary extractor.
      // If so, run OCR fallback and merge missing values.
      if (normalizedDocType === 'driving_license' && !hasCoreLicenseFields(data)) {
        try {
          const fallbackData = await runLicenseFallbackOCR();
          data = {
            ...fallbackData,
            ...data,
            license_number: data.license_number || fallbackData.license_number || fallbackData.dl_number,
            issue_date: data.issue_date || fallbackData.issue_date || fallbackData.valid_from,
            expiry_date: data.expiry_date || data.validity_date || fallbackData.expiry_date || fallbackData.valid_upto,
          };
        } catch {
          // Keep primary extraction data if fallback fails.
        }
      }

      if (normalizedDocType === 'fitness') {
        try {
          const fallbackData = await runFitnessFallbackOCR();
          data = {
            ...data,
            ...fallbackData,
            transaction_no: fallbackData.transaction_no || data.transaction_no,
            receipt_no: fallbackData.receipt_no || data.receipt_no,
            receipt_date: fallbackData.receipt_date || data.receipt_date,
            vehicle_no: fallbackData.vehicle_no || data.vehicle_no,
            vehicle_number: fallbackData.vehicle_number || data.vehicle_number || data.vehicle_no,
            vehicle_class: fallbackData.vehicle_class || data.vehicle_class,
            owner_name: fallbackData.owner_name || data.owner_name,
            chassis_no: fallbackData.chassis_no || data.chassis_no,
            fitness_validity: fallbackData.fitness_validity || data.fitness_validity,
            tax_paid_upto: fallbackData.tax_paid_upto || data.tax_paid_upto,
            expiry_date:
              fallbackData.expiry_date
              || fallbackData.fitness_validity
              || fallbackData.valid_upto
              || data.expiry_date
              || data.valid_until
              || data.validity_date,
          };
        } catch {
          // Keep primary extraction data if fallback fails.
        }
      }

      applyExtractedValues(data);

      if (result?.extracted === false) {
        setExtractionMessage(result?.message || 'Extraction unavailable. You can continue with manual entry.');
      } else {
        setExtractionMessage('Document fields extracted and auto-filled.');
      }
    } catch {
      try {
        const fallbackData: Record<string, any> = normalizedDocType === 'driving_license'
          ? await runLicenseFallbackOCR()
          : await (async () => {
              const fallback = await runServerOCR(file, normalizedDocType);
              return Object.entries(fallback.extractedFields || {}).reduce((acc, [key, value]) => {
                acc[key] = value?.value;
                return acc;
              }, {} as Record<string, any>);
            })();

        if (Object.keys(fallbackData).length > 0) {
          applyExtractedValues(fallbackData);
          setExtractionMessage('Document scanned and fields auto-filled (OCR fallback).');
        } else {
          setExtractionMessage('Extraction failed. You can continue with manual entry.');
          setExtractedData(null);
        }
      } catch {
        setExtractionMessage('Extraction failed. You can continue with manual entry.');
        setExtractedData(null);
      }
    } finally {
      setExtractingDoc(false);
    }
  }, [form.document_type, form.entity_type, form.title, getDocumentNumberField, normalizeDateToISO, normalizeDocType, updateField]);

  const handleScanCapture = useCallback((imageFile: File) => {
    const scanDocType = form.document_type || 'license';
    if (!form.document_type) {
      updateField('document_type', 'license');
    }
    setScannerOpen(false);
    handleFileSelect(imageFile, scanDocType);
  }, [form.document_type, handleFileSelect, updateField]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
  }, [handleFileSelect]);

  const removeFile = useCallback(() => {
    setSelectedFile(null);
    setFilePreview('');
    setExtractedData(null);
    setExtractionMessage('');
    updateField('file_name', '');
    updateField('file_size', 0);
    updateField('file_type', '');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [updateField]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Number(bytes / 1024).toFixed(1)} KB`;
    return `${Number(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isDriverLicense = normalizeDocType(form.document_type || '') === 'driving_license';

  const formatSummaryDate = (raw?: string) => {
    if (!raw) return '';
    const normalized = normalizeDateToISO(raw);
    if (!normalized) return '';
    return new Date(normalized).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // ── Validation ──
  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.title.trim()) e.title = 'Document title is required';
    if (!form.document_type) e.document_type = 'Select a document type';
    if (!form.file_name && !isEdit) e.file = 'Please upload a file';
    if (form.expiry_date && form.issue_date && form.expiry_date < form.issue_date)
      e.expiry_date = 'Expiry date must be after issue date';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Mutations ──
  const saveMutation = useMutation({
    mutationFn: async (status: string) => {
      const payload = { ...form, approval_status: status } as any;
      if (isEdit) {
        return documentService.update(Number(id), payload);
      }

      if (selectedFile) {
        const fd = new FormData();
        fd.append('file', selectedFile);
        fd.append('title', form.title || selectedFile.name);
        fd.append('document_type', normalizeDocType(form.document_type || 'other'));
        fd.append('entity_type', form.entity_type || 'driver');
        if (form.entity_id) fd.append('entity_id', String(form.entity_id));
        if (form.entity_label) fd.append('entity_label', form.entity_label);
        if (form.document_number) fd.append('document_number', form.document_number);
        if (form.issue_date) fd.append('issue_date', form.issue_date);
        if (form.expiry_date) fd.append('expiry_date', form.expiry_date);

        const normalizedDocType = normalizeDocType(form.document_type || 'other');
        const numberField = getDocumentNumberField(normalizedDocType);
        const expiryField = normalizedDocType === 'rc' ? 'validity_date' : 'expiry_date';

        const mergedExtractedData = {
          ...(extractedData || {}),
          ...(form.document_number ? { [numberField]: form.document_number } : {}),
          ...(form.issue_date ? { issue_date: form.issue_date.split('-').reverse().join('/') } : {}),
          ...(form.expiry_date ? { [expiryField]: form.expiry_date.split('-').reverse().join('/') } : {}),
        };
        if (Object.keys(mergedExtractedData).length > 0) {
          fd.append('extracted_data', JSON.stringify(mergedExtractedData));
        }

        return documentService.uploadFile(fd);
      }

      return documentService.create(payload);
    },
    onSuccess: (data: any) => {
      setCreatedDocId(data.id);
    },
    onError: () => {
      setSaving(false);
    },
  });

  const handleSave = (status: string) => {
    if (!validate()) return;
    setSaving(true);
    saveMutation.mutate(status);
  };

  // ── Entity selection ──
  const selectEntity = (entity: EntityOption) => {
    updateField('entity_id', entity.id);
    updateField('entity_label', entity.label);
    setShowEntityDropdown(false);
    setEntitySearch('');
  };

  const clearEntity = () => {
    updateField('entity_id', 0);
    updateField('entity_label', '');
  };

  // ── Success View ──
  if (createdDocId) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} className="text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {isEdit ? 'Document Updated!' : 'Document Uploaded!'}
          </h2>
          <p className="text-gray-500 mb-2">
            Document <span className="font-mono font-semibold text-primary-600">{nextDocNumber || existingDoc?.doc_number}</span> has been {isEdit ? 'updated' : 'created'} successfully.
          </p>
          <p className="text-gray-400 text-sm mb-8">
            Status: <span className="font-medium capitalize">{form.approval_status === 'pending' ? 'Submitted for Approval' : 'Draft'}</span>
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate('/documents')}
              className="px-5 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
              All Documents
            </button>
            <button onClick={() => { setCreatedDocId(null); setForm({ ...INITIAL_FORM }); setSelectedFile(null); setFilePreview(''); }}
              className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors flex items-center gap-2">
              <FilePlus size={16} /> Upload Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentFileName = selectedFile?.name || form.file_name;
  const currentFileSize = selectedFile?.size || form.file_size;
  const currentFileType = selectedFile?.type || form.file_type;

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* ── Breadcrumb ── */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <Link to="/documents" className="hover:text-primary-600 transition-colors">Documents</Link>
          <ChevronRight size={14} />
          <span className="text-gray-900 font-medium">{isEdit ? 'Edit Document' : 'Upload Document'}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/documents')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {isEdit ? 'Edit Document' : 'Upload New Document'}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {isEdit
                  ? `Editing ${existingDoc?.doc_number || ''}`
                  : `New Document • ${nextDocNumber || 'DOC-XXXX'}`}
              </p>
            </div>
          </div>
          {isEdit && existingDoc && (
            <div className={`px-4 py-1.5 rounded-full text-xs font-semibold border ${
              existingDoc.approval_status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : existingDoc.approval_status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200'
              : existingDoc.approval_status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-gray-100 text-gray-700 border-gray-200'
            }`}>
              {existingDoc.approval_status.toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* ── Form Body ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column — Main Sections */}
        <div className="lg:col-span-2 space-y-6">

          {/* ━━━ Section 1: Document Information ━━━ */}
          <SectionCard title="Document Information" subtitle="Type, entity linking & identification" icon={<FileText size={20} />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField label="Document Type" required error={errors.document_type}>
                <SelectInput
                  value={form.document_type}
                  onChange={(v) => updateField('document_type', v)}
                  options={visibleDocTypes}
                  placeholder="Select document type…"
                  error={!!errors.document_type}
                />
              </FormField>

              <FormField label="Document Title" required error={errors.title}>
                <TextInput
                  value={form.title}
                  onChange={(v) => updateField('title', v)}
                  placeholder="e.g., Vehicle Insurance — MH 04 AB 1234"
                  error={!!errors.title}
                  prefix={<Tag size={16} />}
                />
              </FormField>

              <FormField label="Document / Reference Number" hint="Official document or policy number">
                <TextInput
                  value={form.document_number}
                  onChange={(v) => updateField('document_number', v)}
                  placeholder="e.g., POL-INS-78234"
                  prefix={<File size={16} />}
                />
              </FormField>

              <FormField label="Link to Entity" hint="Associate with a vehicle, driver, trip, or client">
                <SelectInput
                  value={form.entity_type}
                  onChange={(v) => { updateField('entity_type', v); clearEntity(); }}
                  options={entityTypes}
                  placeholder="Select entity type…"
                />
              </FormField>

              {form.entity_type && (
                <div className="md:col-span-2">
                  <FormField label={`Select ${form.entity_type.charAt(0).toUpperCase() + form.entity_type.slice(1)}`}>
                    <div className="relative">
                      {form.entity_label ? (
                        <div className="flex items-center justify-between px-3 py-2.5 border border-gray-300 rounded-lg bg-gray-50">
                          <div className="flex items-center gap-2 text-sm">
                            <Link2 size={16} className="text-primary-500" />
                            <span className="font-medium">{form.entity_label}</span>
                          </div>
                          <button onClick={clearEntity} className="p-1 hover:bg-gray-200 rounded-md transition-colors">
                            <X size={14} className="text-gray-400" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center border border-gray-300 rounded-lg focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-200 bg-white">
                            <div className="pl-3 text-gray-400"><Search size={16} /></div>
                            <input
                              type="text"
                              value={entitySearch}
                              onChange={(e) => setEntitySearch(e.target.value)}
                              onFocus={() => setShowEntityDropdown(true)}
                              placeholder={`Search ${form.entity_type}s…`}
                              className="flex-1 px-3 py-2.5 text-sm bg-transparent outline-none placeholder-gray-400"
                            />
                          </div>
                          {showEntityDropdown && (
                            <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                              {entities.length === 0 ? (
                                <div className="px-4 py-3 text-sm text-gray-400">No results found</div>
                              ) : (
                                entities.map((e: EntityOption) => (
                                  <button key={e.id} type="button"
                                    onClick={() => selectEntity(e)}
                                    className="w-full text-left px-4 py-2.5 hover:bg-primary-50 text-sm border-b border-gray-50 last:border-0 transition-colors">
                                    <span className="text-gray-800">{e.label}</span>
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </FormField>
                </div>
              )}
            </div>
          </SectionCard>

          {/* ━━━ Section 2: File Upload ━━━ */}
          <SectionCard title="File Upload" subtitle="Drag & drop or browse for a file" icon={<Upload size={20} />}
            badge={currentFileName ? (
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                File attached
              </span>
            ) : undefined}
          >
            {!currentFileName ? (
              /* Drop zone */
              <div
                onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-primary-400 bg-primary-50/50 scale-[1.01]'
                    : errors.file
                      ? 'border-red-300 bg-red-50/30 hover:border-red-400'
                      : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
                }`}
              >
                <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4 ${
                  dragActive ? 'bg-primary-100' : 'bg-gray-100'
                }`}>
                  <UploadCloud size={28} className={dragActive ? 'text-primary-600' : 'text-gray-400'} />
                </div>
                <p className="font-semibold text-gray-700 mb-1">
                  {dragActive ? 'Drop file here' : 'Drag & drop your file here'}
                </p>
                <p className="text-sm text-gray-400 mb-4">or click to browse</p>
                <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary-200 bg-primary-50 text-primary-700 text-xs font-semibold hover:bg-primary-100 transition-colors"
                  >
                    <Upload size={13} />
                    Upload File
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setScannerOpen(true);
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-blue-600 bg-blue-600 text-white text-sm font-semibold shadow-sm hover:bg-blue-700 hover:border-blue-700 transition-colors"
                  >
                    <ScanLine size={16} />
                    Scan
                  </button>
                </div>
                <div className="flex items-center justify-center gap-3 text-xs text-gray-400">
                  <span className="px-2 py-0.5 bg-gray-100 rounded">PDF</span>
                  <span className="px-2 py-0.5 bg-gray-100 rounded">JPG</span>
                  <span className="px-2 py-0.5 bg-gray-100 rounded">PNG</span>
                  <span className="px-2 py-0.5 bg-gray-100 rounded">Excel</span>
                  <span className="text-gray-300">|</span>
                  <span>Max 10 MB</span>
                </div>
                <input ref={fileInputRef} type="file" accept={ACCEPTED_EXTENSIONS} className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
              </div>
            ) : (
              /* File preview card */
              <div className="border border-gray-200 rounded-2xl overflow-hidden">
                {/* Image preview */}
                {filePreview && (
                  <div className="bg-gray-50 border-b border-gray-200 flex items-center justify-center p-4 max-h-64">
                    <img src={filePreview} alt="Preview" className="max-h-56 rounded-lg object-contain shadow-sm" />
                  </div>
                )}
                <div className="p-4 flex items-center gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center">
                    {FILE_ICONS[currentFileType] || <File size={28} className="text-gray-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{currentFileName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatFileSize(currentFileSize)} • {currentFileType.split('/').pop()?.toUpperCase()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-primary-600"
                      title="Replace file">
                      <RefreshCw size={16} />
                    </button>
                    <button type="button" onClick={removeFile}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors text-gray-400 hover:text-red-600"
                      title="Remove file">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <input ref={fileInputRef} type="file" accept={ACCEPTED_EXTENSIONS} className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
              </div>
            )}
            {errors.file && (
              <p className="mt-2 text-xs text-red-600 flex items-center gap-1"><AlertCircle size={12} /> {errors.file}</p>
            )}
            {extractingDoc && (
              <p className="mt-2 text-xs text-primary-700 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Extracting document data...</p>
            )}
            {!!extractionMessage && !extractingDoc && (
              <p className="mt-2 text-xs text-gray-600 flex items-center gap-1"><AlertCircle size={12} /> {extractionMessage}</p>
            )}

            {form.document_type === 'license' && (
              <div className="mt-4 border border-gray-200 rounded-xl p-4 bg-gray-50/40">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">Manual Entry (Safety)</p>
                <p className="text-xs text-gray-500 mb-3">If OCR is incorrect, update these values manually before saving.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <FormField label="License Number">
                    <TextInput
                      value={form.document_number}
                      onChange={(v) => updateField('document_number', v)}
                      placeholder="Enter license number"
                    />
                  </FormField>
                  <FormField label="Issue Date">
                    <TextInput
                      type="date"
                      value={form.issue_date}
                      onChange={(v) => updateField('issue_date', v)}
                    />
                  </FormField>
                  <FormField label="Expiry Date" error={errors.expiry_date}>
                    <TextInput
                      type="date"
                      value={form.expiry_date}
                      onChange={(v) => updateField('expiry_date', v)}
                      error={!!errors.expiry_date}
                    />
                  </FormField>
                </div>
              </div>
            )}

            {form.document_type === 'rc' && (
              <div className="mt-4 border border-gray-200 rounded-xl p-4 bg-gray-50/40">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">Manual Entry (Safety)</p>
                <p className="text-xs text-gray-500 mb-3">If OCR is incorrect, update these RC values manually before saving.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <FormField label="Registration Number">
                    <TextInput
                      value={form.document_number}
                      onChange={(v) => updateField('document_number', v.toUpperCase().replace(/\s+/g, ''))}
                      placeholder="Enter registration number"
                    />
                  </FormField>
                  <FormField label="Issue Date">
                    <TextInput
                      type="date"
                      value={form.issue_date}
                      onChange={(v) => updateField('issue_date', v)}
                    />
                  </FormField>
                  <FormField label="Validity Date" error={errors.expiry_date}>
                    <TextInput
                      type="date"
                      value={form.expiry_date}
                      onChange={(v) => updateField('expiry_date', v)}
                      error={!!errors.expiry_date}
                    />
                  </FormField>
                </div>
              </div>
            )}

            {form.document_type === 'permit' && (
              <div className="mt-4 border border-gray-200 rounded-xl p-4 bg-gray-50/40">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">Manual Entry (Safety)</p>
                <p className="text-xs text-gray-500 mb-3">If OCR is incorrect, edit permit fields manually before saving.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {PERMIT_FIELDS.map((field) => (
                    <FormField key={field.key} label={field.label} className={field.multiline ? 'md:col-span-2' : ''}>
                      {field.multiline ? (
                        <TextArea
                          value={String((extractedData || {})[field.key] || '')}
                          onChange={(v) => updateExtractedField(field.key, v)}
                          placeholder={`Enter ${field.label.toLowerCase()}...`}
                          rows={3}
                        />
                      ) : (
                        <TextInput
                          value={String((extractedData || {})[field.key] || '')}
                          onChange={(v) => updateExtractedField(field.key, v)}
                          placeholder={`Enter ${field.label.toLowerCase()}`}
                        />
                      )}
                    </FormField>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>

          {/* ━━━ Section 3: Compliance & Tracking ━━━ */}
          <SectionCard title="Compliance & Tracking" subtitle="Expiry dates, reminders & renewal" icon={<Shield size={20} />}
            collapsible defaultOpen={true}>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FormField label="Issue Date">
                  <TextInput
                    type="date"
                    value={form.issue_date}
                    onChange={(v) => updateField('issue_date', v)}
                    prefix={<Calendar size={16} />}
                  />
                </FormField>

                <FormField label="Expiry Date" error={errors.expiry_date} hint={!form.expiry_date ? 'Leave blank if not applicable' : undefined}>
                  <TextInput
                    type="date"
                    value={form.expiry_date}
                    onChange={(v) => updateField('expiry_date', v)}
                    prefix={<Calendar size={16} />}
                    error={!!errors.expiry_date}
                  />
                </FormField>
              </div>

              <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/50 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Tracking Options</p>
                <ToggleSwitch checked={form.renewal_required} onChange={(v) => updateField('renewal_required', v)} label="Renewal required after expiry" />
                <ToggleSwitch checked={form.expiry_alert} onChange={(v) => updateField('expiry_alert', v)} label="Show expiry warning on dashboard" />
                <ToggleSwitch checked={form.auto_reminder} onChange={(v) => updateField('auto_reminder', v)} label="Send automatic email reminders" />
              </div>
            </div>
          </SectionCard>

          {/* ━━━ Section 4: Notes ━━━ */}
          <SectionCard title="Notes & Remarks" subtitle="Additional information" icon={<MessageSquare size={20} />} collapsible defaultOpen={false}>
            <FormField label="Notes" hint="Internal notes about this document">
              <TextArea
                value={form.notes}
                onChange={(v) => updateField('notes', v)}
                placeholder="e.g., Comprehensive policy covering all risks..."
                rows={4}
              />
            </FormField>
          </SectionCard>
        </div>

        {/* Right Column — Summary & Approval */}
        <div className="space-y-6">

          {/* Summary Card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden sticky top-6">
            <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-primary-50 to-transparent">
              <h3 className="font-bold text-gray-900">Document Summary</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-3">
                <SummaryRow label="Doc Number" value={isEdit ? existingDoc?.doc_number || '—' : nextDocNumber || 'Auto'} mono />
                <SummaryRow label="Type" value={docTypes.find((t: any) => t.value === form.document_type)?.label || '—'} />
                <SummaryRow label="Linked To" value={form.entity_label || 'Not linked'} />
                {!!form.document_number && <SummaryRow label="Ref Number" value={form.document_number} mono />}
                {isDriverLicense && (
                  <div className="space-y-2 pt-1">
                    <SummaryStatusRow
                      label="Name"
                      value={String((extractedData || {}).holder_name || (extractedData || {}).owner_name || '').trim() || 'Not extracted'}
                      ok={!!String((extractedData || {}).holder_name || (extractedData || {}).owner_name || '').trim()}
                    />
                    <SummaryStatusRow
                      label="Issue Date"
                      value={formatSummaryDate((extractedData || {}).issue_date || form.issue_date) || 'Not extracted'}
                      ok={!!formatSummaryDate((extractedData || {}).issue_date || form.issue_date)}
                    />
                    <SummaryStatusRow
                      label="Validity"
                      value={formatSummaryDate((extractedData || {}).expiry_date || (extractedData || {}).validity_date || (extractedData || {}).valid_upto || form.expiry_date) || 'Not extracted'}
                      ok={!!formatSummaryDate((extractedData || {}).expiry_date || (extractedData || {}).validity_date || (extractedData || {}).valid_upto || form.expiry_date)}
                    />
                  </div>
                )}
                {!isDriverLicense && form.document_type !== 'fitness' && !!extractedData?.holder_name && <SummaryRow label="Driver Name" value={String(extractedData.holder_name)} />}
                {!isDriverLicense && form.document_type !== 'fitness' && !!extractedData?.owner_name && !extractedData?.holder_name && (
                  <SummaryRow
                    label={form.document_type === 'rc' ? 'Owner Name' : 'Driver Name'}
                    value={String(extractedData.owner_name)}
                  />
                )}
                {form.document_type === 'fitness' && (
                  <div className="space-y-2 pt-1">
                    {([
                      { label: 'Vehicle No',      val: String((extractedData || {}).vehicle_number || '').trim() },
                      { label: 'Owner Name',      val: String((extractedData || {}).owner_name || '').trim() },
                      { label: 'Fitness Validity',val: String((extractedData || {}).fitness_validity || (extractedData || {}).expiry_date || '').trim() },
                      { label: 'Receipt Date',    val: String((extractedData || {}).receipt_date || '').trim() },
                      { label: 'Chassis No',      val: String((extractedData || {}).chassis_no || '').trim() },
                    ] as { label: string; val: string }[]).map(({ label, val }) => (
                      <SummaryStatusRow key={label} label={label} value={val || 'Not extracted'} ok={!!val} />
                    ))}
                  </div>
                )}
                {form.document_type === 'permit' && (
                  <div className="space-y-2 pt-1">
                    {([
                      { label: 'Permit No',        val: String((extractedData || {}).permit_number || '').trim() },
                      { label: 'Permit Holder',    val: String((extractedData || {}).permit_holder_name || '').trim() },
                      { label: 'Date of Approval', val: String((extractedData || {}).date_of_approval || '').trim() },
                      { label: 'Type of Vehicle',  val: String((extractedData || {}).type_of_vehicle || '').trim() },
                      { label: 'Valid From',        val: String((extractedData || {}).valid_from || '').trim() },
                      { label: 'Valid To',          val: String((extractedData || {}).valid_to || '').trim() },
                    ] as { label: string; val: string }[]).map(({ label, val }) => (
                      <SummaryStatusRow key={label} label={label} value={val || 'Not extracted'} ok={!!val} />
                    ))}
                  </div>
                )}
                {!!extractedData?.dob && <SummaryRow label="DOB" value={String(extractedData.dob)} />}
                {!!extractedData?.blood_group && <SummaryRow label="Blood Group" value={String(extractedData.blood_group)} />}
                {form.expiry_date && form.document_type !== 'fitness' && form.document_type !== 'permit' && (
                  <SummaryRow label="Expires" value={new Date(form.expiry_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
                )}

                {/* All Extracted Fields — hidden for fitness and permit (shown in dedicated sections above) */}
                {extractedData && Object.keys(extractedData).length > 0 && form.document_type !== 'fitness' && form.document_type !== 'permit' && (
                  <div className="space-y-2 pt-2 border-t border-gray-100 mt-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Extracted Data</p>
                    {Object.entries(extractedData)
                      .filter(([, v]) => v != null && String(v).trim() !== '')
                      .map(([key, value]) => (
                        <SummaryStatusRow
                          key={key}
                          label={key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                          value={String(value)}
                          ok={true}
                        />
                      ))}
                  </div>
                )}
              </div>

              {/* Expiry indicator */}
              {form.expiry_date && (() => {
                const exp = new Date(form.expiry_date);
                const now = new Date();
                const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                if (diffDays < 0) return (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs">
                    <XCircle size={14} className="text-red-500" />
                    <span className="text-red-700 font-medium">Expired {Math.abs(diffDays)} days ago</span>
                  </div>
                );
                if (diffDays <= 30) return (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs">
                    <Clock size={14} className="text-amber-500" />
                    <span className="text-amber-700 font-medium">Expiring in {diffDays} days</span>
                  </div>
                );
                return (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs">
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    <span className="text-emerald-700 font-medium">Valid — {diffDays} days remaining</span>
                  </div>
                );
              })()}
            </div>

            {/* Version History (edit mode) */}
            {isEdit && existingDoc?.versions && existingDoc.versions.length > 0 && (
              <div className="px-5 py-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <History size={13} /> Version History
                </p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {existingDoc.versions.map((v: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 text-xs p-2 rounded-lg hover:bg-gray-50">
                      <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-[10px]">
                        v{v.version}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-700 truncate">{v.file_name}</p>
                        <p className="text-gray-400">{v.uploaded_by} • {new Date(v.uploaded_at).toLocaleDateString('en-IN')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Sticky Action Bar ── */}
      <div className="sticky bottom-0 mt-8 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="bg-white/95 backdrop-blur border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] rounded-t-2xl px-6 py-4 flex items-center justify-between">
          <button type="button" onClick={() => navigate('/documents')}
            className="px-5 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2">
            <ArrowLeft size={16} /> Cancel
          </button>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => handleSave('draft')} disabled={saving}
              className="px-5 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Draft
            </button>
            <button type="button" onClick={() => handleSave('pending')} disabled={saving}
              className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Upload & Submit
            </button>
          </div>
        </div>
      </div>

      <DocumentScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onCapture={handleScanCapture}
        docType={form.document_type || 'license'}
      />
    </div>
  );
}

// ── Summary Row ──
function SummaryRow({ label, value, mono, truncate }: { label: string; value: string; mono?: boolean; truncate?: boolean }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-gray-400">{label}</span>
      <span className={`font-medium text-gray-800 text-right max-w-[60%] ${mono ? 'font-mono text-xs' : ''} ${truncate ? 'truncate' : ''}`}>
        {value}
      </span>
    </div>
  );
}

function SummaryStatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex justify-between items-start gap-2 text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="font-medium text-gray-800 text-right max-w-[60%] break-words inline-flex items-center gap-1.5">
        {ok ? <CheckCircle2 size={14} className="text-emerald-500" /> : <AlertCircle size={14} className="text-amber-500" />}
        {value}
      </span>
    </div>
  );
}
