import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { financeService } from '@/services/dataService';
import { ArrowUpRight, ArrowDownRight, Download } from 'lucide-react';
import type { FilterParams } from '@/types';

export default function LedgerPage() {
  const [filters, setFilters] = useState<FilterParams>({});

  const { data: entries, isLoading } = useQuery({
    queryKey: ['ledger', filters],
    queryFn: () => financeService.getLedger(filters),
  });

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Ledger</h1>
          <p className="page-subtitle">Financial transaction ledger</p>
        </div>
        <div className="flex gap-2">
          <input type="date" className="input-field w-40" onChange={(e) => setFilters({ ...filters, from_date: e.target.value })} />
          <input type="date" className="input-field w-40" onChange={(e) => setFilters({ ...filters, to_date: e.target.value })} />
          <button className="btn-secondary flex items-center gap-2"><Download size={16} /> Export</button>
        </div>
      </div>

      <div className="card p-0">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="table-header">Date</th>
              <th className="table-header">Description</th>
              <th className="table-header">Reference</th>
              <th className="table-header text-right">Debit</th>
              <th className="table-header text-right">Credit</th>
              <th className="table-header text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={6} className="table-cell"><div className="h-4 bg-gray-200 rounded animate-pulse" /></td></tr>
              ))
            ) : (entries || []).length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">No ledger entries found</td></tr>
            ) : (
              (entries || []).map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="table-cell">{new Date(entry.date).toLocaleDateString('en-IN')}</td>
                  <td className="table-cell">{entry.description}</td>
                  <td className="table-cell text-sm text-gray-500">
                    {entry.reference_type && `${entry.reference_type} #${entry.reference_id}`}
                  </td>
                  <td className="table-cell text-right">
                    {entry.ledger_type === 'debit' ? (
                      <span className="text-red-600 font-medium flex items-center justify-end gap-1">
                        <ArrowDownRight size={14} /> ₹{(entry.amount ?? 0).toLocaleString('en-IN')}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="table-cell text-right">
                    {entry.ledger_type === 'credit' ? (
                      <span className="text-green-600 font-medium flex items-center justify-end gap-1">
                        <ArrowUpRight size={14} /> ₹{(entry.amount ?? 0).toLocaleString('en-IN')}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="table-cell text-right font-semibold">₹{(entry.balance ?? 0).toLocaleString('en-IN')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
