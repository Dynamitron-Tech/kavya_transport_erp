/**
 * ScrollFrameAnimation — Apple-style scroll-driven image-sequence canvas
 * =========================================================================
 * Replaces the Babylon.js 3D truck with 300 JPEGs mapped to scroll progress.
 *
 * Features
 * --------
 * - Fixed-position <canvas> that acts as the full-viewport background layer
 * - Frames preloaded in batches: first 12 immediately → rest in background
 * - rAF render loop: reads progressRef (0-1) → maps to frame index (0-299)
 * - Cover-fit: image always fills the viewport (like CSS object-fit:cover)
 * - HiDPI / Retina support (devicePixelRatio capped at 2)
 * - Resize-safe: recalculates canvas dimensions on every resize
 * - Fires kavya:truck-ready once the first frame is painted so App.jsx
 *   can dismiss the loading screen exactly as it did with BabylonCanvas
 * - Bidirectional: scrolling up replays earlier frames automatically
 *
 * Props
 * -----
 *  progressRef     MutableRefObject<number>  0→1 spring-damped scroll progress
 *  onReady         () => void                called once after first frame paint
 *  initialProgress number (0-1)             scroll position to start at (used
 *                                           when returning from About page so
 *                                           the last frame shows immediately)
 */

import React, { useRef, useEffect } from 'react'

// ── Config ──────────────────────────────────────────────────────────────────
const FIRST_BATCH  = 15    // frames loaded synchronously before anything else
const BATCH_SIZE   = 60    // size of each subsequent background-load batch
const MAX_DPR      = 2     // cap retina scaling to avoid memory blowout
const SPEED_SCALE  = 1.105 // 30% faster then -15% = net ~10.5% faster than original

/**
 * Flat frame manifest — concatenates p1 (12) → p2 (300) → p3 (11) = 323 frames.
 * Each entry: { part: 'p1'|'p2'|'p3', num: string (zero-padded) }
 *
 * p1: ezgif-frame-004.jpg … ezgif-frame-015.jpg  (frames 004-015, 12 total)
 * p2: ezgif-frame-001.jpg … ezgif-frame-300.jpg  (frames 001-300, 300 total)
 * p3: ezgif-frame-001.jpg … ezgif-frame-011.jpg  (frames 001-011, 11 total)
 */
const FRAMES = (() => {
  const list = []
  // p1: files 004 → 015
  for (let n = 4; n <= 15; n++)
    list.push(`/ani/p1/ezgif-frame-${String(n).padStart(3, '0')}.jpg`)
  // p2: files 001 → 300
  for (let n = 1; n <= 300; n++)
    list.push(`/ani/p2/ezgif-frame-${String(n).padStart(3, '0')}.jpg`)
  // p3: files 001 → 011
  for (let n = 1; n <= 11; n++)
    list.push(`/ani/p3/ezgif-frame-${String(n).padStart(3, '0')}.jpg`)
  return list
})()

const TOTAL_FRAMES = FRAMES.length  // 323

const frameSrc = (i) => FRAMES[i]

