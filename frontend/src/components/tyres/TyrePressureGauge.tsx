/**
 * TyrePressureGauge — Semicircle SVG PSI gauge with colour zones and animated needle.
 * Props: value (PSI), min (default 0), criticalPsi (default 60), minPsi (default 80), max (default 160), size (px, default 200)
 */
import React, { useEffect, useRef, useState } from 'react';

interface Props {
  value: number;
  criticalPsi?: number;
  minPsi?: number;
  max?: number;
  size?: number;
  label?: string;
  showValue?: boolean;
}

export default function TyrePressureGauge({
  value,
  criticalPsi = 60,
  minPsi = 80,
  max = 160,
  size = 200,
  label,
  showValue = true,
}: Props) {
  const [displayValue, setDisplayValue] = useState(0);
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animate needle on mount / value change
  useEffect(() => {
    const target = Math.max(0, Math.min(value, max));
    let current = 0;
    const step = target / 30;
    const tick = () => {
      current = Math.min(current + step, target);
      setDisplayValue(current);
      if (current < target) {
        animRef.current = setTimeout(tick, 16);
      }
    };
    tick();
    return () => { if (animRef.current) clearTimeout(animRef.current); };
  }, [value, max]);

  const cx = size / 2;
  const cy = size * 0.58;
  const r = size * 0.40;
  const strokeW = size * 0.085;

  // Arc helper: value → angle (0 = left = -180°, 1 = right = 0°)
  const valToAngle = (v: number) => {
    const ratio = Math.max(0, Math.min(v / max, 1));
    return -Math.PI + ratio * Math.PI; // -π to 0
  };

  const polarToXY = (angle: number, radius: number) => ({
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  });

  const arcPath = (startVal: number, endVal: number) => {
    const a1 = valToAngle(startVal);
    const a2 = valToAngle(endVal);
    const p1 = polarToXY(a1, r);
    const p2 = polarToXY(a2, r);
    const large = (a2 - a1) > Math.PI ? 1 : 0;
    return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y}`;
  };

  // Needle
  const needleAngle = valToAngle(displayValue);
  const needleTip = polarToXY(needleAngle, r - strokeW / 2 - 2);
  const needleBase1 = polarToXY(needleAngle + Math.PI / 2, 5);
  const needleBase2 = polarToXY(needleAngle - Math.PI / 2, 5);

  // Colour based on current value
  const gaugeColor =
    displayValue < criticalPsi ? '#ef4444' :
    displayValue < minPsi ? '#f97316' :
    displayValue < minPsi * 1.6 ? '#22c55e' :
    displayValue < max * 0.9 ? '#f97316' : '#ef4444';

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`}>
        {/* Background arc zones */}
        <path d={arcPath(0, criticalPsi)} stroke="#fca5a5" strokeWidth={strokeW} fill="none" strokeLinecap="round" />
        <path d={arcPath(criticalPsi, minPsi)} stroke="#fdba74" strokeWidth={strokeW} fill="none" />
        <path d={arcPath(minPsi, max * 0.75)} stroke="#86efac" strokeWidth={strokeW} fill="none" />
        <path d={arcPath(max * 0.75, max * 0.9)} stroke="#fdba74" strokeWidth={strokeW} fill="none" />
        <path d={arcPath(max * 0.9, max)} stroke="#fca5a5" strokeWidth={strokeW} fill="none" strokeLinecap="round" />

        {/* Filled arc to current value */}
        {displayValue > 0 && (
          <path
            d={arcPath(0, displayValue)}
            stroke={gaugeColor}
            strokeWidth={strokeW - 4}
            fill="none"
            strokeLinecap="round"
            opacity={0.9}
          />
        )}

        {/* Threshold tick marks */}
        {[criticalPsi, minPsi].map(thresh => {
          const angle = valToAngle(thresh);
          const outer = polarToXY(angle, r + strokeW / 2 + 2);
          const inner = polarToXY(angle, r - strokeW / 2 - 2);
          return (
            <line key={thresh} x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y}
              stroke="#fff" strokeWidth={2} strokeDasharray="none" />
          );
        })}

        {/* Needle */}
        <polygon
          points={`${needleTip.x},${needleTip.y} ${needleBase1.x},${needleBase1.y} ${needleBase2.x},${needleBase2.y}`}
          fill="#1e293b"
          opacity={0.85}
        />
        <circle cx={cx} cy={cy} r={6} fill="#1e293b" />

        {/* Value text */}
        {showValue && (
          <>
            <text x={cx} y={cy + 20} textAnchor="middle" fontSize={size * 0.13} fontWeight={700} fill={gaugeColor}>
              {Math.round(displayValue)}
            </text>
            <text x={cx} y={cy + 34} textAnchor="middle" fontSize={size * 0.07} fill="#6b7280">PSI</text>
          </>
        )}

        {/* Min/Max labels */}
        <text x={cx - r - 2} y={cy + 12} textAnchor="middle" fontSize={size * 0.06} fill="#9ca3af">0</text>
        <text x={cx + r + 2} y={cy + 12} textAnchor="middle" fontSize={size * 0.06} fill="#9ca3af">{max}</text>
      </svg>
      {label && <p className="text-xs text-gray-500 mt-1">{label}</p>}
    </div>
  );
}
