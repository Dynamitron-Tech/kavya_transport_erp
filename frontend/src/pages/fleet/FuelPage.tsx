import { handleApiError } from '../../utils/handleApiError';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import DataTable, { Column } from '@/components/common/DataTable';
import { Modal } from '@/components/common/Modal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { SubmitButton } from '@/components/common/SubmitButton';
import api from '@/services/api';
import { tripService } from '@/services/dataService';
import { safeArray } from '@/utils/helpers';
import { Pencil, Trash2 } from 'lucide-react';

type FuelItem = {
  id: number;
  fill_date: string;
  vehicle_id: number;
  vehicle_number?: string;
  fuel_station?: string;
  litres_filled?: number;
  rate_per_litre?: number;
  total_amount?: number;
  odometer_reading?: number;
  km_per_litre?: number;
};

const emptyForm = {
  vehicle_id: '',
  trip_id: '',
  fill_date: new Date().toISOString().slice(0, 10),
  fuel_station: '',
  litres_filled: '',
  rate_per_litre: '',
  odometer_reading: '',
};

export default function FuelPage() {
  const qc = useQueryClient();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<FuelItem | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['fuel-entries'],
    queryFn: () => api.get('/fuel', { params: { page: 1, limit: 200 } }),
    enabled: true,
  });

  const { data: vehicles } = useQuery({
    queryKey: ['fuel-vehicles'],
    queryFn: () => api.get('/vehicles', { params: { page: 1, limit: 100 } }),
    enabled: true,
  });

  const { data: trips } = useQuery({
    queryKey: ['fuel-trips'],
    queryFn: () => api.get('/trips', { params: { page: 1, limit: 100 } }),
    enabled: true,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.trip_id) {
        throw new Error('Trip selection is required.');
      }
      return tripService.addFuelEntry(Number(form.trip_id), {
        fuel_date: `${form.fill_date}T00:00:00`,
        fuel_type: 'diesel',
        quantity_litres: Number(form.litres_filled || 0),
        rate_per_litre: Number(form.rate_per_litre || 0),
        total_amount: totalAmount,
        odometer_reading: Number(form.odometer_reading || 0),
        pump_name: form.fuel_station,
        payment_mode: 'cash',
      });
    },
    onSuccess: () => {
      toast.success('Fuel entry created successfully.');
      setIsCreateOpen(false);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ['fuel-entries'] });
      qc.invalidateQueries({ queryKey: ['fleet-fuel-records'] });
      qc.invalidateQueries({ queryKey: ['fleet-fuel-summary'] });
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editItem) return;
      const payload: any = {
        vehicle_id: Number(form.vehicle_id),
        trip_id: form.trip_id ? Number(form.trip_id) : undefined,
        fill_date: form.fill_date,
        fuel_station: form.fuel_station,
        litres_filled: Number(form.litres_filled || 0),
        rate_per_litre: Number(form.rate_per_litre || 0),
        total_amount: totalAmount,
        odometer_reading: Number(form.odometer_reading || 0),
      };
      return api.put(`/fuel/${editItem.id}`, payload);
    },
    onSuccess: () => {
      toast.success('Fuel entry updated successfully.');
      setEditItem(null);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ['fuel-entries'] });
      qc.invalidateQueries({ queryKey: ['fleet-fuel-records'] });
      qc.invalidateQueries({ queryKey: ['fleet-fuel-summary'] });
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/fuel/${id}`),
    onSuccess: () => {
      toast.success('Fuel entry deleted successfully.');
      qc.invalidateQueries({ queryKey: ['fuel-entries'] });
      qc.invalidateQueries({ queryKey: ['fleet-fuel-records'] });
      qc.invalidateQueries({ queryKey: ['fleet-fuel-summary'] });
    },
    onError: (error) => {
      handleApiError(error, 'Operation failed');
    },
  });

  const rows = safeArray<any>((data as any)?.items ?? data).map((item: any) => ({
    id: item.id,
    fill_date: item.fill_date || item.date,
    vehicle_id: Number(item.vehicle_id || 0),
    vehicle_number: item.vehicle_number || item.vehicle?.registration_number || `#${item.vehicle_id}`,
    fuel_station: item.fuel_station || item.station,
    litres_filled: Number(item.litres_filled || item.litres || 0),
    rate_per_litre: Number(item.rate_per_litre || item.cost_per_litre || 0),
    total_amount: Number(item.total_amount || 0),
    odometer_reading: Number(item.odometer_reading || item.odometer || 0),
    km_per_litre: Number(item.km_per_litre || item.mileage || 0),
  })) as FuelItem[];

  const vehicleOptions = safeArray<any>((vehicles as any)?.items ?? vehicles);
  const tripOptions = safeArray<any>((trips as any)?.items ?? trips);
  const totalAmount = useMemo(() => Number(form.litres_filled || 0) * Number(form.rate_per_litre || 0), [form.litres_filled, form.rate_per_litre]);

  const openCreate = () => {
    setForm(emptyForm);
    setEditItem(null);
    setIsCreateOpen(true);
  };

  const openEdit = (item: FuelItem) => {
    setEditItem(item);
    setForm({
      vehicle_id: String(item.vehicle_id || ''),
      trip_id: '',
      fill_date: item.fill_date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      fuel_station: item.fuel_station || '',
      litres_filled: String(item.litres_filled || ''),
      rate_per_litre: String(item.rate_per_litre || ''),
      odometer_reading: String(item.odometer_reading || ''),
    });
    setIsCreateOpen(true);
  };

  const getMileageBadge = (kmpl: number) => {
    if (kmpl > 4) return 'bg-green-50 text-green-700';
    if (kmpl >= 2.5) return 'bg-amber-50 text-amber-700';
    return 'bg-red-50 text-red-700';
  };

  const columns: Column<FuelItem>[] = [
    { key: 'fill_date', header: 'Date', render: (r) => new Date(r.fill_date).toLocaleDateString('en-IN') },
    { key: 'vehicle_number', header: 'Vehicle', render: (r) => <span className="font-medium">{r.vehicle_number}</span> },
    { key: 'fuel_station', header: 'Station' },
    { key: 'litres_filled', header: 'Litres', render: (r) => `${Number(r.litres_filled || 0).toFixed(2)} L` },
    { key: 'rate_per_litre', header: 'Rate', render: (r) => `₹${Number(r.rate_per_litre || 0).toFixed(2)}` },
    { key: 'total_amount', header: 'Total Amount', render: (r) => `₹${Number(r.total_amount || 0).toLocaleString('en-IN')}` },
    { key: 'odometer_reading', header: 'Odometer', render: (r) => `${Number(r.odometer_reading || 0).toLocaleString('en-IN')} km` },
    {
      key: 'km_per_litre',
      header: 'KM/L',
      render: (r) => <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getMileageBadge(Number(r.km_per_litre || 0))}`}>{Number(r.km_per_litre || 0).toFixed(2)} km/l</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => openEdit(r)} className="p-1.5 rounded-md hover:bg-gray-100" title="Edit"><Pencil size={14} /></button>
          <button type="button" onClick={() => setDeleteId(r.id)} className="p-1.5 rounded-md hover:bg-red-50 text-red-600" title="Delete"><Trash2 size={14} /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fuel Management</h1>
          <p className="page-subtitle">Track fuel entries, cost and mileage</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        total={rows.length}
        isLoading={isLoading}
        searchPlaceholder="Search by station or vehicle..."
        onSearch={() => {}}
        onRefresh={() => refetch()}
        onAdd={openCreate}
        addLabel="Add Fuel Entry"
      />

      <Modal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setEditItem(null);
          setForm(emptyForm);
        }}
        title={editItem ? 'Edit Fuel Entry' : 'Add Fuel Entry'}
        size="lg"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (editItem) updateMutation.mutate();
            else createMutation.mutate();
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Vehicle</label>
              <select className="input-field" value={form.vehicle_id} onChange={(e) => setForm((p) => ({ ...p, vehicle_id: e.target.value }))} required>
                <option value="">Select vehicle</option>
                {vehicleOptions.map((v: any) => (
                  <option key={v.id} value={v.id}>{v.registration_number || v.vehicle_number || `#${v.id}`}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Trip</label>
              <select className="input-field" value={form.trip_id} onChange={(e) => setForm((p) => ({ ...p, trip_id: e.target.value }))} required>
                <option value="">Select trip</option>
                {tripOptions.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.trip_number || `Trip #${t.id}`}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Fill Date</label>
              <input type="date" className="input-field" value={form.fill_date} onChange={(e) => setForm((p) => ({ ...p, fill_date: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Fuel Station</label>
              <input className="input-field" value={form.fuel_station} onChange={(e) => setForm((p) => ({ ...p, fuel_station: e.target.value }))} required />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Litres Filled</label>
              <input type="number" step="0.01" className="input-field" value={form.litres_filled} onChange={(e) => setForm((p) => ({ ...p, litres_filled: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Rate per Litre</label>
              <input type="number" step="0.01" className="input-field" value={form.rate_per_litre} onChange={(e) => setForm((p) => ({ ...p, rate_per_litre: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Total Amount</label>
              <input className="input-field" value={`₹${totalAmount.toFixed(2)}`} disabled />
            </div>
          </div>

          <div>
            <div>
              <label className="label">Odometer Reading</label>
              <input type="number" className="input-field" value={form.odometer_reading} onChange={(e) => setForm((p) => ({ ...p, odometer_reading: e.target.value }))} required />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setIsCreateOpen(false)}>Cancel</button>
            <SubmitButton isLoading={createMutation.isPending || updateMutation.isPending} label={editItem ? 'Save Changes' : 'Add Fuel Entry'} />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleteId !== null}
        title="Delete Fuel Entry"
        message="Delete this fuel entry? This action cannot be undone."
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

