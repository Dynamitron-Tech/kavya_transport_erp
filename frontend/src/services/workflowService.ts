// ============================================================
// PA Workflow Status Engine
// Defines: Status transitions, auto-blocks, validation rules
// For: Jobs, LRs, Trips, Vehicles, Documents
// ============================================================

// ---- Status Definitions ----

export type JobStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'documentation'
  | 'trip_created'
  | 'in_transit'
  | 'delivered'
  | 'closure_pending'
  | 'closed'
  | 'cancelled';

export type LRStatus =
  | 'draft'
  | 'generated'
  | 'dispatched'
  | 'delivered'
  | 'pod_received'
  | 'closed'
  | 'cancelled';

export type TripStatus =
  | 'planned'
  | 'dispatched'
  | 'in_transit'
  | 'completed'
  | 'closure_pending'
  | 'closed'
  | 'cancelled';

export type VehicleStatus =
  | 'available'
  | 'on_trip'
  | 'maintenance'
  | 'breakdown'
  | 'inactive';

export type DocumentStatus =
  | 'pending'
  | 'valid'
  | 'expiring_soon'
  | 'expired';

// ---- Transition Rules ----

interface TransitionRule {
  from: string;
  to: string;
  requiredConditions: string[];
  autoBlocks: string[];   // Conditions that block this transition
  description: string;
}

export const JOB_TRANSITIONS: TransitionRule[] = [
  { from: 'draft',              to: 'pending_approval',  requiredConditions: ['client_set', 'origin_set', 'destination_set', 'cargo_details'], autoBlocks: [], description: 'Submit for manager approval' },
  { from: 'pending_approval',   to: 'approved',          requiredConditions: ['manager_approved'],   autoBlocks: ['rejected_by_manager'], description: 'Manager approves job' },
  { from: 'pending_approval',   to: 'draft',             requiredConditions: ['manager_rejected'],   autoBlocks: [], description: 'Manager rejects, return to draft' },
  { from: 'approved',           to: 'documentation',     requiredConditions: [],                     autoBlocks: [], description: 'Start documentation (LR, E-way Bill)' },
  { from: 'documentation',      to: 'trip_created',      requiredConditions: ['lr_created', 'eway_bill_generated', 'vehicle_assigned', 'driver_assigned'], autoBlocks: ['vehicle_docs_expired', 'driver_docs_expired'], description: 'Create trip from job' },
  { from: 'trip_created',       to: 'in_transit',        requiredConditions: ['trip_started'],        autoBlocks: ['vehicle_blocked'], description: 'Trip started, vehicle in transit' },
  { from: 'in_transit',         to: 'delivered',         requiredConditions: ['pod_uploaded'],         autoBlocks: [], description: 'Delivery confirmed with POD' },
  { from: 'delivered',          to: 'closure_pending',   requiredConditions: ['expenses_verified'],   autoBlocks: [], description: 'All expenses verified, ready to close' },
  { from: 'closure_pending',    to: 'closed',            requiredConditions: ['banking_entry_done', 'all_docs_uploaded'], autoBlocks: ['pending_expense_dispute'], description: 'Job fully closed' },
];

export const LR_TRANSITIONS: TransitionRule[] = [
  { from: 'draft',       to: 'generated',  requiredConditions: ['job_approved', 'details_complete'], autoBlocks: [], description: 'Generate LR number' },
  { from: 'generated',   to: 'dispatched', requiredConditions: ['trip_dispatched'],                  autoBlocks: [], description: 'Vehicle dispatched with LR' },
  { from: 'dispatched',  to: 'delivered',  requiredConditions: ['trip_completed'],                   autoBlocks: [], description: 'Goods delivered at destination' },
  { from: 'delivered',   to: 'pod_received', requiredConditions: ['pod_uploaded'],                   autoBlocks: [], description: 'POD received and uploaded' },
  { from: 'pod_received', to: 'closed',    requiredConditions: ['job_closed'],                       autoBlocks: [], description: 'LR closed with job' },
];

