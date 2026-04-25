import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, AlertTriangle, Search } from 'lucide-react';
import { fuelPumpService } from '@/services/fuelPumpService';

export default function PumpFuelLogPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['fuel-issues', page, flaggedOnly],
    queryFn: () => fuelPumpService.getIssues({ page, limit: 20, flagged_only: flaggedOnly }),
  });

  const issues = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fuel Issue Log</h1>
          <p className="text-sm text-gray-500">All fuel dispensing records</p>
        </div>
        <button
          onClick={() => navigate('/pump/issue')}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm"
        >
          <Plus size={16} /> Issue Fuel
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search by vehicle or receipt..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={flaggedOnly}
            onChange={(e) => { setFlaggedOnly(e.target.checked); setPage(1); }}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          Flagged only
        </label>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty (L)</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Odometer</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : issues.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No fuel issues found</td></tr>
              ) : (
                issues.map((issue: any) => (
                  <tr key={issue.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">
                      {new Date(issue.issued_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                      <div className="text-xs text-gray-400">
                        {new Date(issue.issued_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {issue.vehicle_registration || `#${issue.vehicle_id}`}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {issue.driver_name || (issue.driver_id ? `#${issue.driver_id}` : '-')}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {Number(issue.quantity_litres).toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      ₹{Number(issue.rate_per_litre).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      ₹{Number(issue.total_amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {issue.odometer_reading ? `${Number(issue.odometer_reading).toLocaleString()} km` : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {issue.is_flagged ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                          <AlertTriangle size={12} /> Flagged
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">OK</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between text-sm">
            <span className="text-gray-500">
              Page {pagination.page} of {pagination.pages} ({pagination.total} records)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 border border-gray-300 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={page >= pagination.pages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 border border-gray-300 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
