// KPI Action Cards — Project Associate Dashboard
// Clickable cards that redirect to filtered pages

import {
  ClipboardList, FileText, Shield, Navigation,
  XCircle, Upload, Clock
} from 'lucide-react';

interface KpiData {
  total_jobs: { today: number; this_week: number };
  jobs_pending_documentation: number;
  lr_pending_creation: number;
  eway_bills_pending: number;
  trips_pending_creation: number;
  trips_pending_closure: number;
  documents_pending_upload: number;
  jobs_awaiting_approval: number;
}

interface Props {
  data: Partial<KpiData> | undefined;
  isLoading: boolean;
  navigate: (path: string) => void;
}

interface KpiCardConfig {
  key: string;
  title: string;
  getValue: (d: Partial<KpiData> | undefined) => number | string;
  subtitle?: (d: Partial<KpiData> | undefined) => string;
  icon: React.ReactNode;
  iconBg: string;
  navigateTo: string;
  badgeColor?: string;
}

const kpiCards: KpiCardConfig[] = [
  {
    key: 'total_jobs',
    title: 'Total Jobs',
    getValue: (d) => d?.total_jobs?.today ?? 0,
    subtitle: (d) => `${d?.total_jobs?.this_week ?? 0} this week`,
    icon: <ClipboardList size={22} className="text-blue-600" />,
    iconBg: 'bg-blue-50 border-blue-100',
    navigateTo: '/jobs',
  },
  {
    key: 'pending_docs',
    title: 'Pending Documentation',
    getValue: (d) => d?.jobs_pending_documentation ?? 0,
    icon: <FileText size={22} className="text-amber-600" />,
    iconBg: 'bg-amber-50 border-amber-100',
    navigateTo: '/jobs?status=pending_documentation',
    badgeColor: 'bg-amber-100 text-amber-700',
  },
  {
    key: 'lr_pending',
    title: 'LR Pending',
    getValue: (d) => d?.lr_pending_creation ?? 0,
    icon: <FileText size={22} className="text-orange-600" />,
    iconBg: 'bg-orange-50 border-orange-100',
    navigateTo: '/lr?status=pending',
    badgeColor: 'bg-orange-100 text-orange-700',
  },
  {
    key: 'eway_pending',
    title: 'E-way Bills Pending',
    getValue: (d) => d?.eway_bills_pending ?? 0,
    icon: <Shield size={22} className="text-red-600" />,
    iconBg: 'bg-red-50 border-red-100',
    navigateTo: '/lr?eway_pending=true',
    badgeColor: 'bg-red-100 text-red-700',
  },
  {
    key: 'trips_pending',
    title: 'Trips Pending Creation',
    getValue: (d) => d?.trips_pending_creation ?? 0,
    icon: <Navigation size={22} className="text-purple-600" />,
    iconBg: 'bg-purple-50 border-purple-100',
    navigateTo: '/jobs?status=approved&no_trip=true',
    badgeColor: 'bg-purple-100 text-purple-700',
  },
  {
    key: 'trips_closure',
    title: 'Trips Pending Closure',
    getValue: (d) => d?.trips_pending_closure ?? 0,
    icon: <XCircle size={22} className="text-rose-600" />,
    iconBg: 'bg-rose-50 border-rose-100',
    navigateTo: '/trips?status=closure_pending',
    badgeColor: 'bg-rose-100 text-rose-700',
  },
  {
    key: 'docs_upload',
    title: 'Documents Pending',
    getValue: (d) => d?.documents_pending_upload ?? 0,
    icon: <Upload size={22} className="text-cyan-600" />,
    iconBg: 'bg-cyan-50 border-cyan-100',
    navigateTo: '/jobs?docs_pending=true',
    badgeColor: 'bg-cyan-100 text-cyan-700',
  },
  {
    key: 'awaiting_approval',
    title: 'Awaiting Approval',
    getValue: (d) => d?.jobs_awaiting_approval ?? 0,
    icon: <Clock size={22} className="text-indigo-600" />,
    iconBg: 'bg-indigo-50 border-indigo-100',
    navigateTo: '/jobs?status=pending_approval',
    badgeColor: 'bg-indigo-100 text-indigo-700',
  },
];

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-3 flex-1">
          <div className="h-3 bg-gray-200 rounded w-24" />
          <div className="h-8 bg-gray-200 rounded w-12" />
          <div className="h-3 bg-gray-200 rounded w-20" />
        </div>
        <div className="w-12 h-12 bg-gray-200 rounded-xl" />
      </div>
    </div>
  );
}

export default function PAKpiCards({ data, isLoading, navigate }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpiCards.map((card) => {
        const value = card.getValue(data);
        const subtitle = card.subtitle ? card.subtitle(data) : undefined;
        const isUrgent = typeof value === 'number' && value > 0 && card.badgeColor;

        return (
          <button
            key={card.key}
            onClick={() => navigate(card.navigateTo)}
            className={`bg-white rounded-xl border p-5 text-left transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 group ${
              isUrgent ? 'border-gray-200 hover:border-gray-300' : 'border-gray-100'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">{card.title}</p>
                <div className="flex items-baseline gap-2 mt-1.5">
                  <p className="text-3xl font-bold text-gray-900">{value}</p>
                  {isUrgent && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${card.badgeColor}`}>
                      Action needed
                    </span>
                  )}
                </div>
                {subtitle && (
                  <p className="text-xs text-gray-400 mt-1.5">{subtitle}</p>
                )}
              </div>
              <div className={`p-3 rounded-xl border ${card.iconBg} group-hover:scale-110 transition-transform`}>
                {card.icon}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
