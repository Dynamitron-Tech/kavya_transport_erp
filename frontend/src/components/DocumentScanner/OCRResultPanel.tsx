/**
 * OCRResultPanel.tsx
 * Slide-in panel showing extracted document fields after OCR.
 *
 * Features:
 *   - "Apply All High Confidence" and "Apply All Fields" buttons
 *   - Per-field confidence badges (green HIGH / yellow CHECK / red VERIFY)
 *   - Inline editing of any extracted value
 *   - Individual "Apply" per field with green-flash animation
 *   - "Try Server OCR" fallback button when confidence < 60%
 *   - Collapsible raw OCR text section
 */

import React, { useState, useCallback } from 'react';
import {
  CheckCircle2, AlertCircle, Info, ChevronDown, ChevronUp,
  Pencil, Check, X, RefreshCw, Server, FileSearch,
} from 'lucide-react';
import { OCRResult, runServerOCR } from '@/services/ocrService';
import { ExtractedFields, FieldValue } from '@/utils/fieldExtractor';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FieldApplyEvent {
  fieldKey: string;
  value: string;
  formField: string | null;  // null = info-only
}

export interface OCRResultPanelProps {
  result: OCRResult;
  docType: string;           // User-selected form doc type (e.g. 'rc', 'insurance')
  onApplyField: (event: FieldApplyEvent) => void;
  onClose: () => void;
  /** The original File — used for server OCR fallback */
  originalFile?: File | null;
}

// ─── Field → form field mapping ──────────────────────────────────────────────
// Exported so DocumentUploadPage can auto-apply fields without a manual click.
export const FIELD_TO_FORM: Record<string, string | null> = {
  registration_number: 'reference_number',
  policy_number:       'reference_number',
  dl_number:           'reference_number',
  puc_number:          'reference_number',
  certificate_number:  'reference_number',
  valid_upto:          'expiry_date',
  valid_from:          'issue_date',
  test_date:           'issue_date',
  owner_name:          'title',
  holder_name:         'title',
  insurer_name:        null,  // info only
  vehicle_number:      'entity_search',
  vehicle_class:       null,
  fuel_type:           null,
  chassis_number:      null,
  engine_number:       null,
  emission_values:     null,
  emission_norms:      null,
  address:             null,
  blood_group:         null,
  dob:                 null,
  father_name:         null,
  issue_date:          'issue_date',
  premium_amount:      null,
  issued_by:           null,
};

const FIELD_LABELS: Record<string, string> = {
  registration_number: 'Registration Number',
  policy_number:       'Policy Number',
  dl_number:           'DL Number',
  puc_number:          'PUC Number',
  certificate_number:  'Certificate Number',
  valid_upto:          'Valid / Expiry Date',
  valid_from:          'Valid From',
  test_date:           'Test Date',
  owner_name:          'Owner Name',
  holder_name:         'Holder Name',
  insurer_name:        'Insurer',
  vehicle_number:      'Vehicle Number',
  vehicle_class:       'Vehicle Class',
  fuel_type:           'Fuel Type',
  chassis_number:      'Chassis No.',
  engine_number:       'Engine No.',
  emission_values:     'Emission Values',
  emission_norms:      'Emission Norms',
  address:             'Address',
  blood_group:         'Blood Group',
  dob:                 'Date of Birth',
  father_name:         'Father / Guardian Name',
  issue_date:          'Issue Date',
  premium_amount:      'Premium Amount',
  issued_by:           'Issued By',
};

