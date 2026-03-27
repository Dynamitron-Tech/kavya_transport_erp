import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { marketTripService } from '@/services/dataService';
import { Modal } from '@/components/common/Modal';
import { SubmitButton } from '@/components/common/SubmitButton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { getStatusLabel } from '@/services/workflowService';
import { handleApiError } from '../../utils/handleApiError';
import type { MarketTripStatus } from '@/types';
import {
  ArrowLeft, Truck, User, IndianRupee,
  CheckCircle, XCircle, Play, PackageCheck, CreditCard
} from 'lucide-react';

const STATUS_FLOW: MarketTripStatus[] = ['pending', 'assigned', 'in_transit', 'delivered', 'settled'];

export default function MarketTripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [assignOpen, setAssignOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  const [assignPayload, setAssignPayload] = useState({
    vehicle_registration: '',
    driver_name: '',
    driver_phone: '',
    driver_license: '',
  });
  const [settlePayload, setSettlePayload] = useState({
    settlement_reference: '',
    settlement_remarks: '',
  });

  const { data: trip, isLoading } = useQuery({
    queryKey: ['market-trip', id],
    queryFn: () => marketTripService.get(Number(id)),
    enabled: !!id,
  });

  const { data: pnl } = useQuery({
    queryKey: ['market-trip-pnl', id],
    queryFn: () => marketTripService.getPnl(Number(id)),
    enabled: !!id,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['market-trip', id] });
    qc.invalidateQueries({ queryKey: ['market-trip-pnl', id] });
    qc.invalidateQueries({ queryKey: ['market-trips'] });
  };

  const assignMutation = useMutation({
    mutationFn: () => marketTripService.assign(Number(id), assignPayload),
    onSuccess: () => { invalidate(); toast.success('Vehicle & driver assigned'); setAssignOpen(false); },
    onError: (error) => handleApiError(error, 'Failed to assign'),
  });

  const startMutation = useMutation({
    mutationFn: () => marketTripService.startTransit(Number(id)),
    onSuccess: () => { invalidate(); toast.success('Trip started — In Transit'); },
    onError: (error) => handleApiError(error, 'Failed to start transit'),
  });

  const deliverMutation = useMutation({
    mutationFn: () => marketTripService.deliver(Number(id)),
    onSuccess: () => { invalidate(); toast.success('Delivery completed'); },
    onError: (error) => handleApiError(error, 'Failed to mark delivered'),
  });

  const settleMutation = useMutation({
    mutationFn: () => marketTripService.settle(Number(id), settlePayload),
    onSuccess: () => { invalidate(); toast.success('Trip settled'); setSettleOpen(false); },
    onError: (error) => handleApiError(error, 'Failed to settle'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => marketTripService.cancel(Number(id)),
    onSuccess: () => { invalidate(); toast.success('Trip cancelled'); setCancelConfirm(false); },
    onError: (error) => handleApiError(error, 'Failed to cancel'),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;
  }

  if (!trip) {
    return <div className="text-center py-12 text-gray-500">Market trip not found</div>;
  }

  const t: any = trip;
  const p: any = pnl;
  const currentIdx = STATUS_FLOW.indexOf(t.status);
  const margin = Number(t.client_rate || 0) - Number(t.contractor_rate || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/market-trips')} className="p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Market Trip #{t.id}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
              <span className="font-mono">Job #{t.job_id}</span>
              <span>•</span>
              <span>{t.supplier?.name || `Supplier #${t.supplier_id}`}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {t.status === 'pending' && (
            <button onClick={() => setAssignOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium">
              <User size={16} /> Assign Vehicle
            </button>
          )}
          {t.status === 'assigned' && (
            <button onClick={() => startMutation.mutate()} disabled={startMutation.isPending} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-medium disabled:opacity-50">
              <Play size={16} /> Start Transit
            </button>
          )}
          {t.status === 'in_transit' && (
            <button onClick={() => deliverMutation.mutate()} disabled={deliverMutation.isPending} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700 text-sm font-medium disabled:opacity-50">
              <PackageCheck size={16} /> Mark Delivered
            </button>
          )}
          {t.status === 'delivered' && (
            <button onClick={() => setSettleOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 text-white hover:bg-orange-700 text-sm font-medium">
              <CreditCard size={16} /> Settle
            </button>
          )}
          {['pending', 'assigned'].includes(t.status) && (
            <button onClick={() => setCancelConfirm(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-300 text-red-600 hover:bg-red-50 text-sm font-medium">
              <XCircle size={16} /> Cancel
            </button>
          )}
        </div>
      </div>

      {/* Status Timeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Status Timeline</h3>
        <div className="flex items-center">
          {STATUS_FLOW.map((status, idx) => {
            const isActive = idx <= currentIdx;
            const isCurrent = status === t.status;
            return (
              <div key={status} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isActive ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-400'} ${isCurrent ? 'ring-4 ring-primary-100' : ''}`}>
                    {isActive ? <CheckCircle size={16} /> : <span className="text-xs font-medium">{idx + 1}</span>}
                  </div>
                  <span className={`mt-2 text-xs font-medium ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                    {getStatusLabel(status)}
                  </span>
                </div>
                {idx < STATUS_FLOW.length - 1 && (
                  <div className={`h-0.5 w-full -mt-5 ${idx < currentIdx ? 'bg-primary-600' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>
        {t.status === 'cancelled' && (
          <div className="mt-4 p-3 bg-red-50 rounded-lg text-sm text-red-600 font-medium">
            This trip has been cancelled.
          </div>
        )}
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trip Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2"><Truck size={16} /> Trip Details</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Vehicle</span><span className="font-mono font-medium">{t.vehicle_registration || '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Driver</span><span className="font-medium">{t.driver_name || '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Driver Phone</span><span className="font-medium">{t.driver_phone || '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Driver License</span><span className="font-mono font-medium">{t.driver_license || '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Created</span><span className="font-medium">{t.created_at ? new Date(t.created_at).toLocaleDateString('en-IN') : '—'}</span></div>
            {t.assigned_at && <div className="flex justify-between"><span className="text-gray-500">Assigned</span><span className="font-medium">{new Date(t.assigned_at).toLocaleDateString('en-IN')}</span></div>}
            {t.delivered_at && <div className="flex justify-between"><span className="text-gray-500">Delivered</span><span className="font-medium">{new Date(t.delivered_at).toLocaleDateString('en-IN')}</span></div>}
            {t.settled_at && <div className="flex justify-between"><span className="text-gray-500">Settled</span><span className="font-medium">{new Date(t.settled_at).toLocaleDateString('en-IN')}</span></div>}
            {t.settlement_reference && <div className="flex justify-between"><span className="text-gray-500">Settlement Ref</span><span className="font-mono font-medium">{t.settlement_reference}</span></div>}
          </div>
        </div>

        {/* P&L Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2"><IndianRupee size={16} /> Profit & Loss</h3>
          {p ? (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Client Rate</span><span className="font-medium text-green-600">+ ₹{Number(p.client_rate || 0).toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Contractor Rate</span><span className="font-medium text-red-600">- ₹{Number(p.contractor_rate || 0).toLocaleString('en-IN')}</span></div>
              {Number(p.advance_amount) > 0 && (
                <div className="flex justify-between"><span className="text-gray-500">Advance</span><span className="font-medium text-red-500">- ₹{Number(p.advance_amount).toLocaleString('en-IN')}</span></div>
              )}
              {Number(p.loading_charges) > 0 && (
                <div className="flex justify-between"><span className="text-gray-500">Loading Charges</span><span className="font-medium text-red-500">- ₹{Number(p.loading_charges).toLocaleString('en-IN')}</span></div>
              )}
              {Number(p.unloading_charges) > 0 && (
                <div className="flex justify-between"><span className="text-gray-500">Unloading Charges</span><span className="font-medium text-red-500">- ₹{Number(p.unloading_charges).toLocaleString('en-IN')}</span></div>
              )}
              {Number(p.other_charges) > 0 && (
                <div className="flex justify-between"><span className="text-gray-500">Other Charges</span><span className="font-medium text-red-500">- ₹{Number(p.other_charges).toLocaleString('en-IN')}</span></div>
              )}
              <div className="border-t pt-3 flex justify-between">
                <span className="text-gray-500">TDS ({p.tds_rate || 0}%)</span>
                <span className="font-medium text-blue-600">₹{Number(p.tds_amount || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Net Payable</span>
                <span className="font-medium">₹{Number(p.net_payable || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="border-t pt-3 flex justify-between text-base">
                <span className="font-semibold text-gray-900">Margin</span>
                <span className={`font-bold ${Number(p.margin || margin) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ₹{Number(p.margin || margin).toLocaleString('en-IN')}
                  {p.margin_pct != null && <span className="text-sm ml-1">({Number(p.margin_pct).toFixed(1)}%)</span>}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Client Rate</span><span className="font-medium text-green-600">+ ₹{Number(t.client_rate || 0).toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Contractor Rate</span><span className="font-medium text-red-600">- ₹{Number(t.contractor_rate || 0).toLocaleString('en-IN')}</span></div>
              <div className="border-t pt-3 flex justify-between text-base">
                <span className="font-semibold text-gray-900">Margin</span>
                <span className={`font-bold ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>₹{margin.toLocaleString('en-IN')}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Assign Modal */}
      <Modal isOpen={assignOpen} onClose={() => setAssignOpen(false)} title="Assign Vehicle & Driver">
        <form onSubmit={(e) => { e.preventDefault(); assignMutation.mutate(); }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Registration *</label>
            <input type="text" required value={assignPayload.vehicle_registration} onChange={(e) => setAssignPayload({ ...assignPayload, vehicle_registration: e.target.value.toUpperCase() })} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm" placeholder="e.g. TN01AB1234" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Driver Name *</label>
              <input type="text" required value={assignPayload.driver_name} onChange={(e) => setAssignPayload({ ...assignPayload, driver_name: e.target.value })} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Driver Phone *</label>
              <input type="text" required value={assignPayload.driver_phone} onChange={(e) => setAssignPayload({ ...assignPayload, driver_phone: e.target.value })} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Driver License</label>
            <input type="text" value={assignPayload.driver_license} onChange={(e) => setAssignPayload({ ...assignPayload, driver_license: e.target.value })} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm" />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setAssignOpen(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
            <SubmitButton isLoading={assignMutation.isPending} label="Assign" />
          </div>
        </form>
      </Modal>

      {/* Settle Modal */}
      <Modal isOpen={settleOpen} onClose={() => setSettleOpen(false)} title="Settle Market Trip">
        <form onSubmit={(e) => { e.preventDefault(); settleMutation.mutate(); }} className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-2">
            <div className="flex justify-between"><span className="text-gray-500">Contractor Rate</span><span className="font-medium">₹{Number(t.contractor_rate || 0).toLocaleString('en-IN')}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">TDS ({t.tds_rate || 0}%)</span><span className="font-medium text-red-500">-₹{Number(t.tds_amount || 0).toLocaleString('en-IN')}</span></div>
            <div className="flex justify-between border-t pt-2"><span className="text-gray-900 font-semibold">Net Payable</span><span className="font-bold text-green-600">₹{Number(t.net_payable || 0).toLocaleString('en-IN')}</span></div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Settlement Reference *</label>
            <input type="text" required value={settlePayload.settlement_reference} onChange={(e) => setSettlePayload({ ...settlePayload, settlement_reference: e.target.value })} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm" placeholder="e.g. UTR/NEFT/Cheque No." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
            <textarea value={settlePayload.settlement_remarks} onChange={(e) => setSettlePayload({ ...settlePayload, settlement_remarks: e.target.value })} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm" rows={2} />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setSettleOpen(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
            <SubmitButton isLoading={settleMutation.isPending} label="Confirm Settlement" />
          </div>
        </form>
      </Modal>

      {/* Cancel Confirm */}
      <ConfirmDialog
        isOpen={cancelConfirm}
        onCancel={() => setCancelConfirm(false)}
        onConfirm={() => cancelMutation.mutate()}
        title="Cancel Market Trip"
        message={`Are you sure you want to cancel this market trip (Job #${t.job_id})?`}
        confirmLabel="Cancel Trip"
        isDangerous
      />
    </div>
  );
}
