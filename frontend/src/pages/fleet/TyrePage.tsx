import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import DataTable, { Column } from '@/components/common/DataTable';
import { Modal } from '@/components/common/Modal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { SubmitButton } from '@/components/common/SubmitButton';
import api from '@/services/api';
import { safeArray } from '@/utils/helpers';
import { handleApiError } from '../../utils/handleApiError';
import { Pencil, Trash2, CalendarPlus } from 'lucide-react';

type TyreItem = {
  id: number;
  serial_number: string;
  brand: string;
  size: string;
  purchase_date: string;
  cost: number;
  vehicle_id?: number;
  vehicle_number?: string;
  axle_position: string;
  status: 'MOUNTED' | 'REMOVED' | 'RETREADING' | 'SCRAPPED';
  total_km?: number;
  cost_per_km?: number;
};

const emptyTyre = {
  serial_number: '',
  brand: '',
  size: '',
  purchase_date: new Date().toISOString().slice(0, 10),
  cost: '',
  vehicle_id: '',
  axle_position: 'FL',
  status: 'MOUNTED',
};

const emptyEvent = {
  event_type: 'MOUNTED',
  odometer: '',
  reason: '',
};

export default function TyrePage() {
  const qc = useQueryClient();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<TyreItem | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [eventItem, setEventItem] = useState<TyreItem | null>(null);
  const [form, setForm] = useState(emptyTyre);
  const [eventForm, setEventForm] = useState(emptyEvent);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tyre-list'],
    queryFn: () => api.get('/tyre', { params: { page: 1, limit: 200 } }),
    enabled: true,
  });

  const { data: vehicles } = useQuery({
    queryKey: ['tyre-vehicles'],
    queryFn: () => api.get('/vehicles', { params: { page: 1, limit: 100 } }),
    enabled: true,
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/tyre', {
      serial_number: form.serial_number,
      brand: form.brand,
      size: form.size,
      purchase_date: form.purchase_date,
      cost: Number(form.cost || 0),
      vehicle_id: Number(form.vehicle_id),
      axle_position: form.axle_position,
      status: form.status,
    }),
    onSuccess: () => {
      toast.success('Tyre created successfully.');
      setIsCreateOpen(false);
      setForm(emptyTyre);
      qc.invalidateQueries({ queryKey: ['tyre-list'] });
    },
    onError: (error) => handleApiError(error, 'Failed to create tyre.'),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editItem) throw new Error('No tyre selected for update.');
      return api.put(`/tyre/${editItem.id}`, {
        serial_number: form.serial_number,
        brand: form.brand,
        size: form.size,
        purchase_date: form.purchase_date,
        cost: Number(form.cost || 0),
        vehicle_id: Number(form.vehicle_id),
        axle_position: form.axle_position,
        status: form.status,
      });
    },
    onSuccess: () => {
      toast.success('Tyre updated successfully.');
      setIsCreateOpen(false);
      setEditItem(null);
      setForm(emptyTyre);
      qc.invalidateQueries({ queryKey: ['tyre-list'] });
    },
    onError: (error) => handleApiError(error, 'Failed to update tyre.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/tyre/${id}`),
    onSuccess: () => {
      toast.success('Tyre deleted successfully.');
      qc.invalidateQueries({ queryKey: ['tyre-list'] });
    },
    onError: (error) => handleApiError(error, 'Failed to delete tyre.'),
  });

  const eventMutation = useMutation({
    mutationFn: () => {
      if (!eventItem) throw new Error('No tyre selected for event logging.');
      return api.post(`/tyre/${eventItem.id}/event`, {
        event_type: eventForm.event_type,
        odometer: Number(eventForm.odometer || 0),
        reason: eventForm.event_type === 'REMOVED' ? eventForm.reason : undefined,
      });
    },
    onSuccess: () => {
      toast.success('Tyre event logged successfully.');
      setEventItem(null);
      setEventForm(emptyEvent);
      qc.invalidateQueries({ queryKey: ['tyre-list'] });
    },
    onError: (error) => handleApiError(error, 'Failed to log tyre event.'),
  });

  const tyrePayload = (data as any)?.data;
  const tyreItems = safeArray<any>(tyrePayload?.items ?? (data as any)?.items ?? data);
  const rows = tyreItems.map((item: any) => ({
    id: item.id,
    serial_number: item.serial_number,
    brand: item.brand,
    size: item.size,
    purchase_date: item.purchase_date,
    cost: Number(item.cost || 0),
    vehicle_id: item.vehicle_id,
    vehicle_number: item.vehicle_number || item.vehicle?.registration_number || '-',
    axle_position: item.axle_position || 'SPARE',
    status: item.status || 'MOUNTED',
    total_km: Number(item.total_km || 0),
    cost_per_km: Number(item.cost_per_km || 0),
  })) as TyreItem[];

  const vehicleOptions = safeArray<any>((vehicles as any)?.data ?? (vehicles as any)?.items ?? vehicles);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      MOUNTED: 'bg-green-50 text-green-700',
      REMOVED: 'bg-amber-50 text-amber-700',
      RETREADING: 'bg-blue-50 text-blue-700',
      SCRAPPED: 'bg-red-50 text-red-700',
    };
    return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${map[status] || 'bg-gray-100 text-gray-700'}`}>{status}</span>;
  };

  const columns: Column<TyreItem>[] = [
    { key: 'serial_number', header: 'Serial No', render: (r) => <span className="font-mono text-xs text-primary-600">{r.serial_number}</span> },
    { key: 'brand', header: 'Brand' },
    { key: 'size', header: 'Size' },
    { key: 'vehicle_number', header: 'Vehicle' },
    { key: 'axle_position', header: 'Position' },
    { key: 'status', header: 'Status', render: (r) => statusBadge(r.status) },
    { key: 'total_km', header: 'Total KM', render: (r) => Number(r.total_km || 0).toLocaleString('en-IN') },
    { key: 'cost_per_km', header: 'Cost/KM', render: (r) => `₹${Number(r.cost_per_km || 0).toFixed(2)}` },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => { setEditItem(r); setForm({ serial_number: r.serial_number, brand: r.brand, size: r.size, purchase_date: r.purchase_date?.slice(0, 10), cost: String(r.cost || ''), vehicle_id: r.vehicle_id ? String(r.vehicle_id) : '', axle_position: r.axle_position, status: r.status }); setIsCreateOpen(true); }} className="p-1.5 rounded-md hover:bg-gray-100" title="Edit"><Pencil size={14} /></button>
          <button type="button" onClick={() => setEventItem(r)} className="p-1.5 rounded-md hover:bg-blue-50 text-blue-600" title="Log Event"><CalendarPlus size={14} /></button>
          <button type="button" onClick={() => setDeleteId(r.id)} className="p-1.5 rounded-md hover:bg-red-50 text-red-600" title="Delete"><Trash2 size={14} /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tyre Management</h1>
          <p className="page-subtitle">Track tyre lifecycle, position and events</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        total={tyrePayload?.summary?.total_tyres ?? (data as any)?.pagination?.total ?? rows.length}
        isLoading={isLoading}
        onRefresh={() => refetch()}
        onAdd={() => { setEditItem(null); setForm(emptyTyre); setIsCreateOpen(true); }}
        addLabel="Add Tyre"
      />

      <Modal isOpen={isCreateOpen} onClose={() => { setIsCreateOpen(false); setEditItem(null); }} title={editItem ? 'Edit Tyre' : 'Add Tyre'} size="md">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (editItem) updateMutation.mutate(); else createMutation.mutate(); }}>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Serial Number</label><input className="input-field" value={form.serial_number} onChange={(e) => setForm((p) => ({ ...p, serial_number: e.target.value }))} required /></div>
            <div><label className="label">Brand</label><input className="input-field" value={form.brand} onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))} required /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Size</label><input className="input-field" value={form.size} onChange={(e) => setForm((p) => ({ ...p, size: e.target.value }))} required /></div>
            <div><label className="label">Purchase Date</label><input type="date" className="input-field" value={form.purchase_date} onChange={(e) => setForm((p) => ({ ...p, purchase_date: e.target.value }))} required /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Cost</label><input type="number" className="input-field" value={form.cost} onChange={(e) => setForm((p) => ({ ...p, cost: e.target.value }))} required /></div>
            <div>
              <label className="label">Vehicle</label>
              <select className="input-field" value={form.vehicle_id} onChange={(e) => setForm((p) => ({ ...p, vehicle_id: e.target.value }))} required>
                <option value="">Select vehicle</option>
                {vehicleOptions.map((v: any) => <option key={v.id} value={v.id}>{v.registration_number || `#${v.id}`}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Axle Position</label>
              <select className="input-field" value={form.axle_position} onChange={(e) => setForm((p) => ({ ...p, axle_position: e.target.value }))}>
                {['FL', 'FR', 'RL1', 'RL2', 'RR1', 'RR2', 'SPARE'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input-field" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                {['MOUNTED', 'REMOVED', 'RETREADING', 'SCRAPPED'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setIsCreateOpen(false)}>Cancel</button>
            <SubmitButton isLoading={createMutation.isPending || updateMutation.isPending} label={editItem ? 'Save Changes' : 'Add Tyre'} />
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!eventItem} onClose={() => setEventItem(null)} title="Log Tyre Event" size="sm">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); eventMutation.mutate(); }}>
          <div>
            <label className="label">Event Type</label>
            <select className="input-field" value={eventForm.event_type} onChange={(e) => setEventForm((p) => ({ ...p, event_type: e.target.value }))}>
              {['MOUNTED', 'REMOVED', 'RETREADED', 'SCRAPPED'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Odometer</label>
            <input type="number" className="input-field" value={eventForm.odometer} onChange={(e) => setEventForm((p) => ({ ...p, odometer: e.target.value }))} required />
          </div>
          {eventForm.event_type === 'REMOVED' && (
            <div>
              <label className="label">Reason</label>
              <textarea className="input-field" rows={2} value={eventForm.reason} onChange={(e) => setEventForm((p) => ({ ...p, reason: e.target.value }))} required />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setEventItem(null)}>Cancel</button>
            <SubmitButton isLoading={eventMutation.isPending} label="Log Event" />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleteId !== null}
        title="Delete Tyre"
        message="Delete this tyre record? This action cannot be undone."
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
