/**
 * Tyre Calculations — Business logic for tread depth, wear rate & days remaining
 * Transport ERP — Fleet Management
 */

export type TyreStatus = 'good' | 'average' | 'worn' | 'critical';

/** Legal minimum tread depth in mm (India motor vehicle rules) */
export const MINIMUM_TREAD_MM = 2.5;

/** Assumed new tyre depth for progress bar baseline */
export const INITIAL_TREAD_MM = 10;

// ── Status classification ───────────────────────────────

/**
 * Classify tyre condition from tread depth (mm).
 * >8mm  → good
 * 5–8mm → average
 * 2.5–5mm → worn
 * ≤2.5mm → critical (legal minimum)
 */
export function getTyreStatus(depth: number): TyreStatus {
  if (depth > 8) return 'good';
  if (depth >= 5) return 'average';
  if (depth > 2.5) return 'worn';
  return 'critical';
}

// ── Wear rate computation ───────────────────────────────

interface TreadReading {
  created_at?: string;
  date?: string;
  tread_depth_mm?: number | null;
}

/**
 * Compute average daily wear (mm/day) from a series of readings.
 * Returns null when there is insufficient data (< 2 readings or < 1 day elapsed).
 */
export function computeAvgDailyWear(readings: TreadReading[]): number | null {
  const valid = readings
    .filter(r => r.tread_depth_mm != null && (r.created_at || r.date))
    .sort(
      (a, b) =>
        new Date(a.created_at || a.date!).getTime() -
        new Date(b.created_at || b.date!).getTime(),
    );

  if (valid.length < 2) return null;

  const first = valid[0];
  const last = valid[valid.length - 1];

  const depthWorn =
    (first.tread_depth_mm as number) - (last.tread_depth_mm as number);
  const msElapsed =
    new Date(last.created_at || last.date!).getTime() -
    new Date(first.created_at || first.date!).getTime();
  const daysElapsed = msElapsed / (1000 * 60 * 60 * 24);

  if (daysElapsed < 1 || depthWorn <= 0) return null;

  return depthWorn / daysElapsed;
}

// ── Days remaining ──────────────────────────────────────

/**
 * Estimate days remaining until tread depth reaches MINIMUM_TREAD_MM.
 * Returns 0 when the tyre is already at or below the legal limit.
 * Returns null when avgDailyWear is unknown.
 */
export function computeDaysRemaining(
  currentDepth: number,
  avgDailyWear: number | null,
): number | null {
  if (avgDailyWear === null || avgDailyWear <= 0) return null;
  if (currentDepth <= MINIMUM_TREAD_MM) return 0;
  return Math.floor((currentDepth - MINIMUM_TREAD_MM) / avgDailyWear);
}

// ── Life remaining ────────────────────────────────────────

/**
 * Percentage of tyre life remaining based on actual initial thickness.
 * Formula: (currentDepth - 1.6) / (initialThickness - 1.6) * 100
 * Clamped to [0, 100].
 */
export function computeLifeRemainingPct(
  currentDepth: number,
  initialThickness: number,
): number {
  const MIN = 1.6;
  if (initialThickness <= MIN) return 0;
  return Math.min(100, Math.max(0, ((currentDepth - MIN) / (initialThickness - MIN)) * 100));
}

/**
 * Estimate avgDailyWear and daysRemaining from fitment date + initial thickness.
 * Used as fallback when fewer than 2 readings are available.
 */
export function computeDaysRemainingFromFitment(
  currentDepth: number,
  initialThickness: number,
  fittedOn: string,
): { avgDailyWear: number | null; daysRemaining: number | null } {
  const daysSinceFitted =
    (Date.now() - new Date(fittedOn).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceFitted < 1) return { avgDailyWear: null, daysRemaining: null };
  const worn = initialThickness - currentDepth;
  if (worn <= 0) return { avgDailyWear: null, daysRemaining: null };
  const avgDailyWear = worn / daysSinceFitted;
  const daysRemaining = Math.floor((currentDepth - MINIMUM_TREAD_MM) / avgDailyWear);
  return { avgDailyWear, daysRemaining: Math.max(0, daysRemaining) };
}

// ── Color helpers ───────────────────────────────────────

/** Returns a Tailwind-compatible hex color for a tyre status. */
export function getStatusColor(status: TyreStatus): string {
  switch (status) {
    case 'good':     return '#22c55e';
    case 'average':  return '#eab308';
    case 'worn':     return '#f97316';
    case 'critical': return '#ef4444';
  }
}

/** Returns a color based on days remaining (urgency). */
export function getDaysRemainingColor(days: number | null): string {
  if (days === null) return '#6b7280';   // gray — no data
  if (days === 0)    return '#ef4444';   // red — replace now
  if (days < 7)     return '#ef4444';   // red — urgent
  if (days < 15)    return '#f97316';   // orange — within 2 weeks
  if (days < 30)    return '#eab308';   // yellow — within a month
  return '#22c55e';                      // green — plenty of life
}

/** Human-readable label for days remaining. */
export function formatDaysRemaining(days: number | null, depth: number): string {
  if (depth <= MINIMUM_TREAD_MM) return 'Replace Now';
  if (days === null) return 'N/A – insufficient data';
  if (days === 0) return 'Replace Now';
  if (days === 1) return '~1 day';
  return `~${days} days`;
}
