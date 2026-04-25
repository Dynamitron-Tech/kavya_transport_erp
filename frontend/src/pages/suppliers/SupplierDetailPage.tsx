import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { supplierService } from '@/services/dataService';
import { StatusBadge, Modal } from '@/components/common/Modal';
import { SubmitButton } from '@/components/common/SubmitButton';
import { getStatusColor, getStatusLabel } from '@/services/workflowService';
import { safeArray } from '@/utils/helpers';
import { handleApiError } from '../../utils/handleApiError';
import {
  ArrowLeft, Truck, Phone, MapPin, CreditCard,
  FileText, IndianRupee, Plus, X
} from 'lucide-react';

const SUPPLIER_TYPE_LABELS: Record<string, string> = {
  broker: 'Broker',
  fleet_owner: 'Fleet Owner',
  individual: 'Individual',
};

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'profile' | 'vehicles' | 'trips' | 'statement'>('profile');
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);
  const [vehiclePayload, setVehiclePayload] = useState({ vehicle_registration: '', vehicle_type: '' });

  const { data: supplier, isLoading } = useQuery({
    queryKey: ['supplier', id],
    queryFn: () => supplierService.get(Number(id)),
    enabled: !!id,
  });

  const { data: tripsData } = useQuery({
    queryKey: ['supplier-trips', id],
    queryFn: () => supplierService.getTrips(Number(id)),
    enabled: !!id && activeTab === 'trips',
  });

  const { data: statement } = useQuery({
    queryKey: ['supplier-statement', id],
    queryFn: () => supplierService.getStatement(Number(id)),
    enabled: !!id && activeTab === 'statement',
  });

  const addVehicleMutation = useMutation({
    mutationFn: () => supplierService.addVehicle(Number(id), vehiclePayload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier', id] });
      toast.success('Vehicle added');
      setAddVehicleOpen(false);
      setVehiclePayload({ vehicle_registration: '', vehicle_type: '' });
    },
    onError: (error) => handleApiError(error, 'Failed to add vehicle'),
  });

  const removeVehicleMutation = useMutation({
    mutationFn: (svId: number) => supplierService.removeVehicle(svId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier', id] });
      toast.success('Vehicle removed');
    },
    onError: (error) => handleApiError(error, 'Failed to remove vehicle'),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;
  }

  if (!supplier) {
    return <div className="text-center py-12 text-gray-500">Supplier not found</div>;
  }

  const s: any = supplier;
  const vehicles = safeArray<any>(s.vehicles);
  const trips = safeArray<any>(tripsData);

  const tabs = [
    { key: 'profile', label: 'Profile' },
    { key: 'vehicles', label: `Vehicles (${vehicles.length})` },
    { key: 'trips', label: 'Market Trips' },
    { key: 'statement', label: 'Statement' },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/suppliers')} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center">
              <Truck size={24} className="text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{s.name}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm font-mono text-gray-500">{s.code}</span>
                <span className="text-sm text-gray-400">•</span>
                <span className="text-sm text-gray-500">{SUPPLIER_TYPE_LABELS[s.supplier_type] || s.supplier_type}</span>
                <StatusBadge status={s.is_active ? 'available' : 'inactive'} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2"><Phone size={16} /> Contact Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Contact Person</span><span className="font-medium">{s.contact_person || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Phone</span><span className="font-medium">{s.phone}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Email</span><span className="font-medium">{s.email || '—'}</span></div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2"><MapPin size={16} /> Address</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Address</span><span className="font-medium text-right max-w-[60%]">{s.address || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">City</span><span className="font-medium">{s.city || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">State</span><span className="font-medium">{s.state || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Pincode</span><span className="font-medium">{s.pincode || '—'}</span></div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2"><FileText size={16} /> KYC Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">PAN</span><span className="font-mono font-medium">{s.pan || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">GSTIN</span><span className="font-mono font-medium">{s.gstin || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Aadhaar</span><span className="font-mono font-medium">{s.aadhaar || '—'}</span></div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2"><CreditCard size={16} /> Banking & TDS</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Bank Name</span><span className="font-medium">{s.bank_name || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Account No.</span><span className="font-mono font-medium">{s.bank_account_number || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">IFSC</span><span className="font-mono font-medium">{s.bank_ifsc || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">TDS Applicable</span><span className="font-medium">{s.tds_applicable ? 'Yes' : 'No'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">TDS Rate (194C)</span><span className="font-medium">{s.tds_rate}%</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Credit Days</span><span className="font-medium">{s.credit_days}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Vehicles Tab */}
      {activeTab === 'vehicles' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => setAddVehicleOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white hover:bg-primary-700 text-sm font-medium">
              <Plus size={16} /> Add Vehicle
            </button>
          </div>
          {vehicles.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <Truck size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No vehicles linked to this supplier</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vehicles.map((v: any) => (
                <div key={v.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                      <Truck size={20} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 font-mono">{v.vehicle_registration || `Vehicle #${v.vehicle_id}`}</p>
                      <p className="text-xs text-gray-400">{v.vehicle_type || 'N/A'}</p>
                    </div>
                  </div>
                  <button onClick={() => removeVehicleMutation.mutate(v.id)} className="p-1.5 rounded-md hover:bg-red-50">
                    <X size={14} className="text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Modal isOpen={addVehicleOpen} onClose={() => setAddVehicleOpen(false)} title="Add Vehicle">
            <form onSubmit={(e) => { e.preventDefault(); addVehicleMutation.mutate(); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Registration *</label>
                <input type="text" required value={vehiclePayload.vehicle_registration} onChange={(e) => setVehiclePayload({ ...vehiclePayload, vehicle_registration: e.target.value.toUpperCase() })} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm" placeholder="e.g. TN01AB1234" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
                <input type="text" value={vehiclePayload.vehicle_type} onChange={(e) => setVehiclePayload({ ...vehiclePayload, vehicle_type: e.target.value })} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm" placeholder="e.g. 32ft MXL" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setAddVehicleOpen(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
                <SubmitButton isLoading={addVehicleMutation.isPending} label="Add Vehicle" />
              </div>
            </form>
          </Modal>
        </div>
      )}

      {/* Trips Tab */}
      {activeTab === 'trips' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Client Rate</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Our Rate</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Margin</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {trips.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No market trips found</td></tr>
              ) : trips.map((t: any) => {
                const margin = (Number(t.client_rate) || 0) - (Number(t.contractor_rate) || 0);
                const sc = getStatusColor(t.status);
                return (
                  <tr key={t.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/market-trips/${t.id}`)}>
                    <td className="px-4 py-3 text-sm font-mono">Job #{t.job_id}</td>
                    <td className="px-4 py-3 text-sm font-mono">{t.vehicle_registration || '—'}</td>
                    <td className="px-4 py-3 text-sm text-right">₹{Number(t.client_rate || 0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-sm text-right">₹{Number(t.contractor_rate || 0).toLocaleString('en-IN')}</td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>₹{margin.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>{getStatusLabel(t.status)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Statement Tab */}
      {activeTab === 'statement' && (
        <div className="space-y-6">
          {statement && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Payable', value: (statement as any).total_payable, color: 'text-orange-600' },
                  { label: 'Total Paid', value: (statement as any).total_paid, color: 'text-green-600' },
                  { label: 'TDS Deducted', value: (statement as any).total_tds_deducted, color: 'text-blue-600' },
                  { label: 'Outstanding', value: (statement as any).outstanding, color: 'text-red-600' },
                ].map((item) => (
                  <div key={item.label} className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-xs text-gray-500">{item.label}</p>
                    <p className={`text-xl font-bold ${item.color} mt-1`}>
                      <IndianRupee size={16} className="inline" />
                      {Number(item.value || 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trip</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">TDS</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net Payable</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ref</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {((statement as any).entries || []).length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No entries</td></tr>
                    ) : ((statement as any).entries || []).map((entry: any) => {
                      const sc = getStatusColor(entry.status);
                      return (
                        <tr key={entry.market_trip_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-mono">MT-{entry.market_trip_id}</td>
                          <td className="px-4 py-3 text-sm font-mono">Job #{entry.job_id}</td>
                          <td className="px-4 py-3 text-sm text-right">₹{Number(entry.contractor_rate || 0).toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 text-sm text-right text-red-500">-₹{Number(entry.tds_amount || 0).toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 text-sm text-right font-medium">₹{Number(entry.net_payable || 0).toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>{getStatusLabel(entry.status)}</span></td>
                          <td className="px-4 py-3 text-sm text-gray-500">{entry.settlement_reference || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