export const TRIP_TRANSITIONS: TransitionRule[] = [
  { from: 'planned',        to: 'dispatched',      requiredConditions: ['vehicle_assigned', 'driver_assigned', 'lr_attached'], autoBlocks: ['vehicle_docs_expired', 'driver_docs_expired', 'no_eway_bill'], description: 'Dispatch vehicle' },
  { from: 'dispatched',     to: 'in_transit',      requiredConditions: ['departure_confirmed'],                                autoBlocks: [], description: 'Vehicle departed from origin' },
  { from: 'in_transit',     to: 'completed',       requiredConditions: ['arrival_confirmed'],                                  autoBlocks: [], description: 'Vehicle arrived at destination' },
  { from: 'completed',      to: 'closure_pending', requiredConditions: ['pod_uploaded', 'expenses_entered'],                   autoBlocks: [], description: 'Ready for trip closure' },
  { from: 'closure_pending', to: 'closed',         requiredConditions: ['expenses_verified', 'documents_complete'],            autoBlocks: ['pending_dispute'], description: 'Trip fully closed' },
];

// ---- Compliance Blockers ----

export interface ComplianceBlocker {
  entity_type: 'vehicle' | 'driver';
  entity_id: number;
  entity_label: string;
  blocker_type: string;
  document_type: string;
  severity: 'critical' | 'warning';
  message: string;
  blocks_dispatch: boolean;
}

export function checkDispatchBlockers(
  vehicleId: number,
  driverId: number,
  vehicleDocs: { type: string; status: string; expiry?: string }[],
  driverDocs: { type: string; status: string; expiry?: string }[],
): ComplianceBlocker[] {
  const blockers: ComplianceBlocker[] = [];
  const now = new Date();

  // Check vehicle documents
  const requiredVehicleDocs = ['insurance', 'fitness', 'permit', 'pollution'];
  for (const docType of requiredVehicleDocs) {
    const doc = vehicleDocs.find(d => d.type === docType);
    if (!doc) {
      blockers.push({
        entity_type: 'vehicle',
        entity_id: vehicleId,
        entity_label: '',
        blocker_type: 'missing_document',
        document_type: docType,
        severity: 'critical',
        message: `Missing ${docType} document — cannot dispatch.`,
        blocks_dispatch: true,
      });
    } else if (doc.status === 'expired') {
      blockers.push({
        entity_type: 'vehicle',
        entity_id: vehicleId,
        entity_label: '',
        blocker_type: 'expired_document',
        document_type: docType,
        severity: 'critical',
        message: `${docType} expired${doc.expiry ? ' on ' + doc.expiry : ''}. Renewal required.`,
        blocks_dispatch: true,
      });
    } else if (doc.expiry) {
      const expiry = new Date(doc.expiry);
      const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 7) {
        blockers.push({
          entity_type: 'vehicle',
          entity_id: vehicleId,
          entity_label: '',
          blocker_type: 'expiring_document',
          document_type: docType,
          severity: 'warning',
          message: `${docType} expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Plan renewal.`,
          blocks_dispatch: false,
        });
      }
    }
  }

  // Check driver documents
  const requiredDriverDocs = ['license', 'medical'];
  for (const docType of requiredDriverDocs) {
    const doc = driverDocs.find(d => d.type === docType);
    if (!doc) {
      blockers.push({
        entity_type: 'driver',
        entity_id: driverId,
        entity_label: '',
        blocker_type: 'missing_document',
        document_type: docType,
        severity: 'critical',
        message: `Missing driver ${docType} — cannot dispatch.`,
        blocks_dispatch: true,
      });
    } else if (doc.status === 'expired') {
      blockers.push({
        entity_type: 'driver',
        entity_id: driverId,
        entity_label: '',
        blocker_type: 'expired_document',
        document_type: docType,
        severity: 'critical',
        message: `Driver ${docType} has expired. Renewal required.`,
        blocks_dispatch: true,
      });
    }
  }

  return blockers;
}

// ---- Status Transition Validator ----

export function canTransition(
  entityType: 'job' | 'lr' | 'trip',
  currentStatus: string,
  targetStatus: string,
): { allowed: boolean; rule?: TransitionRule; message: string } {
  const rules =
    entityType === 'job' ? JOB_TRANSITIONS :
    entityType === 'lr' ? LR_TRANSITIONS :
    TRIP_TRANSITIONS;

  const rule = rules.find(r => r.from === currentStatus && r.to === targetStatus);
  if (!rule) {
    return {
      allowed: false,
      message: `Cannot transition ${entityType} from "${currentStatus}" to "${targetStatus}". No valid path.`,
    };
  }

  return {
    allowed: true,
    rule,
    message: rule.description,
  };
}

// ---- Next Actions for PA ----

export interface NextAction {
  label: string;
  description: string;
  link: string;
  priority: 'high' | 'medium' | 'low';
  icon: string;
}

