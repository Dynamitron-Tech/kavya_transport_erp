import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fuel, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { fuelPumpService } from '@/services/fuelPumpService';
import api from '@/services/api';

export default function PumpIssueFuelPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: tanksData } = useQuery({
    queryKey: ['fuel-tanks'],
    queryFn: fuelPumpService.getTanks,
  });

  const { data: vehiclesData } = useQuery({
    queryKey: ['vehicles-list'],
    queryFn: () => api.get('/vehicles', { params: { limit: 200 } }),
  });

  const { data: driversData } = useQuery({
    queryKey: ['drivers-list'],
    queryFn: () => api.get('/drivers', { params: { limit: 200 } }),
  });

  const tanks = tanksData?.data || [];
  const vehicles = vehiclesData?.data || [];
  const drivers = driversData?.data || [];

  const [form, setForm] = useState({
    tank_id: '',
    vehicle_id: '',
    driver_id: '',
    trip_id: '',
    fuel_type: 'diesel',
    quantity_litres: '',
    rate_per_litre: '89.50',
    odometer_reading: '',
    receipt_number: '',
    remarks: '',
    issued_at: new Date().toISOString().slice(0, 16),
  });

  const mutation = useMutation({
    mutationFn: (data: any) => fuelPumpService.issueFuel(data),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['pump-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['fuel-issues'] });

      if (response?.data?.theft_alert) {
        toast.error(`⚠️ Anomaly Alert: ${response.data.theft_alert.description}`, { duration: 8000 });
      } else {
        toast.success('Fuel issued successfully');
      }
      navigate('/pump/log');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to issue fuel');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tank_id || !form.vehicle_id || !form.quantity_litres || !form.rate_per_litre) {
      toast.error('Please fill required fields');
      return;
    }
    mutation.mutate({
      tank_id: Number(form.tank_id),
      vehicle_id: Number(form.vehicle_id),
      driver_id: form.driver_id ? Number(form.driver_id) : null,
      trip_id: form.trip_id ? Number(form.trip_id) : null,
      fuel_type: form.fuel_type,
      quantity_litres: Number(form.quantity_litres),
      rate_per_litre: Number(form.rate_per_litre),
      odometer_reading: form.odometer_reading ? Number(form.odometer_reading) : null,
      receipt_number: form.receipt_number || null,
      remarks: form.remarks || null,
      issued_at: new Date(form.issued_at).toISOString(),
    });
  };

  const totalAmount = (Number(form.quantity_litres) || 0) * (Number(form.rate_per_litre) || 0);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Fuel className="text-primary-600" size={24} />
          <h1 className="text-xl font-bold text-gray-900">Issue Fuel</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tank *</label>
              <select
                value={form.tank_id}
                onChange={(e) => setForm({ ...form, tank_id: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-primary-500 focus:border-primary-500"
                required
              >
                <option value="">Select tank</option>
                {tanks.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({Number(t.current_stock_litres).toLocaleString()}L available)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle *</label>
              <select
                value={form.vehicle_id}
                onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-primary-500 focus:border-primary-500"
                required
              >
                <option value="">Select vehicle</option>
                {vehicles.map((v: any) => (
                  <option key={v.id} value={v.id}>
                    {v.registration_number} - {v.make} {v.model}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Driver</label>
              <select
                value={form.driver_id}
                onChange={(e) => setForm({ ...form, driver_id: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Select driver (optional)</option>
                {drivers.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.first_name} {d.last_name} - {d.phone}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Type</label>
              <select
                value={form.fuel_type}
                onChange={(e) => setForm({ ...form, fuel_type: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="diesel">Diesel</option>
                <option value="petrol">Petrol</option>
                <option value="cng">CNG</option>
                <option value="def">DEF</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity (Litres) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={form.quantity_litres}
                onChange={(e) => setForm({ ...form, quantity_litres: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rate / Litre (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={form.rate_per_litre}
                onChange={(e) => setForm({ ...form, rate_per_litre: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Odometer Reading</label>
              <input
                type="number"
                step="0.01"
                value={form.odometer_reading}
                onChange={(e) => setForm({ ...form, odometer_reading: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-primary-500 focus:border-primary-500"
                placeholder="Current km reading"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time *</label>
              <input
                type="datetime-local"
                value={form.issued_at}
                onChange={(e) => setForm({ ...form, issued_at: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Number</label>
              <input
                type="text"
                value={form.receipt_number}
                onChange={(e) => setForm({ ...form, receipt_number: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trip ID</label>
              <input
                type="number"
                value={form.trip_id}
                onChange={(e) => setForm({ ...form, trip_id: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-primary-500 focus:border-primary-500"
                placeholder="Optional"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
            <textarea
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-primary-500 focus:border-primary-500"
              rows={2}
            />
          </div>

          {/* Total Display */}
          <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Total Amount</span>
            <span className="text-2xl font-bold text-gray-900">₹{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 py-2.5 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 py-2.5 px-4 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50"
            >
              {mutation.isPending ? 'Issuing...' : 'Issue Fuel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
