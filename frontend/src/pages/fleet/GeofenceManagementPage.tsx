import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MapPin, Plus, Trash2, Edit, Shield, Activity, Circle,
  ChevronDown, ChevronUp, Eye, EyeOff, Target, AlertTriangle, Filter
} from 'lucide-react';
import { KPICard, Modal, EmptyState, LoadingSpinner, ConfirmDialog } from '@/components/common/Modal';
import { geofenceService } from '@/services/dataService';
import type { Geofence, GeofenceType } from '@/types';
import { safeArray } from '@/utils/helpers';

const GEOFENCE_TYPE_LABELS: Record<GeofenceType, string> = {
  route: 'Route Corridor',
  zone: 'Zone',
  loading: 'Loading Point',
  unloading: 'Unloading Point',
  fuel_station: 'Fuel Station',
  restricted: 'Restricted Area',
};

const GEOFENCE_TYPE_COLORS: Record<GeofenceType, string> = {
  route: 'bg-blue-100 text-blue-700',
  zone: 'bg-green-100 text-green-700',
  loading: 'bg-amber-100 text-amber-700',
  unloading: 'bg-purple-100 text-purple-700',
  fuel_station: 'bg-cyan-100 text-cyan-700',
  restricted: 'bg-red-100 text-red-700',
};

interface GeofenceFormData {
  name: string;
  geofence_type: GeofenceType;
  trip_id?: number;
  route_id?: number;
  center_lat?: number;
  center_lng?: number;
  radius_meters?: number;
  alert_threshold_meters: number;
  speed_limit_kmph?: number;
  is_active: boolean;
}

const defaultForm: GeofenceFormData = {
  name: '',
  geofence_type: 'zone',
  alert_threshold_meters: 500,
  is_active: true,
};

