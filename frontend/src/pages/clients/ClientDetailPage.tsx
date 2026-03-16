import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { clientService } from '@/services/dataService';
import { StatusBadge, LoadingPage } from '@/components/common/Modal';
import { ArrowLeft, Phone, Mail, MapPin, Edit, FileText, ChevronRight } from 'lucide-react';

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: () => clientService.get(Number(id)),
    enabled: !!id,
  });

  if (isLoading) return <LoadingPage />;
  if (!client) return <div className="text-center py-12 text-gray-500">Client not found</div>;

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
          <p className="text-gray-500">{client.code} | {client.client_type}</p>
        </div>
        <button className="btn-secondary flex items-center gap-2">
          <Edit size={16} /> Edit
        </button>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Contact Info</h3>
          <div className="space-y-3 text-sm">
            {client.phone && <div className="flex items-center gap-2 text-gray-600"><Phone size={16} className="text-gray-400" /> {client.phone}</div>}
            {client.email && <div className="flex items-center gap-2 text-gray-600"><Mail size={16} className="text-gray-400" /> {client.email}</div>}
            {client.billing_address && <div className="flex items-start gap-2 text-gray-600"><MapPin size={16} className="text-gray-400 mt-0.5" /> {client.billing_address}, {client.billing_city}, {client.billing_state} {client.billing_pincode}</div>}
            {client.gst_number && <div className="flex items-center gap-2 text-gray-600"><FileText size={16} className="text-gray-400" /> GST: {client.gst_number}</div>}
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Financial Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Credit Limit</span>
              <span className="font-semibold">₹{Number((client.credit_limit || 0) ?? 0).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Credit Days</span>
              <span className="font-semibold">{client.credit_days} days</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Outstanding</span>
              <span className="font-semibold text-red-600">₹{Number((client.outstanding_amount || 0) ?? 0).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <button className="btn-primary w-full text-sm">Create Job</button>
            <button className="btn-secondary w-full text-sm">Create Invoice</button>
            <button className="btn-secondary w-full text-sm">View Ledger</button>
          </div>
        </div>
      </div>

      {/* Contacts */}
      {client.contacts && client.contacts.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Contacts</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {client.contacts.map((contact) => (
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
    </div>
  );
}
