import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trophy, TrendingUp, TrendingDown, AlertTriangle, Star, Send, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { KPICard, LoadingSpinner, EmptyState, Modal } from '@/components/common/Modal';
import { driverScoringService } from '@/services/dataService';
import type { LeaderboardEntry, ScoreTier } from '@/types';
import { safeArray } from '@/utils/helpers';

const TIER_CONFIG: Record<ScoreTier, { label: string; color: string; bg: string }> = {
  EXCELLENT: { label: 'Excellent', color: 'text-green-700', bg: 'bg-green-100' },
  GOOD: { label: 'Good', color: 'text-blue-700', bg: 'bg-blue-100' },
  AVERAGE: { label: 'Average', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  POOR: { label: 'Poor', color: 'text-orange-700', bg: 'bg-orange-100' },
  UNSAFE: { label: 'Unsafe', color: 'text-red-700', bg: 'bg-red-100' },
};

function TierBadge({ tier }: { tier: ScoreTier }) {
  const config = TIER_CONFIG[tier] || TIER_CONFIG.AVERAGE;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${config.color} ${config.bg}`}>
      {config.label}
    </span>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 90 ? '#22c55e' : score >= 75 ? '#3b82f6' : score >= 60 ? '#eab308' : score >= 40 ? '#f97316' : '#ef4444';

  return (
    <svg width="100" height="100" viewBox="0 0 100 100" className="transform -rotate-90">
      <circle cx="50" cy="50" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="8" />
      <circle cx="50" cy="50" r={radius} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={circumference} strokeDashoffset={circumference - progress} strokeLinecap="round" />
      <text x="50" y="50" textAnchor="middle" dominantBaseline="central" className="transform rotate-90 origin-center"
        fill={color} fontSize="18" fontWeight="bold">{score}</text>
    </svg>
  );
}

export default function DriverLeaderboardPage() {
  const queryClient = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [coachingDriverId, setCoachingDriverId] = useState<number | null>(null);
  const [coachingNote, setCoachingNote] = useState('');
  const [coachingCategory, setCoachingCategory] = useState('');

  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ['driver-leaderboard', month, year],
    queryFn: () => driverScoringService.getLeaderboard({ month, year }),
  });

  const { data: distribution } = useQuery({
    queryKey: ['fleet-score-distribution', month, year],
    queryFn: () => driverScoringService.getFleetDistribution({ month, year }),
  });

  const { data: expandedBreakdown } = useQuery({
    queryKey: ['driver-score-breakdown', expandedId, month, year],
    queryFn: () => expandedId ? driverScoringService.getDriverScoreBreakdown(expandedId, { month, year }) : null,
    enabled: !!expandedId,
  });

  const { data: expandedTrend } = useQuery({
    queryKey: ['driver-score-trend', expandedId],
    queryFn: () => expandedId ? driverScoringService.getDriverScoreTrend(expandedId, 6) : null,
    enabled: !!expandedId,
  });

  const { data: coachingNotes } = useQuery({
    queryKey: ['coaching-notes', expandedId],
    queryFn: () => expandedId ? driverScoringService.getCoachingNotes(expandedId) : null,
    enabled: !!expandedId,
  });

  const addNoteMutation = useMutation({
    mutationFn: ({ driverId, note_text, category }: { driverId: number; note_text: string; category?: string }) =>
      driverScoringService.addCoachingNote(driverId, { note_text, category }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaching-notes'] });
      setCoachingDriverId(null);
      setCoachingNote('');
      setCoachingCategory('');
    },
  });

  const entries: LeaderboardEntry[] = safeArray(leaderboard?.entries);
  const dist = distribution?.distribution || {};
  const avgScore = distribution?.average_score || 0;
  const totalDrivers = leaderboard?.total_drivers || 0;

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2024, i, 1).toLocaleString('en', { month: 'long' }),
  }));

  const handlePrevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const handleNextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Driver Leaderboard</h1>
          <p className="text-sm text-gray-500 mt-1">Driver behavior scores and rankings</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrevMonth} className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50">&larr;</button>
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={handleNextMonth} className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50">&rarr;</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <KPICard title="Total Drivers" value={totalDrivers} icon={<Users className="w-5 h-5" />} color="gray" />
        <KPICard title="Average Score" value={avgScore} icon={<Star className="w-5 h-5" />} color="blue" />
        <KPICard title="Excellent" value={dist.EXCELLENT || 0} icon={<Trophy className="w-5 h-5" />} color="green" />
        <KPICard title="Good" value={dist.GOOD || 0} icon={<TrendingUp className="w-5 h-5" />} color="blue" />
        <KPICard title="Poor" value={dist.POOR || 0} icon={<TrendingDown className="w-5 h-5" />} color="orange" />
        <KPICard title="Unsafe" value={dist.UNSAFE || 0} icon={<AlertTriangle className="w-5 h-5" />} color="red" />
      </div>

      {/* Distribution Bar */}
      {totalDrivers > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Score Distribution</h3>
          <div className="flex h-6 rounded-full overflow-hidden">
            {(['EXCELLENT', 'GOOD', 'AVERAGE', 'POOR', 'UNSAFE'] as ScoreTier[]).map(tier => {
              const count = dist[tier] || 0;
              const pct = (count / totalDrivers) * 100;
              if (pct === 0) return null;
              const colors: Record<string, string> = { EXCELLENT: 'bg-green-500', GOOD: 'bg-blue-500', AVERAGE: 'bg-yellow-400', POOR: 'bg-orange-500', UNSAFE: 'bg-red-500' };
              return <div key={tier} className={`${colors[tier]} transition-all`} style={{ width: `${pct}%` }} title={`${tier}: ${count} (${pct.toFixed(0)}%)`} />;
            })}
          </div>
          <div className="flex gap-4 mt-2 text-xs text-gray-500">
            {(['EXCELLENT', 'GOOD', 'AVERAGE', 'POOR', 'UNSAFE'] as ScoreTier[]).map(tier => {
              const colors: Record<string, string> = { EXCELLENT: 'bg-green-500', GOOD: 'bg-blue-500', AVERAGE: 'bg-yellow-400', POOR: 'bg-orange-500', UNSAFE: 'bg-red-500' };
              return (
                <span key={tier} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${colors[tier]}`} />
                  {TIER_CONFIG[tier].label}: {dist[tier] || 0}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Leaderboard Table */}
      {entries.length === 0 ? (
        <EmptyState title="No Data" description="No driver scores available for this period." />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee Code</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Score</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tier</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Events</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Penalty</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map(entry => {
                const isExpanded = expandedId === entry.driver_id;
                return (
                  <DriverRow
                    key={entry.driver_id}
                    entry={entry}
                    isExpanded={isExpanded}
                    onToggle={() => setExpandedId(isExpanded ? null : entry.driver_id)}
                    onCoach={() => setCoachingDriverId(entry.driver_id)}
                    breakdown={isExpanded ? expandedBreakdown : null}
                    trend={isExpanded ? expandedTrend : null}
                    notes={isExpanded ? safeArray(coachingNotes) : []}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Coaching Note Modal */}
      <Modal
        isOpen={coachingDriverId !== null}
        onClose={() => { setCoachingDriverId(null); setCoachingNote(''); setCoachingCategory(''); }}
        title="Add Coaching Note"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select value={coachingCategory} onChange={e => setCoachingCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">General</option>
              <option value="safety">Safety</option>
              <option value="speed">Speed Management</option>
              <option value="fuel">Fuel Efficiency</option>
              <option value="compliance">Compliance</option>
              <option value="commendation">Commendation</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
            <textarea
              value={coachingNote}
              onChange={e => setCoachingNote(e.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Enter coaching feedback..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setCoachingDriverId(null); setCoachingNote(''); }}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button
              onClick={() => {
                if (coachingDriverId && coachingNote.trim()) {
                  addNoteMutation.mutate({ driverId: coachingDriverId, note_text: coachingNote, category: coachingCategory || undefined });
                }
              }}
              disabled={!coachingNote.trim() || addNoteMutation.isPending}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {addNoteMutation.isPending ? 'Saving...' : 'Save Note'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Driver Row with expandable detail ──────────────────────────────

interface DriverRowProps {
  entry: LeaderboardEntry;
  isExpanded: boolean;
  onToggle: () => void;
  onCoach: () => void;
  breakdown: any;
  trend: any;
  notes: any[];
}

function DriverRow({ entry, isExpanded, onToggle, onCoach, breakdown, trend, notes }: DriverRowProps) {
  const rankIcon = entry.rank <= 3 ? (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
      entry.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
      entry.rank === 2 ? 'bg-gray-100 text-gray-600' :
      'bg-orange-100 text-orange-700'
    }`}>{entry.rank}</span>
  ) : (
    <span className="text-sm text-gray-500 pl-2">{entry.rank}</span>
  );

  return (
    <>
      <tr className={`hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-blue-50' : ''}`} onClick={onToggle}>
        <td className="px-4 py-3">{rankIcon}</td>
        <td className="px-4 py-3">
          <div className="font-medium text-gray-900">{entry.driver_name}</div>
          <div className="text-xs text-gray-500">{entry.phone}</div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600">{entry.employee_code || '—'}</td>
        <td className="px-4 py-3 text-center">
          <span className="text-lg font-bold" style={{
            color: entry.score >= 90 ? '#22c55e' : entry.score >= 75 ? '#3b82f6' : entry.score >= 60 ? '#eab308' : entry.score >= 40 ? '#f97316' : '#ef4444'
          }}>{entry.score}</span>
        </td>
        <td className="px-4 py-3 text-center"><TierBadge tier={entry.tier} /></td>
        <td className="px-4 py-3 text-center text-sm text-gray-600">{entry.total_events}</td>
        <td className="px-4 py-3 text-center text-sm text-red-600">-{entry.total_penalty}</td>
        <td className="px-4 py-3 text-center">
          <div className="flex items-center justify-center gap-1">
            <button onClick={e => { e.stopPropagation(); onCoach(); }}
              className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600" title="Add coaching note">
              <Send className="w-4 h-4" />
            </button>
            {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={8} className="px-4 py-4 bg-gray-50 border-t border-gray-100">
            <DriverExpandedDetail
              entry={entry}
              breakdown={breakdown}
              trend={trend}
              notes={notes}
            />
          </td>
        </tr>
      )}
    </>
  );
}

// ── Expanded Detail Panel ──────────────────────────────────────────

function DriverExpandedDetail({ entry, breakdown, trend, notes }: {
  entry: LeaderboardEntry;
  breakdown: any;
  trend: any;
  notes: any[];
}) {
  const categories = safeArray(breakdown?.categories);
  const trendPoints = safeArray(trend?.trend);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Score Gauge */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col items-center">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Overall Score</h4>
        <ScoreGauge score={entry.score} />
        <TierBadge tier={entry.tier} />
      </div>

      {/* Category Breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Event Breakdown</h4>
        {categories.length === 0 ? (
          <p className="text-sm text-gray-400">No events this month</p>
        ) : (
          <div className="space-y-2">
            {categories.map((cat: any) => {
              const label = (cat.event_type || '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
              const maxPenalty = 50;
              const pct = Math.min(100, (cat.penalty / maxPenalty) * 100);
              return (
                <div key={cat.event_type}>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>{label}</span>
                    <span>{cat.count} events (-{cat.penalty} pts)</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full mt-1">
                    <div className="h-2 bg-red-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Trend + Coaching Notes */}
      <div className="space-y-4">
        {/* Mini Trend */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Score Trend</h4>
          {trendPoints.length === 0 ? (
            <p className="text-sm text-gray-400">No trend data</p>
          ) : (
            <div className="flex items-end gap-1 h-16">
              {trendPoints.map((pt: any, i: number) => {
                const h = Math.max(4, (pt.score / 100) * 64);
                const color = pt.score >= 90 ? 'bg-green-400' : pt.score >= 75 ? 'bg-blue-400' : pt.score >= 60 ? 'bg-yellow-400' : pt.score >= 40 ? 'bg-orange-400' : 'bg-red-400';
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className={`w-full ${color} rounded-t`} style={{ height: `${h}px` }} title={`${pt.label}: ${pt.score}`} />
                    <span className="text-[9px] text-gray-400 truncate">{pt.label?.split(' ')[0]}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Coaching Notes */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Coaching Notes</h4>
          {notes.length === 0 ? (
            <p className="text-sm text-gray-400">No coaching notes</p>
          ) : (
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {notes.slice(0, 3).map((n: any) => (
                <div key={n.id} className="text-xs border-l-2 border-blue-400 pl-2">
                  <p className="text-gray-700">{n.note_text}</p>
                  <p className="text-gray-400 mt-0.5">{n.created_at ? new Date(n.created_at).toLocaleDateString() : ''}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
