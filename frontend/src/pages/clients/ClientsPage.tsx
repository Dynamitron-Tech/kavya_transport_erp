import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { clientService, documentService } from '@/services/dataService';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import DataTable, { Column } from '@/components/common/DataTable';
import { StatusBadge, Modal } from '@/components/common/Modal';
import { SubmitButton } from '@/components/common/SubmitButton';
import { useAuthStore } from '@/store/authStore';
import type { FilterParams } from '@/types';
import { Building2, Phone, Mail, Pencil, Trash2, Upload, FileText } from 'lucide-react';
import { safeArray } from '@/utils/helpers';
import { exportTableToPdf } from '@/utils/pdfExport';
import { handleApiError } from '../../utils/handleApiError';

type RequiredClientDocKey = 'pan' | 'gst' | 'tds' | 'business_card';

export default function ClientsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  useAuthStore();

  const [filters, setFilters] = useState<FilterParams>({ page: 1, page_size: 20 });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [requiredDocs, setRequiredDocs] = useState<Record<RequiredClientDocKey, File | null>>({
    pan: null,
    gst: null,
    tds: null,
    business_card: null,
  });

  const requiredDocLabels: Record<RequiredClientDocKey, string> = {
    pan: 'PAN Document',
    gst: 'GST Document',
    tds: 'TDS Document',
    business_card: 'Business Card',
  };

  const uploadedDocCount = Object.values(requiredDocs).filter(Boolean).length;
  const allRequiredDocsUploaded = uploadedDocCount === 4;

  const emptyCreate = {
    name: '', code: '', client_type: 'corporate', contact_person: '', gstin: '', pan: '',
    email: '', phone: '', alt_phone: '', website: '', industry: '', company_size: '',
    address_line1: '', city: '', state: '', pincode: '',
    tds_rate: '', tax_exempt: false,
    invoice_frequency: 'per_order', payment_method: 'bank_transfer',
    ifsc_code: '',
    legal_name: '', trade_name: '', nature_of_business: '', designation: '',
    name_deductor: '', name_deductee: '', pan_deductor: '', pan_deductee: '',
    nature_payment: '', tds_amount: '',
  };

  const [createPayload, setCreatePayload] = useState(emptyCreate);
  const [editPayload, setEditPayload] = useState({ name: '', email: '', phone: '', city: '', state: '' });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['clients', filters],
    queryFn: () => clientService.list(filters),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!allRequiredDocsUploaded) {
        throw new Error('Please upload all 4 required documents: PAN, GST, TDS, and Business Card.');
      }

      const payload: any = { ...createPayload };
      if (!payload.code || !String(payload.code).trim()) {
        delete payload.code;
      }
      delete payload.tan;
      delete payload.reg_type;

      const created = await clientService.create(payload);
      const newClientId = Number((created as any)?.id ?? (created as any)?.data?.id ?? 0);

      if (newClientId) {
        const entries = Object.entries(requiredDocs) as Array<[RequiredClientDocKey, File | null]>;
        const uploads = entries.filter(([, file]) => !!file).map(async ([docKey, file]) => {
          const formData = new FormData();
          formData.append('file', file as File);
          formData.append('entity_type', 'client');
          formData.append('entity_id', String(newClientId));
          formData.append('entity_label', createPayload.name || 'Client');
          formData.append('title', requiredDocLabels[docKey]);
          formData.append('document_type', 'other');
          return documentService.uploadFile(formData);
        });

        const results = await Promise.allSettled(uploads);
        const failed = results.filter((r) => r.status === 'rejected').length;
        if (failed > 0) {
          toast.error(`Client created, but ${failed} document upload(s) failed.`);
        }
      }

      return created;
    },
    onSuccess: () => {
      setIsCreateOpen(false);
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client created successfully.');
      setCreatePayload(emptyCreate);
      setRequiredDocs({ pan: null, gst: null, tds: null, business_card: null });
    },
    onError: (error) => handleApiError(error, 'Create failed'),
  });

  const editMutation = useMutation({
    mutationFn: (payload: any) => clientService.update(editItem!.id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Updated successfully');
      setEditItem(null);
    },
    onError: (error) => handleApiError(error, 'Update failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clientService.delete(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Deleted successfully');
    },
    onError: (error) => handleApiError(error, 'Delete failed'),
  });

  const handleEdit = (client: any) => {
    setEditItem(client);
    setEditPayload({
      name: client.name || '',
      email: client.email || '',
      phone: client.phone || '',
      city: client.city || '',
      state: client.state || '',
    });
  };

  const rows = safeArray<any>(data);

  const handleExportPdf = () => {
    exportTableToPdf({
      title: 'Clients Report',
      fileName: `clients-${new Date().toISOString().slice(0, 10)}.pdf`,
      rows,
      columns: [
        { header: 'Code', accessor: (c) => c.code },
        { header: 'Client Name', accessor: (c) => c.name },
        { header: 'GST Number', accessor: (c) => c.gstin },
        { header: 'Phone', accessor: (c) => c.phone },
        { header: 'Email', accessor: (c) => c.email },
        { header: 'City', accessor: (c) => c.city },
        { header: 'Outstanding', accessor: (c) => `INR ${Number(c.outstanding_amount || 0).toLocaleString('en-IN')}` },
        { header: 'Status', accessor: (c) => (c.is_active ? 'Active' : 'Inactive') },
      ],
    });
  };

  const columns: Column<any>[] = [
    {
      key: 'code',
      header: 'Code',
      sortable: true,
      render: (c: any) => (
        <button onClick={(e) => { e.stopPropagation(); navigate(`/clients/${c.id}`); }} className="font-mono text-sm font-medium text-primary-600 hover:underline">
          {c.code}
        </button>
      ),
    },
    {
      key: 'name',
      header: 'Client Name',
      sortable: true,
      render: (c: any) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Building2 size={18} className="text-blue-600" />
          </div>
          <div>
            <button onClick={(e) => { e.stopPropagation(); navigate(`/clients/${c.id}`); }} className="font-medium text-gray-900 hover:text-primary-600 hover:underline text-left">
              {c.name}
            </button>
            <p className="text-xs text-gray-400 capitalize">{c.client_type}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'gstin',
      header: 'GST Number',
      render: (c: any) => <span className="font-mono text-sm">{c.gstin || '—'}</span>,
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (c: any) => (
        <div className="text-sm">
          {c.phone && <div className="flex items-center gap-1 text-gray-600"><Phone size={12} /> {c.phone}</div>}
          {c.email && <div className="flex items-center gap-1 text-gray-400 text-xs"><Mail size={12} /> {c.email}</div>}
        </div>
      ),
    },
    {
      key: 'city',
      header: 'City',
      render: (c: any) => c.city || '—',
    },
    {
      key: 'outstanding_amount',
      header: 'Outstanding',
      sortable: true,
      render: (c: any) => (
        <span className={Number(c.outstanding_amount || 0) > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}>
          ₹{Number(c.outstanding_amount || 0).toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (c: any) => <StatusBadge status={c.is_active ? 'active' : 'inactive'} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (c: any) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={(e) => { e.stopPropagation(); handleEdit(c); }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg" title="Edit"><Pencil className="w-4 h-4" /></button>
          <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteId(String(c.id)); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">Manage your client base and billing</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        total={(data as any)?.total || (data as any)?.pagination?.total || 0}
        page={filters.page}
        pageSize={filters.page_size}
        isLoading={isLoading}
        searchPlaceholder="Search clients..."
        onSearch={(q) => setFilters({ ...filters, search: q, page: 1 })}
        onPageChange={(p) => setFilters({ ...filters, page: p })}
        onSort={(key, order) => setFilters({ ...filters, sort_by: key, sort_order: order })}
        onRowClick={(c: any) => navigate(`/clients/${c.id}`)}
        onAdd={() => setIsCreateOpen(true)}
        addLabel="Add Client"
        onRefresh={() => refetch()}
        onExport={handleExportPdf}
        emptyMessage="No clients found. Create your first client to get started."
      />

      <Modal
        isOpen={isCreateOpen}
        onClose={() => { setIsCreateOpen(false); setRequiredDocs({ pan: null, gst: null, tds: null, business_card: null }); }}
        title="Add New Client"
        size="xl"
        footer={
          <>
            <button className="btn-secondary" onClick={() => { setIsCreateOpen(false); setRequiredDocs({ pan: null, gst: null, tds: null, business_card: null }); }}>Cancel</button>
            <button className="btn-primary" disabled={createMutation.isPending || !createPayload.name || !allRequiredDocsUploaded} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? 'Creating...' : 'Create Client'}
            </button>
          </>
        }
      >
        <form className="space-y-5">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <FileText size={14} /> Upload Required Documents
            </h3>
            <p className="text-xs text-gray-500 mb-3">Upload all 4 documents: PAN, GST, TDS, and Business Card.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(['pan', 'gst', 'tds', 'business_card'] as RequiredClientDocKey[]).map((docKey) => (
                <label key={docKey} className="border border-blue-200 rounded-lg bg-white p-3 cursor-pointer hover:border-blue-400 transition-all block">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setRequiredDocs((prev) => ({ ...prev, [docKey]: file }));
                    }}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-gray-700">{requiredDocLabels[docKey]}</p>
                      <p className="text-[11px] text-gray-500 mt-1">{requiredDocs[docKey]?.name || 'Click to upload'}</p>
                    </div>
                    <Upload size={16} className="text-blue-500" />
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-3 text-xs text-gray-600">
              <span className={allRequiredDocsUploaded ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>
                {uploadedDocCount}/4 documents uploaded
              </span>
              {!allRequiredDocsUploaded && <span className="ml-2">Please upload all required documents to create client.</span>}
            </div>

            {!allRequiredDocsUploaded && (
              <div className="mt-2 text-[11px] text-red-500">
                Required: PAN, GST, TDS, Business Card
              </div>
            )}
          </div>

          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-1">Basic Information</div>
          <div className="grid grid-cols-1 gap-4">
            <div><label className="label">Client Name *</label><input type="text" className="input-field" placeholder="Enter client name" value={createPayload.name} onChange={(e) => setCreatePayload(p => ({ ...p, name: e.target.value }))} /></div>
            <div><label className="label">Client Code</label><input type="text" className="input-field bg-gray-50" placeholder="Auto-generated on save" value={createPayload.code} onChange={(e) => setCreatePayload(p => ({ ...p, code: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="label">Client Type</label><select className="input-field" value={createPayload.client_type} onChange={(e) => setCreatePayload(p => ({ ...p, client_type: e.target.value }))}><option value="corporate">Corporate</option><option value="individual">Individual</option><option value="government">Government</option><option value="ngo">NGO</option></select></div>
            <div><label className="label">Contact Person</label><input type="text" className="input-field" value={createPayload.contact_person} onChange={(e) => setCreatePayload(p => ({ ...p, contact_person: e.target.value }))} /></div>
            <div><label className="label">Designation</label><input type="text" className="input-field" value={createPayload.designation} onChange={(e) => setCreatePayload(p => ({ ...p, designation: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Legal Name</label><input type="text" className="input-field" value={createPayload.legal_name} onChange={(e) => setCreatePayload(p => ({ ...p, legal_name: e.target.value }))} /></div>
            <div><label className="label">Trade Name</label><input type="text" className="input-field" value={createPayload.trade_name} onChange={(e) => setCreatePayload(p => ({ ...p, trade_name: e.target.value }))} /></div>
          </div>

          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-1">Tax & Identity</div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">PAN Number</label><input type="text" className="input-field font-mono" value={createPayload.pan} onChange={(e) => setCreatePayload(p => ({ ...p, pan: e.target.value }))} /></div>
            <div><label className="label">GSTIN</label><input type="text" className="input-field font-mono" value={createPayload.gstin} onChange={(e) => setCreatePayload(p => ({ ...p, gstin: e.target.value }))} /></div>
          </div>

          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-1">Contact Information</div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Email</label><input type="email" className="input-field" value={createPayload.email} onChange={(e) => setCreatePayload(p => ({ ...p, email: e.target.value }))} /></div>
            <div><label className="label">Phone</label><input type="tel" className="input-field" value={createPayload.phone} onChange={(e) => setCreatePayload(p => ({ ...p, phone: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Alternate Phone</label><input type="tel" className="input-field" value={createPayload.alt_phone} onChange={(e) => setCreatePayload(p => ({ ...p, alt_phone: e.target.value }))} /></div>
            <div><label className="label">Website</label><input type="url" className="input-field" value={createPayload.website} onChange={(e) => setCreatePayload(p => ({ ...p, website: e.target.value }))} /></div>
          </div>
          <div><label className="label">Address</label><textarea className="input-field" rows={2} value={createPayload.address_line1} onChange={(e) => setCreatePayload(p => ({ ...p, address_line1: e.target.value }))} /></div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="label">City</label><input type="text" className="input-field" value={createPayload.city} onChange={(e) => setCreatePayload(p => ({ ...p, city: e.target.value }))} /></div>
            <div><label className="label">State</label><input type="text" className="input-field" value={createPayload.state} onChange={(e) => setCreatePayload(p => ({ ...p, state: e.target.value }))} /></div>
            <div><label className="label">Pincode</label><input type="text" className="input-field" value={createPayload.pincode} onChange={(e) => setCreatePayload(p => ({ ...p, pincode: e.target.value }))} /></div>
          </div>

          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-1">Financial Details</div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Invoice Frequency</label><select className="input-field" value={createPayload.invoice_frequency} onChange={(e) => setCreatePayload(p => ({ ...p, invoice_frequency: e.target.value }))}><option value="per_order">Per Order</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option></select></div>
            <div><label className="label">Payment Method</label><select className="input-field" value={createPayload.payment_method} onChange={(e) => setCreatePayload(p => ({ ...p, payment_method: e.target.value }))}><option value="bank_transfer">Bank Transfer</option><option value="upi">UPI</option><option value="cheque">Cheque</option><option value="cash">Cash</option></select></div>
          </div>
          <div>
            <label className="label">IFSC Code</label>
            <input type="text" className="input-field font-mono" value={createPayload.ifsc_code} onChange={(e) => setCreatePayload(p => ({ ...p, ifsc_code: e.target.value }))} />
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title={`Edit ${editItem?.name || ''}`} size="lg">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); editMutation.mutate(editPayload); }}>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Client Name</label><input className="input-field" value={editPayload.name} onChange={(e) => setEditPayload(p => ({ ...p, name: e.target.value }))} required /></div>
            <div><label className="label">Email</label><input className="input-field" value={editPayload.email} onChange={(e) => setEditPayload(p => ({ ...p, email: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="label">Phone</label><input className="input-field" value={editPayload.phone} onChange={(e) => setEditPayload(p => ({ ...p, phone: e.target.value }))} /></div>
            <div><label className="label">City</label><input className="input-field" value={editPayload.city} onChange={(e) => setEditPayload(p => ({ ...p, city: e.target.value }))} /></div>
            <div><label className="label">State</label><input className="input-field" value={editPayload.state} onChange={(e) => setEditPayload(p => ({ ...p, state: e.target.value }))} /></div>
          </div>
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
            <button type="button" onClick={() => setEditItem(null)} className="btn-secondary">Cancel</button>
            <SubmitButton isLoading={editMutation.isPending} label="Save Changes" />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        title="Delete Record"
        message="This action cannot be undone."
        confirmLabel="Delete"
        isDangerous={true}
        onConfirm={() => { if (!deleteId) return; deleteMutation.mutate(deleteId); setDeleteId(null); }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
