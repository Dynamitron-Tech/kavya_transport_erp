import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { invoiceWorkspaceService } from '@/services/invoiceWorkspaceService';
import {
  FileText, Building2, ChevronRight, CheckCircle2, Clock,
  FileSpreadsheet, Upload, Eye, AlertTriangle, Wallet,
} from 'lucide-react';

export default function AccountantDashboardPage() {
  const navigate = useNavigate();

  const { data: batches } = useQuery({
    queryKey: ['ifias-batches'],
    queryFn: () => invoiceWorkspaceService.getBatches(),
  });

  const recentBatches = (batches || []).slice(0, 6);
  const reviewPending = recentBatches.filter((b: any) => b.review_lrs > 0);
  const totalReviewLRs = reviewPending.reduce((a: number, b: any) => a + (b.review_lrs || 0), 0);

  const batchStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': case 'exported': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle2 size={10} /> {status}</span>;
      case 'processing': case 'validating': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><Clock size={10} /> {status}</span>;
      case 'failed': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><AlertTriangle size={10} /> Failed</span>;
      default: return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{status}</span>;
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><FileSpreadsheet size={22} /> Accountant Dashboard</h1>
          <p className="page-subtitle">IFIAS invoice processing & bank tools</p>
        </div>
      </div>

      {/* Alert: LRs needing review */}
      {totalReviewLRs > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Eye size={18} className="text-amber-600" />
            <span className="text-sm font-medium text-amber-800">
              {totalReviewLRs} LR{totalReviewLRs > 1 ? 's' : ''} need manual review in IFIAS
            </span>
          </div>
          <button
            onClick={() => navigate('/accountant/invoice-workspace')}
            className="bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-amber-600"
          >
            Open Workspace
          </button>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* IFIAS Recent Batches — 2/3 */}
        <div className="lg:col-span-2 bg-white rounded-lg border">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <FileText size={15} /> IFIAS — Recent Batches
            </h3>
            <button
              onClick={() => navigate('/accountant/invoice-workspace')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              Open Workspace <ChevronRight size={13} />
            </button>
          </div>
          {recentBatches.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              <FileSpreadsheet size={36} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No IFIAS batches yet</p>
              <p className="text-xs mt-1 text-gray-300">Upload a Britannia Excel to get started</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-2.5 px-4 text-left font-medium text-gray-500 text-xs">Client</th>
                  <th className="py-2.5 px-4 text-left font-medium text-gray-500 text-xs">Period</th>
                  <th className="py-2.5 px-4 text-center font-medium text-gray-500 text-xs">LRs</th>
                  <th className="py-2.5 px-4 text-center font-medium text-gray-500 text-xs">Review</th>
                  <th className="py-2.5 px-4 text-center font-medium text-gray-500 text-xs">Status</th>
                  <th className="py-2.5 px-4 text-right font-medium text-gray-500 text-xs">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentBatches.map((batch: any) => (
                  <tr
                    key={batch.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate('/accountant/invoice-workspace')}
                  >
                    <td className="py-3 px-4 font-medium text-gray-900">{batch.client_name || batch.transporter_name || '—'}</td>
                    <td className="py-3 px-4 text-gray-500">{batch.billing_period || '—'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-medium text-gray-900">{batch.processed_lrs}</span>
                      <span className="text-gray-400">/{batch.total_lrs}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {batch.review_lrs > 0
                        ? <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-medium">{batch.review_lrs}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-3 px-4 text-center">{batchStatusBadge(batch.status)}</td>
                    <td className="py-3 px-4 text-right text-xs text-gray-400">
                      {batch.created_at ? new Date(batch.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Quick Actions — 1/3 */}
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h3>
          <div className="space-y-2">
            <button
              onClick={() => navigate('/accountant/invoice-workspace')}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition text-left"
            >
              <Upload size={17} className="text-blue-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-900">Invoice Workspace</p>
                <p className="text-xs text-blue-600">IFIAS batch processing</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/accountant/banking')}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-cyan-50 hover:bg-cyan-100 transition text-left"
            >
              <Building2 size={17} className="text-cyan-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-cyan-900">Bank Statement</p>
                <p className="text-xs text-cyan-600">Download & reconcile with Tally</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/accountant/payments')}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-purple-50 hover:bg-purple-100 transition text-left"
            >
              <Wallet size={17} className="text-purple-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-purple-900">Driver Advance</p>
                <p className="text-xs text-purple-600">Issue trip advances</p>
              </div>
            </button>
            <button
              onClick={() => navigate('/fleet/gst-verify')}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-amber-50 hover:bg-amber-100 transition text-left"
            >
              <CheckCircle2 size={17} className="text-amber-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-900">GST Verification</p>
                <p className="text-xs text-amber-600">Verify GSTIN filing status</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
