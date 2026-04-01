/**
 * VehicleTyreDiagram — SVG top-down vehicle diagram with live tyre data
 */
import React, { memo } from 'react';
import type { TyreData, TyreAlertType } from '@/types';

export type VehicleLayout = 'LCV_4' | 'TRUCK_2AXLE' | 'TRUCK_3AXLE' | 'TRAILER_3AXLE' | 'BUS_5AXLE';

/**
 * Map raw DB position codes (FL, FR, RL1 …) to diagram positions (1L0, 1R0, 2L0 …).
 * Call this before passing tyres to the diagram.
 */
export const POSITION_MAP: Record<string, string> = {
  FL: '1L0', FR: '1R0',
  RL1: '2L0', RR1: '2R1', RL2: '2L1', RR2: '2R0',
  RL3: '3L0', RR3: '3R1', RL4: '3L1', RR4: '3R0',
};

export function mapDbPositions(tyres: Map<string, any>): Map<string, any> {
  const mapped = new Map<string, any>();
  tyres.forEach((val, key) => {
    const diagramKey = POSITION_MAP[key] || key;
    mapped.set(diagramKey, { ...val, position: diagramKey, db_position: key });
  });
  return mapped;
}

/** Pick the best diagram layout from API vehicle_type string. */
export function layoutForVehicleType(vehicleType: string, tyreCount?: number): VehicleLayout {
  const t = (vehicleType || '').toUpperCase();
  if (t === 'LCV' || t === 'MINI_TRUCK') return 'LCV_4';
  if (t === 'TANKER' || t === 'CONTAINER') return 'TRUCK_3AXLE';
  if (t === 'TRAILER') return 'TRAILER_3AXLE';
  if (t === 'BUS') return 'BUS_5AXLE';
  // TRUCK — decide by tyre count
  if (tyreCount && tyreCount > 6) return 'TRUCK_3AXLE';
  return 'TRUCK_2AXLE';
}

interface Props {
  vehicleType: VehicleLayout;
  tyres: Map<string, Partial<TyreData>>;
  onTyreClick: (position: string) => void;
  selectedPosition?: string | null;
}

// ── Color helpers ───────────────────────────────────────

export function getTyreColor(tyre: Partial<TyreData>): string {
  if (!tyre.has_sensor && tyre.has_sensor !== undefined) return '#9E9E9E';
  if (tyre.alert === 'critical_pressure') return '#F44336';
  if (tyre.alert === 'low_pressure') return '#FF9800';
  if (tyre.alert === 'high_temp') return '#FF5722';
  const life = tyre.life_percent ?? 100;
  if (life >= 70) return '#4CAF50';
  if (life >= 50) return '#8BC34A';
  if (life >= 30) return '#FFC107';
  return '#F44336';
}

export function tyreLifeColor(life: number): string {
  if (life >= 90) return '#4CAF50';
  if (life >= 70) return '#8BC34A';
  if (life >= 50) return '#CDDC39';
  if (life >= 30) return '#FFC107';
  if (life >= 10) return '#FF9800';
  return '#F44336';
}

export function getPSIStatus(psi: number, target: number): { label: string; color: string } {
  const diff = ((target - psi) / target) * 100;
  if (diff > 20) return { label: 'CRITICAL', color: '#F44336' };
  if (diff > 10) return { label: 'LOW', color: '#FF9800' };
  if (diff < -10) return { label: 'HIGH', color: '#2196F3' };
  return { label: 'NORMAL', color: '#4CAF50' };
}

// ── Layout definitions ──────────────────────────────────

interface TyrePosition {
  position: string;
  x: number;
  y: number;
}

