import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, FileText, RefreshCw, Upload, X } from 'lucide-react';
import { driverService } from '@/services/dataService';
import { safeArray, openDocumentUrl } from '@/utils/helpers';
import api from '@/services/api';
import toast from 'react-hot-toast';

type DriverDoc = {
  id: number;
  document_type?: string;
  document_number?: string;
  file_name?: string;
  file_url?: string;
  uploaded_at?: string;
};

const DOC_LABELS: Record<string, string> = {
  driving_license: 'Driving License',
  license: 'Driving License',
  aadhaar_card: 'Aadhaar Card',
  aadhaar: 'Aadhaar Card',
  driver_badge: 'Driver Badge',
  medical_fitness: 'Medical Fitness',
  pan_card: 'PAN Card',
  puc: 'PUC',
  rc: 'RC',
};

function resolveFileUrl(fileUrl?: string): string {
  if (!fileUrl) return '';
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;

  const compact = String(fileUrl).trim().replace(/\\/g, '/');
  let normalized = compact.startsWith('/') ? compact : `/${compact}`;

  // Static uploads are mounted at /uploads (not under /api/v1).
  if (normalized.startsWith('/api/v1/uploads/')) {
    normalized = normalized.replace('/api/v1/uploads/', '/uploads/');
  } else if (normalized.startsWith('/api/uploads/')) {
    normalized = normalized.replace('/api/uploads/', '/uploads/');
  } else if (!normalized.startsWith('/uploads/')) {
    // Handle raw storage keys like "driver-documents/12/file.jpg".
    normalized = `/uploads/${normalized.replace(/^\/+/, '')}`;
  }

  if (import.meta.env.DEV) {
    const backendOrigin = (import.meta.env.VITE_PROXY_TARGET || 'http://localhost:8000').replace(/\/$/, '');
    return `${backendOrigin}${normalized}`;
  }
  return normalized;
}

function toDisplayName(doc: DriverDoc): string {
  if (doc.file_name) return doc.file_name;

  const typeKey = (doc.document_type || '').toLowerCase();
  const label = DOC_LABELS[typeKey] || doc.document_type || 'Document';

  const url = doc.file_url || '';
  const filename = decodeURIComponent(url.split('/').pop() || '');
  const ext = filename.includes('.') ? `.${filename.split('.').pop()}` : '';

  // Storage keys are usually long hex strings; avoid showing them to drivers.
  const base = filename.replace(/\.[^.]+$/, '');
  const looksGenerated = /^[a-f0-9]{24,}$/i.test(base);
  if (looksGenerated || !filename) {
    return `${label}${doc.document_number ? ` - ${doc.document_number}` : ''}${ext}`;
  }

  return filename;
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN');
}

// All expected document types for the driver
const EXPECTED_DOC_TYPES = [
  { key: 'driving_license', label: 'Driving License' },
  { key: 'aadhaar_card', label: 'Aadhaar Card' },
  { key: 'driver_badge', label: 'Driver Badge' },
  { key: 'medical_fitness', label: 'Medical Fitness' },
];

interface UploadModalProps {
  docType: string;
  docLabel: string;
  existingDoc: DriverDoc | null;
  onClose: () => void;
  onSuccess: () => void;
}

