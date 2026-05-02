import React from 'react';
import type { ValidationFlag } from '@/services/invoiceWorkspaceService';

interface ConfidenceBadgeProps {
  score: number | null;
  flags?: ValidationFlag[];
  field?: string;
}

export default function ConfidenceBadge({ score, flags = [], field }: ConfidenceBadgeProps) {
  if (score === null || score === undefined) return <span className="text-gray-400 text-xs">—</span>;

  const pct = Math.round(score * 100);
  const fieldFlags = field ? flags.filter(f => f.field === field) : flags;

  let dotColor = 'bg-green-500';
  let textColor = 'text-green-700';
  let bgColor = 'bg-green-50';

  if (pct < 60) {
    dotColor = 'bg-red-500';
    textColor = 'text-red-700';
    bgColor = 'bg-red-50';
  } else if (pct < 85) {
    dotColor = 'bg-yellow-500';
    textColor = 'text-yellow-700';
    bgColor = 'bg-yellow-50';
  }

  return (
    <div className="relative group inline-flex items-center gap-1">
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${bgColor} ${textColor} cursor-help`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        {pct}%
      </span>

      {fieldFlags.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 z-50 hidden group-hover:block w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-2 text-xs">
          {fieldFlags.map((f, i) => (
            <div key={i} className={`mb-1.5 last:mb-0 ${
              f.severity === 'critical' ? 'text-red-700' :
              f.severity === 'warning' ? 'text-yellow-700' : 'text-gray-600'
            }`}>
              <p className="font-medium">{f.message}</p>
              {f.value_found && <p>Found: <span className="font-mono">{f.value_found}</span></p>}
              {f.value_expected && <p>Expected: <span className="font-mono">{f.value_expected}</span></p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
