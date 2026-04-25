import { useRef, useState, useCallback, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ScanLine, Upload, Loader2, CheckCircle2, Search, X, ChevronDown } from 'lucide-react';
import api from '@/services/api';
import { DocumentScanner } from '@/components/DocumentScanner';
import OCRResultPanel, { FieldApplyEvent, FIELD_TO_FORM } from '@/components/DocumentScanner/OCRResultPanel';
import { runServerOCR, OCRResult } from '@/services/ocrService';

// Map detected OCR type → friendly title prefix
const DOC_TYPE_LABEL: Record<string, string> = {
  RC: 'RC', Insurance: 'Insurance', DrivingLicense: 'Driving License',
  Fitness: 'Fitness Certificate', PUC: 'Pollution Certificate',
};

// ─── Entity Selector ─────────────────────────────────────────────────────────

interface EntityOption { id: number; label: string; sub?: string }

function EntitySelector({
  entityType, value, onChange,
}: { entityType: string; value: string; onChange: (id: string, label: string) => void }) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<EntityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<EntityOption | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Reset when entity type changes
  useEffect(() => {
    setSelected(null);
    setQuery('');
    onChange('', '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType]);

  const fetchOptions = useCallback(async (q: string) => {
    setLoading(true);
    try {
      let items: EntityOption[] = [];
      if (entityType === 'vehicle') {
        const res = await api.get(`/vehicles?search=${encodeURIComponent(q)}&limit=20`);
        const list = (res as any)?.data ?? res;
        items = (Array.isArray(list) ? list : []).map((v: any) => ({
          id: v.id,
          label: v.registration_number ?? `Vehicle #${v.id}`,
          sub: v.vehicle_type ?? v.make ?? '',
        }));
      } else if (entityType === 'driver') {
        const res = await api.get(`/drivers?search=${encodeURIComponent(q)}&limit=20`);
        const list = (res as any)?.data ?? res;
        items = (Array.isArray(list) ? list : []).map((d: any) => ({
          id: d.id,
          label: d.full_name ?? d.name ?? `Driver #${d.id}`,
          sub: d.phone ?? d.license_number ?? '',
        }));
      } else if (entityType === 'client') {
        const res = await api.get(`/jobs/lookup/clients?search=${encodeURIComponent(q)}&limit=20`);
        const list = (res as any)?.data ?? res;
        items = (Array.isArray(list) ? list : []).map((c: any) => ({
          id: c.id,
          label: c.company_name ?? c.name ?? `Client #${c.id}`,
          sub: c.contact_person ?? '',
        }));
      }
      setOptions(items);
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [entityType]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => fetchOptions(query), 300);
    return () => clearTimeout(timer);
  }, [query, open, fetchOptions]);

  const handleSelect = (opt: EntityOption) => {
    setSelected(opt);
    setQuery('');
    setOpen(false);
    onChange(String(opt.id), opt.label);
  };

  const handleClear = () => {
    setSelected(null);
    setQuery('');
    onChange('', '');
  };

  const noSearch = !['vehicle', 'driver', 'client'].includes(entityType);

  if (noSearch) {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value, '')}
        placeholder={`Enter ${entityType} ID`}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {selected ? (
        <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{selected.label}</p>
            {selected.sub && <p className="text-xs text-gray-500 truncate">{selected.sub}</p>}
          </div>
          <button type="button" onClick={handleClear} className="shrink-0 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg cursor-text hover:border-blue-400"
          onClick={() => { setOpen(true); fetchOptions(query); }}
        >
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => { setOpen(true); fetchOptions(query); }}
            placeholder={`Search ${entityType}s…`}
            className="flex-1 outline-none text-sm bg-transparent"
          />
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        </div>
      )}

      {open && !selected && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-lg border border-gray-200 shadow-lg max-h-52 overflow-y-auto">
          {loading && (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Searching…
            </div>
          )}
          {!loading && options.length === 0 && (
            <div className="px-3 py-3 text-sm text-gray-500">No {entityType}s found</div>
          )}
          {!loading && options.map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelect(opt)}
              className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-gray-100 last:border-0"
            >
              <p className="text-sm font-medium text-gray-900">{opt.label}</p>
              {opt.sub && <p className="text-xs text-gray-500">{opt.sub}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DocumentUploadPage() {
  const fileRef = useRef<HTMLInputElement>(null);

  // Form fields
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [entityType, setEntityType] = useState('vehicle');
  const [entityId, setEntityId] = useState('');
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState('other');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [result, setResult] = useState<any>(null);

  // OCR state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  // Tracks which form fields were just auto-filled by OCR (for highlight animation)
  const [autoFilled, setAutoFilled] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);

  /** Returns Tailwind ring classes when a field was just auto-filled */
  const afClass = (field: string) =>
    autoFilled.has(field)
      ? 'ring-2 ring-emerald-400 border-emerald-400 bg-emerald-50 transition-all duration-500'
      : '';

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('No file selected');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entity_type', entityType);
      formData.append('entity_id', entityId || '0');
      formData.append('title', title || file.name);
      formData.append('document_type', docType);
      if (referenceNumber) formData.append('reference_number', referenceNumber);
      if (issueDate)       formData.append('issue_date', issueDate);
      if (expiryDate)      formData.append('expiry_date', expiryDate);
      const resp = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(resp);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    uploadMutation.mutate();
  };

  // Apply a single OCR field to the form (also used manually from OCR panel)
  const handleApplyField = useCallback(({ formField, value }: FieldApplyEvent) => {
    if (!formField) return;
    switch (formField) {
      case 'reference_number': setReferenceNumber(value); break;
      case 'expiry_date':      setExpiryDate(value); break;
      case 'issue_date':       setIssueDate(value); break;
      case 'title':            setTitle(prev => prev || value); break;
    }
  }, []);

  /**
   * Auto-apply all mappable fields from an OCR result to the form inputs.
   * Generates a smart title if none is set.
   * Highlights filled inputs with a 3-second green flash.
   */
  const autoApplyOcrFields = useCallback((result: OCRResult) => {
    const filled = new Set<string>();

    for (const [key, field] of Object.entries(result.extractedFields)) {
      const formField = FIELD_TO_FORM[key];
      if (!formField || formField === 'entity_search') continue;
      const val = field.value;
      if (!val) continue;
      switch (formField) {
        case 'reference_number': setReferenceNumber(val); filled.add('reference_number'); break;
        case 'expiry_date':      setExpiryDate(val);      filled.add('expiry_date');      break;
        case 'issue_date':       setIssueDate(val);       filled.add('issue_date');       break;
        case 'title':            setTitle(prev => prev || val); filled.add('title');       break;
      }
    }

    // Auto-generate title: "HOLDER_NAME – Document Type" or "DL_NUMBER – Driving License"
    setTitle(prev => {
      if (prev) return prev;
      const holderName = result.extractedFields.holder_name?.value
        ?? result.extractedFields.owner_name?.value;
      const docLabel = result.docType ? DOC_TYPE_LABEL[result.docType] ?? result.docType : '';
      const refNum = result.extractedFields.dl_number?.value
        ?? result.extractedFields.registration_number?.value
        ?? result.extractedFields.policy_number?.value;
      if (holderName && docLabel) {
        filled.add('title');
        return `${holderName} – ${docLabel}`;
      }
      if (refNum && docLabel) {
        filled.add('title');
        return `${refNum} – ${docLabel}`;
      }
      return prev;
    });

    if (filled.size > 0) {
      setAutoFilled(filled);
      setTimeout(() => setAutoFilled(new Set()), 3000);
    }
  }, []);

  // Shared post-OCR handler
  const applyOcrResult = useCallback((result: OCRResult) => {
    setOcrResult(result);
    autoApplyOcrFields(result);
    // Auto-update doc type dropdown
    if (result.docType && result.docType !== 'Other') {
      const reverse: Record<string, string> = {
        RC: 'rc', Insurance: 'insurance', DrivingLicense: 'license',
        Fitness: 'fitness', PUC: 'pollution',
      };
      const mapped = reverse[result.docType];
      if (mapped) setDocType(prev => prev === 'other' ? mapped : prev);
    }
    // Auto-switch entity type: DL → driver, RC/Fitness/PUC/Insurance → vehicle
    if (result.docType === 'DrivingLicense') {
      setEntityType('driver');
    } else if (['RC', 'Fitness', 'PUC', 'Insurance'].includes(result.docType ?? '')) {
      setEntityType('vehicle');
    }
  }, [autoApplyOcrFields]);

  // Called when DocumentScanner captures a frame
  const handleScanCapture = useCallback(async (imageFile: File, imageDataUrl: string) => {
    setScannerOpen(false);
    setFile(imageFile);
    setFilePreview(imageDataUrl);
    setOcrFile(imageFile);
    setOcrResult(null);
    setOcrLoading(true);
    setOcrProgress(0);

    try {
      setOcrProgress(30);
      const result = await runServerOCR(imageFile, docType || 'auto');
      setOcrProgress(100);
      applyOcrResult(result);
    } finally {
      setOcrLoading(false);
    }
  }, [docType, applyOcrResult]);

  // Called when user picks a file via normal file input — auto-trigger OCR
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    processPickedFile(picked);
  };

  // Shared handler for both file input and drag-and-drop
  const processPickedFile = (picked: File) => {
    setFile(picked);
    setOcrResult(null);
    setTitle('');
    setReferenceNumber('');
    setIssueDate('');
    setExpiryDate('');
    const url = URL.createObjectURL(picked);
    setFilePreview(url);

    if (picked.type.startsWith('image/')) {
      setOcrFile(picked);
      setOcrLoading(true);
      setOcrProgress(0);
      runServerOCR(picked, docType || 'auto')
        .then(result => {
          setOcrProgress(100);
          applyOcrResult(result);
        })
        .finally(() => {
          setOcrLoading(false);
        });
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) processPickedFile(dropped);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upload Document</h1>
        <p className="text-gray-500 text-sm mt-1">Upload RC, Insurance, POD, Invoice or other documents</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ── Upload form ── */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">

          {/* File upload dropzone + Scan button */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">File *</label>
            <div className="flex gap-2">
              <div
                className={`flex-1 relative border-2 border-dashed rounded-xl p-4 transition-colors cursor-pointer ${
                  dragOver
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
                onClick={() => fileRef.current?.click()}
                onDragOver={handleDragOver}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {filePreview ? (
                  <div className="flex items-center gap-3">
                    <img src={filePreview} alt="Preview" className="w-12 h-12 object-cover rounded-lg border border-gray-200" />
                    <div>
                      <div className="text-sm text-gray-700 truncate">{file?.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">Click to change</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-gray-400 gap-1">
                    <Upload className="w-6 h-6" />
                    {dragOver ? (
                      <span className="text-sm font-medium text-blue-600">Drop file here</span>
                    ) : (
                      <>
                        <span className="text-xs font-medium">Click or drag & drop to upload</span>
                        <span className="text-xs">JPG, PNG or PDF — OCR auto-reads the document</span>
                      </>
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="flex flex-col items-center justify-center gap-1 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-xs font-medium min-w-[80px]"
                title="Scan document with camera"
              >
                <ScanLine className="w-5 h-5" />
                Scan
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleFileChange} className="hidden" />
          </div>

          {/* OCR loading progress */}
          {ocrLoading && (
            <div className="space-y-1.5">
              <p className="text-sm text-blue-700 font-medium flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Reading document… {ocrProgress}%
              </p>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-200" style={{ width: `${ocrProgress}%` }} />
              </div>
            </div>
          )}

          {/* Entity type + doc type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Entity Type</label>
              <select value={entityType} onChange={(e) => setEntityType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="vehicle">Vehicle</option>
                <option value="driver">Driver</option>
                <option value="client">Client</option>
                <option value="trip">Trip</option>
                <option value="finance">Finance</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Document Type {autoFilled.has('docType') && <span className="text-emerald-600 text-xs font-normal ml-1">✓ auto</span>}
              </label>
              <select value={docType} onChange={(e) => {
                setDocType(e.target.value);
                if (e.target.value === 'license') setEntityType('driver');
                else if (['rc','insurance','fitness','pollution'].includes(e.target.value)) setEntityType('vehicle');
              }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="rc">RC</option>
                <option value="insurance">Insurance</option>
                <option value="fitness">Fitness</option>
                <option value="license">Driving License</option>
                <option value="pollution">PUC/Pollution</option>
                <option value="invoice">Invoice</option>
                <option value="eway_bill">E-way Bill</option>
                <option value="lr_copy">LR Copy</option>
                <option value="permit">Permit</option>
                <option value="pod">POD</option>
                <option value="contract">Contract</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Entity selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {entityType === 'vehicle' ? 'Vehicle' : entityType === 'driver' ? 'Driver' : entityType === 'client' ? 'Client' : 'Entity'}
            </label>
            <EntitySelector
              entityType={entityType}
              value={entityId}
              onChange={(id) => setEntityId(id)}
            />
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title {autoFilled.has('title') && <span className="text-emerald-600 text-xs font-normal ml-1">✓ auto-filled</span>}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., AJA KUMAR – Driving License"
              className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${afClass('title')}`}
            />
          </div>

          {/* Reference number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reference / Document Number {autoFilled.has('reference_number') && <span className="text-emerald-600 text-xs font-normal ml-1">✓ auto-filled</span>}
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="e.g., TN72BC7214 or policy number"
              className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${afClass('reference_number')}`}
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Issue Date {autoFilled.has('issue_date') && <span className="text-emerald-600 text-xs font-normal ml-1">✓ auto-filled</span>}
              </label>
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)}
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${afClass('issue_date')}`} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expiry Date {autoFilled.has('expiry_date') && <span className="text-emerald-600 text-xs font-normal ml-1">✓ auto-filled</span>}
              </label>
              <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)}
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${afClass('expiry_date')}`} />
            </div>
          </div>

          <button
            type="submit"
            disabled={uploadMutation.isPending || !file}
            className="w-full px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
          >
            {uploadMutation.isPending ? 'Uploading…' : 'Upload Document'}
          </button>

          {uploadMutation.isError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              Upload failed. Please try again.
            </div>
          )}

          {result && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              <div>
                <p className="text-green-700 font-medium text-sm">Document uploaded successfully</p>
                <p className="text-xs text-gray-500 mt-0.5">ID: {result.id}</p>
              </div>
            </div>
          )}
        </form>

        {/* ── OCR result panel (right column) ── */}
        {ocrResult && (
          <OCRResultPanel
            result={ocrResult}
            docType={docType}
            onApplyField={handleApplyField}
            onClose={() => setOcrResult(null)}
            originalFile={ocrFile}
          />
        )}
      </div>

      {/* Camera scanner modal */}
      <DocumentScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onCapture={handleScanCapture}
        docType={docType}
      />
    </div>
  );
}
