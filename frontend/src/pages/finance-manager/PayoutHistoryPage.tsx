import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { financeManagerService } from '@/services/financeManagerService';
import {
  History, CheckCircle2, XCircle, Clock, ArrowUpDown,
  Search,
} from 'lucide-react';

const fmt = (paise: number) => `₹${((paise || 0) / 100).toLocaleString('en-IN')}`;

type TypeFilter = 'all' | 'salary' | 'advance' | 'expense' | 'vendor';

export default function PayoutHistoryPage() {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'created_at' | 'amount_paise'>('created_at');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const { data: payouts, isLoading } = useQuery({
    queryKey: ['payouts', typeFilter],
    queryFn: () => financeManagerService.getPayouts(typeFilter === 'all' ? undefined : typeFilter),
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case 'processed': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle2 size={12} /> Processed</span>;
      case 'processing': case 'queued': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700"><Clock size={12} /> Processing</span>;
      case 'failed': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><XCircle size={12} /> Failed</span>;
      case 'reversed': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700"><XCircle size={12} /> Reversed</span>;
      case 'cancelled': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"><XCircle size={12} /> Cancelled</span>;
      default: return <span className="text-xs text-gray-500">{status}</span>;
    }
  };

  const typeBadge = (type: string) => {
    const colors: Record<string, string> = {
      salary: 'bg-blue-50 text-blue-700',
      advance: 'bg-purple-50 text-purple-700',
      expense: 'bg-teal-50 text-teal-700',
      vendor: 'bg-amber-50 text-amber-700',
    };
    return <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${colors[type] || 'bg-gray-50 text-gray-700'}`}>{type}</span>;
  };

  const items = (payouts || [])
    .filter((p: any) =>
      !search || p.recipient_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.utr?.includes(search) || p.razorpay_payout_id?.includes(search)
    )
    .sort((a: any, b: any) => {
      const aVal = sortField === 'amount_paise' ? a.amount_paise : new Date(a.created_at).getTime();
      const bVal = sortField === 'amount_paise' ? b.amount_paise : new Date(b.created_at).getTime();
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });

  const totalPaise = items.reduce((a: number, p: any) => a + (p.amount_paise || 0), 0);
  const processedCount = items.filter((p: any) => p.status === 'processed').length;

  const toggleSort = (field: 'created_at' | 'amount_paise') => {
    if (sortField === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortField(field); setSortDir('desc'); }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><History size={24} /> Payout History</h1>
          <p className="page-subtitle">
            {items.length} payouts · {fmt(totalPaise)} total · {processedCount} successful
          </p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Payouts', value: items.length, color: 'text-gray-900' },
          { label: 'Total Amount', value: fmt(totalPaise), color: 'text-gray-900' },
          { label: 'Successful', value: processedCount, color: 'text-green-600' },
          { label: 'Failed', value: items.filter((p: any) => p.status === 'failed').length, color: 'text-red-600' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-lg border p-4">
            <p className="text-xs text-gray-500 mb-1">{kpi.label}</p>
            <p className={`text-xl font-semibold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['all', 'salary', 'advance', 'expense', 'vendor'] as TypeFilter[]).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 text-sm rounded-md transition capitalize ${typeFilter === t ? 'bg-white shadow font-medium' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, UTR, ID..."
            className="border rounded-lg pl-8 pr-3 py-1.5 text-sm w-64"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th
                className="py-3 px-4 text-left font-medium text-gray-600 cursor-pointer select-none"
                onClick={() => toggleSort('created_at')}
              >
                Date <ArrowUpDown size={12} className="inline ml-1" />
              </th>
              <th className="py-3 px-4 text-left font-medium text-gray-600">Recipient</th>
              <th className="py-3 px-4 text-center font-medium text-gray-600">Type</th>
              <th
                className="py-3 px-4 text-right font-medium text-gray-600 cursor-pointer select-none"
                onClick={() => toggleSort('amount_paise')}
              >
                Amount <ArrowUpDown size={12} className="inline ml-1" />
              </th>
              <th className="py-3 px-4 text-center font-medium text-gray-600">Method</th>
              <th className="py-3 px-4 text-left font-medium text-gray-600">UTR</th>
              <th className="py-3 px-4 text-center font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={7} className="py-8 text-center text-gray-400">Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="py-8 text-center text-gray-400">No payouts found</td></tr>
            ) : items.map((p: any) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                  {p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                </td>
                <td className="py-3 px-4">
                  <p className="font-medium text-gray-900">{p.recipient_name || '—'}</p>
                  {p.purpose && <p className="text-xs text-gray-400">{p.purpose}</p>}
                </td>
                <td className="py-3 px-4 text-center">{typeBadge(p.payout_type)}</td>
                <td className="py-3 px-4 text-right font-mono font-medium">{fmt(p.amount_paise)}</td>
                <td className="py-3 px-4 text-center text-xs text-gray-500 uppercase">{p.payment_method || '—'}</td>
                <td className="py-3 px-4 text-xs font-mono text-gray-500">{p.utr || '—'}</td>
                <td className="py-3 px-4 text-center">{statusBadge(p.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
