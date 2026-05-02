/**
 * ComplianceCard — summary card for a compliance check item.
 * Usage: <ComplianceCard label="Insurance" status="ACTIVE" validUpto="2025-12-31" />
 */
import StatusBadge from './StatusBadge';

interface Props {
  label: string;
  status: string;
  validUpto?: string;
  icon?: string;
}

export default function ComplianceCard({ label, status, validUpto, icon }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
      {icon && <span className="text-2xl mb-2 block">{icon}</span>}
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <StatusBadge status={status} />
      {validUpto && (
        <p className="text-xs text-gray-400 mt-2">Valid: {validUpto}</p>
      )}
    </div>
  );
}
