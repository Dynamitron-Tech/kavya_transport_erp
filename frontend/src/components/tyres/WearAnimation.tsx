/**
 * WearAnimation — Animated bar showing tyre wear from current to predicted tread.
 * Respects prefers-reduced-motion.
 */
import React, { useEffect, useRef, useState } from 'react';

interface Props {
  startTread: number;
  endTread: number;
  position: string;
  durationMs?: number;
  maxTread?: number;
  wornThreshold?: number;
}

export default function WearAnimation({
  startTread, endTread, position, durationMs = 1200, maxTread = 10, wornThreshold = 1.6,
}: Props) {
  const prefersReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [currentTread, setCurrentTread] = useState(startTread);
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedRef = useRef(false);

  const getColor = (v: number) => {
    if (v <= 0) return '#dc2626';
    if (v < wornThreshold) return '#ef4444';
    if (v < 3.0) return '#f97316';
    if (v < 6.0) return '#eab308';
    return '#22c55e';
  };

  useEffect(() => {
    if (prefersReduced) {
      setCurrentTread(endTread);
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    const steps = 60;
    const diff = endTread - startTread;
    const stepSize = diff / steps;
    const interval = durationMs / steps;
    let step = 0;

    const tick = () => {
      step++;
      const newVal = startTread + stepSize * step;
      setCurrentTread(Math.max(0, newVal));
      if (step < steps) {
        animRef.current = setTimeout(tick, interval);
      }
    };
    animRef.current = setTimeout(tick, 100);
    return () => { if (animRef.current) clearTimeout(animRef.current); };
  }, []);

  const barHeight = `${(currentTread / maxTread) * 100}%`;
  const atReplacement = currentTread <= 0;
  const color = getColor(currentTread);

  return (
    <div className="flex flex-col items-center gap-1 w-12">
      <div className="text-xs font-medium text-gray-500 truncate">{position}</div>
      <div className="relative w-8 h-20 bg-gray-100 rounded-lg border border-gray-200 overflow-hidden">
        {/* Worn threshold marker */}
        <div
          className="absolute w-full border-t-2 border-dashed border-red-300 z-10"
          style={{ bottom: `${(wornThreshold / maxTread) * 100}%` }}
        />
        {/* Animated fill */}
        <div
          className="absolute bottom-0 left-0 w-full rounded-b-lg transition-all"
          style={{
            height: barHeight,
            backgroundColor: color,
            transition: `height ${1200 / 60}ms linear`,
          }}
        />
        {atReplacement && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-red-600 text-[8px] font-bold">0mm</span>
          </div>
        )}
      </div>
      <div className={`text-xs font-semibold`} style={{ color }}>
        {currentTread.toFixed(1)}mm
      </div>
      <div className="text-[10px] text-gray-400">
        from {startTread.toFixed(1)}
      </div>
      {atReplacement && (
        <div className="text-[9px] text-red-600 font-bold text-center leading-tight">Replace!</div>
      )}
    </div>
  );
}
