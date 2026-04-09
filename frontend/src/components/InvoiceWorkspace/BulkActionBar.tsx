import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CheckSquare, Download, RefreshCw } from 'lucide-react';
import { invoiceWorkspaceService } from '@/services/invoiceWorkspaceService';

interface BulkActionBarProps {
  batchId: number;
  totalApproved: number;
  totalConfirmed: number;
  onSelectionChange?: (ids: number[]) => void;
}

export default function BulkActionBar({ batchId, totalApproved, totalConfirmed }: BulkActionBarProps) {
  const qc = useQueryClient();
  const [isExporting, setIsExporting] = useState(false);

  const confirmAllMutation = useMutation({
    mutationFn: () => invoiceWorkspaceService.confirmAll(batchId),
    onSuccess: (data) => {
      toast.success(`${data.confirmed_count} items confirmed`);
      qc.invalidateQueries({ queryKey: ['ifias-items', batchId] });
      qc.invalidateQueries({ queryKey: ['ifias-batch', batchId] });
    },
    onError: () => toast.error('Confirm all failed'),
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await invoiceWorkspaceService.exportBatch(batchId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `IFIAS_Batch${batchId}_Export.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Excel exported successfully');
      qc.invalidateQueries({ queryKey: ['ifias-batch', batchId] });
    } catch {
      toast.error('Export failed — ensure items are confirmed first');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">
      <span className="text-xs text-gray-500 mr-2">Bulk actions:</span>

      <button
        onClick={() => confirmAllMutation.mutate()}
        disabled={confirmAllMutation.isPending || totalApproved === 0}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <CheckSquare size={13} />
        Confirm All Auto-approved{totalApproved > 0 ? ` (${totalApproved})` : ''}
      </button>

      <button
        onClick={handleExport}
        disabled={isExporting || totalConfirmed === 0}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isExporting ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
        Export to Excel{totalConfirmed > 0 ? ` (${totalConfirmed} confirmed)` : ''}
      </button>
    </div>
  );
}