function getLayout(type: VehicleLayout): { positions: TyrePosition[]; width: number; height: number; bodyPath: string } {
  const W = 320;
  const tyreW = 48;
  const leftX = 30;
  const rightX = W - 30 - tyreW;
  const leftInner = leftX + tyreW + 4;
  const rightInner = rightX - tyreW - 4;

  switch (type) {
    case 'LCV_4':
      // Light commercial / mini-truck — 4 single tyres, 2 axles
      return {
        width: W, height: 250,
        bodyPath: `M${leftX + tyreW + 10},20 h${rightX - leftX - tyreW - 20} q20,0 20,20 v170 q0,20 -20,20 h-${rightX - leftX - tyreW - 20} q-20,0 -20,-20 v-170 q0,-20 20,-20 z`,
        positions: [
          { position: '1L0', x: leftX, y: 40 },
          { position: '1R0', x: rightX, y: 40 },
          { position: '2L0', x: leftX, y: 150 },
          { position: '2R0', x: rightX, y: 150 },
        ],
      };
    case 'TRUCK_2AXLE':
      return {
        width: W, height: 280,
        bodyPath: `M${leftX + tyreW + 10},20 h${rightX - leftX - tyreW - 20} q20,0 20,20 v200 q0,20 -20,20 h-${rightX - leftX - tyreW - 20} q-20,0 -20,-20 v-200 q0,-20 20,-20 z`,
        positions: [
          { position: '1L0', x: leftX, y: 40 },
          { position: '1R0', x: rightX, y: 40 },
          { position: '2L0', x: leftX, y: 170 },
          { position: '2L1', x: leftInner, y: 170 },
          { position: '2R1', x: rightInner, y: 170 },
          { position: '2R0', x: rightX, y: 170 },
        ],
      };
    case 'TRUCK_3AXLE':
      return {
        width: W, height: 400,
        bodyPath: `M${leftX + tyreW + 10},20 h${rightX - leftX - tyreW - 20} q20,0 20,20 v320 q0,20 -20,20 h-${rightX - leftX - tyreW - 20} q-20,0 -20,-20 v-320 q0,-20 20,-20 z`,
        positions: [
          { position: '1L0', x: leftX, y: 40 },
          { position: '1R0', x: rightX, y: 40 },
          { position: '2L0', x: leftX, y: 190 },
          { position: '2L1', x: leftInner, y: 190 },
          { position: '2R1', x: rightInner, y: 190 },
          { position: '2R0', x: rightX, y: 190 },
          { position: '3L0', x: leftX, y: 270 },
          { position: '3L1', x: leftInner, y: 270 },
          { position: '3R1', x: rightInner, y: 270 },
          { position: '3R0', x: rightX, y: 270 },
        ],
      };
    case 'TRAILER_3AXLE':
      // Trailer — no cab / no front steer axle, 3 dual axles = 12 tyres
      return {
        width: W, height: 360,
        bodyPath: `M${leftX + tyreW + 10},14 h${rightX - leftX - tyreW - 20} q20,0 20,20 v280 q0,20 -20,20 h-${rightX - leftX - tyreW - 20} q-20,0 -20,-20 v-280 q0,-20 20,-20 z`,
        positions: [
          { position: '1L0', x: leftX, y: 40 },
          { position: '1L1', x: leftInner, y: 40 },
          { position: '1R1', x: rightInner, y: 40 },
          { position: '1R0', x: rightX, y: 40 },
          { position: '2L0', x: leftX, y: 150 },
          { position: '2L1', x: leftInner, y: 150 },
          { position: '2R1', x: rightInner, y: 150 },
          { position: '2R0', x: rightX, y: 150 },
          { position: '3L0', x: leftX, y: 260 },
          { position: '3L1', x: leftInner, y: 260 },
          { position: '3R1', x: rightInner, y: 260 },
          { position: '3R0', x: rightX, y: 260 },
        ],
      };
    case 'BUS_5AXLE':
    default:
      return {
        width: W, height: 560,
        bodyPath: `M${leftX + tyreW + 10},14 h${rightX - leftX - tyreW - 20} q20,0 20,20 v480 q0,20 -20,20 h-${rightX - leftX - tyreW - 20} q-20,0 -20,-20 v-480 q0,-20 20,-20 z`,
        positions: [
          { position: '1L0', x: leftX, y: 30 },
          { position: '1R0', x: rightX, y: 30 },
          { position: '2L0', x: leftX, y: 130 },
          { position: '2R0', x: rightX, y: 130 },
          { position: '3L0', x: leftX, y: 230 },
          { position: '3R0', x: rightX, y: 230 },
          { position: '4L0', x: leftX, y: 340 },
          { position: '4L1', x: leftInner, y: 340 },
          { position: '4R1', x: rightInner, y: 340 },
          { position: '4R0', x: rightX, y: 340 },
          { position: '5L0', x: leftX, y: 420 },
          { position: '5L1', x: leftInner, y: 420 },
          { position: '5R1', x: rightInner, y: 420 },
          { position: '5R0', x: rightX, y: 420 },
        ],
      };
  }
}

// ── Single tyre SVG ─────────────────────────────────────