function UploadModal({ docType, docLabel, existingDoc, onClose, onSuccess }: UploadModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docNumber, setDocNumber] = useState(existingDoc?.document_number ?? '');
  const isUpdate = existingDoc !== null;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error('No file selected');
      const form = new FormData();
      form.append('file', selectedFile);
      form.append('document_type', docType);
      if (docNumber.trim()) form.append('document_number', docNumber.trim());
      if (isUpdate && existingDoc) {
        return api.put(`/drivers/me/documents/${existingDoc.id}`, form);
      }
      return api.post('/drivers/me/documents/upload', form);
    },
    onSuccess: () => {
      toast.success(`${docLabel} ${isUpdate ? 'updated' : 'uploaded'} successfully`);
      onSuccess();
      onClose();
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.detail || `Failed to ${isUpdate ? 'update' : 'upload'} document`;
      toast.error(msg);
    },
  });

  const currentUrl = existingDoc ? resolveFileUrl(existingDoc.file_url) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {isUpdate ? `Update ${docLabel}` : `Upload ${docLabel}`}
        </h2>

        {/* Current document preview */}
        {isUpdate && currentUrl && (
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 mb-2">Current Document</p>
            <img
              src={currentUrl}
              alt="Current document"
              className="w-full h-40 object-cover rounded-lg border border-gray-200"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        )}

        {/* Document number */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Document Number (optional)</label>
          <input
            type="text"
            value={docNumber}
            onChange={(e) => setDocNumber(e.target.value)}
            placeholder="e.g. DL-1234567890"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* File picker */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer mb-4 transition-colors ${
            selectedFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/30'
          }`}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            className="hidden"
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
          />
          {selectedFile ? (
            <p className="text-sm font-medium text-green-700">{selectedFile.name}</p>
          ) : (
            <>
              <Upload size={24} className="mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-500">Click to select file (JPG, PNG, PDF)</p>
            </>
          )}
        </div>

        <button
          type="button"
          disabled={!selectedFile || mutation.isPending}
          onClick={() => mutation.mutate()}
          className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {mutation.isPending ? 'Uploading...' : isUpdate ? 'Update Document' : 'Upload Document'}
        </button>
      </div>
    </div>
  );
}

export default function DriverDocumentsPage() {
  const qc = useQueryClient();
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['driver-my-documents'],
    queryFn: () => driverService.getMyDocuments(),
  });
  const [uploadModal, setUploadModal] = useState<{ docType: string; docLabel: string } | null>(null);

  const docs: DriverDoc[] = useMemo(
    () => safeArray<DriverDoc>((data as any)?.items ?? data),
    [data],
  );

  // Build a map for quick lookup: docType -> doc
  const docByType = useMemo(() => {
    const map: Record<string, DriverDoc> = {};
    for (const doc of docs) {
      const key = (doc.document_type ?? '').toLowerCase();
      // Normalise aliases
      const normKey = key === 'license' ? 'driving_license' : key === 'aadhaar' ? 'aadhaar_card' : key;
      if (!map[normKey]) map[normKey] = doc;
    }
    return map;
  }, [docs]);

  // Extra docs not in expected types (e.g. pan_card uploaded via fleet)
  const extraDocs = useMemo(() => {
    const expected = new Set(EXPECTED_DOC_TYPES.map((t) => t.key));
    return docs.filter((d) => {
      const key = (d.document_type ?? '').toLowerCase();
      return !expected.has(key) && d.file_url;
    });
  }, [docs]);

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 sm:px-6">
      {uploadModal && (
        <UploadModal
          docType={uploadModal.docType}
          docLabel={uploadModal.docLabel}
          existingDoc={docByType[uploadModal.docType] ?? null}
          onClose={() => setUploadModal(null)}
          onSuccess={() => { void qc.invalidateQueries({ queryKey: ['driver-my-documents'] }); }}
        />
      )}

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Documents</h1>
          <p className="text-sm text-gray-500 mt-1">View and update your driver documents</p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Expected document type cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {EXPECTED_DOC_TYPES.map((t) => (
            <div key={t.key} className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {EXPECTED_DOC_TYPES.map(({ key, label }) => {
            const doc = docByType[key];
            const uploaded = Boolean(doc?.file_url);
            const fileUrl = uploaded ? resolveFileUrl(doc.file_url) : null;
            return (
              <div
                key={key}
                className={`bg-white border rounded-xl p-5 flex flex-col gap-3 ${
                  uploaded ? 'border-green-200' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={18} className={uploaded ? 'text-green-600 shrink-0' : 'text-gray-400 shrink-0'} />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{label}</p>
                      {doc?.document_number && (
                        <p className="text-xs text-gray-500 font-mono">{doc.document_number}</p>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    uploaded ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {uploaded ? 'Uploaded' : 'Missing'}
                  </span>
                </div>

                {/* Preview thumbnail */}
                {uploaded && fileUrl && (
                  <img
                    src={fileUrl}
                    alt={label}
                    className="w-full h-32 object-cover rounded-lg border border-gray-100 cursor-pointer"
                    onClick={() => openDocumentUrl(fileUrl)}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}

                <div className="flex gap-2 mt-auto">
                  {uploaded && fileUrl && (
                    <button
                      type="button"
                      onClick={() => openDocumentUrl(fileUrl)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      <Eye size={14} /> View
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setUploadModal({ docType: key, docLabel: label })}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Upload size={14} /> {uploaded ? 'Update' : 'Upload'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Extra docs (e.g. PAN card uploaded by fleet) */}
      {extraDocs.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-600 mb-3">Other Documents</h2>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">File</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Uploaded</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody>
                {extraDocs.map((doc) => {
                  const fileUrl = resolveFileUrl(doc.file_url);
                  const typeKey = (doc.document_type || '').toLowerCase();
                  return (
                    <tr key={doc.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/70">
                      <td className="px-4 py-3 text-sm text-gray-700">{DOC_LABELS[typeKey] || doc.document_type || 'Document'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText size={15} className="text-gray-400 shrink-0" />
                          <span className="text-sm text-gray-800 truncate">{toDisplayName(doc)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(doc.uploaded_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openDocumentUrl(fileUrl)}
                          disabled={!fileUrl}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                        >
                          <Eye size={14} /> View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
