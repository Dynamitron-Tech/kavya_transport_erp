// Banking & Approval Status Widget — Project Associate Dashboard
// Shows pending banking entries, approvals, and rejected items

import {
  CreditCard, Clock, AlertTriangle, XCircle,
  ChevronRight, IndianRupee, CheckCircle2
} from 'lucide-react';

interface BankingEntry {
  id: string;
  job_number: string;
  client: string;
  amount: number;
  type: string;
  status: string;
  date: string;
}

interface BankingData {
  banking_entries_pending: number;
  total_pending_amount: number;
  jobs_awaiting_approval: number;
  rejected_jobs: number;
  pending_entries: BankingEntry[];
  rejected_entries: BankingEntry[];
}

interface Props {
  data: BankingData | undefined;
  isLoading: boolean;
  navigate: (path: string) => void;
}

function BankingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl" />
        ))}
      </div>
      <div className="space-y-2">
        <div className="h-14 bg-gray-100 rounded-lg" />
        <div className="h-14 bg-gray-100 rounded-lg" />
      </div>
    </div>
  );
}

function formatAmount(amount: number): string {
  if (amount >= 100000) {
    return `₹${Number(amount / 100000).toFixed(1)}L`;
  }
  if (amount >= 1000) {
    return `₹${Number(amount / 1000).toFixed(1)}K`;
  }
  return `₹${Number(amount ?? 0).toLocaleString('en-IN')}`;
}

export default function PABankingStatus({ data, isLoading, navigate }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900 text-lg">Banking & Approvals</h3>
          <p className="text-sm text-gray-500">Financial status overview</p>
        </div>
        <button
          onClick={() => navigate('/finance')}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
        >
          Finance <ChevronRight size={16} />
        </button>
      </div>

      <div className="p-5">
        {isLoading ? (
          <BankingSkeleton />
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {/* Pending Entries */}
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                <div className="flex items-center gap-2 mb-1">
                  <Clock size={14} className="text-amber-600" />
                  <span className="text-xs font-medium text-amber-700">Pending</span>
                </div>
                <p className="text-2xl font-bold text-amber-900">
                  {data?.banking_entries_pending || 0}
                </p>
                <p className="text-[11px] text-amber-600 mt-0.5">banking entries</p>
              </div>

              {/* Pending Amount */}
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                <div className="flex items-center gap-2 mb-1">
                  <IndianRupee size={14} className="text-blue-600" />
                  <span className="text-xs font-medium text-blue-700">Amount</span>
                </div>
                <p className="text-2xl font-bold text-blue-900">
                  {formatAmount(data?.total_pending_amount || 0)}
                </p>
                <p className="text-[11px] text-blue-600 mt-0.5">pending total</p>
              </div>

              {/* Awaiting Approval */}
              <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={14} className="text-purple-600" />
                  <span className="text-xs font-medium text-purple-700">Approvals</span>
                </div>
                <p className="text-2xl font-bold text-purple-900">
                  {data?.jobs_awaiting_approval || 0}
                </p>
                <p className="text-[11px] text-purple-600 mt-0.5">jobs awaiting</p>
              </div>

              {/* Rejected */}
              <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                <div className="flex items-center gap-2 mb-1">
                  <XCircle size={14} className="text-red-600" />
                  <span className="text-xs font-medium text-red-700">Rejected</span>
                </div>
                <p className="text-2xl font-bold text-red-900">
                  {data?.rejected_jobs || 0}
                </p>
                <p className="text-[11px] text-red-600 mt-0.5">need attention</p>
              </div>
            </div>

            {/* Pending Entries List */}
            {data?.pending_entries && data.pending_entries.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Pending Entries
                </h4>
                <div className="space-y-2">
                  {data.pending_entries.slice(0, 4).map((entry) => (
                    <div
                      key={entry.id}
                      onClick={() => navigate('/finance')}
                      className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                        <CreditCard size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-900">
                            {entry.job_number}
                          </span>
                          <span className="text-sm font-bold text-gray-900">
                            ₹{Number(entry.amount ?? 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-xs text-gray-500 truncate">{entry.client}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                            {entry.type}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rejected Entries */}
            {data?.rejected_entries && data.rejected_entries.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Rejected — Action Needed
                </h4>
                <div className="space-y-2">
                  {data.rejected_entries.slice(0, 3).map((entry) => (
                    <div
                      key={entry.id}
                      onClick={() => navigate('/finance')}
                      className="flex items-center gap-3 p-2.5 rounded-lg border border-red-100 bg-red-50/50 hover:bg-red-50 cursor-pointer transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                        <XCircle size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-900">
                            {entry.job_number}
                          </span>
                          <span className="text-sm font-bold text-red-700">
                            ₹{Number(entry.amount ?? 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <span className="text-xs text-red-600">{entry.client}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {(!data?.pending_entries || data.pending_entries.length === 0) &&
              (!data?.rejected_entries || data.rejected_entries.length === 0) && (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <CheckCircle2 size={28} className="mb-2 text-emerald-400" />
                  <p className="text-sm font-medium text-emerald-600">All clear!</p>
                  <p className="text-xs text-gray-400 mt-1">No pending banking entries</p>
                </div>
              )}
          </>
        )}
      </div>
    </div>
  );
}
