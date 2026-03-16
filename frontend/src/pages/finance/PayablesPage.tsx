import { useQuery } from '@tanstack/react-query';
import { financeService } from '@/services/dataService';

export default function PayablesPage() {
  const { data: payables, isLoading } = useQuery({
    queryKey: ['payables'],
    queryFn: () => financeService.getPayables(),
  });

  const getAgingColor = (days: number) => {
    if (days > 90) return 'text-red-600 bg-red-50';
    if (days > 60) return 'text-orange-600 bg-orange-50';
    if (days > 30) return 'text-amber-600 bg-amber-50';
    return 'text-green-600 bg-green-50';
  };

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Payables</h1>
          <p className="page-subtitle">Track amounts payable to vendors and service providers</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '0-30 Days', color: 'text-green-600' },
          { label: '31-60 Days', color: 'text-amber-600' },
          { label: '61-90 Days', color: 'text-orange-600' },
          { label: '90+ Days', color: 'text-red-600' },
        ].map((bucket) => (
          <div key={bucket.label} className="card py-4">
            <p className="text-sm text-gray-500">{bucket.label}</p>
            <p className={`text-xl font-bold ${bucket.color}`}>₹0</p>
          </div>
        ))}
      </div>

      <div className="card p-0">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="table-header">Vendor</th>
              <th className="table-header">Description</th>
              <th className="table-header text-right">Total</th>
              <th className="table-header text-right">Paid</th>
              <th className="table-header text-right">Pending</th>
              <th className="table-header">Due Date</th>
              <th className="table-header">Aging</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : (payables || []).length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">No outstanding payables</td></tr>
            ) : (
              (payables || [])
                .filter((item) => item !== null && item !== undefined)
                .map((p, index) => (
                <tr key={p.id ?? `${p.vendor_name ?? 'vendor'}-${p.due_date ?? 'due'}-${index}`} className="hover:bg-gray-50">
                  <td className="table-cell font-medium">{p.vendor_name}</td>
                  <td className="table-cell">{p.description}</td>
                  <td className="table-cell text-right">₹{(p.total_amount ?? 0).toLocaleString('en-IN')}</td>
                  <td className="table-cell text-right text-green-600">₹{(p.paid_amount ?? 0).toLocaleString('en-IN')}</td>
                  <td className="table-cell text-right text-red-600 font-medium">₹{(p.pending_amount ?? 0).toLocaleString('en-IN')}</td>
                  <td className="table-cell">{new Date(p.due_date).toLocaleDateString('en-IN')}</td>
                  <td className="table-cell">
                    <span className={`badge ${getAgingColor(p.aging_days)}`}>{p.aging_days} days</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
