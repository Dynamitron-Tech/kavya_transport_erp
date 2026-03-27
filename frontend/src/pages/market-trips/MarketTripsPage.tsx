import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { marketTripService, supplierService } from '@/services/dataService';
import DataTable, { Column } from '@/components/common/DataTable';
import { Modal } from '@/components/common/Modal';
import { SubmitButton } from '@/components/common/SubmitButton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { getStatusColor, getStatusLabel } from '@/services/workflowService';
import { safeArray } from '@/utils/helpers';
import { handleApiError } from '../../utils/handleApiError';
import type { MarketTrip, MarketTripStatus, Supplier } from '@/types';
import { Plus, Search, Filter, Truck, TrendingUp } from 'lucide-react';

const STATUS_OPTIONS: { value: MarketTripStatus | ''; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'settled', label: 'Settled' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function MarketTripsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<MarketTrip | null>(null);

  const [createPayload, setCreatePayload] = useState({
    job_id: '',
    supplier_id: '',
    client_rate: '',
    contractor_rate: '',
    vehicle_registration: '',
    driver_name: '',
    driver_phone: '',
  });

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
        job_id: Number(createPayload.job_id),
        supplier_id: Number(createPayload.supplier_id),
        client_rate: Number(createPayload.client_rate),
        contractor_rate: Number(createPayload.contractor_rate),
        vehicle_registration: createPayload.vehicle_registration || undefined,
        driver_name: createPayload.driver_name || undefined,
        driver_phone: createPayload.driver_phone || undefined,
      } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['market-trips'] });
      toast.success('Market trip created');
      setCreateOpen(false);
      setCreatePayload({ job_id: '', supplier_id: '', client_rate: '', contractor_rate: '', vehicle_registration: '', driver_name: '', driver_phone: '' });
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

  // Stats
  const totalTrips = trips.length;
  const activeTrips = trips.filter((t) => ['assigned', 'in_transit'].includes(t.status)).length;
  const totalMargin = trips.reduce((sum, t) => sum + (Number((t as any).margin) || (Number(t.client_rate) - Number(t.contractor_rate))), 0);

  const columns: Column<MarketTrip>[] = [
    {
      key: 'job_id',
      header: 'Job',
      render: (row) => <span className="font-mono text-sm">Job #{row.job_id}</span>,
    },
    {
      key: 'supplier_id',
      header: 'Supplier',
      render: (row) => (
        <span className="text-sm">{(row as any).supplier?.name || `Supplier #${row.supplier_id}`}</span>
      ),
    },
    {
      key: 'vehicle_registration',
      header: 'Vehicle',
      render: (row) => (
        <span className="font-mono text-sm">{row.vehicle_registration || '—'}</span>
      ),
    },
    {
      key: 'client_rate',
      header: 'Client Rate',
      render: (row) => <span className="text-sm text-right">₹{Number(row.client_rate || 0).toLocaleString('en-IN')}</span>,
    },
    {
      key: 'contractor_rate',
      header: 'Contractor Rate',
      render: (row) => <span className="text-sm text-right">₹{Number(row.contractor_rate || 0).toLocaleString('en-IN')}</span>,
    },
    {
      key: 'margin' as any,
      header: 'Margin',
      render: (row) => {
        const margin = Number(row.client_rate || 0) - Number(row.contractor_rate || 0);
        return (
          <span className={`text-sm font-medium ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ₹{margin.toLocaleString('en-IN')}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const sc = getStatusColor(row.status);
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>
            {getStatusLabel(row.status)}
          </span>
        );
      },
    },
    {
      key: 'actions' as any,
      header: '',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/market-trips/${row.id}`); }}
            className="text-xs text-primary-600 hover:text-primary-800 font-medium"
          >
            View
          </button>
          {['pending', 'assigned'].includes(row.status) && (
            <button
              onClick={(e) => { e.stopPropagation(); setCancelTarget(row); }}
              className="text-xs text-red-600 hover:text-red-800 font-medium"
            >
              Cancel
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Market Trips</h1>
          <p className="text-sm text-gray-500 mt-1">Manage hired/market truck trips</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-white hover:bg-primary-700 text-sm font-medium shadow-sm"
        >
          <Plus size={16} /> New Market Trip
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
            <Truck size={20} className="text-orange-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Trips</p>
            <p className="text-lg font-bold text-gray-900">{totalTrips}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <Truck size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Active Trips</p>
            <p className="text-lg font-bold text-gray-900">{activeTrips}</p>
          </div>
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
          <input
            type="text"
            placeholder="Search by job, vehicle, supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
          />
        </div>
        <div className="relative">
          <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-9 pr-8 py-2 rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm appearance-none"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={trips}
        isLoading={isLoading}
        onRowClick={(row) => navigate(`/market-trips/${row.id}`)}
        emptyMessage="No market trips found"
      />

      {/* Create Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create Market Trip">
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job ID *</label>
              <input
                type="number"
                required
                value={createPayload.job_id}
                onChange={(e) => setCreatePayload({ ...createPayload, job_id: e.target.value })}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                placeholder="e.g. 101"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier *</label>
              <select
                required
                value={createPayload.supplier_id}
                onChange={(e) => setCreatePayload({ ...createPayload, supplier_id: e.target.value })}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
              >
                <option value="">Select supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Rate (₹) *</label>
              <input
                type="number"
                required
                min="0"
                value={createPayload.client_rate}
                onChange={(e) => setCreatePayload({ ...createPayload, client_rate: e.target.value })}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contractor Rate (₹) *</label>
              <input
                type="number"
                required
                min="0"
                value={createPayload.contractor_rate}
                onChange={(e) => setCreatePayload({ ...createPayload, contractor_rate: e.target.value })}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
              />
            </div>
          </div>

          {Number(createPayload.client_rate) > 0 && Number(createPayload.contractor_rate) > 0 && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <span className="text-gray-500">Margin: </span>
              <span className={`font-medium ${Number(createPayload.client_rate) - Number(createPayload.contractor_rate) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ₹{(Number(createPayload.client_rate) - Number(createPayload.contractor_rate)).toLocaleString('en-IN')}
              </span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Registration</label>
            <input
              type="text"
              value={createPayload.vehicle_registration}
              onChange={(e) => setCreatePayload({ ...createPayload, vehicle_registration: e.target.value.toUpperCase() })}
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
              placeholder="e.g. TN01AB1234"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Driver Name</label>
              <input
                type="text"
                value={createPayload.driver_name}
                onChange={(e) => setCreatePayload({ ...createPayload, driver_name: e.target.value })}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Driver Phone</label>
              <input
                type="text"
                value={createPayload.driver_phone}
                onChange={(e) => setCreatePayload({ ...createPayload, driver_phone: e.target.value })}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
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
        message={`Are you sure you want to cancel the market trip for Job #${cancelTarget?.job_id}?`}
        confirmLabel="Cancel Trip"
        isDangerous
      />
    </div>
  );
}
