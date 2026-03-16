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
import { Modal, TabPills, KPICard } from '@/components/common/Modal';
import { SubmitButton } from '@/components/common/SubmitButton';
import type { Document, FilterParams, DocumentStats } from '@/types';
import { safeArray } from '@/utils/helpers';
import { handleApiError } from '../../utils/handleApiError';
import {
  FileText, Clock, CheckCircle2, XCircle,
  AlertTriangle, Eye, Trash2, MoreHorizontal, Download,
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

// ── Approval Badge ──
function ApprovalBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700 border-gray-300', icon: <FileText size={11} /> },
    pending: { label: 'Pending', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: <Clock size={11} /> },
    approved: { label: 'Approved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 size={11} /> },
    rejected: { label: 'Rejected', color: 'bg-red-50 text-red-700 border-red-200', icon: <XCircle size={11} /> },
  };
  const c = config[status] || config.draft;
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${c.color}`}>
      {c.icon} {c.label}
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

const ENTITY_TYPE_LABELS: Record<string, string> = {
  vehicle: 'Vehicle',
  driver: 'Driver',
  trip: 'Trip',
  client: 'Client',
  finance: 'Finance',
};

export default function DocumentListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<FilterParams>({ page: 1, page_size: 20 });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [expiryFilter, setExpiryFilter] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [actionMenuId, setActionMenuId] = useState<number | null>(null);
  const [deleteDocId, setDeleteDocId] = useState<number | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [editDoc, setEditDoc] = useState<Document | null>(null);
  const [editForm, setEditForm] = useState({ title: '', doc_number: '' });

  // ── Data Queries ──
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['documents', filters, statusFilter, typeFilter, expiryFilter],
    queryFn: () => documentService.list({
      ...filters,
      approval_status: statusFilter !== 'all' ? statusFilter : undefined,
      document_type: typeFilter || undefined,
      expiry_filter: expiryFilter || undefined,
    }),
  });

  const { data: stats } = useQuery<DocumentStats>({
    queryKey: ['document-stats'],
    queryFn: () => documentService.stats(),
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

  const approveMutation = useMutation({
    mutationFn: (id: number) => documentService.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document-stats'] });
      toast.success('Document approved successfully.');
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
        </div>
      ),
    },
    {
      key: 'document_type',
      header: 'Type',
      sortable: true,
      render: (d) => (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
          <Tag size={11} /> {DOC_TYPE_LABELS[d.document_type] || d.document_type}
        </span>
      ),
    },
    {
      key: 'entity_type',
      header: 'Linked To',
      render: (d) => d.entity_label ? (
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-xs text-primary-600 font-medium">
            <Link2 size={11} /> {ENTITY_TYPE_LABELS[d.entity_type] || d.entity_type}
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[180px]">{d.entity_label.split(' — ')[0]}</p>
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
      key: 'approval_status',
      header: 'Status',
      sortable: true,
      render: (d) => <ApprovalBadge status={d.approval_status} />,
    },
    {
      key: 'uploaded_by',
      header: 'Uploaded By',
      render: (d) => (
        <div>
          <p className="text-sm text-gray-700">{d.uploaded_by}</p>
          <p className="text-[10px] text-gray-400">{new Date(d.created_at).toLocaleDateString('en-IN')}</p>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '80px',
      render: (d) => (
        <div className="relative">
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); openEditModal(d); }}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-primary-600"
              title="Edit"
            >
              <Eye size={15} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setActionMenuId(actionMenuId === d.id ? null : d.id); }}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
            >
              <MoreHorizontal size={15} />
            </button>
          </div>
          {actionMenuId === d.id && (
            <div className="absolute right-0 top-8 z-30 bg-white border border-gray-200 rounded-xl shadow-lg w-44 py-1 overflow-hidden"
              onMouseLeave={() => setActionMenuId(null)}>
              <button onClick={(e) => { e.stopPropagation(); openEditModal(d); setActionMenuId(null); }}
                className="w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2">
                <Eye size={14} /> View / Edit
              </button>
              {d.approval_status === 'pending' && (
                <button onClick={(e) => { e.stopPropagation(); approveMutation.mutate(d.id); setActionMenuId(null); }}
                  className="w-full px-4 py-2 text-sm text-left hover:bg-emerald-50 text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 size={14} /> Approve
                </button>
              )}
              <button onClick={(e) => { e.stopPropagation(); window.open(d.file_url, '_blank'); setActionMenuId(null); }}
                className="w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2">
                <Download size={14} /> Download
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button onClick={(e) => { e.stopPropagation(); setDeleteDocId(d.id); setActionMenuId(null); }}
                className="w-full px-4 py-2 text-sm text-left hover:bg-red-50 text-red-600 flex items-center gap-2">
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}
        </div>
      ),
    },
  ];

  // ── Status Tabs ──
  const statusTabs = [
    { key: 'all', label: `All${stats ? ` (${stats.total})` : ''}` },
    { key: 'draft', label: 'Drafts' },
    { key: 'pending', label: `Pending${stats?.pending_approval ? ` (${stats.pending_approval})` : ''}` },
    { key: 'approved', label: `Approved${stats?.approved ? ` (${stats.approved})` : ''}` },
    { key: 'rejected', label: 'Rejected' },
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

      {/* ── KPI Cards ── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KPICard
            title="Total Documents"
            value={stats.total}
            icon={<FileText size={20} />}
            color="blue"
          />
          <KPICard
            title="Approved"
            value={stats.approved}
            icon={<CheckCircle2 size={20} />}
            color="green"
          />
          <KPICard
            title="Pending Approval"
            value={stats.pending_approval}
            icon={<Clock size={20} />}
            color="amber"
          />
          <KPICard
            title="Expiring Soon"
            value={stats.expiring_soon}
            icon={<AlertTriangle size={20} />}
            color="orange"
          />
          <KPICard
            title="Expired"
            value={stats.expired}
            icon={<XCircle size={20} />}
            color="red"
          />
        </div>
      )}

      {/* ── Filters Row ── */}
      <div className="flex flex-wrap gap-3 items-center">
        <TabPills
          tabs={statusTabs}
          activeTab={statusFilter}
          onChange={(key) => { setStatusFilter(key); setFilters({ ...filters, page: 1 }); }}
        />
        <div className="flex items-center gap-2 ml-auto">
          <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setFilters({ ...filters, page: 1 }); }}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white outline-none focus:border-primary-500">
            <option value="">All Types</option>
            {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select value={expiryFilter} onChange={(e) => { setExpiryFilter(e.target.value); setFilters({ ...filters, page: 1 }); }}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white outline-none focus:border-primary-500">
            <option value="">All Expiry</option>
            <option value="expired">Expired</option>
            <option value="expiring_soon">Expiring Soon (30d)</option>
            <option value="valid">Valid</option>
          </select>
        </div>
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
        onAdd={() => navigate('/documents/upload')}
        addLabel="Upload Document"
        onRefresh={() => refetch()}
        selectedIds={selectedIds}
        onSelectAll={(checked) => {
          if (checked) {
            setSelectedIds(new Set((safeArray<Document>(data)).map(d => d.id)));
          } else {
            setSelectedIds(new Set());
          }
        }}
        onSelectRow={(id, checked) => {
          setSelectedIds(prev => {
            const next = new Set(prev);
            if (checked) next.add(id); else next.delete(id);
            return next;
          });
        }}
        bulkActions={selectedIds.size > 0 ? (
          <button
            onClick={() => {
              setShowBulkDeleteConfirm(true);
            }}
            className="px-3 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
          >
            Delete Selected
          </button>
        ) : undefined}
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

      <ConfirmDialog
        isOpen={showBulkDeleteConfirm}
        title="Delete Selected Documents"
        message={`This will permanently delete ${selectedIds.size} document(s). Continue?`}
        confirmLabel="Delete All"
        isDangerous={true}
        onConfirm={() => {
          selectedIds.forEach((id) => deleteMutation.mutate(id));
          setSelectedIds(new Set());
          setShowBulkDeleteConfirm(false);
        }}
        onCancel={() => setShowBulkDeleteConfirm(false)}
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

