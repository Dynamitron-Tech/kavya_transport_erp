import { useQuery } from '@tanstack/react-query';
import { financeService } from '@/services/dataService';
import { safeArray } from '@/utils/helpers';

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

  const items = safeArray<any>(receivables).map((r: any, idx: number) => ({
    id: r.id ?? r.client_id ?? idx + 1,
    client_name: r.client_name || `Client #${r.client_id ?? idx + 1}`,
    invoice_number: r.invoice_number || r.client_code || '-',
    total_amount: Number(r.total_amount ?? r.total_due ?? 0),
    received_amount: Number(r.received_amount ?? 0),
    pending_amount: Number(r.pending_amount ?? r.total_due ?? 0),
    due_date: r.due_date || r.oldest_due || null,
    aging_days: Number(r.aging_days ?? (r.oldest_due ? Math.max(0, Math.floor((Date.now() - new Date(r.oldest_due).getTime()) / (1000 * 60 * 60 * 24))) : 0)),
  }));

  const sumAging = (from: number, to: number) =>
    items
      .filter((r) => r.aging_days >= from && r.aging_days <= to)
      .reduce((sum, r) => sum + r.pending_amount, 0);

  const total90Plus = items
    .filter((r) => r.aging_days > 90)
    .reduce((sum, r) => sum + r.pending_amount, 0);

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
          { label: '0-30 Days', color: 'text-green-600', value: sumAging(0, 30) },
          { label: '31-60 Days', color: 'text-amber-600', value: sumAging(31, 60) },
          { label: '61-90 Days', color: 'text-orange-600', value: sumAging(61, 90) },
          { label: '90+ Days', color: 'text-red-600', value: total90Plus },
        ].map((bucket) => (
          <div key={bucket.label} className="card py-4">
            <p className="text-sm text-gray-500">{bucket.label}</p>
            <p className={`text-xl font-bold ${bucket.color}`}>₹{Number(bucket.value || 0).toLocaleString('en-IN')}</p>
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
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">No outstanding receivables</td></tr>
            ) : (
              items.map((r, index) => (
                <tr key={r.id ?? `${r.invoice_number ?? 'invoice'}-${r.due_date ?? 'due'}-${index}`} className="hover:bg-gray-50">
                  <td className="table-cell font-medium">{r.client_name}</td>
                  <td className="table-cell font-mono text-sm text-primary-600">{r.invoice_number}</td>
                  <td className="table-cell text-right">₹{(r.total_amount ?? 0).toLocaleString('en-IN')}</td>
                  <td className="table-cell text-right text-green-600">₹{(r.received_amount ?? 0).toLocaleString('en-IN')}</td>
                  <td className="table-cell text-right text-red-600 font-medium">₹{(r.pending_amount ?? 0).toLocaleString('en-IN')}</td>
                  <td className="table-cell">{r.due_date ? new Date(r.due_date).toLocaleDateString('en-IN') : '—'}</td>
                  <td className="table-cell">
                    <span className={`badge ${getAgingColor(r.aging_days)}`}>
                      {Number(r.aging_days || 0)} days
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
