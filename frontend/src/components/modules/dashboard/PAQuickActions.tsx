// Quick Action Buttons — Project Associate Dashboard
// Prominent workflow action shortcuts

import {
  Plus, FileText, Shield, Navigation,
  Upload, CreditCard
} from 'lucide-react';

interface Props {
  navigate: (path: string) => void;
}

const quickActions = [
  {
    label: 'Create LR',
    icon: <Plus size={18} />,
    path: '/lr/new',
    color: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200',
  },
  {
    label: 'LR Details',
    icon: <FileText size={18} />,
    path: '/lr',
    color: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200',
  },
  {
    label: 'Generate E-way Bill',
    icon: <Shield size={18} />,
    path: '/lr?action=eway',
    color: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200',
  },
  {
    label: 'Create Trip',
    icon: <Navigation size={18} />,
    path: '/trips?action=create',
    color: 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-200',
  },
  {
    label: 'Upload Document',
    icon: <Upload size={18} />,
    path: '/jobs?action=upload',
    color: 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-cyan-200',
  },
  {
    label: 'Banking Entry',
    icon: <CreditCard size={18} />,
    path: '/finance/payments?action=create',
    color: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200',
  },
];

export default function PAQuickActions({ navigate }: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      {quickActions.map((action) => (
        <button
          key={action.label}
          onClick={() => navigate(action.path)}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg transition-all duration-200 hover:-translate-y-0.5 ${action.color}`}
        >
          {action.icon}
          {action.label}
        </button>
      ))}
    </div>
  );
}
