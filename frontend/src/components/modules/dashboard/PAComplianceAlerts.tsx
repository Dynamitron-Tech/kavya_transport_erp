// ============================================================
// PA Compliance Alerts Widget
// Shows: Expiring docs, expired docs, compliance blockers
// Red badge on expired, yellow on expiring-soon
// ============================================================

import {
  Shield, ChevronRight,
  Loader2, XCircle, AlertCircle
} from 'lucide-react';

interface ComplianceItem {
  id: number;
  entity_type: 'vehicle' | 'driver';
  entity_label: string;
  document_type: string;
  document_title: string;
  expiry_date: string;
  days_until_expiry: number;
  status: 'expired' | 'expiring_soon' | 'valid';
  blocks_dispatch: boolean;
}

interface ComplianceData {
  expired_count: number;
  expiring_soon_count: number;
  total_blocking: number;
  items: ComplianceItem[];
}

interface Props {
  data: ComplianceData | undefined;
  isLoading: boolean;
  navigate: (path: string) => void;
}

const SEVERITY_CONFIG = {
  expired: {
    bg: 'bg-red-50 border-red-200',
    badge: 'bg-red-100 text-red-700',
    icon: <XCircle size={14} className="text-red-500" />,
    text: 'text-red-700',
  },
  expiring_soon: {
    bg: 'bg-amber-50 border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
    icon: <AlertCircle size={14} className="text-amber-500" />,
    text: 'text-amber-700',
  },
  valid: {
    bg: 'bg-green-50 border-green-200',
    badge: 'bg-green-100 text-green-700',
    icon: <Shield size={14} className="text-green-500" />,
    text: 'text-green-700',
  },
};

export default function PAComplianceAlerts({ data, isLoading, navigate }: Props) {
  const compliance = data || { expired_count: 0, expiring_soon_count: 0, total_blocking: 0, items: [] };
  const alerts = compliance?.items;
  const safeAlerts = Array.isArray(alerts) ? alerts : [];

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">Compliance & Expiry</h3>
          {(compliance.expired_count + compliance.expiring_soon_count) > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
              {compliance.expired_count + compliance.expiring_soon_count}
            </span>
          )}
        </div>
        <button
          onClick={() => navigate('/documents?status=expired,expiring_soon')}
          className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
        >
          View all <ChevronRight size={12} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={24} className="animate-spin text-gray-300" />
        </div>
      ) : (
        <>
          {/* Summary badges */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="text-center p-2.5 rounded-xl bg-red-50 border border-red-100">
              <p className="text-lg font-bold text-red-600">{compliance.expired_count}</p>
              <p className="text-[10px] text-red-500 font-medium">Expired</p>
            </div>
            <div className="text-center p-2.5 rounded-xl bg-amber-50 border border-amber-100">
              <p className="text-lg font-bold text-amber-600">{compliance.expiring_soon_count}</p>
              <p className="text-[10px] text-amber-500 font-medium">Expiring Soon</p>
            </div>
            <div className="text-center p-2.5 rounded-xl bg-rose-50 border border-rose-100">
              <p className="text-lg font-bold text-rose-600">{compliance.total_blocking}</p>
              <p className="text-[10px] text-rose-500 font-medium">Blocking</p>
            </div>
          </div>

          {/* Item list */}
          {(safeAlerts ?? []).length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">No compliance alerts</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
              {(safeAlerts ?? []).slice(0, 8).map((item) => {
                const cfg = SEVERITY_CONFIG[item.status];
                return (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/documents?entity_type=${item.entity_type}&entity_label=${item.entity_label}`)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${cfg.bg}`}
                  >
                    <div className="flex-shrink-0">{cfg.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{item.entity_label}</p>
                      <p className="text-[10px] text-gray-500 truncate">{item.document_title}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cfg.badge}`}>
                        {item.status === 'expired'
                          ? 'Expired'
                          : `${item.days_until_expiry}d left`}
                      </span>
                      {item.blocks_dispatch && (
                        <p className="text-[9px] text-red-500 font-semibold mt-0.5">Blocks Dispatch</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
