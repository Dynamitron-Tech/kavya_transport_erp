import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobService } from '@/services/dataService';
import { StatusBadge, LoadingPage } from '@/components/common/Modal';
import { useAuthStore } from '@/store/authStore';
import { ArrowLeft, Edit, CheckCircle, MapPin, Package, DollarSign, ChevronRight, FileText, Truck } from 'lucide-react';

export default function JobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: () => jobService.get(Number(id)),
    enabled: !!id,
  });

  const approveMutation = useMutation({
    mutationFn: () => jobService.approve(Number(id), { action: 'approve' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['job', id] }),
  });

  const submitMutation = useMutation({
    mutationFn: () => jobService.submitForApproval(Number(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['job', id] }),
  });

  if (isLoading) return <LoadingPage />;
  if (!job) return <div className="text-center py-16 text-gray-400">Job not found</div>;

  const InfoRow = ({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }) => (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-sm ${bold ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{value}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="breadcrumb">
        <Link to="/dashboard">Dashboard</Link>
        <ChevronRight size={14} className="breadcrumb-separator" />
        <Link to="/jobs">Jobs</Link>
        <ChevronRight size={14} className="breadcrumb-separator" />
        <span className="text-gray-900 font-medium">{job.job_number}</span>
      </nav>

      {/* Page header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/jobs')} className="btn-icon"><ArrowLeft size={18} /></button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="page-title">{job.job_number}</h1>
            <StatusBadge status={job.status} />
            <StatusBadge status={job.priority || 'normal'} variant="outline" />
          </div>
          <p className="page-subtitle mt-0.5">{job.client?.name || `Client #${job.client_id}`} · {job.contract_type?.replace('_', ' ')}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {job.status === 'draft' && hasPermission('jobs:update') && (
            <button onClick={() => submitMutation.mutate()} className="btn-primary flex items-center gap-2 text-sm" disabled={submitMutation.isPending}>
              Submit for Approval
            </button>
          )}
          {job.status === 'pending_approval' && hasPermission('jobs:approve') && (
            <button onClick={() => approveMutation.mutate()} className="btn-success flex items-center gap-2 text-sm" disabled={approveMutation.isPending}>
              <CheckCircle size={14} /> Approve
            </button>
          )}
          <button className="btn-secondary flex items-center gap-2 text-sm"><Edit size={14} /> Edit</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Route */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-blue-50"><MapPin size={15} className="text-blue-600" /></div>
            <h3 className="text-sm font-semibold text-gray-900">Route Details</h3>
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">Origin</p>
              <p className="font-medium text-gray-900 mt-0.5">{job.origin}</p>
              {job.origin_address && <p className="text-xs text-gray-400 mt-0.5">{job.origin_address}</p>}
            </div>
            <div className="border-l-2 border-dashed border-gray-200 ml-2 h-4" />
            <div>
              <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">Destination</p>
              <p className="font-medium text-gray-900 mt-0.5">{job.destination}</p>
              {job.destination_address && <p className="text-xs text-gray-400 mt-0.5">{job.destination_address}</p>}
            </div>
          </div>
        </div>

        {/* Cargo */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-purple-50"><Package size={15} className="text-purple-600" /></div>
            <h3 className="text-sm font-semibold text-gray-900">Cargo Details</h3>
          </div>
          <div>
            <InfoRow label="Cargo Type" value={job.cargo_type} bold />
            {job.cargo_description && <InfoRow label="Description" value={job.cargo_description} />}
            {job.weight_tons && <InfoRow label="Weight" value={`${job.weight_tons} Tons`} />}
            {job.num_packages && <InfoRow label="Packages" value={job.num_packages} />}
            <InfoRow label="Pickup Date" value={new Date(job.pickup_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
            {job.delivery_date && <InfoRow label="Delivery Date" value={new Date(job.delivery_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />}
          </div>
        </div>

        {/* Financial */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-green-50"><DollarSign size={15} className="text-green-600" /></div>
            <h3 className="text-sm font-semibold text-gray-900">Financials</h3>
          </div>
          <div>
            <InfoRow label="Rate" value={`₹${Number((job.rate || 0) ?? 0).toLocaleString('en-IN')}`} bold />
            {job.estimated_cost && <InfoRow label="Est. Cost" value={`₹${(job.estimated_cost ?? 0).toLocaleString('en-IN')}`} />}
            {job.budget_amount && <InfoRow label="Budget" value={`₹${(job.budget_amount ?? 0).toLocaleString('en-IN')}`} />}
            {job.agreed_amount && (
              <InfoRow label="Agreed Amount" value={
                <span className="font-semibold text-green-600">₹{(job.agreed_amount ?? 0).toLocaleString('en-IN')}</span>
              } bold />
            )}
          </div>
          {job.status === 'approved' && (
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
              <button onClick={() => navigate('/lr/new')} className="btn-primary w-full text-sm flex items-center justify-center gap-2">
                <FileText size={14} /> Create LR
              </button>
              <button className="btn-secondary w-full text-sm flex items-center justify-center gap-2">
                <Truck size={14} /> Assign Vehicle
              </button>
            </div>
          )}
        </div>
      </div>

      {job.special_instructions && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Special Instructions</h3>
          <p className="text-sm text-gray-600 leading-relaxed">{job.special_instructions}</p>
        </div>
      )}
    </div>
  );
}
