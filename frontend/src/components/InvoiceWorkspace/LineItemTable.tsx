import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Check, X, Eye, RefreshCw, Pencil } from 'lucide-react';
import { invoiceWorkspaceService, IfiasLineItem } from '@/services/invoiceWorkspaceService';
import ConfidenceBadge from './ConfidenceBadge';
import api from '@/services/api';

interface LineItemTableProps {
  batchId: number;
  items: IfiasLineItem[];
  onViewPdf: (item: IfiasLineItem) => void;
  // Keyboard mode
  keyboardMode?: boolean;
  focusedItemIdx?: number | null;
  onRowAdvance?: (nextIdx: number) => void;
  onRowConfirm?: (item: IfiasLineItem) => void;
}

const STATUS_STYLES: Record<string, string> = {
  AUTO_APPROVED: 'bg-white',
  NEEDS_REVIEW: 'bg-yellow-50',
  REJECTED: 'bg-red-50',
  CONFIRMED: 'bg-green-50',
  PENDING: 'bg-gray-50',
  PROCESSING: 'bg-blue-50',
};

const STATUS_BADGE: Record<string, string> = {
  AUTO_APPROVED: 'bg-green-100 text-green-800',
  NEEDS_REVIEW: 'bg-yellow-100 text-yellow-800',
  REJECTED: 'bg-red-100 text-red-800',
  CONFIRMED: 'bg-emerald-100 text-emerald-800',
  PENDING: 'bg-gray-100 text-gray-700',
  PROCESSING: 'bg-blue-100 text-blue-800',
};

interface EditCell {
  itemId: number;
  field: 'truck_type' | 'detention_days' | 'sat_slip_no';
  value: string;
}

