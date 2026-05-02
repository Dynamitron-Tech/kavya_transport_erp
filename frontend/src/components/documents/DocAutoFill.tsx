import React, { useRef, useState, useCallback } from 'react';
import { Scan, Loader2, CheckCircle2, AlertCircle, X, RefreshCw } from 'lucide-react';
import { documentService } from '@/services/dataService';

type ExtractState = 'idle' | 'extracting' | 'done' | 'error';

interface Props {
  documentType: string;  // e.g. 'rc', 'driving_license'
  entityType: string;    // e.g. 'vehicle', 'driver'
  label?: string;
  onExtracted?: (data: Record<string, any>) => void;
  onFile?: (file: File) => void;
}

const DOC_LABELS: Record<string, string> = {
  rc: 'Registration Certificate (RC)',
  driving_license: 'Driving License',
  insurance: 'Insurance Certificate',
  pollution: 'Pollution Certificate',
  fitness: 'Fitness Certificate',
  permit: 'Permit',
};

export function DocAutoFill({ documentType, entityType, label, onExtracted, onFile }: Props) {
  const [state, setState] = useState<ExtractState>('idle');
  const [extractedData, setExtractedData] = useState<Record<string, any>>({});
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const docLabel = label ?? DOC_LABELS[documentType] ?? documentType.replace(/_/g, ' ');

  const processFile = useCallback(async (file: File) => {
    setState('extracting');
    setError('');
    if (onFile) onFile(file);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('document_type', documentType);
      fd.append('entity_type', entityType);
      const result = await documentService.extract(fd);
      const data = result?.data ?? {};
      setExtractedData(data);
      setState('done');
      if (onExtracted) onExtracted(data);
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.response?.data?.message ?? err?.message ?? 'Extraction failed';
      setError(String(msg));
      setState('error');
    }
  }, [documentType, entityType, onExtracted, onFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset so same file can be re-selected
    e.target.value = '';
  };

  const filledFields = Object.entries(extractedData)
    .filter(([, v]) => v !== null && v !== undefined && v !== '' && !Array.isArray(v) && typeof v !== 'object')
    .slice(0, 6);

  if (state === 'idle') {
    return (
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-3.5 cursor-pointer transition-all select-none ${
          dragOver
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={handleInput}
        />
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <Scan size={16} className="text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-700">Scan {docLabel} to auto-fill</p>
            <p className="text-xs text-gray-400">Drop an image or PDF — AI extracts fields automatically</p>
          </div>
          <span className="text-xs text-blue-500 font-medium px-2 py-0.5 bg-blue-50 rounded-full whitespace-nowrap">
            Optional
          </span>
        </div>
      </div>
    );
  }

  if (state === 'extracting') {
    return (
      <div className="border-2 border-blue-200 rounded-xl p-3.5 bg-blue-50">
        <div className="flex items-center gap-3">
          <Loader2 size={16} className="animate-spin text-blue-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-700">Reading document…</p>
            <p className="text-xs text-blue-500">AI is extracting fields from your {docLabel}</p>
          </div>
        </div>
        <div className="mt-3 space-y-1.5 pl-7">
          {[96, 72, 110, 80].map((w, i) => (
            <div
              key={i}
              className="h-2.5 rounded animate-pulse bg-blue-100"
              style={{ width: `${w}px` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="border-2 border-red-200 rounded-xl p-3.5 bg-red-50">
        <div className="flex items-center gap-3">
          <AlertCircle size={16} className="text-red-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-700">Extraction failed</p>
            <p className="text-xs text-red-500 truncate">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => { setState('idle'); setError(''); }}
            className="text-red-400 hover:text-red-600 transition-colors p-1 rounded"
            title="Try again"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>
    );
  }

  // done
  const filledCount = Object.values(extractedData).filter(
    (v) => v !== null && v !== undefined && v !== ''
  ).length;

  return (
    <div className="border-2 border-green-200 rounded-xl p-3.5 bg-green-50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={15} className="text-green-600 shrink-0" />
          <span className="text-sm font-medium text-green-700">
            {filledCount} field{filledCount !== 1 ? 's' : ''} extracted — form auto-filled
          </span>
        </div>
        <button
          type="button"
          onClick={() => { setState('idle'); setExtractedData({}); }}
          className="text-green-500 hover:text-green-700 transition-colors p-1 rounded"
          title="Clear and re-scan"
        >
          <X size={13} />
        </button>
      </div>
      {filledFields.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filledFields.map(([key, value]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700"
            >
              <span className="font-medium">{key.replace(/_/g, ' ')}:</span>
              <span className="truncate max-w-[96px]">{String(value).slice(0, 22)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
