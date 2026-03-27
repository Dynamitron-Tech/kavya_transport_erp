import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { lrService } from '@/services/dataService';
import { StatusBadge, LoadingPage } from '@/components/common/Modal';
import { ArrowLeft, Printer, Upload, CheckCircle, FileText, ChevronRight } from 'lucide-react';
import { useRef } from 'react';
import toast from 'react-hot-toast';

export default function LRDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: lr, isLoading } = useQuery({
    queryKey: ['lr', id],
    queryFn: () => lrService.get(Number(id)),
    enabled: !!id,
  });

  const handlePrint = async () => {
    try {
      const printData = await lrService.print(Number(id));
      const html = typeof printData === 'string' ? printData : printData?.html || printData?.data?.html;
      if (html) {
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); w.print(); }
      } else {
        window.print();
      }
    } catch {
      window.print();
    }
  };

  const uploadPODMutation = useMutation({
    mutationFn: (file: File) => lrService.uploadPOD(Number(id), file),
    onSuccess: () => {
      toast.success('POD uploaded successfully');
      queryClient.invalidateQueries({ queryKey: ['lr', id] });
    },
    onError: () => toast.error('Failed to upload POD'),
  });

  const verifyPODMutation = useMutation({
    mutationFn: () => lrService.verifyPOD(Number(id)),
    onSuccess: () => {
      toast.success('POD verified successfully');
      queryClient.invalidateQueries({ queryKey: ['lr', id] });
    },
    onError: () => toast.error('Failed to verify POD'),
  });

  const handleUploadPOD = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadPODMutation.mutate(file);
    e.target.value = '';
  };

  if (isLoading) return <LoadingPage />;
  if (!lr) return <div className="text-center py-16 text-gray-400">LR not found</div>;

  return (
    <div className="space-y-6">
      <nav className="breadcrumb">
        <Link to="/dashboard">Dashboard</Link>
        <ChevronRight size={14} className="breadcrumb-separator" />
        <Link to="/lr">Lorry Receipts</Link>
        <ChevronRight size={14} className="breadcrumb-separator" />
        <span className="text-gray-900 font-medium">{lr.lr_number}</span>
      </nav>

      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/lr')} className="btn-icon"><ArrowLeft size={18} /></button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="page-title">{lr.lr_number}</h1>
            <StatusBadge status={lr.status} />
          </div>
          <p className="page-subtitle mt-0.5">Date: {new Date(lr.lr_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} · {lr.payment_mode?.replace('_', ' ').toUpperCase()}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,.pdf" />
          <button onClick={handlePrint} className="btn-secondary flex items-center gap-2 text-sm"><Printer size={14} /> Print</button>
          {!lr.pod_uploaded && <button onClick={handleUploadPOD} disabled={uploadPODMutation.isPending} className="btn-primary flex items-center gap-2 text-sm"><Upload size={14} /> {uploadPODMutation.isPending ? 'Uploading...' : 'Upload POD'}</button>}
          {lr.pod_uploaded && lr.status !== 'pod_received' && <button onClick={() => verifyPODMutation.mutate()} disabled={verifyPODMutation.isPending} className="btn-success flex items-center gap-2 text-sm"><CheckCircle size={14} /> Confirm POD</button>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Consignor</h3>
          <div className="space-y-2 text-sm">
            <p className="font-medium text-gray-900">{lr.consignor_name}</p>
            {lr.consignor_address && <p className="text-gray-500">{lr.consignor_address}</p>}
            {lr.consignor_gstin && <p className="text-gray-400">GST: {lr.consignor_gstin}</p>}
          </div>
        </div>
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Consignee</h3>
          <div className="space-y-2 text-sm">
            <p className="font-medium text-gray-900">{lr.consignee_name}</p>
            {lr.consignee_address && <p className="text-gray-500">{lr.consignee_address}</p>}
            {lr.consignee_gstin && <p className="text-gray-400">GST: {lr.consignee_gstin}</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Route & E-way Bill</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Origin</span><span>{lr.origin}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Destination</span><span>{lr.destination}</span></div>
            {lr.eway_bill_number && <div className="flex justify-between"><span className="text-gray-500">E-way Bill</span><span className="font-mono">{lr.eway_bill_number}</span></div>}
            {lr.eway_bill_expiry && <div className="flex justify-between"><span className="text-gray-500">E-way Expiry</span><span>{new Date(lr.eway_bill_expiry).toLocaleDateString('en-IN')}</span></div>}
          </div>
        </div>
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Freight Details</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Freight Amount</span><span className="font-semibold">₹{Number((lr.freight_amount || 0) ?? 0).toLocaleString('en-IN')}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Advance</span><span>₹{Number((lr.advance_amount || 0) ?? 0).toLocaleString('en-IN')}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Balance</span><span className="font-semibold text-red-600">₹{Number((lr.balance_amount || 0) ?? 0).toLocaleString('en-IN')}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Total Weight</span><span>{lr.total_weight || '—'} kg</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Packages</span><span>{lr.total_packages || '—'}</span></div>
          </div>
        </div>
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">POD Status</h3>
          <div className="flex flex-col items-center py-4">
            {lr.status === 'pod_received' ? (
              <>
                <CheckCircle size={48} className="text-green-500 mb-2" />
                <p className="font-semibold text-green-700">POD Received</p>
                <p className="text-xs text-gray-400 mt-1">{lr.pod_date && `Received: ${new Date(lr.pod_date).toLocaleDateString('en-IN')}`}</p>
              </>
            ) : lr.pod_uploaded ? (
              <>
                <FileText size={48} className="text-amber-500 mb-2" />
                <p className="font-semibold text-amber-700">POD Uploaded</p>
                <p className="text-xs text-gray-400 mt-1">Awaiting confirmation</p>
              </>
            ) : (
              <>
                <Upload size={48} className="text-gray-300 mb-2" />
                <p className="font-semibold text-gray-500">POD Pending</p>
                <p className="text-xs text-gray-400 mt-1">Upload proof of delivery</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Line items */}
      {lr.items && lr.items.length > 0 && (
        <div className="card p-0">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Items</h3>
          </div>
          <table className="w-full">
            <thead><tr className="bg-gray-50">
              <th className="table-header">Description</th>
              <th className="table-header">Qty</th>
              <th className="table-header">Weight</th>
              <th className="table-header">Rate</th>
              <th className="table-header">Amount</th>
              <th className="table-header">Invoice No.</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {lr.items.map((item) => (
                <tr key={item.id}>
                  <td className="table-cell">{item.description}</td>
                  <td className="table-cell">{item.quantity} {item.unit}</td>
                  <td className="table-cell">{item.weight || '—'} kg</td>
                  <td className="table-cell">₹{Number((item.rate || 0) ?? 0).toLocaleString('en-IN')}</td>
                  <td className="table-cell font-medium">₹{Number((item.amount || 0) ?? 0).toLocaleString('en-IN')}</td>
                  <td className="table-cell font-mono text-sm">{item.invoice_number || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