export function getNextActionsForJob(
  jobId: number,
  jobStatus: JobStatus,
  hasLR: boolean,
  hasEwayBill: boolean,
  hasTrip: boolean,
  hasPOD: boolean,
  hasExpenses: boolean,
  hasBanking: boolean
): NextAction[] {
  const actions: NextAction[] = [];

  switch (jobStatus) {
    case 'draft':
      actions.push({ label: 'Submit for Approval', description: 'Complete job details and submit', link: `/jobs/${jobId}/edit`, priority: 'high', icon: 'send' });
      break;
    case 'approved':
    case 'documentation':
      if (!hasLR) actions.push({ label: 'Create LR', description: 'Generate Lorry Receipt', link: `/lr/create?job=${jobId}`, priority: 'high', icon: 'file-text' });
      if (!hasEwayBill) actions.push({ label: 'Generate E-way Bill', description: 'Create E-way Bill for transport', link: `/eway-bills/create?job=${jobId}`, priority: 'high', icon: 'shield' });
      if (hasLR && hasEwayBill && !hasTrip) actions.push({ label: 'Create Trip', description: 'Assign vehicle & driver', link: `/trips/create?job=${jobId}`, priority: 'high', icon: 'navigation' });
      break;
    case 'delivered':
      if (!hasPOD) actions.push({ label: 'Upload POD', description: 'Upload proof of delivery', link: `/documents/upload?entity=job&id=${jobId}&type=pod`, priority: 'high', icon: 'upload' });
      if (!hasExpenses) actions.push({ label: 'Enter Expenses', description: 'Record trip expenses', link: `/finance/expenses?job=${jobId}`, priority: 'medium', icon: 'receipt' });
      break;
    case 'closure_pending':
      if (!hasBanking) actions.push({ label: 'Banking Entry', description: 'Complete banking/payment entry', link: `/finance/banking?job=${jobId}`, priority: 'medium', icon: 'credit-card' });
      actions.push({ label: 'Close Job', description: 'Finalize and close job', link: `/jobs/${jobId}/close`, priority: 'high', icon: 'check-circle' });
      break;
  }

  return actions;
}

// ---- Status Color Map ----

export const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  // Jobs
  draft:              { bg: 'bg-gray-100',    text: 'text-gray-700',    dot: '#6b7280' },
  pending_approval:   { bg: 'bg-yellow-100',  text: 'text-yellow-700',  dot: '#eab308' },
  approved:           { bg: 'bg-green-100',   text: 'text-green-700',   dot: '#22c55e' },
  documentation:      { bg: 'bg-amber-100',   text: 'text-amber-700',   dot: '#f59e0b' },
  trip_created:       { bg: 'bg-blue-100',    text: 'text-blue-700',    dot: '#3b82f6' },
  in_transit:         { bg: 'bg-purple-100',  text: 'text-purple-700',  dot: '#8b5cf6' },
  delivered:          { bg: 'bg-teal-100',    text: 'text-teal-700',    dot: '#14b8a6' },
  closure_pending:    { bg: 'bg-orange-100',  text: 'text-orange-700',  dot: '#f97316' },
  closed:             { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: '#10b981' },
  cancelled:          { bg: 'bg-red-100',     text: 'text-red-700',     dot: '#ef4444' },
  // Trips
  planned:            { bg: 'bg-slate-100',   text: 'text-slate-700',   dot: '#64748b' },
  dispatched:         { bg: 'bg-sky-100',     text: 'text-sky-700',     dot: '#0ea5e9' },
  completed:          { bg: 'bg-cyan-100',    text: 'text-cyan-700',    dot: '#06b6d4' },
  // LR
  generated:          { bg: 'bg-indigo-100',  text: 'text-indigo-700',  dot: '#6366f1' },
  pod_received:       { bg: 'bg-lime-100',    text: 'text-lime-700',    dot: '#84cc16' },
  // Vehicle
  available:          { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: '#10b981' },
  on_trip:            { bg: 'bg-blue-100',    text: 'text-blue-700',    dot: '#2563eb' },
  maintenance:        { bg: 'bg-amber-100',   text: 'text-amber-700',   dot: '#f59e0b' },
  breakdown:          { bg: 'bg-red-100',     text: 'text-red-700',     dot: '#ef4444' },
  inactive:           { bg: 'bg-gray-100',    text: 'text-gray-600',    dot: '#94a3b8' },
};

export function getStatusColor(status: string) {
  return STATUS_COLORS[status] || STATUS_COLORS.draft;
}

// ---- Format Helpers ----

export function getStatusLabel(status: string): string {
  return status
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
