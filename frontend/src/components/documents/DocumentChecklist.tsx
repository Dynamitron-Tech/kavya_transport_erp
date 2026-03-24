/**
 * DocumentChecklist
 *
 * Shows required and optional document cards for an entity.
 * Each card has a status badge (MISSING / UPLOADED / EXPIRING / EXPIRED).
 * Clicking "Upload" on a card opens a Modal with DocumentUploadWithExtraction.
 */

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle, AlertCircle, Clock, FileX, Upload, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { DocumentUploadWithExtraction, type ExtractionResult } from './DocumentUploadWithExtraction';
import { documentService } from '@/services/dataService';

// ── Types ────────────────────────────────────────────────────────────────────

type DocStatus = 'missing' | 'uploaded' | 'expiring' | 'expired';

interface DocRequirement {
  type: string;
  label: string;
  required: boolean;
  description?: string;
}

interface Props {
  entityType: string;
  entityId?: number;
  onExtracted?: (doc: DocRequirement, result: ExtractionResult) => void;
  onAllRequiredUploaded?: () => void;
}

// ── Status helpers ────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
  rc: 'Registration Certificate',
  insurance: 'Insurance Policy',
  fitness: 'Fitness Certificate',
  driving_license: 'Driving License',
  puc: 'Pollution Under Control',
  permit: 'Vehicle Permit',
  tax_receipt: 'Road Tax Receipt',
  driver_badge: 'Driver Badge',
  medical_fitness: 'Medical Fitness Certificate',
  aadhaar: 'Aadhaar Card',
  pan_card: 'PAN Card',
  gst_certificate: 'GST Certificate',
};

function getDocStatus(expiryDate?: string): DocStatus {
  if (!expiryDate) return 'uploaded';
  const expiry = new Date(expiryDate);
  const now = new Date();
  const daysLeft = Math.floor((expiry.getTime() - now.getTime()) / 86_400_000);
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= 30) return 'expiring';
  return 'uploaded';
}

const STATUS_CONFIG: Record<DocStatus | 'missing', {
  icon: React.ReactNode;
  label: string;
  badgeCls: string;
  cardCls: string;
}> = {
  missing: {
    icon: <FileX size={14} />,
    label: 'Missing',
    badgeCls: 'bg-gray-100 text-gray-600',
    cardCls: 'border-gray-200',
  },
  uploaded: {
    icon: <CheckCircle size={14} />,
    label: 'Valid',
    badgeCls: 'bg-green-50 text-green-700',
    cardCls: 'border-green-200',
  },
  expiring: {
    icon: <Clock size={14} />,
    label: 'Expiring Soon',
    badgeCls: 'bg-amber-50 text-amber-700',
    cardCls: 'border-amber-200',
  },
  expired: {
    icon: <AlertCircle size={14} />,
    label: 'Expired',
    badgeCls: 'bg-red-50 text-red-700',
    cardCls: 'border-red-200',
  },
};

// ── Card ──────────────────────────────────────────────────────────────────────

interface CardProps {
  req: DocRequirement;
  status: DocStatus | 'missing';
  expiryDate?: string;
  entityId?: number;
  entityType: string;
  onExtracted?: (result: ExtractionResult) => void;
  onUploaded?: () => void;
}

