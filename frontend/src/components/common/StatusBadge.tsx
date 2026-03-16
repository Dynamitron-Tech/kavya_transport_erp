/**
 * StatusBadge — colored pill for status display.
 * Usage: <StatusBadge status="ACTIVE" /> or <StatusBadge status="EXPIRED" />
 */
interface Props {
  status: string;
  className?: string;
}

const COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  VALID: 'bg-green-100 text-green-800',
  COMPLIANT: 'bg-green-100 text-green-800',
  CLEAR: 'bg-green-100 text-green-800',
  PAID: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-green-100 text-green-800',
  APPROVED: 'bg-green-100 text-green-800',
  GENERATED: 'bg-blue-100 text-blue-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  DRAFT: 'bg-gray-100 text-gray-600',
  EXPIRED: 'bg-red-100 text-red-800',
  NON_COMPLIANT: 'bg-red-100 text-red-800',
  BLACKLISTED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-red-100 text-red-800',
  REJECTED: 'bg-red-100 text-red-800',
  NOT_FOUND: 'bg-gray-100 text-gray-500',
};

export default function StatusBadge({ status, className = '' }: Props) {
  const color = COLORS[status?.toUpperCase()] || 'bg-gray-100 text-gray-700';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color} ${className}`}>
      {status}
    </span>
  );
}
