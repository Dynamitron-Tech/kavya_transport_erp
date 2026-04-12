import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { lrService } from '@/services/dataService';
import { StatusBadge, LoadingPage } from '@/components/common/Modal';
import { ArrowLeft, Printer, ChevronRight, Truck, User, Phone } from 'lucide-react';

export default function LRDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: lr, isLoading } = useQuery({
    queryKey: ['lr', id],
    queryFn: () => lrService.get(Number(id)),
    enabled: !!id,
    retry: false,
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
          <button onClick={handlePrint} className="btn-secondary flex items-center gap-2 text-sm"><Printer size={14} /> Print</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Consignor</h3>
          <div className="space-y-2 text-sm">
            <p className="font-medium text-gray-900">{lr.consignor_name}</p>
            {lr.consignor_address && <p className="text-gray-500">{lr.consignor_address}</p>}
            {lr.consignor_gstin && <p className="text-gray-400">GST: {lr.consignor_gstin}</p>}
            {lr.consignor_phone && <p className="text-gray-400 flex items-center gap-1"><Phone size={11} /> {lr.consignor_phone}</p>}
          </div>
        </div>
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Consignee</h3>
          <div className="space-y-2 text-sm">
            <p className="font-medium text-gray-900">{lr.consignee_name}</p>
            {lr.consignee_address && <p className="text-gray-500">{lr.consignee_address}</p>}
            {lr.consignee_gstin && <p className="text-gray-400">GST: {lr.consignee_gstin}</p>}
            {lr.consignee_phone && <p className="text-gray-400 flex items-center gap-1"><Phone size={11} /> {lr.consignee_phone}</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Route & E-way Bill</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Origin</span><span>{lr.origin}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Destination</span><span>{lr.destination}</span></div>
            {lr.eway_bill_number && <div className="flex justify-between"><span className="text-gray-500">E-way Bill No.</span><span className="font-mono">{lr.eway_bill_number}</span></div>}
            {lr.eway_bill_date && <div className="flex justify-between"><span className="text-gray-500">E-way Bill Date</span><span>{new Date(lr.eway_bill_date).toLocaleDateString('en-IN')}</span></div>}
            {lr.eway_bill_valid_until && <div className="flex justify-between"><span className="text-gray-500">Valid Until</span><span>{new Date(lr.eway_bill_valid_until).toLocaleDateString('en-IN')}</span></div>}
          </div>
        </div>
        {(lr.vehicle_registration || lr.driver_name) && (
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Vehicle & Driver</h3>
            <div className="space-y-3 text-sm">
              {lr.vehicle_registration && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Truck size={15} className="text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Vehicle</p>
                    <p className="font-medium text-gray-900">{lr.vehicle_registration}</p>
                  </div>
                </div>
              )}
              {lr.driver_name && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                    <User size={15} className="text-green-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Driver</p>
                    <p className="font-medium text-gray-900">{lr.driver_name}</p>
                    {lr.driver_phone && <p className="text-xs text-gray-400">{lr.driver_phone}</p>}
                  </div>
                </div>
              )}
              {lr.transport_type && (
                <div className="flex justify-between pt-1 border-t border-gray-50">
                  <span className="text-gray-500">Transport Type</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${lr.transport_type === 'market' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                    {lr.transport_type === 'market' ? 'Market Trip' : 'Fleet Vehicle'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Freight Details</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Freight Amount</span><span className="font-semibold">₹{Number(lr.freight_amount || 0).toLocaleString('en-IN')}</span></div>
            {Number(lr.loading_charges || 0) > 0 && <div className="flex justify-between"><span className="text-gray-500">Loading Charges</span><span>₹{Number(lr.loading_charges).toLocaleString('en-IN')}</span></div>}
            {Number(lr.unloading_charges || 0) > 0 && <div className="flex justify-between"><span className="text-gray-500">Unloading Charges</span><span>₹{Number(lr.unloading_charges).toLocaleString('en-IN')}</span></div>}
            {Number(lr.detention_charges || 0) > 0 && <div className="flex justify-between"><span className="text-gray-500">Detention Charges</span><span>₹{Number(lr.detention_charges).toLocaleString('en-IN')}</span></div>}
            {Number(lr.other_charges || 0) > 0 && <div className="flex justify-between"><span className="text-gray-500">Other Charges</span><span>₹{Number(lr.other_charges).toLocaleString('en-IN')}</span></div>}
            <div className="flex justify-between border-t border-gray-100 pt-2"><span className="text-gray-500">Total Freight</span><span className="font-bold text-gray-900">₹{Number(lr.total_freight || lr.freight_amount || 0).toLocaleString('en-IN')}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Advance</span><span>₹{Number(lr.advance_amount || 0).toLocaleString('en-IN')}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Balance</span><span className="font-semibold text-red-600">₹{Number(lr.balance_amount || 0).toLocaleString('en-IN')}</span></div>
            <div className="border-t border-gray-100 pt-2 space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">Total Weight</span><span>{lr.total_weight ? `${lr.total_weight} kg` : '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Packages</span><span>{lr.total_packages > 0 ? lr.total_packages : '—'}</span></div>
              {lr.declared_value && Number(lr.declared_value) > 0 && <div className="flex justify-between"><span className="text-gray-500">Declared Value</span><span>₹{Number(lr.declared_value).toLocaleString('en-IN')}</span></div>}
            </div>
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
              <th className="table-header">Packages</th>
              <th className="table-header">Actual Weight</th>
              <th className="table-header">Charged Weight</th>
              <th className="table-header">Rate</th>
              <th className="table-header">Amount</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {lr.items.map((item: any) => (
                <tr key={item.id}>
                  <td className="table-cell">
                    <div className="font-medium">{item.description}</div>
                    {item.hsn_code && <div className="text-xs text-gray-400">HSN: {item.hsn_code}</div>}
                    {item.package_type && <div className="text-xs text-gray-400">{item.package_type}</div>}
                  </td>
                  <td className="table-cell">{item.packages ?? '—'}</td>
                  <td className="table-cell">{item.actual_weight != null ? `${item.actual_weight} kg` : '—'}</td>
                  <td className="table-cell">{item.charged_weight != null ? `${item.charged_weight} kg` : '—'}</td>
                  <td className="table-cell">₹{Number(item.rate || 0).toLocaleString('en-IN')}</td>
                  <td className="table-cell font-medium">₹{Number(item.amount || 0).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
