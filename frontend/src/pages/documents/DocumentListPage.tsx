// ============================================================
// Document List Page — Enterprise DMS
// Transport ERP — Document listing with KPI cards, status tabs,
// type filters, expiry indicators, search, and bulk actions
// ============================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { documentService } from '@/services/dataService';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import DataTable, { Column } from '@/components/common/DataTable';
import { Modal, TabPills } from '@/components/common/Modal';
import { SubmitButton } from '@/components/common/SubmitButton';
import type { Document, FilterParams } from '@/types';
import { safeArray, openDocumentUrl } from '@/utils/helpers';
import { handleApiError } from '../../utils/handleApiError';
import {
  FileText, Clock, CheckCircle2, XCircle,
  AlertTriangle, Eye, Trash2,
  File, Image, FileSpreadsheet, Tag, Link2
} from 'lucide-react';

// ── Expiry Badge ──
function ExpiryBadge({ status, expiryDate }: { status: string; expiryDate: string }) {
  if (!expiryDate || status === 'none') {
    return <span className="text-xs text-gray-400">N/A</span>;
  }
  const exp = new Date(expiryDate);
  const now = new Date();
  const diff = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (status === 'expired' || diff < 0) {
    return (
      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
        <XCircle size={11} />
        Expired
      </div>
    );
  }
  if (status === 'expiring_soon' || diff <= 30) {
    return (
      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
        <Clock size={11} />
        {diff}d left
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
      <CheckCircle2 size={11} />
      Valid
    </div>
  );
}

// ── File Type Icon ──
function FileTypeIcon({ fileType }: { fileType: string }) {
  if (fileType?.includes('pdf')) return <FileText size={16} className="text-red-500" />;
  if (fileType?.startsWith('image/')) return <Image size={16} className="text-blue-500" />;
  if (fileType?.includes('sheet') || fileType?.includes('excel')) return <FileSpreadsheet size={16} className="text-green-500" />;
  return <File size={16} className="text-gray-400" />;
}

// ── Doc Type Label ──
const DOC_TYPE_LABELS: Record<string, string> = {
  rc: 'RC',
  insurance: 'Insurance',
  fitness: 'Fitness Cert',
  license: 'Driving License',
  driving_license: 'Driving License',
  pollution: 'PUC',
  invoice: 'Invoice',
  eway_bill: 'E-Way Bill',
  lr_copy: 'LR Copy',
  permit: 'Road Permit',
  contract: 'Contract',
  pod: 'POD',
  tax_receipt: 'Tax Receipt',
  other: 'Other',
};

const TYPE_FILTER_OPTIONS = [
  { value: 'rc', label: 'RC' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'fitness', label: 'Fitness Cert' },
  { value: 'license', label: 'Driving License' },
  { value: 'pollution', label: 'PUC' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'eway_bill', label: 'E-Way Bill' },
  { value: 'lr_copy', label: 'LR Copy' },
  { value: 'permit', label: 'Road Permit' },
  { value: 'contract', label: 'Contract' },
  { value: 'pod', label: 'POD' },
  { value: 'tax_receipt', label: 'Tax Receipt' },
  { value: 'other', label: 'Other' },
];

const ENTITY_TYPE_LABELS: Record<string, string> = {
  vehicle: 'Vehicle',
  driver: 'Driver',
  trip: 'Trip',
  client: 'Client',
  finance: 'Finance',
};

function resolveFileUrl(fileUrl?: string | null): string {
  if (!fileUrl) return '';
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;

  const normalizedPath = fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`;
  if (import.meta.env.DEV) {
    const backendOrigin = (import.meta.env.VITE_PROXY_TARGET || 'http://localhost:8000').replace(/\/$/, '');
    return `${backendOrigin}${normalizedPath}`;
  }
  return normalizedPath;
}

function getTypeLabel(documentType?: string, fileType?: string): string {
  const normalized = (documentType || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

  if (DOC_TYPE_LABELS[normalized]) {
    return DOC_TYPE_LABELS[normalized];
  }

  if (normalized === 'dl' || normalized === 'driver_license') {
    return 'Driving License';
  }

  const mime = (fileType || '').toLowerCase();
  if (mime.includes('pdf')) return 'PDF';
  if (mime.startsWith('image/')) return 'Image';
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return 'Spreadsheet';

  return documentType || 'Other';
}

export default function DocumentListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<FilterParams>({ page: 1, page_size: 20 });
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [expiryFilter, setExpiryFilter] = useState<string>('');
  const [deleteDocId, setDeleteDocId] = useState<number | null>(null);
  const [editDoc, setEditDoc] = useState<Document | null>(null);
  const [editForm, setEditForm] = useState({ title: '', doc_number: '' });

  // ── Data Queries ──
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['documents', filters, typeFilter, expiryFilter],
    queryFn: () => documentService.list({
      ...filters,
      document_type: typeFilter || undefined,
      expiry_filter: expiryFilter || undefined,
    }),
  });

  // ── Mutations ──
  const deleteMutation = useMutation({
    mutationFn: (id: number) => documentService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document-stats'] });
      toast.success('Document deleted successfully.');
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Document> }) => documentService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document updated successfully.');
      setEditDoc(null);
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const openEditModal = (doc: Document) => {
    setEditDoc(doc);
    setEditForm({ title: doc.title || '', doc_number: doc.doc_number || '' });
  };

  const typeTabs = [
    { key: '', label: 'All' },
    ...TYPE_FILTER_OPTIONS.map((opt) => ({ key: opt.value, label: opt.label })),
  ];

  // ── Columns ──
  const columns: Column<Document>[] = [
    {
      key: 'file_type',
      header: '',
      width: '40px',
      render: (d) => <FileTypeIcon fileType={d.file_type} />,
    },
    {
      key: 'title',
      header: 'Document',
      sortable: true,
      render: (d) => (
        <div className="min-w-0">
          <p className="font-medium text-gray-900 text-sm truncate max-w-[240px]">{d.title}</p>
          <p className="text-xs text-gray-400 mt-0.5 font-mono">{d.doc_number}</p>
          {(String(d.document_type || '').toLowerCase() === 'license' || String(d.document_type || '').toLowerCase() === 'driving_license') && d.document_number && (
            <p className="text-xs text-gray-500 mt-0.5">License No: <span className="font-medium text-gray-700">{d.document_number}</span></p>
          )}
          {String(d.document_type || '').toLowerCase() === 'rc' && d.document_number && (
            <p className="text-xs text-gray-500 mt-0.5">Reg No: <span className="font-medium text-gray-700">{d.document_number}</span></p>
          )}
        </div>
      ),
    },
    {
      key: 'document_type',
      header: 'Type',
      sortable: true,
      render: (d) => (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
          <Tag size={11} /> {getTypeLabel(d.document_type, d.file_type)}
        </span>
      ),
    },
    {
      key: 'entity_type',
      header: 'Linked To',
      render: (d) => d.entity_label ? (
        <div className="min-w-0">
          <p className="text-sm text-gray-800 truncate max-w-[180px]">{d.entity_label.split(' — ')[0]}</p>
          <div className="flex items-center gap-1 text-xs text-primary-600 font-medium mt-0.5">
            <Link2 size={11} /> {ENTITY_TYPE_LABELS[d.entity_type] || d.entity_type}
          </div>
        </div>
      ) : <span className="text-xs text-gray-400">—</span>,
    },
    {
      key: 'expiry_date',
      header: 'Expiry',
      sortable: true,
      render: (d) => (
        <div>
          <ExpiryBadge status={d.expiry_status} expiryDate={d.expiry_date} />
          {d.expiry_date && (
            <p className="text-[10px] text-gray-400 mt-0.5">
              {new Date(d.expiry_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'uploaded_by',
      header: 'Uploaded By',
      render: (d) => (
        <p className="text-sm text-gray-700">{new Date(d.created_at).toLocaleDateString('en-IN')}</p>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '80px',
      render: (d) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              const fileUrl = resolveFileUrl(d.file_url);
              openDocumentUrl(fileUrl);
            }}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-primary-600"
            title="View File"
          >
            <Eye size={15} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setDeleteDocId(d.id); }}
            className="p-1.5 hover:bg-red-50 rounded-lg transition-colors text-gray-400 hover:text-red-600"
            title="Delete"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Documents</h1>
          <p className="page-subtitle">Manage compliance documents, certificates & files</p>
        </div>
      </div>

      {/* ── Filters Row ── */}
      <div className="flex flex-wrap gap-3 items-center">
        <TabPills
          tabs={typeTabs}
          activeTab={typeFilter}
          onChange={(key) => { setTypeFilter(key); setFilters({ ...filters, page: 1 }); }}
        />
      </div>

      {/* ── Data Table ── */}
      <DataTable
        columns={columns}
        data={safeArray<Document>(data)}
        total={data?.total || 0}
        page={filters.page}
        pageSize={filters.page_size}
        isLoading={isLoading}
        onSearch={(q) => setFilters({ ...filters, search: q, page: 1 })}
        onPageChange={(p) => setFilters({ ...filters, page: p })}
        onSort={(key, order) => setFilters({ ...filters, sort_by: key, sort_order: order, page: 1 })}
        onRowClick={(d) => openEditModal(d)}
        onRefresh={() => refetch()}
      />

      <ConfirmDialog
        isOpen={deleteDocId !== null}
        title="Delete Document"
        message="This action cannot be undone. Are you sure?"
        confirmLabel="Delete"
        isDangerous={true}
        onConfirm={() => {
          if (deleteDocId === null) return;
          deleteMutation.mutate(deleteDocId);
          setDeleteDocId(null);
        }}
        onCancel={() => setDeleteDocId(null)}
      />

      <Modal
        isOpen={!!editDoc}
        onClose={() => setEditDoc(null)}
        title="Edit Document"
        size="md"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!editDoc) return;
            updateMutation.mutate({
              id: editDoc.id,
              payload: {
                title: editForm.title,
                doc_number: editForm.doc_number,
              },
            });
          }}
        >
          <div>
            <label className="label">Title</label>
            <input className="input-field" value={editForm.title} onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Document Number</label>
            <input className="input-field" value={editForm.doc_number} onChange={(e) => setEditForm((p) => ({ ...p, doc_number: e.target.value }))} required />
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setEditDoc(null)}>Cancel</button>
            <SubmitButton isLoading={updateMutation.isPending} label="Save Changes" />
          </div>
        </form>
      </Modal>
    </div>
  );
}