// ── Component ────────────────────────────────────────────────────────────────
export default function ScrollFrameAnimation({ progressRef, onReady, initialProgress = 0 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false })

    // Loaded image objects — null until the frame has downloaded
    const images = new Array(TOTAL_FRAMES).fill(null)

    // Derive the frame we should show immediately (e.g. last frame when
    // returning from the About page — initialProgress will be 0.995)
    const startP   = Math.max(0, Math.min(1, initialProgress * SPEED_SCALE))
    const startIdx = Math.round(startP * (TOTAL_FRAMES - 1))

    let currentIdx   = startIdx  // integer index of last drawn frame
    let smoothPos    = startIdx  // float frame position, lerped every rAF tick
    let rafId        = null
    let disposed     = false
    let readyFired   = false

    // ── Canvas sizing — fills viewport at device-pixel density ──────────────
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      const W   = window.innerWidth
      const H   = window.innerHeight

      // Setting width/height resets transform — always re-apply scale after
      canvas.width  = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Repaint immediately so resize doesn't flash a blank frame
      drawFrame(currentIdx)
    }

    // ── Cover-fit draw — mirrors CSS object-fit:cover ────────────────────────
    const drawFrame = (idx) => {
      const img = images[idx]
      if (!img) return

      const W  = window.innerWidth
      const H  = window.innerHeight
      const iW = img.naturalWidth
      const iH = img.naturalHeight
      if (!iW || !iH) return

      const canvasAR = W / H
      const imgAR    = iW / iH

      let dx, dy, dw, dh
      if (imgAR > canvasAR) {
        // Image wider than viewport → fit height, crop left/right
        dh = H
        dw = dh * imgAR
        dx = (W - dw) / 2
        dy = 0
      } else {
        // Image taller than viewport → fit width, crop top/bottom
        dw = W
        dh = dw / imgAR
        dx = 0
        dy = (H - dh) / 2
      }

      ctx.drawImage(img, dx, dy, dw, dh)
    }

    // ── rAF loop — smooth lerp-based frame advance ──────────────────────────
    //
    // Why lerp instead of direct mapping?
    //   progressRef is spring-damped (stiffness 8, damping 4, ratio ~0.71).
    //   An underdamped spring overshoots, making frames flicker back and forth.
    //   Adding a lerp on the canvas side absorbs that overshoot and also
    //   prevents frame dumps on fast/multi-scroll: instead of drawing every
    //   intermediate frame, smoothPos glides toward the target at a fixed rate.
    //
    // Lerp factor 0.20 at 60 fps:
    //   reaches 91 % of distance in ~10 frames (~167 ms) → feels snappy yet smooth
    const render = () => {
      if (disposed) return

      // Float target from already-smoothed progressRef
      const p      = Math.max(0, Math.min(1, progressRef.current * SPEED_SCALE))
      const target = p * (TOTAL_FRAMES - 1)

      // Lerp smoothPos → target
      smoothPos += (target - smoothPos) * 0.20

      // Snap when within 0.3 frames to kill micro-jitter
      if (Math.abs(target - smoothPos) < 0.3) smoothPos = target

      const tgt = Math.max(0, Math.min(TOTAL_FRAMES - 1, Math.round(smoothPos)))

      if (tgt !== currentIdx) {
        if (images[tgt]) {
          // Best case — target frame is already loaded
          currentIdx = tgt
          drawFrame(tgt)
        } else {
          // Search outward from target for nearest loaded frame.
          // This replaces the old "walk until gap" logic that caused
          // one-at-a-time frame stepping during background loading.
          let found = -1
          for (let r = 1; r <= 40 && found === -1; r++) {
            const lo = tgt - r
            const hi = tgt + r
            if (lo >= 0 && images[lo])             { found = lo }
            else if (hi < TOTAL_FRAMES && images[hi]) { found = hi }
          }
          if (found !== -1 && found !== currentIdx) {
            currentIdx = found
            drawFrame(found)
          }
        }
      }

      rafId = requestAnimationFrame(render)
    }

    // ── Preload helpers ──────────────────────────────────────────────────────
    // Load frames [start, end) and call onDone when all finish
    const loadBatch = (start, end, onDone) => {
      let done  = 0
      const len = end - start

      for (let i = start; i < end; i++) {
        // Skip already-loaded (e.g. re-mount after fast navigation)
        if (images[i]) { done++; if (done === len && onDone) onDone(); continue }

        const img     = new Image()
        img.decoding  = 'async'
        img.fetchpriority = i < FIRST_BATCH ? 'high' : 'low'

        img.onload = () => {
          images[i] = img
          done++

          // ── Start-frame ready → paint + signal loader ──────────────────
          // Fires as soon as the frame we actually need is available.
          // When returning from About, startIdx is the last frame (~322)
          // so we paint that immediately instead of waiting for frame 0.
          if (!readyFired && images[startIdx]) {
            readyFired = true
            currentIdx = startIdx
            resize()              // sets canvas dimensions before first draw
            drawFrame(startIdx)   // paint the correct starting frame

            // Signal App.jsx loading screen (mirrors BabylonCanvas contract)
            window.__kavyaTruckReady = true
            window.dispatchEvent(new CustomEvent('kavya:truck-ready'))
            if (onReady) onReady()

            // Start render loop now that we have at least one frame
            rafId = requestAnimationFrame(render)
          }

          if (done === len && onDone) onDone()
        }

        img.onerror = () => {
          // Leave images[i] as null — render loop will skip it gracefully
          done++
          if (done === len && onDone) onDone()
        }

        img.src = frameSrc(i)
      }
    }

    // ── Background batch loader (fills in all remaining frames) ─────────────
    const beginBackgroundLoad = () => {
      let batchStart = FIRST_BATCH
      const loadNext = () => {
        if (disposed || batchStart >= TOTAL_FRAMES) return
        const batchEnd = Math.min(batchStart + BATCH_SIZE, TOTAL_FRAMES)
        loadBatch(batchStart, batchEnd, () => {
          batchStart = batchEnd
          // Yield to main thread between batches to avoid jank
          setTimeout(loadNext, 16)
        })
      }
      loadNext()
    }

    if (startIdx > FIRST_BATCH) {
      // Returning from About page (or any mid/end start position):
      // Load a small window around the target frame first so it paints
      // instantly, THEN backfill from frame 0 for reverse-scroll support.
      const zoneStart = Math.max(0, startIdx - 2)
      const zoneEnd   = Math.min(TOTAL_FRAMES, startIdx + 3)
      loadBatch(zoneStart, zoneEnd, () => {
        // Now load the beginning (enables smooth reverse scroll)
        loadBatch(0, FIRST_BATCH, beginBackgroundLoad)
      })
    } else {
      // Normal fresh load — start from frame 0
      loadBatch(0, FIRST_BATCH, beginBackgroundLoad)
    }

    // ── Window resize ────────────────────────────────────────────────────────
    window.addEventListener('resize', resize, { passive: true })

    // ── Cleanup ──────────────────────────────────────────────────────────────
    return () => {
      disposed = true
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 1,          // same layer as .main-canvas (behind OverlayUI)
        display: 'block',
        background: '#0f172a',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    />
  )
}