const DOC_TYPE_LABEL: Record<string, string> = {
  RC:             'Registration Certificate (RC)',
  Insurance:      'Insurance Certificate',
  DrivingLicense: 'Driving License',
  Fitness:        'Fitness Certificate',
  PUC:            'Pollution Under Control (PUC)',
  Other:          'Document',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConfidenceBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  const styles = {
    high:   'bg-green-100 text-green-700 border-green-200',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    low:    'bg-red-100 text-red-600 border-red-200',
  };
  const labels = { high: 'High', medium: 'Check', low: 'Verify' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${styles[level]}`}>
      {labels[level]}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OCRResultPanel({
  result,
  docType,
  onApplyField,
  onClose,
  originalFile,
}: OCRResultPanelProps) {
  const [fields, setFields] = useState<ExtractedFields>(result.extractedFields);
  const [appliedFields, setAppliedFields] = useState<Set<string>>(new Set());
  const [flashFields, setFlashFields] = useState<Set<string>>(new Set());
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [rawExpanded, setRawExpanded] = useState(false);
  const [isLoadingServer, setIsLoadingServer] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const confPct = Math.round(result.overallConfidence * 100);
  const isLowConfidence = result.overallConfidence < 0.6;

  const flashApply = useCallback((key: string) => {
    setAppliedFields(prev => new Set([...prev, key]));
    setFlashFields(prev => new Set([...prev, key]));
    setTimeout(() => {
      setFlashFields(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 800);
  }, []);

  const applyField = useCallback((key: string, value: string) => {
    const formField = FIELD_TO_FORM[key] ?? null;
    onApplyField({ fieldKey: key, value, formField });
    flashApply(key);
  }, [onApplyField, flashApply]);

  const applyAll = useCallback((confidenceFilter?: 'high') => {
    Object.entries(fields).forEach(([key, fv]) => {
      if (confidenceFilter && fv.confidence !== confidenceFilter) return;
      applyField(key, fv.value);
    });
  }, [fields, applyField]);

  const startEdit = (key: string, currentValue: string) => {
    setEditingField(key);
    setEditingValue(currentValue);
  };

  const confirmEdit = (key: string) => {
    setFields(prev => ({
      ...prev,
      [key]: { ...prev[key], value: editingValue },
    }));
    setEditingField(null);
  };

  const cancelEdit = () => setEditingField(null);

  const handleServerOCR = async () => {
    if (!originalFile) return;
    setIsLoadingServer(true);
    setServerError(null);
    try {
      const serverResult = await runServerOCR(originalFile, docType);
      setFields(serverResult.extractedFields);
    } catch (err: any) {
      setServerError(err?.message ?? 'Server OCR failed');
    } finally {
      setIsLoadingServer(false);
    }
  };

  const fieldEntries = Object.entries(fields);
  const highConfEntries = fieldEntries.filter(([, v]) => v.confidence === 'high');

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <FileSearch className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Document scanned</p>
            <p className="text-xs text-gray-500">
              {DOC_TYPE_LABEL[result.docType] ?? result.docType}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Confidence bar */}
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs text-gray-500">Confidence</span>
            <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  confPct >= 80 ? 'bg-green-500' : confPct >= 50 ? 'bg-yellow-400' : 'bg-red-400'
                }`}
                style={{ width: `${confPct}%` }}
              />
            </div>
            <span className={`text-xs font-semibold ${confPct >= 80 ? 'text-green-600' : confPct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {confPct}%
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-200 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-blue-50/50 border-b border-gray-100">
        {highConfEntries.length > 0 && (
          <button
            onClick={() => applyAll('high')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Apply High Confidence ({highConfEntries.length})
          </button>
        )}
        <button
          onClick={() => applyAll()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
          Apply All ({fieldEntries.length})
        </button>
      </div>

      {/* Field list */}
      <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
        {fieldEntries.length === 0 && (
          <div className="py-8 text-center text-gray-500 text-sm">
            No fields could be extracted. Please fill the form manually.
          </div>
        )}

        {fieldEntries.map(([key, fv]) => {
          const isEditing = editingField === key;
          const isApplied = appliedFields.has(key);
          const isFlashing = flashFields.has(key);
          const formField = FIELD_TO_FORM[key] ?? null;
          const label = FIELD_LABELS[key] ?? key.replace(/_/g, ' ');

          return (
            <div
              key={key}
              className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                isFlashing ? 'bg-green-50' : 'hover:bg-gray-50'
              }`}
            >
              {/* Field label + confidence */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-600 truncate">{label}</span>
                  <ConfidenceBadge level={fv.confidence} />
                  {!formField && (
                    <span className="text-xs text-gray-400 italic">Info only</span>
                  )}
                </div>

                {/* Value — editable inline */}
                {isEditing ? (
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      autoFocus
                      value={editingValue}
                      onChange={e => setEditingValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') confirmEdit(key);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      className="flex-1 text-sm border border-blue-400 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <button onClick={() => confirmEdit(key)} className="p-0.5 text-green-600 hover:text-green-700">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={cancelEdit} className="p-0.5 text-gray-400 hover:text-gray-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-sm text-gray-900 font-medium truncate">
                      {fv.value || <span className="text-gray-400 italic">—</span>}
                    </span>
                    <button
                      onClick={() => startEdit(key, fv.value)}
                      className="p-0.5 text-gray-300 hover:text-gray-600 transition-colors"
                      title="Edit value"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Apply button */}
              {formField && !isEditing && (
                <button
                  onClick={() => applyField(key, fv.value)}
                  className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    isApplied
                      ? 'bg-green-100 text-green-700 border border-green-200'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isApplied ? (
                    <><CheckCircle2 className="w-3 h-3" /> Applied</>
                  ) : (
                    'Apply'
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Low confidence / server OCR fallback */}
      {isLowConfidence && (
        <div className="px-4 py-3 bg-yellow-50 border-t border-yellow-100">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-yellow-800 font-medium">Low confidence scan</p>
              <p className="text-xs text-yellow-700 mt-0.5">
                Try enhanced server OCR for better results (takes ~10 seconds).
              </p>
              {serverError && (
                <p className="text-xs text-red-600 mt-1">{serverError}</p>
              )}
            </div>
            <button
              onClick={handleServerOCR}
              disabled={isLoadingServer || !originalFile}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600 text-white text-xs font-medium rounded-lg hover:bg-yellow-700 disabled:opacity-50 transition-colors"
            >
              {isLoadingServer ? (
                <><RefreshCw className="w-3 h-3 animate-spin" /> Processing…</>
              ) : (
                <><Server className="w-3 h-3" /> Server OCR</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Raw OCR text collapsible */}
      <div className="border-t border-gray-100">
        <button
          onClick={() => setRawExpanded(p => !p)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            Raw OCR text (debug)
          </span>
          {rawExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {rawExpanded && (
          <pre className="px-4 pb-4 text-xs text-gray-500 whitespace-pre-wrap max-h-40 overflow-y-auto bg-gray-50 border-t border-gray-100">
            {result.rawText || '(empty)'}
          </pre>
        )}
      </div>
    </div>
  );
}
