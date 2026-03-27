import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { clientService, jobService } from '@/services/dataService';
import { StatusBadge, LoadingPage, Modal } from '@/components/common/Modal';
import { SubmitButton } from '@/components/common/SubmitButton';
import { ArrowLeft, Phone, Mail, MapPin, Edit, ChevronRight, Plus, Truck, User, Package, IndianRupee, Calendar, CheckCircle2 } from 'lucide-react';
import { safeArray } from '@/utils/helpers';
import { handleApiError } from '../../utils/handleApiError';
import api from '@/services/api';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_approval: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // ── State ──
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [showEditClient, setShowEditClient] = useState(false);
  const [step, setStep] = useState(1); // 1=details, 2=vehicle, 3=driver, 4=confirm
  const [editPayload, setEditPayload] = useState({
    name: '',
    email: '',
    phone: '',
    city: '',
    state: '',
    address_line1: '',
    pincode: '',
    gstin: '',
    pan: '',
    credit_limit: 0,
    credit_days: 30,
  });
  const [jobForm, setJobForm] = useState({
    origin_city: '', destination_city: '', material_type: '', quantity: '',
    vehicle_type_required: 'open_body', agreed_rate: '', pickup_date: '',
    expected_delivery_date: '', priority: 'normal',
  });
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [selectedDriver, setSelectedDriver] = useState<any>(null);

  // ── Queries ──
  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: () => clientService.get(Number(id)),
    enabled: !!id,
  });

  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ['client-jobs', id],
    queryFn: () => jobService.list({ client_id: Number(id), page: 1, page_size: 50 }),
    enabled: !!id,
  });

  const { data: vehiclesRaw } = useQuery({
    queryKey: ['available-vehicles'],
    queryFn: () => api.get('/vehicles', { params: { page: 1, limit: 100 } }),
    enabled: showCreateJob && step >= 2,
  });

  const { data: driversRaw } = useQuery({
    queryKey: ['available-drivers'],
    queryFn: () => api.get('/drivers', { params: { page: 1, limit: 100 } }),
    enabled: showCreateJob && step >= 3,
  });

  const vehicles = safeArray<any>(vehiclesRaw);
  const drivers = safeArray<any>(driversRaw);
  const jobs = safeArray<any>(jobsData);

  // ── Mutations ──
  const createJobMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        job_date: new Date().toISOString().slice(0, 10),
        client_id: Number(id),
        origin_city: jobForm.origin_city,
        origin_address: jobForm.origin_city,
        destination_city: jobForm.destination_city,
        destination_address: jobForm.destination_city,
        material_type: jobForm.material_type || 'GENERAL',
        quantity: Number(jobForm.quantity) || 0,
        quantity_unit: 'tonnes',
        vehicle_type_required: jobForm.vehicle_type_required,
        agreed_rate: Number(jobForm.agreed_rate) || 0,
        pickup_date: jobForm.pickup_date ? `${jobForm.pickup_date}T00:00:00` : null,
        expected_delivery_date: jobForm.expected_delivery_date ? `${jobForm.expected_delivery_date}T00:00:00` : null,
        rate_type: 'per_trip',
        num_vehicles_required: 1,
        priority: jobForm.priority,
      };
      const jobResult = await jobService.create(payload);
      const newJobId = jobResult?.id || jobResult?.data?.id;
      if (newJobId && selectedVehicle && selectedDriver) {
        await api.put(`/jobs/${newJobId}/assign`, {
          vehicle_id: selectedVehicle.id,
          driver_id: selectedDriver.id,
        });
      }
      return newJobId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client-jobs', id] });
      qc.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job created and assigned successfully!');
      resetModal();
    },
    onError: (err) => handleApiError(err, 'Failed to create LR'),
  });

  const updateClientMutation = useMutation({
    mutationFn: (payload: typeof editPayload) => clientService.update(Number(id), payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['client', id] });
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client updated successfully');
      setShowEditClient(false);
    },
    onError: (err) => handleApiError(err, 'Failed to update client'),
  });

  useEffect(() => {
    if (!client) return;
    setEditPayload({
      name: client.name || '',
      email: client.email || '',
      phone: client.phone || '',
      city: client.city || '',
      state: client.state || '',
      address_line1: client.address_line1 || '',
      pincode: client.pincode || '',
      gstin: client.gstin || '',
      pan: client.pan || '',
      credit_limit: Number(client.credit_limit || 0),
      credit_days: Number(client.credit_days || 30),
    });
  }, [client]);

  const resetModal = () => {
    setShowCreateJob(false);
    setStep(1);
    setJobForm({
      origin_city: '', destination_city: '', material_type: '', quantity: '',
      vehicle_type_required: 'open_body', agreed_rate: '', pickup_date: '',
      expected_delivery_date: '', priority: 'normal',
    });
    setSelectedVehicle(null);
    setSelectedDriver(null);
  };

  if (isLoading) return <LoadingPage />;
  if (!client) return <div className="text-center py-12 text-gray-500">Client not found</div>;

  const inr = (n: any) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
  const activeJobs = jobs.filter((j: any) => !['completed', 'cancelled'].includes(j.status));
  const completedJobs = jobs.filter((j: any) => j.status === 'completed');

  return (
    <div className="space-y-5">
      {/* Breadcrumbs */}
      <nav className="breadcrumb">
        <Link to="/dashboard">Dashboard</Link>
        <ChevronRight size={14} className="breadcrumb-separator" />
        <Link to="/clients">Clients</Link>
        <ChevronRight size={14} className="breadcrumb-separator" />
        <span className="text-gray-900 font-medium">{client.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/clients')} className="btn-icon">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="page-title">{client.name}</h1>
            <StatusBadge status={client.is_active ? 'active' : 'inactive'} />
          </div>
          <p className="text-gray-500">{client.code} · {client.client_type}</p>
        </div>
        <button onClick={() => navigate('/lr/new')} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Create LR
        </button>
        <button onClick={() => setShowEditClient(true)} className="btn-secondary flex items-center gap-2">
          <Edit size={16} /> Edit
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Active Jobs', value: activeJobs.length, icon: Package, color: 'text-blue-600 bg-blue-50' },
          { label: 'Completed', value: completedJobs.length, icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
          { label: 'Credit Limit', value: inr(client.credit_limit), icon: IndianRupee, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Outstanding', value: inr(client.outstanding_amount), icon: IndianRupee, color: Number(client.outstanding_amount || 0) > 0 ? 'text-red-600 bg-red-50' : 'text-gray-600 bg-gray-50' },
          { label: 'Credit Days', value: `${client.credit_days || 0} days`, icon: Calendar, color: 'text-purple-600 bg-purple-50' },
        ].map((s) => (
          <div key={s.label} className="card flex items-center gap-3 py-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${s.color}`}>
              <s.icon size={18} />
            </div>
            <div>
              <p className="text-xs text-gray-400">{s.label}</p>
              <p className="font-semibold text-gray-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Two column: Info + Financial */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <h3 className="font-semibold text-gray-900 mb-4">Client Information</h3>
          <div className="grid grid-cols-2 gap-y-3 gap-x-8 text-sm">
            <div><span className="text-gray-400">Phone</span><p className="font-medium flex items-center gap-1.5 mt-0.5"><Phone size={14} className="text-gray-400" /> {client.phone || '—'}</p></div>
            <div><span className="text-gray-400">Email</span><p className="font-medium flex items-center gap-1.5 mt-0.5"><Mail size={14} className="text-gray-400" /> {client.email || '—'}</p></div>
            <div><span className="text-gray-400">Address</span><p className="font-medium flex items-center gap-1.5 mt-0.5"><MapPin size={14} className="text-gray-400" /> {[client.address_line1, client.city, client.state, client.pincode].filter(Boolean).join(', ') || '—'}</p></div>
            <div><span className="text-gray-400">GSTIN</span><p className="font-medium font-mono mt-0.5">{client.gstin || '—'}</p></div>
            <div><span className="text-gray-400">PAN</span><p className="font-medium font-mono mt-0.5">{client.pan || '—'}</p></div>
            <div><span className="text-gray-400">Type</span><p className="font-medium capitalize mt-0.5">{client.client_type || '—'}</p></div>
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <button onClick={() => navigate('/lr/new')} className="btn-primary w-full text-sm flex items-center justify-center gap-2"><Plus size={14} /> Create LR</button>
            <button onClick={() => navigate(`/finance/invoices?client_id=${id}`)} className="btn-secondary w-full text-sm">View Invoices</button>
            <button onClick={() => navigate(`/finance/ledger?client_id=${id}`)} className="btn-secondary w-full text-sm">View Ledger</button>
            <button onClick={() => navigate(`/jobs?client_id=${id}`)} className="btn-secondary w-full text-sm">All Jobs</button>
          </div>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Jobs ({jobs.length})</h3>
          <button onClick={() => navigate('/lr/new')} className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
            <Plus size={14} /> New LR
          </button>
        </div>
        {jobsLoading ? (
          <div className="py-8 text-center text-gray-400">Loading jobs...</div>
        ) : jobs.length === 0 ? (
          <div className="py-8 text-center text-gray-400">
            <Package size={40} className="mx-auto mb-2 text-gray-300" />
            <p>No jobs yet.</p>
            <button onClick={() => navigate('/lr/new')} className="text-primary-600 hover:underline text-sm mt-1">Create your first LR</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Job #</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Route</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Material</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Rate</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Priority</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Status</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j: any) => (
                  <tr key={j.id} onClick={() => navigate(`/jobs/${j.id}`)} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors">
                    <td className="py-2.5 px-3 font-mono font-semibold text-primary-600">{j.job_number}</td>
                    <td className="py-2.5 px-3">{j.origin_city || '—'} → {j.destination_city || '—'}</td>
                    <td className="py-2.5 px-3">{j.material_type || '—'}</td>
                    <td className="py-2.5 px-3 font-semibold">{inr(j.agreed_rate || j.total_amount)}</td>
                    <td className="py-2.5 px-3"><span className="capitalize">{j.priority || 'normal'}</span></td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[j.status] || STATUS_COLORS.draft}`}>
                        {(j.status || 'draft').replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-500">{j.created_at ? new Date(j.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Contacts */}
      {client.contacts && client.contacts.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Contacts</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {client.contacts.map((contact: any) => (
              <div key={contact.id} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900">{contact.name}</p>
                  {contact.is_primary && <span className="badge-info">Primary</span>}
                </div>
                {contact.designation && <p className="text-xs text-gray-400">{contact.designation}</p>}
                <p className="text-sm text-gray-600 mt-1">{contact.phone}</p>
                {contact.email && <p className="text-xs text-gray-400">{contact.email}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal isOpen={showEditClient} onClose={() => setShowEditClient(false)} title={`Edit ${client.name}`} size="lg">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            updateClientMutation.mutate(editPayload);
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Client Name</label>
              <input className="input-field" value={editPayload.name} onChange={(e) => setEditPayload((p) => ({ ...p, name: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input-field" value={editPayload.email} onChange={(e) => setEditPayload((p) => ({ ...p, email: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Phone</label>
              <input className="input-field" value={editPayload.phone} onChange={(e) => setEditPayload((p) => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <label className="label">Address</label>
              <input className="input-field" value={editPayload.address_line1} onChange={(e) => setEditPayload((p) => ({ ...p, address_line1: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">City</label>
              <input className="input-field" value={editPayload.city} onChange={(e) => setEditPayload((p) => ({ ...p, city: e.target.value }))} />
            </div>
            <div>
              <label className="label">State</label>
              <input className="input-field" value={editPayload.state} onChange={(e) => setEditPayload((p) => ({ ...p, state: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Pincode</label>
              <input className="input-field" value={editPayload.pincode} onChange={(e) => setEditPayload((p) => ({ ...p, pincode: e.target.value }))} />
            </div>
            <div>
              <label className="label">GSTIN</label>
              <input className="input-field" value={editPayload.gstin} onChange={(e) => setEditPayload((p) => ({ ...p, gstin: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">PAN</label>
              <input className="input-field" value={editPayload.pan} onChange={(e) => setEditPayload((p) => ({ ...p, pan: e.target.value }))} />
            </div>
            <div>
              <label className="label">Credit Limit</label>
              <input type="number" className="input-field" value={editPayload.credit_limit} onChange={(e) => setEditPayload((p) => ({ ...p, credit_limit: Number(e.target.value) || 0 }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Credit Days</label>
              <input type="number" className="input-field" value={editPayload.credit_days} onChange={(e) => setEditPayload((p) => ({ ...p, credit_days: Number(e.target.value) || 0 }))} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setShowEditClient(false)}>Cancel</button>
            <SubmitButton isLoading={updateClientMutation.isPending} label="Save Changes" />
          </div>
        </form>
      </Modal>

      {/* ─── Multi-Step Create LR Modal ─── */}
      <Modal isOpen={showCreateJob} onClose={resetModal} title={`Create LR — Step ${step} of 4`} size="lg">
        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-6">
          {['Details', 'Vehicle', 'Driver', 'Confirm'].map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i + 1 <= step ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'}`}>{i + 1}</div>
              <span className={`text-xs hidden sm:block ${i + 1 <= step ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>{label}</span>
              {i < 3 && <div className={`flex-1 h-0.5 ${i + 1 < step ? 'bg-primary-600' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Job Details */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Origin City *</label><input className="input-field" placeholder="e.g., Mumbai" value={jobForm.origin_city} onChange={(e) => setJobForm(p => ({ ...p, origin_city: e.target.value }))} /></div>
              <div><label className="label">Destination City *</label><input className="input-field" placeholder="e.g., Delhi" value={jobForm.destination_city} onChange={(e) => setJobForm(p => ({ ...p, destination_city: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Material Type *</label><input className="input-field" placeholder="e.g., Steel Coils" value={jobForm.material_type} onChange={(e) => setJobForm(p => ({ ...p, material_type: e.target.value }))} /></div>
              <div><label className="label">Quantity (Tonnes)</label><input type="number" className="input-field" placeholder="0" value={jobForm.quantity} onChange={(e) => setJobForm(p => ({ ...p, quantity: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Agreed Rate (₹) *</label><input type="number" className="input-field" placeholder="50000" value={jobForm.agreed_rate} onChange={(e) => setJobForm(p => ({ ...p, agreed_rate: e.target.value }))} /></div>
              <div>
                <label className="label">Vehicle Type</label>
                <select className="input-field" value={jobForm.vehicle_type_required} onChange={(e) => setJobForm(p => ({ ...p, vehicle_type_required: e.target.value }))}>
                  <option value="open_body">Open Body</option><option value="closed_body">Container</option><option value="flatbed">Flatbed</option>
                  <option value="tanker">Tanker</option><option value="tipper">Tipper</option><option value="trailer">Trailer</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><label className="label">Pickup Date</label><input type="date" className="input-field" value={jobForm.pickup_date} onChange={(e) => setJobForm(p => ({ ...p, pickup_date: e.target.value }))} /></div>
              <div><label className="label">Delivery Date</label><input type="date" className="input-field" value={jobForm.expected_delivery_date} onChange={(e) => setJobForm(p => ({ ...p, expected_delivery_date: e.target.value }))} /></div>
              <div>
                <label className="label">Priority</label>
                <select className="input-field" value={jobForm.priority} onChange={(e) => setJobForm(p => ({ ...p, priority: e.target.value }))}>
                  <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t">
              <button className="btn-secondary" onClick={resetModal}>Cancel</button>
              <button className="btn-primary" disabled={!jobForm.origin_city || !jobForm.destination_city || !jobForm.agreed_rate} onClick={() => setStep(2)}>Next: Select Vehicle →</button>
            </div>
          </div>
        )}

        {/* Step 2: Select Vehicle */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Select a vehicle for this job (optional — you can assign later).</p>
            <div className="max-h-72 overflow-y-auto space-y-2">
              {vehicles.filter((v: any) => (v.status === 'available' || v.status === 'AVAILABLE')).length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No available vehicles.</p>
              )}
              {vehicles.map((v: any) => {
                const isAvailable = (v.status || '').toLowerCase() === 'available';
                const isSelected = selectedVehicle?.id === v.id;
                return (
                  <div
                    key={v.id}
                    onClick={() => isAvailable && setSelectedVehicle(isSelected ? null : v)}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all flex items-center gap-3 ${
                      isSelected ? 'border-primary-500 bg-primary-50' : isAvailable ? 'border-gray-200 hover:border-gray-300' : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <Truck size={20} className={isSelected ? 'text-primary-600' : 'text-gray-400'} />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{v.rc_number || v.registration_number || `Vehicle #${v.id}`}</p>
                      <p className="text-xs text-gray-400">{v.vehicle_type || 'N/A'} · {v.make} {v.model}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isAvailable ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                      {(v.status || 'unknown').replace('_', ' ')}
                    </span>
                    {isSelected && <CheckCircle2 size={18} className="text-primary-600" />}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between pt-3 border-t">
              <button className="btn-secondary" onClick={() => setStep(1)}>← Back</button>
              <div className="flex gap-3">
                <button className="text-sm text-gray-500 hover:text-gray-700" onClick={() => { setSelectedVehicle(null); setStep(3); }}>Skip</button>
                <button className="btn-primary" onClick={() => setStep(3)}>Next: Select Driver →</button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Select Driver */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Select a driver for this job (optional — you can assign later).</p>
            <div className="max-h-72 overflow-y-auto space-y-2">
              {drivers.filter((d: any) => (d.status === 'available' || d.status === 'AVAILABLE')).length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No available drivers.</p>
              )}
              {drivers.map((d: any) => {
                const isAvailable = (d.status || '').toLowerCase() === 'available';
                const isSelected = selectedDriver?.id === d.id;
                return (
                  <div
                    key={d.id}
                    onClick={() => isAvailable && setSelectedDriver(isSelected ? null : d)}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all flex items-center gap-3 ${
                      isSelected ? 'border-primary-500 bg-primary-50' : isAvailable ? 'border-gray-200 hover:border-gray-300' : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <User size={20} className={isSelected ? 'text-primary-600' : 'text-gray-400'} />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{d.name || d.full_name || `Driver #${d.id}`}</p>
                      <p className="text-xs text-gray-400">{d.phone || ''} · {d.license_type || ''}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isAvailable ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                      {(d.status || 'unknown').replace('_', ' ')}
                    </span>
                    {isSelected && <CheckCircle2 size={18} className="text-primary-600" />}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between pt-3 border-t">
              <button className="btn-secondary" onClick={() => setStep(2)}>← Back</button>
              <div className="flex gap-3">
                <button className="text-sm text-gray-500 hover:text-gray-700" onClick={() => { setSelectedDriver(null); setStep(4); }}>Skip</button>
                <button className="btn-primary" onClick={() => setStep(4)}>Next: Confirm →</button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm">
              <h4 className="font-semibold text-gray-900">Job Summary</h4>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-gray-400">Client:</span> <span className="font-medium">{client.name}</span></div>
                <div><span className="text-gray-400">Route:</span> <span className="font-medium">{jobForm.origin_city} → {jobForm.destination_city}</span></div>
                <div><span className="text-gray-400">Material:</span> <span className="font-medium">{jobForm.material_type || 'GENERAL'}</span></div>
                <div><span className="text-gray-400">Quantity:</span> <span className="font-medium">{jobForm.quantity || '—'} tonnes</span></div>
                <div><span className="text-gray-400">Rate:</span> <span className="font-medium">{inr(jobForm.agreed_rate)}</span></div>
                <div><span className="text-gray-400">Priority:</span> <span className="font-medium capitalize">{jobForm.priority}</span></div>
              </div>
              {(selectedVehicle || selectedDriver) && (
                <div className="border-t pt-3 mt-3 grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <Truck size={14} className="text-gray-400" />
                    <span className="text-gray-400">Vehicle:</span>
                    <span className="font-medium">{selectedVehicle ? (selectedVehicle.rc_number || selectedVehicle.registration_number) : 'Not assigned'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-gray-400" />
                    <span className="text-gray-400">Driver:</span>
                    <span className="font-medium">{selectedDriver ? (selectedDriver.name || selectedDriver.full_name) : 'Not assigned'}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-between pt-3 border-t">
              <button className="btn-secondary" onClick={() => setStep(3)}>← Back</button>
              <SubmitButton isLoading={createJobMutation.isPending} label="Create LR & Assign" loadingLabel="Creating..." onClick={() => createJobMutation.mutate()} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
