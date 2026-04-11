import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { marketTripService, supplierService, documentService } from '@/services/dataService';
import { Modal } from '@/components/common/Modal';
import { SubmitButton } from '@/components/common/SubmitButton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { getStatusColor, getStatusLabel } from '@/services/workflowService';
import { safeArray } from '@/utils/helpers';
import { handleApiError } from '../../utils/handleApiError';
import type { MarketTrip, MarketTripStatus, Supplier } from '@/types';
import {
  Plus, Search, Filter, Truck, TrendingUp, Upload, Loader2,
  CheckCircle, ChevronDown, ChevronUp, Car, User, MapPin,
  Phone, CreditCard, Calendar, Hash, Fuel, Settings,
} from 'lucide-react';

const STATUS_OPTIONS: { value: MarketTripStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'settled', label: 'Settled' },
  { value: 'cancelled', label: 'Cancelled' },
];

const VEHICLE_TYPES = ['Truck', 'Trailer', 'Tanker', 'Container', 'LCV', 'HCV', 'Tipper', 'Other'];
const FUEL_TYPES = ['Diesel', 'Petrol', 'CNG', 'Electric', 'LPG'];

interface CreatePayload {
  job_id: string; supplier_id: string; client_rate: string; contractor_rate: string; advance_amount: string;
  vehicle_registration: string; vehicle_type: string; fuel_type: string; vehicle_make: string;
  vehicle_model: string; year_of_manufacture: string; chassis_number: string; engine_number: string; rc_file_url: string;
  driver_name: string; driver_phone: string; driver_alt_phone: string; driver_address: string;
  driver_license: string; driver_license_issue: string; driver_license_valid: string; dl_file_url: string;
}

const EMPTY: CreatePayload = {
  job_id: '', supplier_id: '', client_rate: '', contractor_rate: '', advance_amount: '',
  vehicle_registration: '', vehicle_type: '', fuel_type: '', vehicle_make: '',
  vehicle_model: '', year_of_manufacture: '', chassis_number: '', engine_number: '', rc_file_url: '',
  driver_name: '', driver_phone: '', driver_alt_phone: '', driver_address: '',
  driver_license: '', driver_license_issue: '', driver_license_valid: '', dl_file_url: '',
};

function SectionHeader({ title, icon: Icon, expanded, onToggle }: { title: string; icon: any; expanded: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle}
      className="w-full flex items-center justify-between py-3 px-4 bg-gray-50 hover:bg-gray-100 transition-colors">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center">
          <Icon size={14} className="text-primary-600" />
        </div>
        <span className="text-sm font-semibold text-gray-800">{title}</span>
      </div>
      {expanded ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
    </button>
  );
}

