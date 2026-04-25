/**
 * WearTimelineChart — Recharts line chart showing tread-depth wear per km milestone from simulation.
 * Props: milestones — array of { km, [position]: tread_mm } objects; wornMm, minMm
 */
import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, ResponsiveContainer,
} from 'recharts';

interface Milestone {
  km: number;
  [position: string]: number;
}

interface Props {
  milestones: Milestone[];
  wornMm?: number;
  minMm?: number;
}

const POSITION_COLORS: Record<string, string> = {
  FL: '#3b82f6', FR: '#10b981', RL: '#f59e0b', RR: '#ef4444',
  RLI: '#8b5cf6', RRI: '#ec4899', RLO: '#06b6d4', RRO: '#84cc16',
  spare: '#9ca3af',
};

export default function WearTimelineChart({ milestones, wornMm = 1.6, minMm = 3.0 }: Props) {
  if (!milestones || milestones.length === 0) {
    return <div className="text-sm text-gray-400 text-center py-6">Run a simulation to see wear timeline.</div>;
  }

  // Detect which positions are present (keys excluding 'km')
  const positions = Object.keys(milestones[0]).filter(k => k !== 'km');

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={milestones} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="km"
          tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
          label={{ value: 'km', position: 'insideBottomRight', offset: -4, fontSize: 11 }}
          tick={{ fontSize: 11 }}
        />
        <YAxis
          domain={[0, 'auto']}
          tickFormatter={v => `${v}mm`}
          tick={{ fontSize: 11 }}
          width={45}
        />
        <Tooltip formatter={(v: any) => [`${Number(v).toFixed(2)} mm`]} labelFormatter={l => `${l.toLocaleString()} km`} />
        <Legend wrapperStyle={{ fontSize: 11 }} />

        <ReferenceLine y={minMm} stroke="#f59e0b" strokeDasharray="4 2"
          label={{ value: `Min ${minMm}mm`, position: 'insideTopLeft', fill: '#b45309', fontSize: 10 }} />
        <ReferenceLine y={wornMm} stroke="#ef4444" strokeDasharray="4 2"
          label={{ value: `Worn ${wornMm}mm`, position: 'insideTopLeft', fill: '#b91c1c', fontSize: 10 }} />

        {positions.map(pos => (
          <Line
            key={pos}
            type="monotone"
            dataKey={pos}
            stroke={POSITION_COLORS[pos] || '#6b7280'}
            strokeWidth={2}
            dot={false}
            name={pos}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
