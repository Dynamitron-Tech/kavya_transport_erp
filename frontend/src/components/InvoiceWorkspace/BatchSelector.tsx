import React, { useRef, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { invoiceWorkspaceService } from '@/services/invoiceWorkspaceService';
import type { ProcessingBatch } from '@/services/invoiceWorkspaceService';

interface BatchSelectorProps {
  batches: ProcessingBatch[];
  selectedBatchId: number | null;
  onSelect: (id: number) => void;
  isLoading?: boolean;
  onUploadSuccess?: (batchId: number) => void;
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  EXPORTED: 'bg-purple-100 text-purple-700',
};

export default function BatchSelector({ batches, selectedBatchId, onSelect, isLoading, onUploadSuccess }: BatchSelectorProps) {
  const selected = batches.find(b => b.id === selectedBatchId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await invoiceWorkspaceService.uploadExcel(file);
      toast.success(`Batch created — processing ${result.total_lrs ?? ''} LRs`);
      onUploadSuccess?.(result.batch_id);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Billing Batch</label>
          <select
            value={selectedBatchId ?? ''}
            onChange={e => onSelect(Number(e.target.value))}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          >
            <option value="">— Select a batch —</option>
            {batches.map(b => (
              <option key={b.id} value={b.id}>
                {b.transporter_name} — {b.billing_period ?? 'Unknown period'} ({b.total_lrs} LRs)
              </option>
            ))}
          </select>
        </div>

        {/* Upload new batch */}
        <div className="shrink-0">
          <label className="block text-xs font-medium text-gray-500 mb-1 sm:text-right">New Batch</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? (
              <><Loader2 size={14} className="animate-spin" /> Uploading…</>
            ) : (
              <><Upload size={14} /> Upload Excel</>
            )}
          </button>
        </div>

        {selected && (
          <div className="flex flex-wrap gap-3 text-sm">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLOR[selected.status] ?? 'bg-gray-100'}`}>
              {selected.status}
            </span>
            <div className="flex gap-4 text-gray-600">
              <span className="text-green-700 font-medium">{selected.approved_lrs} auto</span>
              <span className="text-yellow-700 font-medium">{selected.review_lrs} review</span>
              <span className="text-red-700 font-medium">{selected.rejected_lrs} rejected</span>
              <span className="text-blue-700 font-medium">{selected.confirmed_lrs} confirmed</span>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Processing progress</span>
            <span>{selected.processed_lrs} / {selected.total_lrs}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${selected.total_lrs > 0 ? (selected.processed_lrs / selected.total_lrs) * 100 : 0}%` }}
            />
          </div>
          {selected.client_name && (
            <p className="text-xs text-gray-400 mt-1">Client: {selected.client_name}</p>
          )}
        </div>
      )}
    </div>
  );
}
