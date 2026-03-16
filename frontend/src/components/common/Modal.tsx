import { AlertTriangle, Info, X, XCircle } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  footer?: React.ReactNode;
  subtitle?: string;
  headerBadge?: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children, size = 'md', footer, subtitle, headerBadge }: ModalProps) {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-6xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative bg-white rounded-xl shadow-dropdown ${sizeClasses[size]} w-full mx-4 animate-slide-up`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-base font-semibold text-gray-900">{title}</h3>
              {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
            </div>
            {headerBadge}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
        </div>
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50/50 rounded-b-xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Status Badge Component (Design System) ----
interface StatusBadgeProps {
  status: string;
  variant?: 'default' | 'dot' | 'outline';
  size?: 'sm' | 'md';
}

const statusColors: Record<string, { bg: string; text: string; ring: string; dot: string }> = {
  // Green family
  active: { bg: 'bg-green-50', text: 'text-green-700', ring: 'ring-green-600/20', dot: 'bg-green-500' },
  available: { bg: 'bg-green-50', text: 'text-green-700', ring: 'ring-green-600/20', dot: 'bg-green-500' },
  completed: { bg: 'bg-green-50', text: 'text-green-700', ring: 'ring-green-600/20', dot: 'bg-green-500' },
  paid: { bg: 'bg-green-50', text: 'text-green-700', ring: 'ring-green-600/20', dot: 'bg-green-500' },
  delivered: { bg: 'bg-green-50', text: 'text-green-700', ring: 'ring-green-600/20', dot: 'bg-green-500' },
  pod_verified: { bg: 'bg-green-50', text: 'text-green-700', ring: 'ring-green-600/20', dot: 'bg-green-500' },
  pod_received: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-600/20', dot: 'bg-emerald-500' },

  // Blue family - approved/active
  approved: { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-600/20', dot: 'bg-blue-500' },
  in_progress: { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-600/20', dot: 'bg-blue-500' },
  assigned: { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-600/20', dot: 'bg-blue-500' },
  sent: { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-600/20', dot: 'bg-blue-500' },

  // Purple family - in transit
  in_transit: { bg: 'bg-purple-50', text: 'text-purple-700', ring: 'ring-purple-600/20', dot: 'bg-purple-500' },
  on_trip: { bg: 'bg-purple-50', text: 'text-purple-700', ring: 'ring-purple-600/20', dot: 'bg-purple-500' },
  started: { bg: 'bg-purple-50', text: 'text-purple-700', ring: 'ring-purple-600/20', dot: 'bg-purple-500' },
  loading: { bg: 'bg-purple-50', text: 'text-purple-700', ring: 'ring-purple-600/20', dot: 'bg-purple-500' },
  unloading: { bg: 'bg-indigo-50', text: 'text-indigo-700', ring: 'ring-indigo-600/20', dot: 'bg-indigo-500' },

  // Orange/Amber - pending/warning
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-600/20', dot: 'bg-amber-500' },
  pending_approval: { bg: 'bg-orange-50', text: 'text-orange-700', ring: 'ring-orange-600/20', dot: 'bg-orange-500' },
  maintenance: { bg: 'bg-orange-50', text: 'text-orange-700', ring: 'ring-orange-600/20', dot: 'bg-orange-500' },
  on_leave: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-600/20', dot: 'bg-amber-500' },
  partial: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-600/20', dot: 'bg-amber-500' },
  overdue: { bg: 'bg-orange-50', text: 'text-orange-700', ring: 'ring-orange-600/20', dot: 'bg-orange-500' },

  // Red - danger
  breakdown: { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-600/20', dot: 'bg-red-500' },
  cancelled: { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-600/20', dot: 'bg-red-500' },
  rejected: { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-600/20', dot: 'bg-red-500' },
  suspended: { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-600/20', dot: 'bg-red-500' },
  expired: { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-600/20', dot: 'bg-red-500' },
  failed: { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-600/20', dot: 'bg-red-500' },

  // Gray - draft/neutral
  draft: { bg: 'bg-gray-50', text: 'text-gray-600', ring: 'ring-gray-500/20', dot: 'bg-gray-400' },
  planned: { bg: 'bg-gray-50', text: 'text-gray-600', ring: 'ring-gray-500/20', dot: 'bg-gray-400' },
  inactive: { bg: 'bg-gray-50', text: 'text-gray-500', ring: 'ring-gray-500/20', dot: 'bg-gray-400' },

  // Cyan - generated
  generated: { bg: 'bg-cyan-50', text: 'text-cyan-700', ring: 'ring-cyan-600/20', dot: 'bg-cyan-500' },
  extended: { bg: 'bg-cyan-50', text: 'text-cyan-700', ring: 'ring-cyan-600/20', dot: 'bg-cyan-500' },
};

export function StatusBadge({ status, variant = 'default', size = 'sm' }: StatusBadgeProps) {
  if (!status) {
    return <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset bg-gray-50 text-gray-600 ring-gray-500/20">Unknown</span>;
  }
  const colors = statusColors[status] || { bg: 'bg-gray-50', text: 'text-gray-600', ring: 'ring-gray-500/20', dot: 'bg-gray-400' };
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  if (variant === 'dot') {
    return (
      <span className={`inline-flex items-center gap-1.5 ${size === 'sm' ? 'text-sm' : 'text-base'}`}>
        <span className={`w-2 h-2 rounded-full ${colors.dot} ${status === 'on_trip' || status === 'in_transit' ? 'animate-pulse-dot' : ''}`} />
        <span className={`font-medium ${colors.text}`}>{label}</span>
      </span>
    );
  }

  if (variant === 'outline') {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${colors.text} ${colors.ring} bg-transparent`}>
        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
        {label}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${colors.bg} ${colors.text} ${colors.ring}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot} ${status === 'on_trip' || status === 'in_transit' ? 'animate-pulse-dot' : ''}`} />
      {label}
    </span>
  );
}

// ---- Confirm Dialog ----
interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  type?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen, onClose, onConfirm, title, message,
  confirmLabel = 'Confirm', type = 'danger', isLoading
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm" footer={
      <>
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className={type === 'danger' ? 'btn-danger' : 'btn-primary'}
        >
          {isLoading ? 'Processing...' : confirmLabel}
        </button>
      </>
    }>
      <div className="flex items-start gap-4">
        <div className={`p-2.5 rounded-xl flex-shrink-0 ${
          type === 'danger' ? 'bg-red-50' :
          type === 'warning' ? 'bg-amber-50' : 'bg-blue-50'
        }`}>
          {type === 'danger' ? <XCircle size={22} className="text-red-600" /> :
           type === 'warning' ? <AlertTriangle size={22} className="text-amber-600" /> :
           <Info size={22} className="text-blue-600" />}
        </div>
        <p className="text-gray-600 text-sm leading-relaxed">{message}</p>
      </div>
    </Modal>
  );
}

// ---- Loading Spinner ----
export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = { sm: 'w-4 h-4 border-2', md: 'w-8 h-8 border-[3px]', lg: 'w-12 h-12 border-4' };
  return (
    <div className="flex items-center justify-center p-8">
      <div className={`${sizeClasses[size]} border-primary-200 border-t-primary-600 rounded-full animate-spin`} />
    </div>
  );
}

// ---- Loading Page ----
export function LoadingPage() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-[3px] border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-400 font-medium">Loading...</p>
      </div>
    </div>
  );
}

// ---- Empty State ----
export function EmptyState({ icon, title, description, action }: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="text-gray-300 mb-3">{icon}</div>}
      <h3 className="text-base font-semibold text-gray-800">{title}</h3>
      {description && <p className="text-sm text-gray-500 mt-1 max-w-md">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ---- KPI Card ----
export function KPICard({ title, value, icon, change, changeType, color, onClick }: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  change?: string;
  changeType?: 'up' | 'down' | 'neutral';
  color: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={`kpi-card ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="min-w-0">
        <p className="kpi-label">{title}</p>
        <p className="kpi-value">{value}</p>
        {change && (
          <div className={`kpi-trend ${
            changeType === 'up' ? 'text-green-600' :
            changeType === 'down' ? 'text-red-600' : 'text-gray-500'
          }`}>
            {changeType === 'up' && <span>+</span>}
            {change}
          </div>
        )}
      </div>
      <div className={`kpi-icon ${color}`}>
        {icon}
      </div>
    </div>
  );
}

// ---- Page Section ----
export function PageSection({ title, children, action, className = '' }: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`card ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

// ---- Tab Pills ----
export function TabPills({ tabs, activeTab, onChange }: {
  tabs: { key: string; label: string; count?: number }[];
  activeTab: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={activeTab === tab.key ? 'tab-pill-active' : 'tab-pill'}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              activeTab === tab.key ? 'bg-primary-100 text-primary-700' : 'bg-gray-200 text-gray-600'
            }`}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
