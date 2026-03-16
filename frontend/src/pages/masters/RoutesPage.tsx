import { handleApiError } from '../../utils/handleApiError';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import DataTable, { Column } from '@/components/common/DataTable';
import { Modal } from '@/components/common/Modal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { SubmitButton } from '@/components/common/SubmitButton';
import { routeService } from '@/services/dataService';
import { useAuthStore } from '@/store/authStore';
import api from '@/services/api';
import { safeArray } from '@/utils/helpers';
import { Pencil, Trash2, X } from 'lucide-react';

type RouteItem = {
  id: number;
  origin: string;
  destination: string;
  distance_km: number;
  estimated_hours: number;
  typical_fuel_cost: number;
  is_interstate: boolean;
  toll_points: string[];
};

const emptyForm = {
  origin: '',
  destination: '',
  distance_km: '',
  estimated_hours: '',
  typical_fuel_cost: '',
  is_interstate: false,
  toll_points: [] as string[],
};

export default function RoutesPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuthStore();
  const canView = hasPermission('clients:view');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<RouteItem | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [tollInput, setTollInput] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['routes-master'],
    queryFn: () => routeService.list({ page: 1, page_size: 200 }),
    enabled: canView,
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/finance/routes', {
      route_name: `${form.origin} - ${form.destination}`,
      origin_city: form.origin,
      destination_city: form.destination,
      distance_km: Number(form.distance_km || 0),
      estimated_hours: Number(form.estimated_hours || 0),
      toll_gates: form.toll_points.length,
      via_points: JSON.stringify(form.toll_points),
    } as any),
    onSuccess: () => {
      toast.success('Route created successfully.');
      setIsCreateOpen(false);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ['routes-master'] });
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editItem) throw new Error('No route selected for update.');
      return api.put(`/finance/routes/${editItem.id}`, {
        route_name: `${form.origin} - ${form.destination}`,
        origin_city: form.origin,
        destination_city: form.destination,
        distance_km: Number(form.distance_km || 0),
        estimated_hours: Number(form.estimated_hours || 0),
        toll_gates: form.toll_points.length,
        via_points: JSON.stringify(form.toll_points),
      } as any);
    },
    onSuccess: () => {
      toast.success('Route updated successfully.');
      setIsCreateOpen(false);
      setEditItem(null);
      qc.invalidateQueries({ queryKey: ['routes-master'] });
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/finance/routes/${id}`),
    onSuccess: () => {
      toast.success('Route deleted successfully.');
      qc.invalidateQueries({ queryKey: ['routes-master'] });
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const rows = safeArray<any>((data as any)?.items ?? data).map((item: any) => {
    let parsedViaPoints: string[] = [];
    if (typeof item.via_points === 'string') {
      try {
        const parsed = JSON.parse(item.via_points);
        parsedViaPoints = Array.isArray(parsed) ? parsed : [];
      } catch {
        parsedViaPoints = [];
      }
    }
    return ({
    id: item.id,
    origin: item.origin || item.origin_city || '',
    destination: item.destination || item.destination_city || '',
    distance_km: Number(item.distance_km || 0),
    estimated_hours: Number(item.estimated_hours || 0),
    typical_fuel_cost: Number(item.typical_fuel_cost || 0),
    is_interstate: Boolean(item.is_interstate),
    toll_points: safeArray<string>(item.toll_points || parsedViaPoints),
  });
  }) as RouteItem[];

  const columns: Column<RouteItem>[] = [
    { key: 'origin', header: 'Origin' },
    { key: 'destination', header: 'Destination' },
    { key: 'distance_km', header: 'Distance', render: (r) => `${r.distance_km} km` },
    { key: 'estimated_hours', header: 'Est. Hours', render: (r) => r.estimated_hours.toFixed(1) },
    { key: 'typical_fuel_cost', header: 'Fuel Cost', render: (r) => `₹${r.typical_fuel_cost.toLocaleString('en-IN')}` },
    {
      key: 'is_interstate',
      header: 'Interstate',
      render: (r) => <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.is_interstate ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>{r.is_interstate ? 'Yes' : 'No'}</span>,
    },
    {
      key: 'toll_points',
      header: 'Toll Points',
      render: (r) => r.toll_points.length ? r.toll_points.join(', ') : '—',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => { setEditItem(r); setForm({ origin: r.origin, destination: r.destination, distance_km: String(r.distance_km), estimated_hours: String(r.estimated_hours), typical_fuel_cost: String(r.typical_fuel_cost), is_interstate: r.is_interstate, toll_points: [...r.toll_points] }); setIsCreateOpen(true); }} className="p-1.5 rounded-md hover:bg-gray-100" title="Edit"><Pencil size={14} /></button>
          <button type="button" onClick={() => setDeleteId(r.id)} className="p-1.5 rounded-md hover:bg-red-50 text-red-600" title="Delete"><Trash2 size={14} /></button>
        </div>
      ),
    },
  ];

  if (!canView) {
    return <div className="card text-center text-gray-500">You do not have permission to view routes.</div>;
  }

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Routes Master</h1>
          <p className="page-subtitle">Manage route distances, estimates and toll points</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        total={rows.length}
        isLoading={isLoading}
        onRefresh={() => refetch()}
        onAdd={() => { setEditItem(null); setForm(emptyForm); setTollInput(''); setIsCreateOpen(true); }}
        addLabel="Add Route"
      />

      <Modal isOpen={isCreateOpen} onClose={() => { setIsCreateOpen(false); setEditItem(null); }} title={editItem ? 'Edit Route' : 'Add Route'} size="lg">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (editItem) updateMutation.mutate(); else createMutation.mutate(); }}>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Origin</label><input className="input-field" value={form.origin} onChange={(e) => setForm((p) => ({ ...p, origin: e.target.value }))} required /></div>
            <div><label className="label">Destination</label><input className="input-field" value={form.destination} onChange={(e) => setForm((p) => ({ ...p, destination: e.target.value }))} required /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="label">Distance (km)</label><input type="number" className="input-field" value={form.distance_km} onChange={(e) => setForm((p) => ({ ...p, distance_km: e.target.value }))} required /></div>
            <div><label className="label">Estimated Hours</label><input type="number" step="0.1" className="input-field" value={form.estimated_hours} onChange={(e) => setForm((p) => ({ ...p, estimated_hours: e.target.value }))} required /></div>
            <div><label className="label">Typical Fuel Cost</label><input type="number" className="input-field" value={form.typical_fuel_cost} onChange={(e) => setForm((p) => ({ ...p, typical_fuel_cost: e.target.value }))} required /></div>
          </div>
          <div className="flex items-center gap-2">
            <input id="is_interstate" type="checkbox" checked={form.is_interstate} onChange={(e) => setForm((p) => ({ ...p, is_interstate: e.target.checked }))} />
            <label htmlFor="is_interstate" className="text-sm font-medium text-gray-700">Interstate Route</label>
          </div>

          <div>
            <label className="label">Toll Points</label>
            <div className="flex gap-2">
              <input className="input-field" value={tollInput} onChange={(e) => setTollInput(e.target.value)} placeholder="Add toll point name" />
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  const value = tollInput.trim();
                  if (!value) return;
                  setForm((p) => ({ ...p, toll_points: [...p.toll_points, value] }));
                  setTollInput('');
                }}
              >
                Add
              </button>
            </div>
            {form.toll_points.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {form.toll_points.map((point, idx) => (
                  <span key={`${point}-${idx}`} className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">
                    {point}
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, toll_points: p.toll_points.filter((_, i) => i !== idx) }))}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setIsCreateOpen(false)}>Cancel</button>
            <SubmitButton isLoading={createMutation.isPending || updateMutation.isPending} label={editItem ? 'Save Changes' : 'Add Route'} />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleteId !== null}
        title="Delete Route"
        message="Delete this route? This action cannot be undone."
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