const TyreRect = memo(function TyreRect({
  pos, tyre, x, y, isSelected, onClick,
}: {
  pos: string;
  tyre: Partial<TyreData> | undefined;
  x: number;
  y: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const w = 48, h = 64;
  const color = tyre ? getTyreColor(tyre) : '#9E9E9E';
  const hasAlert = tyre?.alert && tyre.alert !== null;
  const psi = tyre?.psi;
  const temp = tyre?.temperature;

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      {/* Alert pulse animation */}
      {hasAlert && (
        <rect
          x={x - 3} y={y - 3} width={w + 6} height={h + 6} rx={8}
          fill="none" stroke="#F44336" strokeWidth={2}
          opacity={0.8}
        >
          <animate attributeName="opacity" values="0.8;0.2;0.8" dur="1.5s" repeatCount="indefinite" />
        </rect>
      )}

      {/* Tyre body */}
      <rect
        x={x} y={y} width={w} height={h} rx={6}
        fill={color}
        stroke={isSelected ? '#1976D2' : '#333'}
        strokeWidth={isSelected ? 2.5 : 1}
        opacity={0.9}
      />

      {/* Position label */}
      <text x={x + w / 2} y={y + 15} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff">
        {pos}
      </text>

      {/* PSI */}
      {psi !== undefined && psi > 0 ? (
        <text x={x + w / 2} y={y + 33} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fff">
          {psi.toFixed(1)}
        </text>
      ) : (
        <text x={x + w / 2} y={y + 33} textAnchor="middle" fontSize={10} fill="rgba(255,255,255,0.7)">
          —
        </text>
      )}

      {/* Temperature */}
      {temp !== undefined && temp > 0 && (
        <text x={x + w / 2} y={y + 50} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.85)">
          {temp.toFixed(0)}°C
        </text>
      )}

      {/* No sensor indicator */}
      {(!tyre || (!tyre.has_sensor && tyre.has_sensor !== undefined)) && (
        <text x={x + w / 2} y={y + 50} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.6)">
          No sensor
        </text>
      )}
    </g>
  );
});

// ── Main diagram ────────────────────────────────────────

function VehicleTyreDiagram({ vehicleType, tyres, onTyreClick, selectedPosition }: Props) {
  const layout = getLayout(vehicleType);

  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      className="w-full max-w-sm mx-auto"
      style={{ maxHeight: layout.height }}
    >
      {/* Vehicle body */}
      <path d={layout.bodyPath} fill="#f3f4f6" stroke="#d1d5db" strokeWidth={1.5} />

      {/* Cab indicator (windshield) — skip for trailers */}
      {vehicleType !== 'TRAILER_3AXLE' && (
        <>
          <rect
            x={layout.width / 2 - 40}
            y={8}
            width={80}
            height={20}
            rx={6}
            fill="#e5e7eb"
            stroke="#d1d5db"
            strokeWidth={1}
          />
          <text x={layout.width / 2} y={22} textAnchor="middle" fontSize={9} fill="#6b7280">CAB</text>
        </>
      )}
      {vehicleType === 'TRAILER_3AXLE' && (
        <>
          <rect
            x={layout.width / 2 - 44}
            y={4}
            width={88}
            height={20}
            rx={6}
            fill="#fef3c7"
            stroke="#f59e0b"
            strokeWidth={1}
          />
          <text x={layout.width / 2} y={18} textAnchor="middle" fontSize={9} fill="#92400e" fontWeight={600}>TRAILER</text>
        </>
      )}

      {/* Axle lines */}
      {getAxleYPositions(layout.positions).map((y, i) => (
        <line
          key={i}
          x1={40}
          y1={y + 32}
          x2={layout.width - 40}
          y2={y + 32}
          stroke="#d1d5db"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      ))}

      {/* Tyres */}
      {layout.positions.map(p => (
        <TyreRect
          key={p.position}
          pos={p.position}
          tyre={tyres.get(p.position)}
          x={p.x}
          y={p.y}
          isSelected={selectedPosition === p.position}
          onClick={() => onTyreClick(p.position)}
        />
      ))}
    </svg>
  );
}

function getAxleYPositions(positions: TyrePosition[]): number[] {
  const ySet = new Set<number>();
  positions.forEach(p => ySet.add(p.y));
  return Array.from(ySet).sort((a, b) => a - b);
}

export default memo(VehicleTyreDiagram);
