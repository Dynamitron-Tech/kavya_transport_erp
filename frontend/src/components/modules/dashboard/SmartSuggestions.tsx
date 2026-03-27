// SmartSuggestions — Dashboard widget showing actionable recommendations
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Lightbulb, AlertTriangle, Clock, FileText,
  Truck, Shield, ChevronRight
} from 'lucide-react';

interface Suggestion {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  path: string;
  priority: 'high' | 'medium' | 'low';
}

const PRIORITY_STYLES = {
  high: 'border-red-200 bg-red-50/40',
  medium: 'border-amber-200 bg-amber-50/40',
  low: 'border-blue-200 bg-blue-50/40',
};

interface SmartSuggestionsProps {
  overview?: any;
}

export default function SmartSuggestions({ overview }: SmartSuggestionsProps) {
  const navigate = useNavigate();

  const suggestions = useMemo<Suggestion[]>(() => {
    const items: Suggestion[] = [];

    const pendingJobs = overview?.jobs?.pending || 0;
    if (pendingJobs > 0) {
      items.push({
        id: 'pending-jobs',
        icon: <Clock size={16} className="text-amber-600" />,
        title: `${pendingJobs} jobs pending approval`,
        description: 'Review and approve pending job orders to avoid delays.',
        path: '/jobs',
        priority: pendingJobs > 5 ? 'high' : 'medium',
      });
    }

    const overdueInvoices = overview?.overdue_invoices || 0;
    if (overdueInvoices > 0) {
      items.push({
        id: 'overdue-invoices',
        icon: <AlertTriangle size={16} className="text-red-600" />,
        title: `${overdueInvoices} overdue invoice${overdueInvoices > 1 ? 's' : ''}`,
        description: 'Follow up on overdue payments to improve cash flow.',
        path: '/finance/invoices',
        priority: 'high',
      });
    }

    const pendingLR = overview?.lr?.pending || 0;
    if (pendingLR > 0) {
      items.push({
        id: 'pending-lr',
        icon: <FileText size={16} className="text-blue-600" />,
        title: `${pendingLR} LRs awaiting completion`,
        description: 'Complete pending LRs to keep logistics on track.',
        path: '/lr',
        priority: 'medium',
      });
    }

    const idleVehicles = overview?.idle_vehicles || 0;
    if (idleVehicles > 3) {
      items.push({
        id: 'idle-vehicles',
        icon: <Truck size={16} className="text-purple-600" />,
        title: `${idleVehicles} vehicles idle`,
        description: 'Optimise fleet utilization by assigning idle vehicles to pending jobs.',
        path: '/vehicles',
        priority: 'low',
      });
    }

    const expiringDocs = overview?.expiring_documents || 0;
    if (expiringDocs > 0) {
      items.push({
        id: 'expiring-docs',
        icon: <Shield size={16} className="text-red-600" />,
        title: `${expiringDocs} documents expiring soon`,
        description: 'Renew expiring vehicle/driver documents before compliance issues arise.',
        path: '/fleet/vehicle-compliance',
        priority: 'high',
      });
    }

    // Sort: high first, then medium, then low
    const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
    items.sort((a, b) => order[a.priority] - order[b.priority]);

    return items.slice(0, 4);
  }, [overview]);

  if (suggestions.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600"><Lightbulb size={16} /></div>
        <h3 className="font-semibold text-[15px] text-gray-900">Smart Suggestions</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {suggestions.map((s) => (
          <button
            key={s.id}
            onClick={() => navigate(s.path)}
            className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all hover:shadow-sm group ${PRIORITY_STYLES[s.priority]}`}
          >
            <div className="mt-0.5 flex-shrink-0">{s.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{s.title}</p>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{s.description}</p>
            </div>
            <ChevronRight size={14} className="mt-0.5 flex-shrink-0 text-gray-300 group-hover:text-gray-500 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
}