function DocumentCard({
  req, status, expiryDate, entityId, entityType, onExtracted, onUploaded,
}: CardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const cfg = STATUS_CONFIG[status];

  const daysLeft = expiryDate
    ? Math.floor((new Date(expiryDate).getTime() - Date.now()) / 86_400_000)
    : null;

  return (
    <>
      <div className={`border rounded-xl p-4 flex items-start justify-between gap-3 bg-white ${cfg.cardCls}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-800">{req.label}</span>
            {req.required && (
              <span className="text-xs text-red-500 font-medium">Required</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-1.5">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badgeCls}`}>
              {cfg.icon}
              {cfg.label}
            </span>
            {expiryDate && status !== 'missing' && (
              <span className="text-xs text-gray-400">
                {status === 'expired'
                  ? `Expired ${Math.abs(daysLeft!)} day${Math.abs(daysLeft!) !== 1 ? 's' : ''} ago`
                  : `Expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
              </span>
            )}
          </div>

          {req.description && (
            <p className="text-xs text-gray-400 mt-1">{req.description}</p>
          )}
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
        >
          <Upload size={12} />
          {status === 'missing' ? 'Upload' : 'Replace'}
        </button>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={req.label}
        subtitle={req.required ? 'Required document' : 'Optional document'}
        size="lg"
      >
        <DocumentUploadWithExtraction
          documentType={req.type}
          entityType={entityType}
          entityId={entityId}
          label={req.label}
          isRequired={req.required}
          onExtracted={result => {
            if (onExtracted) onExtracted(result);
          }}
          onSaved={() => {
            setModalOpen(false);
            if (onUploaded) onUploaded();
          }}
          onClose={() => setModalOpen(false)}
        />
      </Modal>
    </>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function DocumentChecklist({ entityType, entityId, onExtracted, onAllRequiredUploaded }: Props) {
  const queryClient = useQueryClient();
  const [optionalExpanded, setOptionalExpanded] = useState(false);

  // Fetch requirements for this entity type
  const { data: requirements } = useQuery({
    queryKey: ['doc-requirements', entityType],
    queryFn: () => documentService.getRequirements(entityType),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch existing docs for this entity (only when entityId is known)
  const { data: existingDocs } = useQuery({
    queryKey: ['entity-docs', entityType, entityId],
    queryFn: () => documentService.listForEntity(entityId!, entityType),
    enabled: entityId != null,
    staleTime: 30_000,
  });

  if (!requirements) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 rounded-xl animate-pulse bg-gray-100" />
        ))}
      </div>
    );
  }

  const required: string[] = requirements.required ?? [];
  const optional: string[] = requirements.optional ?? [];

  // Build a lookup: docType → latest uploaded document
  const docMap: Record<string, any> = {};
  if (existingDocs) {
    for (const doc of existingDocs) {
      const dtype = (doc.document_type ?? '').toLowerCase();
      if (!docMap[dtype] || new Date(doc.created_at) > new Date(docMap[dtype].created_at)) {
        docMap[dtype] = doc;
      }
    }
  }

  const makeReq = (type: string, isRequired: boolean): DocRequirement => ({
    type,
    label: DOC_TYPE_LABELS[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    required: isRequired,
  });

  const getStatus = (type: string): { status: DocStatus | 'missing'; expiryDate?: string } => {
    const doc = docMap[type];
    if (!doc) return { status: 'missing' };
    const status = getDocStatus(doc.expiry_date);
    return { status, expiryDate: doc.expiry_date };
  };

  const handleUploaded = () => {
    if (entityId != null) {
      queryClient.invalidateQueries({ queryKey: ['entity-docs', entityType, entityId] });
    }
    // Check if all required docs now uploaded
    const allDone = required.every(type => {
      const newDocMap = { ...docMap };
      return newDocMap[type] != null;
    });
    if (allDone && onAllRequiredUploaded) onAllRequiredUploaded();
  };

  const requiredItems = required.map(t => makeReq(t, true));
  const optionalItems = optional.map(t => makeReq(t, false));

  return (
    <div className="space-y-6">
      {/* Required section */}
      {requiredItems.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Required Documents
          </h4>
          <div className="space-y-2">
            {requiredItems.map(req => {
              const { status, expiryDate } = getStatus(req.type);
              return (
                <DocumentCard
                  key={req.type}
                  req={req}
                  status={status}
                  expiryDate={expiryDate}
                  entityId={entityId}
                  entityType={entityType}
                  onExtracted={result => onExtracted && onExtracted(req, result)}
                  onUploaded={handleUploaded}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Optional section (collapsible) */}
      {optionalItems.length > 0 && (
        <div>
          <button
            onClick={() => setOptionalExpanded(p => !p)}
            className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700 transition-colors"
          >
            Optional Documents
            {optionalExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span className="text-gray-400 normal-case font-normal">({optionalItems.length})</span>
          </button>

          {optionalExpanded && (
            <div className="space-y-2 mt-3">
              {optionalItems.map(req => {
                const { status, expiryDate } = getStatus(req.type);
                return (
                  <DocumentCard
                    key={req.type}
                    req={req}
                    status={status}
                    expiryDate={expiryDate}
                    entityId={entityId}
                    entityType={entityType}
                    onExtracted={result => onExtracted && onExtracted(req, result)}
                    onUploaded={handleUploaded}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {requiredItems.length === 0 && optionalItems.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">
          No document requirements configured for {entityType}.
        </p>
      )}
    </div>
  );
}