function OcrUploadZone({ label, docType, onExtracted, fileUrl, isLoading, setLoading }: {
  label: string; docType: string; onExtracted: (data: Record<string, any>, url: string) => void;
  fileUrl: string; isLoading: boolean; setLoading: (v: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('document_type', docType);
      const result = await documentService.extract(fd);
      const extracted = result?.data ?? result;
      let storedUrl = '';
      try {
        const upFd = new FormData();
        upFd.append('file', file);
        upFd.append('document_type', docType);
        upFd.append('entity_type', 'market_trip');
        const up = await documentService.uploadFile(upFd);
        storedUrl = (up as any)?.file_url ?? (up as any)?.url ?? '';
      } catch { /* non-critical */ }
      onExtracted(extracted, storedUrl);
      toast.success('Details extracted from document!');
    } catch (err: any) {
      toast.error(err?.message ?? 'Extraction failed — fill details manually');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="mb-3">
      <input ref={inputRef} type="file" accept="image/*,.pdf" className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={isLoading}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed transition-colors
          ${fileUrl ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50 hover:border-primary-400 hover:bg-primary-50'}
          disabled:opacity-60`}>
        {isLoading ? <Loader2 size={17} className="text-primary-500 animate-spin flex-shrink-0" />
          : fileUrl ? <CheckCircle size={17} className="text-green-500 flex-shrink-0" />
            : <Upload size={17} className="text-gray-400 flex-shrink-0" />}
        <div className="text-left">
          <p className={`text-sm font-medium ${fileUrl ? 'text-green-700' : 'text-gray-600'}`}>
            {isLoading ? 'Extracting details…' : fileUrl ? `${label} uploaded ✓` : `Upload ${label} for auto-fill`}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Supports JPG, PNG, PDF</p>
        </div>
      </button>
    </div>
  );
}

export default function MarketTripsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<MarketTrip | null>(null);

  const [payload, setPayload] = useState<CreatePayload>(EMPTY);
  const [vehicleOpen, setVehicleOpen] = useState(true);
  const [driverOpen, setDriverOpen] = useState(true);
  const [rcLoading, setRcLoading] = useState(false);
  const [dlLoading, setDlLoading] = useState(false);

  const set = (k: keyof CreatePayload) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setPayload((p) => ({ ...p, [k]: e.target.value }));

  const handleRcExtracted = (data: Record<string, any>, url: string) =>
    setPayload((p) => ({
      ...p,
      vehicle_registration: data.registration_number ?? p.vehicle_registration,
      fuel_type: data.fuel_type ?? p.fuel_type,
      chassis_number: data.chassis_number ?? p.chassis_number,
      engine_number: data.engine_number ?? p.engine_number,
      vehicle_type: data.vehicle_class ?? p.vehicle_type,
      rc_file_url: url || p.rc_file_url,
    }));

  const handleDlExtracted = (data: Record<string, any>, url: string) => {
    const toInputDate = (v: string) => { if (!v) return ''; const parts = v.split('/'); return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : v; };
    setPayload((p) => ({
      ...p,
      driver_license: data.license_number ?? p.driver_license,
      driver_license_issue: toInputDate(data.issue_date) ?? p.driver_license_issue,
      driver_license_valid: toInputDate(data.expiry_date) ?? p.driver_license_valid,
      dl_file_url: url || p.dl_file_url,
    }));
  };

  const { data, isLoading } = useQuery({
    queryKey: ['market-trips', search, statusFilter],
    queryFn: () => marketTripService.list({ search, status: statusFilter || undefined } as any),
  });

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-select'],
    queryFn: () => supplierService.list({ limit: 500 } as any),
    staleTime: 60_000,
  });

  const trips = safeArray<MarketTrip>((data as any)?.data ?? data);
  const suppliers = safeArray<Supplier>((suppliersData as any)?.data ?? suppliersData);

  const createMutation = useMutation({
    mutationFn: () =>
      marketTripService.create({
        job_id: payload.job_id ? Number(payload.job_id) : undefined,
        supplier_id: payload.supplier_id ? Number(payload.supplier_id) : undefined,
        client_rate: Number(payload.client_rate),
        contractor_rate: Number(payload.contractor_rate),
        advance_amount: Number(payload.advance_amount || 0),
        vehicle_registration: payload.vehicle_registration || undefined,
        vehicle_type: payload.vehicle_type || undefined,
        fuel_type: payload.fuel_type || undefined,
        vehicle_make: payload.vehicle_make || undefined,
        vehicle_model: payload.vehicle_model || undefined,
        year_of_manufacture: payload.year_of_manufacture ? Number(payload.year_of_manufacture) : undefined,
        chassis_number: payload.chassis_number || undefined,
        engine_number: payload.engine_number || undefined,
        rc_file_url: payload.rc_file_url || undefined,
        driver_name: payload.driver_name || undefined,
        driver_phone: payload.driver_phone || undefined,
        driver_alt_phone: payload.driver_alt_phone || undefined,
        driver_address: payload.driver_address || undefined,
        driver_license: payload.driver_license || undefined,
        driver_license_issue: payload.driver_license_issue || undefined,
        driver_license_valid: payload.driver_license_valid || undefined,
        dl_file_url: payload.dl_file_url || undefined,
      } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['market-trips'] });
      toast.success('Market trip created');
      setCreateOpen(false);
      setPayload(EMPTY);
    },
    onError: (error) => handleApiError(error, 'Failed to create market trip'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => marketTripService.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['market-trips'] });
      toast.success('Market trip cancelled');
      setCancelTarget(null);
    },
    onError: (error) => handleApiError(error, 'Failed to cancel'),
  });

  const totalTrips = trips.length;
  const activeTrips = trips.filter((t) => ['assigned', 'in_transit'].includes(t.status)).length;
  const totalMargin = trips.reduce((sum, t) => sum + (Number((t as any).margin) || (Number(t.client_rate) - Number(t.contractor_rate))), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Market Trips</h1>
          <p className="text-sm text-gray-500 mt-1">Manage hired/market truck trips</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
            <Truck size={20} className="text-orange-600" />
          </div>
          <div><p className="text-xs text-gray-500">Total Trips</p><p className="text-lg font-bold text-gray-900">{totalTrips}</p></div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <Truck size={20} className="text-blue-600" />
          </div>
          <div><p className="text-xs text-gray-500">Active Trips</p><p className="text-lg font-bold text-gray-900">{activeTrips}</p></div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
            <TrendingUp size={20} className="text-green-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Margin</p>
            <p className={`text-lg font-bold ${totalMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>₹{totalMargin.toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search by job, vehicle, supplier..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm" />
        </div>
        <div className="relative">
          <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-9 pr-8 py-2 rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm appearance-none">
            {STATUS_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
      </div>

      {/* Trip Table */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-primary-500" /></div>
      ) : trips.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
            <Truck size={28} className="text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium">No market trips found</p>
          <button onClick={() => setCreateOpen(true)}
            className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm hover:bg-primary-700">
            <Plus size={14} /> Create First Market Trip
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Job</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Vehicle</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Driver</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Supplier</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Client Rate</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Margin</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {trips.map((trip) => {
                const sc = getStatusColor(trip.status);
                const margin = Number(trip.client_rate || 0) - Number(trip.contractor_rate || 0);
                return (
                  <tr key={trip.id} onClick={() => navigate(`/market-trips/${trip.id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors">
                    <td className="px-4 py-3">
                      {trip.job_id
                        ? <span className="font-semibold text-sm text-primary-600">Job #{trip.job_id}</span>
                        : <span className="text-sm text-gray-400 italic">No job</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Truck size={14} className="text-gray-400 flex-shrink-0" />
                        <span className="text-sm text-gray-800 font-medium">
                          {trip.vehicle_registration || '—'}
                        </span>
                        {(trip as any).vehicle_make && (
                          <span className="text-xs text-gray-400">· {(trip as any).vehicle_make} {(trip as any).vehicle_model || ''}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <User size={14} className="text-gray-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-gray-800">{trip.driver_name || '—'}</p>
                          {trip.driver_phone && <p className="text-xs text-gray-400">{trip.driver_phone}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">{(trip as any).supplier?.name || (trip.supplier_id ? `#${trip.supplier_id}` : '—')}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>
                        {getStatusLabel(trip.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold text-gray-800">₹{Number(trip.client_rate || 0).toLocaleString('en-IN')}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-semibold ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ₹{margin.toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {['pending', 'assigned'].includes(trip.status) && (
                        <button onClick={(e) => { e.stopPropagation(); setCancelTarget(trip); }}
                          className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50">
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Create Modal ── */}
      <Modal isOpen={createOpen} onClose={() => { setCreateOpen(false); setPayload(EMPTY); }} title="New Market Trip">
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
          className="space-y-4 max-h-[78vh] overflow-y-auto pr-1">

          {/* Trip Details */}
          <div className="bg-blue-50 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Trip Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Job ID</label>
                <input type="number" value={payload.job_id} onChange={set('job_id')}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                  placeholder="Optional" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Supplier</label>
                <select value={payload.supplier_id} onChange={set('supplier_id')}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm">
                  <option value="">Select supplier</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Client Rate (₹) *</label>
                <input type="number" required min="0" value={payload.client_rate} onChange={set('client_rate')}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Contractor Rate (₹) *</label>
                <input type="number" required min="0" value={payload.contractor_rate} onChange={set('contractor_rate')}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm" />
              </div>
            </div>
            {Number(payload.client_rate) > 0 && Number(payload.contractor_rate) > 0 && (
              <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2">
                <TrendingUp size={13} className={Number(payload.client_rate) >= Number(payload.contractor_rate) ? 'text-green-500' : 'text-red-500'} />
                <span className="text-xs text-gray-500">Margin:</span>
                <span className={`text-sm font-semibold ${Number(payload.client_rate) - Number(payload.contractor_rate) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ₹{(Number(payload.client_rate) - Number(payload.contractor_rate)).toLocaleString('en-IN')}
                </span>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Advance Amount (₹)</label>
              <input type="number" min="0" value={payload.advance_amount} onChange={set('advance_amount')}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                placeholder="0" />
            </div>
          </div>

          {/* Vehicle Section */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <SectionHeader title="Vehicle Details" icon={Car} expanded={vehicleOpen} onToggle={() => setVehicleOpen((v) => !v)} />
            {vehicleOpen && (
              <div className="p-4 space-y-3">
                <OcrUploadZone label="RC (Registration Certificate)" docType="rc"
                  onExtracted={handleRcExtracted} fileUrl={payload.rc_file_url}
                  isLoading={rcLoading} setLoading={setRcLoading} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <Hash size={10} /> Registration Number
                    </label>
                    <input type="text" value={payload.vehicle_registration}
                      onChange={(e) => setPayload((p) => ({ ...p, vehicle_registration: e.target.value.toUpperCase() }))}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm font-mono"
                      placeholder="e.g. TN01AB1234" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <Truck size={10} /> Vehicle Type
                    </label>
                    <select value={payload.vehicle_type} onChange={set('vehicle_type')}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm">
                      <option value="">Select type</option>
                      {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <Fuel size={10} /> Fuel Type
                    </label>
                    <select value={payload.fuel_type} onChange={set('fuel_type')}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm">
                      <option value="">Select fuel</option>
                      {FUEL_TYPES.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <Settings size={10} /> Year of Manufacture
                    </label>
                    <input type="number" min="1990" max="2030" value={payload.year_of_manufacture} onChange={set('year_of_manufacture')}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                      placeholder="e.g. 2019" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Make</label>
                    <input type="text" value={payload.vehicle_make} onChange={set('vehicle_make')}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                      placeholder="e.g. TATA" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Model</label>
                    <input type="text" value={payload.vehicle_model} onChange={set('vehicle_model')}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                      placeholder="e.g. Prima 4028" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Chassis Number</label>
                    <input type="text" value={payload.chassis_number} onChange={set('chassis_number')}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm font-mono"
                      placeholder="Auto-filled from RC" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Engine Number</label>
                    <input type="text" value={payload.engine_number} onChange={set('engine_number')}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm font-mono"
                      placeholder="Auto-filled from RC" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Driver Section */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <SectionHeader title="Driver Details" icon={User} expanded={driverOpen} onToggle={() => setDriverOpen((v) => !v)} />
            {driverOpen && (
              <div className="p-4 space-y-3">
                <OcrUploadZone label="Driving Licence (DL)" docType="driving_license"
                  onExtracted={handleDlExtracted} fileUrl={payload.dl_file_url}
                  isLoading={dlLoading} setLoading={setDlLoading} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <User size={10} /> Driver Name
                    </label>
                    <input type="text" value={payload.driver_name} onChange={set('driver_name')}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                      placeholder="Auto-filled from DL" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <Phone size={10} /> Phone Number
                    </label>
                    <input type="tel" value={payload.driver_phone} onChange={set('driver_phone')}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                      placeholder="+91 XXXXX XXXXX" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <Phone size={10} /> Alternate Phone
                    </label>
                    <input type="tel" value={payload.driver_alt_phone} onChange={set('driver_alt_phone')}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                      placeholder="Emergency contact" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <CreditCard size={10} /> Licence Number
                    </label>
                    <input type="text" value={payload.driver_license} onChange={set('driver_license')}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm font-mono"
                      placeholder="Auto-filled from DL" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <Calendar size={10} /> Licence Issue Date
                    </label>
                    <input type="text" value={payload.driver_license_issue} onChange={set('driver_license_issue')}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                      placeholder="DD/MM/YYYY" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                      <Calendar size={10} /> Valid Until
                    </label>
                    <input type="text" value={payload.driver_license_valid} onChange={set('driver_license_valid')}
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                      placeholder="DD/MM/YYYY" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <MapPin size={10} /> Address
                  </label>
                  <textarea rows={2} value={payload.driver_address}
                    onChange={(e) => setPayload((p) => ({ ...p, driver_address: e.target.value }))}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm resize-none"
                    placeholder="Auto-filled from DL or enter manually" />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t sticky bottom-0 bg-white py-3">
            <button type="button" onClick={() => { setCreateOpen(false); setPayload(EMPTY); }}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
              Cancel
            </button>
            <SubmitButton isLoading={createMutation.isPending} label="Create Market Trip" />
          </div>
        </form>
      </Modal>

      {/* Cancel Confirm */}
      <ConfirmDialog
        isOpen={!!cancelTarget}
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => cancelTarget && cancelMutation.mutate(cancelTarget.id)}
        title="Cancel Market Trip"
        message={`Are you sure you want to cancel the market trip${cancelTarget?.job_id ? ` for Job #${cancelTarget.job_id}` : ''}?`}
        confirmLabel="Cancel Trip"
        isDangerous
      />
    </div>
  );
}