export default function LineItemTable({ batchId, items, onViewPdf, keyboardMode = false, focusedItemIdx = null, onRowAdvance, onRowConfirm }: LineItemTableProps) {
  const qc = useQueryClient();
  const [editCell, setEditCell] = useState<EditCell | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const detentionRef = useRef<HTMLInputElement>(null);
  const [truckSuggestions, setTruckSuggestions] = useState<string[]>([]);

  // When keyboard mode focuses a row, auto-enter edit mode on truck_type
  useEffect(() => {
    if (!keyboardMode || focusedItemIdx === null) return;
    const item = items[focusedItemIdx];
    if (!item) return;
    const current = item.truck_type_verified ?? item.truck_type ?? '';
    setEditCell({ itemId: item.id, field: 'truck_type', value: current });
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [keyboardMode, focusedItemIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateMutation = useMutation({
    mutationFn: ({ lrId, body }: { lrId: number; body: any }) =>
      invoiceWorkspaceService.updateLineItem(batchId, lrId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ifias-items', batchId] });
      qc.invalidateQueries({ queryKey: ['ifias-batch', batchId] });
    },
    onError: () => toast.error('Update failed'),
  });

  const reprocessMutation = useMutation({
    mutationFn: (lrId: number) => invoiceWorkspaceService.reprocessLr(batchId, lrId),
    onSuccess: () => {
      toast.success('Reprocessing queued');
      qc.invalidateQueries({ queryKey: ['ifias-items', batchId] });
    },
  });

  const handleConfirm = (item: IfiasLineItem) => {
    updateMutation.mutate({ lrId: item.id, body: { processing_status: 'CONFIRMED' } });
  };

  const handleCellEdit = (item: IfiasLineItem, field: EditCell['field']) => {
    const current =
      field === 'truck_type' ? (item.truck_type_verified ?? item.truck_type ?? '') :
      field === 'detention_days' ? String(item.detention_days_verified ?? item.detention_days ?? '') :
      (item.sat_slip_no_verified ?? item.sat_slip_no ?? '');
    setEditCell({ itemId: item.id, field, value: current });
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleCellSave = (item: IfiasLineItem, thenFocus?: 'detention_days' | 'next_row') => {
    if (!editCell) return;
    const body: any = {};
    if (editCell.field === 'detention_days') {
      const parsed = parseInt(editCell.value, 10);
      body.detention_days = isNaN(parsed) ? 0 : parsed;
    } else {
      body[editCell.field] = editCell.value.toUpperCase();
    }
    updateMutation.mutate({ lrId: item.id, body });
    setEditCell(null);

    if (thenFocus === 'detention_days') {
      const detVal = String(item.detention_days_verified ?? item.detention_days ?? '');
      setEditCell({ itemId: item.id, field: 'detention_days', value: detVal });
      setTimeout(() => detentionRef.current?.focus(), 30);
    } else if (thenFocus === 'next_row') {
      const idx = items.findIndex(i => i.id === item.id);
      onRowAdvance?.(idx + 1);
    }
  };

  const displayValue = (item: IfiasLineItem, field: EditCell['field']) => {
    if (field === 'truck_type') return item.truck_type_verified ?? item.truck_type ?? '—';
    if (field === 'detention_days') {
      const v = item.detention_days_verified ?? item.detention_days;
      return v !== null ? String(v) : '—';
    }
    return item.sat_slip_no_verified ?? item.sat_slip_no ?? '—';
  };

  const renderEditableCell = (item: IfiasLineItem, field: EditCell['field']) => {
    const isEditing = editCell?.itemId === item.id && editCell?.field === field;
    const value = displayValue(item, field);

    if (isEditing) {
      const isTruckType = field === 'truck_type';
      return (
        <div className="flex items-center gap-1">
          {isTruckType && truckSuggestions.length > 0 && (
            <datalist id="truck-type-list">
              {truckSuggestions.map(s => <option key={s} value={s} />)}
            </datalist>
          )}
          <input
            ref={field === 'detention_days' ? detentionRef : inputRef}
            type={field === 'detention_days' ? 'number' : 'text'}
            list={isTruckType ? 'truck-type-list' : undefined}
            value={editCell.value}
            onChange={e => {
              const v = isTruckType ? e.target.value.toUpperCase() : e.target.value;
              setEditCell({ ...editCell, value: v });
              if (isTruckType && v.length >= 1) {
                api.get('/accountant/truck-types/suggestions', { params: { prefix: v } })
                  .then(r => setTruckSuggestions(r.data?.data ?? []))
                  .catch(() => {});
              }
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (keyboardMode) {
                  if (isTruckType) {
                    handleCellSave(item, 'detention_days');
                  } else {
                    handleCellSave(item, 'next_row');
                    onRowConfirm?.(item);
                  }
                } else {
                  handleCellSave(item);
                }
              }
              if (e.key === 'Tab') {
                e.preventDefault();
                if (isTruckType) {
                  handleCellSave(item, 'detention_days');
                } else {
                  handleCellSave(item, 'next_row');
                }
              }
              if (e.key === 'Escape') setEditCell(null);
            }}
            className="w-24 px-1.5 py-0.5 text-xs border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button onClick={() => handleCellSave(item)} className="text-green-600 hover:text-green-700">
            <Check size={14} />
          </button>
          <button onClick={() => setEditCell(null)} className="text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1 group/cell">
        <span className={`text-sm ${item.manually_reviewed ? 'text-orange-700 font-medium' : ''}`}>
          {value}
        </span>
        {item.auto_filled && field === 'truck_type' && (
          <ConfidenceBadge score={item.confidence_score} flags={item.flags} field={field} />
        )}
        <button
          onClick={() => handleCellEdit(item, field)}
          className="opacity-0 group-hover/cell:opacity-100 text-gray-400 hover:text-blue-600 transition-opacity"
        >
          <Pencil size={12} />
        </button>
      </div>
    );
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-sm">No line items found for this filter.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {['SL', 'LR Number', 'Truck No', 'Truck Type', 'Detention', 'SAT Slip', 'Route', 'Status', 'Actions'].map(h => (
              <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {items.map((item, idx) => {
            const isFocused = keyboardMode && focusedItemIdx === idx;
            const detentionVal = item.detention_days_verified ?? item.detention_days ?? 0;
            const highDetention = detentionVal > 5;
            return (
            <tr
              key={item.id}
              className={`${isFocused ? 'border-l-4 border-l-blue-500 bg-blue-50/40' : STATUS_STYLES[item.processing_status] ?? ''} hover:bg-blue-50/30 transition-colors`}
            >
              <td className="px-3 py-2 text-gray-500 text-xs">{item.excel_row_number ?? idx + 1}</td>

              <td className="px-3 py-2 font-mono text-xs text-gray-900 whitespace-nowrap">
                {item.lr_number}
              </td>

              <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                {item.truck_number ?? '—'}
              </td>

              <td className="px-3 py-2 whitespace-nowrap">
                {renderEditableCell(item, 'truck_type')}
              </td>

              <td className={`px-3 py-2 whitespace-nowrap ${highDetention ? 'bg-amber-50' : ''}`}>
                {renderEditableCell(item, 'detention_days')}
                {highDetention && (
                  <span className="ml-1 text-xs text-amber-600 font-medium">⚠ {detentionVal}d</span>
                )}
              </td>

              <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">
                {renderEditableCell(item, 'sat_slip_no')}
              </td>

              <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                {item.from_location && item.to_location
                  ? `${item.from_location} → ${item.to_location}`
                  : '—'}
              </td>

              <td className="px-3 py-2 whitespace-nowrap">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[item.processing_status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {item.processing_status.replace('_', ' ')}
                </span>
                {item.manually_reviewed && (
                  <span className="ml-1 text-xs text-orange-600">✎</span>
                )}
              </td>

              <td className="px-3 py-2 whitespace-nowrap">
                <div className="flex items-center gap-1">
                  {item.source_pdf_s3 && (
                    <button
                      onClick={() => onViewPdf(item)}
                      title="View PDF"
                      className="p-1 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
                    >
                      <Eye size={14} />
                    </button>
                  )}
                  {(item.processing_status === 'AUTO_APPROVED' || item.processing_status === 'NEEDS_REVIEW') && (
                    <button
                      onClick={() => handleConfirm(item)}
                      title="Confirm"
                      className="p-1 text-gray-400 hover:text-green-600 rounded hover:bg-green-50"
                    >
                      <Check size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => reprocessMutation.mutate(item.id)}
                    title="Reprocess"
                    className="p-1 text-gray-400 hover:text-purple-600 rounded hover:bg-purple-50"
                    disabled={reprocessMutation.isPending}
                  >
                    <RefreshCw size={14} className={reprocessMutation.isPending ? 'animate-spin' : ''} />
                  </button>
                </div>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
