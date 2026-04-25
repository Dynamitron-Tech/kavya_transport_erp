/**
 * EdgeOverlay.tsx
 * Thin transparent canvas overlaid on the camera feed.
 * The parent (useCameraScanner) draws the green contour border directly
 * onto this canvas ref — this component is purely declarative markup.
 */

import React, { forwardRef } from 'react';

interface EdgeOverlayProps {
  width?: number;
  height?: number;
  className?: string;
}

const EdgeOverlay = forwardRef<HTMLCanvasElement, EdgeOverlayProps>(
  ({ width, height, className = '' }, ref) => (
    <canvas
      ref={ref}
      width={width}
      height={height}
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{ width: '100%', height: '100%' }}
    />
  ),
);

EdgeOverlay.displayName = 'EdgeOverlay';

export default EdgeOverlay;
