/**
 * CameraRig — Compatibility Shim
 * ─────────────────────────────────
 * Re-exports getCameraPaused from the Babylon engine config.
 * OverlayUI imports { getCameraPaused } from './CameraRig'.
 * The old R3F-based camera component is no longer needed —
 * camera is now driven by the Babylon scrollCamera module.
 */
import { isInPauseRange } from './engine/config'

// Export pause detection for OverlayUI (same signature as before)
export function getCameraPaused(t) {
  return isInPauseRange(t)
}

// No default export needed — was an R3F component, now obsolete.
// Kept only for the named getCameraPaused export.
