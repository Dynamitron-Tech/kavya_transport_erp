import React from 'react';
import { X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { IfiasLineItem, ValidationFlag } from '@/services/invoiceWorkspaceService';

interface PDFPreviewPanelProps {
  item: IfiasLineItem | null;
  onClose: () => void;
  onConfirm: (item: IfiasLineItem) => void;
}

const FLAG_COLORS: Record<string, string> = {
  critical: 'text-red-700 bg-red-50 border-red-200',
  warning: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  info: 'text-gray-600 bg-gray-50 border-gray-200',
};

export default function PDFPreviewPanel({ item, onClose, onConfirm }: PDFPreviewPanelProps) {
  if (!item) return null;

  const pdfUrl = item.source_pdf_s3
    ? `/api/v1/documents/proxy?key=${encodeURIComponent(item.source_pdf_s3)}`
    : null;

  const autoFill = item.auto_fill_data ?? {};
  const confPct = item.confidence_score !== null ? Math.round((item.confidence_score ?? 0) * 100) : null;

  const comparisonRows = [
    { label: 'LR Number', pdf: item.lr_number, excel: item.lr_number },
    { label: 'Truck No', pdf: '—', excel: item.truck_number ?? '—' },
    { label: 'Truck Type', pdf: item.truck_type_verified ?? '—', excel: item.truck_type ?? '—' },
    { label: 'Detention Days', pdf: item.detention_days_verified != null ? String(item.detention_days_verified) : '—', excel: item.detention_days != null ? String(item.detention_days) : '—' },
    { label: 'SAT Slip No', pdf: item.sat_slip_no_verified ?? '—', excel: item.sat_slip_no ?? '—' },
  ];

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[520px] bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">Satisfaction Slip Preview</h3>
          <p className="text-xs text-gray-500 font-mono">{item.lr_number}</p>
        </div>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* PDF iframe */}
        <div className="h-72 border-b border-gray-200 bg-gray-100">
          {pdfUrl ? (
            <iframe src={pdfUrl} className="w-full h-full" title="Satisfaction Slip PDF" />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              PDF not available
            </div>
          )}
        </div>

        {/* Extracted vs Excel comparison */}
        <div className="p-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Extracted vs Excel
          </h4>
          <div className="rounded-lg border border-gray-200 overflow-hidden text-xs">
            <div className="grid grid-cols-3 bg-gray-50 px-3 py-2 font-medium text-gray-600 border-b border-gray-200">
              <span>Field</span>
              <span className="text-blue-700">From PDF</span>
              <span className="text-gray-700">From Excel</span>
            </div>
            {comparisonRows.map(row => {
              const match = row.pdf === row.excel || row.pdf === '—';
              return (
                <div key={row.label} className="grid grid-cols-3 px-3 py-2 border-b border-gray-100 last:border-0">
                  <span className="text-gray-500">{row.label}</span>
                  <span className={`font-mono font-medium ${!match ? 'text-red-600' : 'text-blue-700'}`}>{row.pdf}</span>
                  <span className="font-mono text-gray-700">{row.excel}</span>
                </div>
              );
            })}
          </div>

          {/* Confidence score */}
          {confPct !== null && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-gray-500">OCR Confidence:</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${confPct >= 85 ? 'bg-green-500' : confPct >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${confPct}%` }}
                />
              </div>
              <span className={`text-xs font-bold ${confPct >= 85 ? 'text-green-700' : confPct >= 60 ? 'text-yellow-700' : 'text-red-700'}`}>
                {confPct}%
              </span>
            </div>
          )}

          {/* Validation flags */}
          {item.flags && item.flags.length > 0 && (
            <div className="mt-3">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Validation Flags
              </h4>
              <div className="space-y-1.5">
                {item.flags.map((flag: ValidationFlag, i: number) => (
                  <div key={i} className={`flex gap-2 px-3 py-2 rounded border text-xs ${FLAG_COLORS[flag.severity] ?? FLAG_COLORS.info}`}>
                    <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium capitalize">{flag.field}: </span>
                      {flag.message}
                      {flag.value_found && <span className="ml-1 font-mono">({flag.value_found})</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
        <button
          onClick={() => onConfirm(item)}
          disabled={item.processing_status === 'CONFIRMED'}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          <CheckCircle2 size={15} />
          {item.processing_status === 'CONFIRMED' ? 'Already Confirmed' : 'Confirm This Slip'}
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
