/**
 * TreadDepthBar — 5-segment vertical bar showing tyre tread depth.
 * Props: value (mm), max (default 10), worn (default 1.6), min (default 3.0)
 */
import React from 'react';

interface Props {
  value: number;
  max?: number;
  worn?: number;
  min?: number;
  showLabel?: boolean;
  compact?: boolean;
}

export default function TreadDepthBar({
  value,
  max = 10,
  worn = 1.6,
  min = 3.0,
  showLabel = true,
  compact = false,
}: Props) {
  const SEGMENTS = 5;
  const ratio = Math.max(0, Math.min(value / max, 1));
  const filledSegments = Math.round(ratio * SEGMENTS);

  // Colour based on value
  const getColor = (segIndex: number) => {
    const segThreshold = (segIndex + 1) / SEGMENTS * max;
    if (value < worn) return '#ef4444';       // red
    if (value < min) return '#f97316';         // orange
    if (value < max * 0.5) return '#eab308';   // yellow
    return '#22c55e';                          // green
  };

  const barW = compact ? 18 : 24;
  const barH = compact ? 52 : 72;
  const gap = compact ? 2 : 3;

  const label =
    value >= max * 0.8 ? 'New' :
    value >= max * 0.6 ? 'Good' :
    value >= min ? 'Average' :
    value >= worn ? 'Worn' :
    'Critical';

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="flex flex-col-reverse gap-0.5 rounded-sm overflow-hidden"
        style={{ width: barW, height: barH }}
      >
        {Array.from({ length: SEGMENTS }).map((_, i) => {
          const filled = i < filledSegments;
          return (
            <div
              key={i}
              style={{
                height: `calc(${100 / SEGMENTS}% - ${gap / 2}px)`,
                backgroundColor: filled ? getColor(i) : '#e5e7eb',
                borderRadius: 2,
                transition: 'background-color 0.3s',
              }}
            />
          );
        })}
      </div>
      {showLabel && (
        <>
          <span className="text-xs font-semibold" style={{ color: getColor(filledSegments - 1) }}>
            {value.toFixed(1)}mm
          </span>
          <span className="text-xs text-gray-400">{label}</span>
        </>
      )}
    </div>
  );
}
