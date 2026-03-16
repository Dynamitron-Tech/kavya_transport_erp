import { useQuery } from '@tanstack/react-query';
import { financeService } from '@/services/dataService';

export default function ReceivablesPage() {
  const { data: receivables, isLoading } = useQuery({
    queryKey: ['receivables'],
    queryFn: () => financeService.getReceivables(),
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
          <h1 className="page-title">Receivables</h1>
          <p className="page-subtitle">Track outstanding amounts from clients</p>
        </div>
      </div>

      {/* Aging summary cards */}
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
              <th className="table-header">Client</th>
              <th className="table-header">Invoice</th>
              <th className="table-header text-right">Total</th>
              <th className="table-header text-right">Received</th>
              <th className="table-header text-right">Pending</th>
              <th className="table-header">Due Date</th>
              <th className="table-header">Aging</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : (receivables || []).length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">No outstanding receivables</td></tr>
            ) : (
              (receivables || []).map((r, index) => (
                <tr key={r.id ?? `${r.invoice_number ?? 'invoice'}-${r.due_date ?? 'due'}-${index}`} className="hover:bg-gray-50">
                  <td className="table-cell font-medium">{r.client_name}</td>
                  <td className="table-cell font-mono text-sm text-primary-600">{r.invoice_number}</td>
                  <td className="table-cell text-right">₹{(r.total_amount ?? 0).toLocaleString('en-IN')}</td>
                  <td className="table-cell text-right text-green-600">₹{(r.received_amount ?? 0).toLocaleString('en-IN')}</td>
                  <td className="table-cell text-right text-red-600 font-medium">₹{(r.pending_amount ?? 0).toLocaleString('en-IN')}</td>
                  <td className="table-cell">{new Date(r.due_date).toLocaleDateString('en-IN')}</td>
                  <td className="table-cell">
                    <span className={`badge ${getAgingColor(r.aging_days)}`}>
                      {r.aging_days} days
                    </span>
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
