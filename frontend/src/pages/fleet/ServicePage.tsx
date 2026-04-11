import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import DataTable, { Column } from '@/components/common/DataTable';
import { Modal } from '@/components/common/Modal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { SubmitButton } from '@/components/common/SubmitButton';
import api from '@/services/api';
import { safeArray } from '@/utils/helpers';
import { handleApiError } from '../../utils/handleApiError';
import { Pencil, Trash2 } from 'lucide-react';

type ServiceItem = {
  id: number;
  vehicle_id: number;
  vehicle_number?: string;
  service_type: string;
  service_date: string;
  odometer: number;
  workshop: string;
  job_card_number?: string;
  labour_cost?: number;
  total_cost?: number;
  next_service_km?: number;
  next_service_date?: string;
  notes?: string;
  status?: 'UPCOMING' | 'OVERDUE' | 'COMPLETED';
};

const emptyForm = {
  vehicle_id: '',
  service_type: 'SCHEDULED',
  service_date: new Date().toISOString().slice(0, 10),
  odometer: '',
  workshop: '',
  job_card_number: '',
  labour_cost: '',
  total_cost: '',
  next_service_km: '',
  next_service_date: '',
  notes: '',
  invoice_photo: null as File | null,
};

export default function ServicePage() {
  const qc = useQueryClient();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<ServiceItem | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['service-list'],
    queryFn: () => api.get('/service', { params: { page: 1, limit: 200 } }),
    enabled: true,
  });

  const { data: vehicles } = useQuery({
    queryKey: ['service-vehicles'],
    queryFn: () => api.get('/vehicles', { params: { page: 1, limit: 100 } }),
    enabled: true,
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/service', {
      vehicle_id: Number(form.vehicle_id),
      service_type: form.service_type,
      service_date: form.service_date,
      odometer: Number(form.odometer || 0),
      workshop: form.workshop,
      job_card_number: form.job_card_number || null,
      labour_cost: Number(form.labour_cost || 0),
      total_cost: Number(form.total_cost || 0),
      next_service_km: Number(form.next_service_km || 0),
      next_service_date: form.next_service_date || null,
      notes: form.notes || null,
    }),
    onSuccess: () => {
      toast.success('Service record created successfully.');
      setIsCreateOpen(false);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ['service-list'] });
    },
    onError: (error) => handleApiError(error, 'Failed to create service record.'),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editItem) return;
      const payload: any = {
        vehicle_id: Number(form.vehicle_id),
        service_type: form.service_type,
        service_date: form.service_date,
        odometer: Number(form.odometer || 0),
        workshop: form.workshop,
        job_card_number: form.job_card_number,
        labour_cost: Number(form.labour_cost || 0),
        total_cost: Number(form.total_cost || 0),
        next_service_km: Number(form.next_service_km || 0),
        next_service_date: form.next_service_date || null,
        notes: form.notes,
      };
      return api.put(`/service/${editItem.id}`, payload);
    },
    onSuccess: () => {
      toast.success('Service record updated successfully.');
      setIsCreateOpen(false);
      setEditItem(null);
      qc.invalidateQueries({ queryKey: ['service-list'] });
    },
    onError: (error) => handleApiError(error, 'Failed to update service record.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/service/${id}`),
    onSuccess: () => {
      toast.success('Service record deleted successfully.');
      qc.invalidateQueries({ queryKey: ['service-list'] });
    },
    onError: (error) => handleApiError(error, 'Failed to delete service record.'),
  });

  const rows = useMemo(
    () => safeArray<any>((data as any)?.items ?? data).map((item: any) => {
      const nextDate = item.next_service_date ? new Date(item.next_service_date) : null;
      const now = new Date();
      let status: 'UPCOMING' | 'OVERDUE' | 'COMPLETED' = 'COMPLETED';
      if (nextDate) status = nextDate.getTime() < now.getTime() ? 'OVERDUE' : 'UPCOMING';
      return {
        id: item.id,
        vehicle_id: Number(item.vehicle_id || 0),
        vehicle_number: item.vehicle_number || item.vehicle?.registration_number || `#${item.vehicle_id}`,
        service_type: item.service_type || 'SCHEDULED',
        service_date: item.service_date || item.date,
        odometer: Number(item.odometer || 0),
        workshop: item.workshop || '-',
        job_card_number: item.job_card_number,
        labour_cost: Number(item.labour_cost || 0),
        total_cost: Number(item.total_cost || 0),
        next_service_km: Number(item.next_service_km || 0),
        next_service_date: item.next_service_date,
        notes: item.notes,
        status,
      } as ServiceItem;
    }),
    [data]
  );

  const statusClass: Record<string, string> = {
    UPCOMING: 'bg-green-50 text-green-700',
    OVERDUE: 'bg-red-50 text-red-700',
    COMPLETED: 'bg-gray-100 text-gray-700',
  };

  const columns: Column<ServiceItem>[] = [
    { key: 'service_date', header: 'Date', render: (r) => new Date(r.service_date).toLocaleDateString('en-IN') },
    { key: 'vehicle_number', header: 'Vehicle', render: (r) => <span className="font-medium">{r.vehicle_number}</span> },
    { key: 'service_type', header: 'Type' },
    { key: 'workshop', header: 'Workshop' },
    { key: 'odometer', header: 'Odometer', render: (r) => `${Number(r.odometer || 0).toLocaleString('en-IN')} km` },
    { key: 'total_cost', header: 'Total Cost', render: (r) => `₹${Number(r.total_cost || 0).toLocaleString('en-IN')}` },
    {
      key: 'next_service',
      header: 'Next Service',
      render: (r) => `${r.next_service_km ? `${Number(r.next_service_km).toLocaleString('en-IN')} km` : '-'} ${r.next_service_date ? `/ ${new Date(r.next_service_date).toLocaleDateString('en-IN')}` : ''}`,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusClass[r.status || 'COMPLETED']}`}>{r.status}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => { setEditItem(r); setForm({ vehicle_id: String(r.vehicle_id || ''), service_type: r.service_type, service_date: r.service_date?.slice(0, 10) || '', odometer: String(r.odometer || ''), workshop: r.workshop || '', job_card_number: r.job_card_number || '', labour_cost: String(r.labour_cost || ''), total_cost: String(r.total_cost || ''), next_service_km: String(r.next_service_km || ''), next_service_date: r.next_service_date?.slice(0, 10) || '', notes: r.notes || '', invoice_photo: null }); setIsCreateOpen(true); }} className="p-1.5 rounded-md hover:bg-gray-100" title="Edit"><Pencil size={14} /></button>
          <button type="button" onClick={() => setDeleteId(r.id)} className="p-1.5 rounded-md hover:bg-red-50 text-red-600" title="Delete"><Trash2 size={14} /></button>
        </div>
      ),
    },
  ];

  const vehicleOptions = safeArray<any>((vehicles as any)?.items ?? vehicles);

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Service & Maintenance</h1>
          <p className="page-subtitle">Manage scheduled and breakdown service records</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        total={rows.length}
        isLoading={isLoading}
        onRefresh={() => refetch()}
        onAdd={() => { setEditItem(null); setForm(emptyForm); setIsCreateOpen(true); }}
        addLabel="Add Service"
      />

      <Modal isOpen={isCreateOpen} onClose={() => { setIsCreateOpen(false); setEditItem(null); }} title={editItem ? 'Edit Service Record' : 'Add Service Record'} size="lg">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (editItem) updateMutation.mutate(); else createMutation.mutate(); }}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Vehicle</label>
              <select className="input-field" value={form.vehicle_id} onChange={(e) => setForm((p) => ({ ...p, vehicle_id: e.target.value }))} required>
                <option value="">Select vehicle</option>
                {vehicleOptions.map((v: any) => <option key={v.id} value={v.id}>{v.registration_number || `#${v.id}`}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Service Type</label>
              <select className="input-field" value={form.service_type} onChange={(e) => setForm((p) => ({ ...p, service_type: e.target.value }))}>
                {['SCHEDULED', 'BREAKDOWN', 'ACCIDENT_REPAIR', 'TYRE_CHANGE'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Service Date</label><input type="date" className="input-field" value={form.service_date} onChange={(e) => setForm((p) => ({ ...p, service_date: e.target.value }))} required /></div>
            <div><label className="label">Odometer</label><input type="number" className="input-field" value={form.odometer} onChange={(e) => setForm((p) => ({ ...p, odometer: e.target.value }))} required /></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Workshop</label><input className="input-field" value={form.workshop} onChange={(e) => setForm((p) => ({ ...p, workshop: e.target.value }))} required /></div>
            <div><label className="label">Job Card Number</label><input className="input-field" value={form.job_card_number} onChange={(e) => setForm((p) => ({ ...p, job_card_number: e.target.value }))} /></div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div><label className="label">Labour Cost</label><input type="number" className="input-field" value={form.labour_cost} onChange={(e) => setForm((p) => ({ ...p, labour_cost: e.target.value }))} /></div>
            <div><label className="label">Total Cost</label><input type="number" className="input-field" value={form.total_cost} onChange={(e) => setForm((p) => ({ ...p, total_cost: e.target.value }))} required /></div>
            <div><label className="label">Next Service KM</label><input type="number" className="input-field" value={form.next_service_km} onChange={(e) => setForm((p) => ({ ...p, next_service_km: e.target.value }))} /></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Next Service Date</label><input type="date" className="input-field" value={form.next_service_date} onChange={(e) => setForm((p) => ({ ...p, next_service_date: e.target.value }))} /></div>
            <div><label className="label">Invoice Photo</label><input type="file" accept="image/*" className="input-field" onChange={(e) => setForm((p) => ({ ...p, invoice_photo: e.target.files?.[0] || null }))} /></div>
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea className="input-field" rows={3} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setIsCreateOpen(false)}>Cancel</button>
            <SubmitButton isLoading={createMutation.isPending || updateMutation.isPending} label={editItem ? 'Save Changes' : 'Add Service'} />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleteId !== null}
        title="Delete Service Record"
        message="Delete this service record? This action cannot be undone."
        confirmLabel="Delete"
        isDangerous={true}
        onConfirm={() => {
          if (deleteId === null) return;
          deleteMutation.mutate(deleteId);
          setDeleteId(null);
        }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