export default function GeofenceManagementPage() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<GeofenceFormData>(defaultForm);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['geofences', typeFilter],
    queryFn: () => geofenceService.list({
      ...(typeFilter ? { geofence_type: typeFilter } : {}),
      page_size: 100,
    }),
  });

  const geofences: Geofence[] = safeArray(data);

  const createMutation = useMutation({
    mutationFn: (payload: Partial<Geofence>) => geofenceService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geofences'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Geofence> }) => geofenceService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geofences'] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => geofenceService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geofences'] });
      setDeleteTarget(null);
    },
  });

  const resetForm = () => {
    setForm(defaultForm);
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (g: Geofence) => {
    setForm({
      name: g.name,
      geofence_type: g.geofence_type,
      trip_id: g.trip_id,
      route_id: g.route_id,
      center_lat: g.center_lat,
      center_lng: g.center_lng,
      radius_meters: g.radius_meters,
      alert_threshold_meters: g.alert_threshold_meters,
      speed_limit_kmph: g.speed_limit_kmph,
      is_active: g.is_active,
    });
    setEditingId(g.id);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, payload: form });
    } else {
      createMutation.mutate(form);
    }
  };

  // Stats
  const activeCount = geofences.filter(g => g.is_active).length;
  const routeCount = geofences.filter(g => g.geofence_type === 'route').length;
  const restrictedCount = geofences.filter(g => g.geofence_type === 'restricted').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Geofence Management</h1>
          <p className="page-subtitle">Create and manage geofence zones for route corridors, loading points, and restricted areas</p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Create Geofence
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard title="Total Geofences" value={geofences.length} icon={<MapPin className="w-5 h-5" />} color="blue" />
        <KPICard title="Active" value={activeCount} icon={<Shield className="w-5 h-5" />} color="green" />
        <KPICard title="Route Corridors" value={routeCount} icon={<Activity className="w-5 h-5" />} color="purple" />
        <KPICard title="Restricted Zones" value={restrictedCount} icon={<AlertTriangle className="w-5 h-5" />} color="red" />
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-gray-400" />
        <select className="input w-48" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          {Object.entries(GEOFENCE_TYPE_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      {/* Geofence List */}
      {isLoading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : geofences.length === 0 ? (
        <EmptyState
          icon={<MapPin className="w-12 h-12 text-gray-300" />}
          title="No geofences found"
          description="Create geofence zones to monitor vehicle routes and restricted areas"
          action={<button className="btn btn-primary" onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-1" /> Create Geofence</button>}
        />
      ) : (
        <div className="space-y-3">
          {geofences.map((g) => (
            <div key={g.id} className="card">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${g.geofence_type === 'restricted' ? 'bg-red-100' : 'bg-blue-100'}`}>
                    {g.geofence_type === 'restricted' ? (
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    ) : g.radius_meters ? (
                      <Circle className="w-5 h-5 text-blue-600" />
                    ) : (
                      <MapPin className="w-5 h-5 text-blue-600" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{g.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${GEOFENCE_TYPE_COLORS[g.geofence_type]}`}>
                        {GEOFENCE_TYPE_LABELS[g.geofence_type]}
                      </span>
                      {g.is_active ? (
                        <span className="flex items-center gap-1 text-xs text-green-600"><Eye className="w-3 h-3" /> Active</span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-gray-400"><EyeOff className="w-3 h-3" /> Inactive</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      {g.radius_meters && (
                        <span><Target className="w-3 h-3 inline mr-1" />Radius: {g.radius_meters}m</span>
                      )}
                      <span>Alert threshold: {g.alert_threshold_meters}m</span>
                      {g.speed_limit_kmph && (
                        <span>Speed limit: {g.speed_limit_kmph} km/h</span>
                      )}
                      {g.center_lat && g.center_lng && (
                        <span>Center: {g.center_lat.toFixed(4)}°, {g.center_lng.toFixed(4)}°</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 hover:bg-gray-100 rounded-lg" onClick={() => handleEdit(g)} title="Edit">
                    <Edit className="w-4 h-4 text-gray-500" />
                  </button>
                  <button className="p-2 hover:bg-red-50 rounded-lg" onClick={() => setDeleteTarget(g.id)} title="Delete">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                  <button className="p-2 hover:bg-gray-100 rounded-lg" onClick={() => setExpandedId(expandedId === g.id ? null : g.id)}>
                    {expandedId === g.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {expandedId === g.id && (
                <div className="border-t px-4 py-3 bg-gray-50">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div><span className="text-gray-500">Type:</span> <span className="font-medium">{GEOFENCE_TYPE_LABELS[g.geofence_type]}</span></div>
                    <div><span className="text-gray-500">Alert Threshold:</span> <span className="font-medium">{g.alert_threshold_meters}m</span></div>
                    {g.radius_meters && <div><span className="text-gray-500">Radius:</span> <span className="font-medium">{g.radius_meters}m</span></div>}
                    {g.speed_limit_kmph && <div><span className="text-gray-500">Speed Limit:</span> <span className="font-medium">{g.speed_limit_kmph} km/h</span></div>}
                    {g.trip_id && <div><span className="text-gray-500">Trip ID:</span> <span className="font-medium">#{g.trip_id}</span></div>}
                    {g.route_id && <div><span className="text-gray-500">Route ID:</span> <span className="font-medium">#{g.route_id}</span></div>}
                    {g.polygon && g.polygon.length > 0 && (
                      <div className="col-span-2"><span className="text-gray-500">Polygon Points:</span> <span className="font-medium">{g.polygon.length} vertices</span></div>
                    )}
                    <div><span className="text-gray-500">Created:</span> <span className="font-medium">{new Date(g.created_at).toLocaleDateString()}</span></div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={showForm} onClose={resetForm} title={editingId ? 'Edit Geofence' : 'Create Geofence'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Name *</label>
              <input className="input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Chennai Loading Zone" />
            </div>
            <div>
              <label className="label">Type *</label>
              <select className="input" required value={form.geofence_type} onChange={e => setForm({ ...form, geofence_type: e.target.value as GeofenceType })}>
                {Object.entries(GEOFENCE_TYPE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Center Latitude</label>
              <input className="input" type="number" step="any" value={form.center_lat ?? ''} onChange={e => setForm({ ...form, center_lat: e.target.value ? parseFloat(e.target.value) : undefined })} placeholder="11.0168" />
            </div>
            <div>
              <label className="label">Center Longitude</label>
              <input className="input" type="number" step="any" value={form.center_lng ?? ''} onChange={e => setForm({ ...form, center_lng: e.target.value ? parseFloat(e.target.value) : undefined })} placeholder="76.9558" />
            </div>
            <div>
              <label className="label">Radius (meters)</label>
              <input className="input" type="number" value={form.radius_meters ?? ''} onChange={e => setForm({ ...form, radius_meters: e.target.value ? parseInt(e.target.value) : undefined })} placeholder="500" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Alert Threshold (m) *</label>
              <input className="input" type="number" required value={form.alert_threshold_meters} onChange={e => setForm({ ...form, alert_threshold_meters: parseInt(e.target.value) || 500 })} />
            </div>
            <div>
              <label className="label">Speed Limit (km/h)</label>
              <input className="input" type="number" value={form.speed_limit_kmph ?? ''} onChange={e => setForm({ ...form, speed_limit_kmph: e.target.value ? parseInt(e.target.value) : undefined })} placeholder="80" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="h-4 w-4 rounded" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                <span className="text-sm font-medium text-gray-700">Active</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Trip ID (optional)</label>
              <input className="input" type="number" value={form.trip_id ?? ''} onChange={e => setForm({ ...form, trip_id: e.target.value ? parseInt(e.target.value) : undefined })} placeholder="Link to trip" />
            </div>
            <div>
              <label className="label">Route ID (optional)</label>
              <input className="input" type="number" value={form.route_id ?? ''} onChange={e => setForm({ ...form, route_id: e.target.value ? parseInt(e.target.value) : undefined })} placeholder="Link to route" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : editingId ? 'Update Geofence' : 'Create Geofence'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
        title="Delete Geofence"
        message="Are you sure you want to delete this geofence? This action cannot be undone."
        confirmLabel="Delete"
        type="danger"
      />
    </div>
  );
}
