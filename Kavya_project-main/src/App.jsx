import { useRef, useState, useCallback, useEffect, useLayoutEffect, useMemo } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useLocation, useNavigate } from 'react-router-dom'
import ScrollFrameAnimation from './engine/ScrollFrameAnimation'
import OverlayUI from './OverlayUI'
import PerfHUD from './components/PerfHUD'

gsap.registerPlugin(ScrollTrigger)

/*
  ARCHITECTURE — Cinematic scroll narrative with smooth progress lerp
  ────────────────────────────────────────────────────────────────────
  1. rawProgress = scrollY / maxScroll (instant)
  2. smoothProgress lerps toward raw at 0.07 rate (exponential decay) → cinematic feel
  3. progressRef.current = smoothProgress → drives 3D + UI at 60fps
  4. GSAP ScrollTrigger → fires setSection() ONLY on boundary crossing (~10 times)
  5. CSS custom property --scroll-progress → fine-grained opacity/transforms
*/

const SCROLL_PAGES = 7

const SECTIONS = [
  { id: 0, name: 'hero',       start: 0.00, end: 0.08 },
  { id: 1, name: 'about',      start: 0.08, end: 0.18 },
  { id: 2, name: 'services',   start: 0.18, end: 0.29 },
  { id: 3, name: 'fleet',      start: 0.29, end: 0.39 },
  { id: 4, name: 'industries', start: 0.39, end: 0.48 },
  { id: 5, name: 'clients',    start: 0.48, end: 0.57 },
  { id: 6, name: 'network',    start: 0.57, end: 0.67 },
  { id: 7, name: 'why',        start: 0.67, end: 0.77 },
  { id: 8, name: 'locations',  start: 0.77, end: 0.87 },
  { id: 9, name: 'cta',        start: 0.87, end: 1.00 },
]

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const entryRouteStateRef = useRef(location.state)
  const skipLoaderFlagRef = useRef(typeof window !== 'undefined' && window.__kavyaSkipLoaderOnce === true)
  const enteredFromAboutScrollUp = entryRouteStateRef.current?.fromAboutScrollUp === true || skipLoaderFlagRef.current
  const [section, setSection] = useState(0)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(!enteredFromAboutScrollUp)
  const [introComplete, setIntroComplete] = useState(enteredFromAboutScrollUp)
  const [assetTierLabel, setAssetTierLabel] = useState('Loading Optimized Assets...')
  const [runtimeTier, setRuntimeTier] = useState(window.__kavyaDeviceTier || 'balanced')
  const [perfMetrics, setPerfMetrics] = useState(null)
  const progressRef = useRef(0)
  const rawProgressRef = useRef(0)
  const transitioningToAboutRef = useRef(false)
  const [exitingToPages, setExitingToPages] = useState(false)

  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false
    return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || window.innerWidth < 768
  }, [])

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  // ── Before first paint: jump scroll to end when entering from About page ──
  // useLayoutEffect runs synchronously after DOM commit but BEFORE the browser
  // paints, so the user never sees the page at scrollY=0 or progress=0.
  // IMPORTANT: pages.css sets `html { scroll-behavior: smooth }` globally, so
  // we must override it to 'auto' before calling scrollTo, otherwise the browser
  // smoothly animates from 0 → end and the user sees the whole sequence replay.
  useLayoutEffect(() => {
    if (!enteredFromAboutScrollUp) return
    // Prevent browser scroll-restoration from firing with the wrong position
    window.history.scrollRestoration = 'manual'
    rawProgressRef.current = 0.995
    progressRef.current = 0.995
    document.documentElement.style.setProperty('--scroll-progress', '0.9950')
    document.documentElement.style.setProperty('--progress', '0.9950')
    // Force instant scroll — override smooth-scroll CSS for this one call
    document.documentElement.style.scrollBehavior = 'auto'
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight
    if (maxScroll > 0) window.scrollTo(0, maxScroll * 0.995)
    // Restore CSS smooth-scroll after two frames (enough for scrollTo to settle)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.documentElement.style.scrollBehavior = ''
    }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Ensure every hard refresh starts from the beginning of the cinematic timeline.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const fromAboutScrollUp = entryRouteStateRef.current?.fromAboutScrollUp === true

    if (skipLoaderFlagRef.current) {
      window.__kavyaSkipLoaderOnce = false
    }

    const prevScrollRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'

    if (fromAboutScrollUp) {
      // Refs and scroll position were already set in useLayoutEffect above.
      // Just update section state and clear the one-time route state.
      rawProgressRef.current = 0.995
      progressRef.current = 0.995
      setSection(SECTIONS[SECTIONS.length - 1].id)
      navigate('/', { replace: true, state: null })
    } else {
      window.scrollTo(0, 0)

      rawProgressRef.current = 0
      progressRef.current = 0
      document.documentElement.style.setProperty('--scroll-progress', '0.0000')
      document.documentElement.style.setProperty('--progress', '0.0000')

      setSection(0)
    }

    return () => {
      window.history.scrollRestoration = prevScrollRestoration
    }
  }, [navigate])

  // ── Spring-damped progress interpolation (cinematic momentum) ──
  useEffect(() => {
    if (prefersReducedMotion) return
    let running = true
    let prevTime = performance.now()
    const velocityRef    = { current: 0 }
    const prevRawRef     = { current: rawProgressRef.current }
    const scrollVelRef   = { current: 0 }   // smoothed scroll velocity
    const bunchFiredRef  = { current: false }
    const stiffness = isMobile ? 12 : 8
    const damping   = isMobile ? 5  : 4

    const tick = (now) => {
      if (!running) return
      const dt = Math.min((now - prevTime) / 1000, 0.05) // cap at 50ms
      prevTime = now

      const raw  = rawProgressRef.current
      const prev = progressRef.current

      // ── Track raw scroll velocity (exponential smoothing) ──
      const rawDelta    = raw - prevRawRef.current
      const instantVel  = rawDelta / dt
      prevRawRef.current = raw
      // Smooth velocity to reduce noise
      scrollVelRef.current = scrollVelRef.current * 0.7 + instantVel * 0.3

      const isScrolling = Math.abs(instantVel) > 0.0002

      // ── Bunching effect: inject momentum when the user stops scrolling ──
      // This causes the animation to overshoot slightly then spring back.
      if (!isScrolling && !bunchFiredRef.current && Math.abs(scrollVelRef.current) > 0.004) {
        velocityRef.current += scrollVelRef.current * 0.45
        scrollVelRef.current = 0
        bunchFiredRef.current = true
      }
      if (isScrolling) {
        bunchFiredRef.current = false
      }

      const displacement  = raw - prev
      // Spring force + damping force
      const springForce   = displacement * stiffness
      const dampForce     = -velocityRef.current * damping
      velocityRef.current += (springForce + dampForce) * dt
      progressRef.current  = Math.max(0, Math.min(1, prev + velocityRef.current * dt))

      // Snap when settled
      if (Math.abs(displacement) < 0.0001 && Math.abs(velocityRef.current) < 0.0001) {
        progressRef.current  = raw
        velocityRef.current  = 0
        scrollVelRef.current = 0
      }

      document.documentElement.style.setProperty('--scroll-progress', progressRef.current.toFixed(4))
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    return () => { running = false }
  }, [prefersReducedMotion, isMobile])

  // ── Scroll → rawProgressRef (every scroll event, no React state) ──
  // ── ScrollTrigger → setSection (only on section boundary crossings) ──
  useEffect(() => {
    if (prefersReducedMotion) {
      progressRef.current = 0
      setSection(0)
      return
    }

    // When returning from the About page, lock out scroll events for 800ms.
    // This prevents browser scroll-restoration events, smooth-scroll animation
    // callbacks, or any residual inertia from corrupting rawProgressRef and
    // causing the frame sequence to replay from the beginning.
    const scrollLockUntil = enteredFromAboutScrollUp ? performance.now() + 800 : 0

    const onScroll = () => {
      if (performance.now() < scrollLockUntil) return
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      rawProgressRef.current = maxScroll > 0 ? window.scrollY / maxScroll : 0
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    // Skip the initial sync when entering from About — scrollTo hasn't fired
    // yet, so window.scrollY is 0 and would clobber the 0.995 we just set.
    if (!enteredFromAboutScrollUp) {
      onScroll()
    }

    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight

    const triggers = SECTIONS.map((sec) => {
      const startPx = sec.start * scrollHeight
      const endPx = sec.end * scrollHeight

      return ScrollTrigger.create({
        start: startPx,
        end: endPx,
        onEnter: () => setSection(sec.id),
        onEnterBack: () => setSection(sec.id),
      })
    })

    return () => {
      window.removeEventListener('scroll', onScroll)
      triggers.forEach(t => t.kill())
    }
  }, [prefersReducedMotion])

  // ── Route handoff: when user scrolls past the cinematic end, enter pages ──
  useEffect(() => {
    if (prefersReducedMotion) return

    const END_THRESHOLD = 0.995

    const navigateToPages = () => {
      if (transitioningToAboutRef.current || loading || !introComplete) return
      transitioningToAboutRef.current = true

      // 1. Immediately freeze scroll position so the page doesn't visually jump
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${window.scrollY}px`
      document.body.style.left = '0'
      document.body.style.right = '0'

      // 2. Trigger fade-out overlay
      setExitingToPages(true)

      // 3. After fade-out animation completes, navigate
      setTimeout(() => {
        const scrollY = document.body.style.top
        document.body.style.overflow = ''
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.left = ''
        document.body.style.right = ''
        window.scrollTo(0, parseInt(scrollY || '0', 10) * -1)
        navigate('/pages', { state: { fromHomeScroll: true } })
      }, 500)
    }

    const hasReachedEnd = () => rawProgressRef.current >= END_THRESHOLD

    const onWheel = (e) => {
      if (e.deltaY > 8 && hasReachedEnd()) {
        navigateToPages()
      }
    }

    const onKeyDown = (e) => {
      const forwardKeys = ['ArrowDown', 'PageDown', ' ', 'End']
      if (forwardKeys.includes(e.key) && hasReachedEnd()) {
        navigateToPages()
      }
    }

    let touchStartY = null
    const onTouchStart = (e) => {
      touchStartY = e.touches?.[0]?.clientY ?? null
    }
    const onTouchEnd = (e) => {
      if (touchStartY === null) return
      const endY = e.changedTouches?.[0]?.clientY ?? touchStartY
      const deltaY = touchStartY - endY
      touchStartY = null
      if (deltaY > 20 && hasReachedEnd()) {
        navigateToPages()
      }
    }

    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [introComplete, loading, navigate, prefersReducedMotion])

  // ── Keyboard navigation (ArrowDown/Up, PageDown/Up) ──
  useEffect(() => {
    const SECTION_POSITIONS = [
      0.00, 0.10, 0.20, 0.30, 0.40,
      0.50, 0.60, 0.70, 0.80, 0.90
    ]

    const handleKeyDown = (e) => {
      // Don't intercept if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      const current = progressRef.current

      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault()
        const next = SECTION_POSITIONS.find(s => s > current + 0.03)
        if (next !== undefined) {
          window.scrollTo({ top: next * maxScroll, behavior: 'smooth' })
        }
      }
      if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault()
        const prev = [...SECTION_POSITIONS].reverse().find(s => s < current - 0.03)
        if (prev !== undefined) {
          window.scrollTo({ top: prev * maxScroll, behavior: 'smooth' })
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const [loaderPhase, setLoaderPhase] = useState(enteredFromAboutScrollUp ? 'gone' : 'loading') // loading → brand → fadeout → gone

  useEffect(() => {
    const updateTierLabel = (tier) => {
      if (tier === 'high') setAssetTierLabel('Loading High Quality Assets...')
      else if (tier === 'low') setAssetTierLabel('Loading Optimized Assets...')
      else setAssetTierLabel('Loading Balanced Assets...')
    }

    const onTier = (e) => {
      const tier = e?.detail?.tier
      updateTierLabel(tier)
      if (tier) setRuntimeTier(tier)
    }
    const onTierChanged = (e) => {
      const tier = e?.detail?.to
      updateTierLabel(tier)
      if (tier) setRuntimeTier(tier)
    }
    const onPerfMetrics = (e) => {
      if (e?.detail) setPerfMetrics(e.detail)
    }
    window.addEventListener('kavya:tier-detected', onTier)
    window.addEventListener('kavya:tier-changed', onTierChanged)
    window.addEventListener('kavya:perf-metrics', onPerfMetrics)
    if (window.__kavyaDeviceTier) updateTierLabel(window.__kavyaDeviceTier)

    return () => {
      window.removeEventListener('kavya:tier-detected', onTier)
      window.removeEventListener('kavya:tier-changed', onTierChanged)
      window.removeEventListener('kavya:perf-metrics', onPerfMetrics)
    }
  }, [])

  const showPerfHUD = useMemo(() => {
    if (typeof window === 'undefined') return false
    const queryEnabled = new URLSearchParams(window.location.search).get('perf') === '1'
    const localEnabled = window.localStorage.getItem('kavya_perf') === 'true'
    return queryEnabled || localEnabled
  }, [])

  useEffect(() => {
    if (enteredFromAboutScrollUp) {
      setLoading(false)
      return
    }

    // Truck may have already loaded before this effect runs (fast cache)
    if (window.__kavyaTruckReady) {
      const existingCanvas = document.querySelector('canvas')
      if (existingCanvas && existingCanvas.clientWidth > 0 && existingCanvas.clientHeight > 0) {
        setTimeout(() => setLoading(false), 300)
      }
      return
    }

    const handler = () => {
      const canvas = document.querySelector('canvas')
      if (canvas && canvas.clientWidth > 0 && canvas.clientHeight > 0) {
        // Small delay to let first frame render
        setTimeout(() => setLoading(false), 300)
        return
      }

      // Wait briefly for first paint if canvas is not ready yet
      requestAnimationFrame(() => {
        const retryCanvas = document.querySelector('canvas')
        if (retryCanvas && retryCanvas.clientWidth > 0 && retryCanvas.clientHeight > 0) {
          setTimeout(() => setLoading(false), 300)
        }
      })
    }
    window.addEventListener('kavya:truck-ready', handler, { once: true })

    // Hard fallback: never hang longer than 15 seconds
    const fallback = setTimeout(() => setLoading(false), 15000)

    return () => {
      window.removeEventListener('kavya:truck-ready', handler)
      clearTimeout(fallback)
    }
  }, [enteredFromAboutScrollUp])

  // ── Cinematic intro sequence ──
  const handleReady = useCallback(() => {
    setReady(true)
  }, [])

  useEffect(() => {
    if (enteredFromAboutScrollUp) {
      setLoaderPhase('gone')
      setIntroComplete(true)
      document.body.style.overflow = ''
      return
    }

    if (loading) return
    document.body.style.overflow = 'hidden'
    setLoaderPhase('brand')
    let t2 = null

    const t1 = setTimeout(() => {
      setLoaderPhase('fadeout')
      t2 = setTimeout(() => {
        setLoaderPhase('gone')
        setIntroComplete(true)
        document.body.style.overflow = ''
      }, 600)
    }, 800)

    return () => {
      clearTimeout(t1)
      if (t2) {
        clearTimeout(t2)
      }
      document.body.style.overflow = ''
    }
  }, [enteredFromAboutScrollUp, loading])

  return (
    <>
      {/* ── Loading screen with cinematic brand reveal ── */}
      <div className={`loader ${loaderPhase === 'brand' ? 'loader--brand' : ''} ${loaderPhase === 'fadeout' ? 'loader--fadeout' : ''} ${loaderPhase === 'gone' ? 'loader--gone' : ''}`}>
        <div className="loader-inner">
          <span className="loader-text">KAVYA</span>
          <span className="loader-sub">TRANSPORTS</span>
          <div className="loader-bar"><div className="loader-bar-fill" /></div>
        </div>
        <div className="loader-brand">
          <h1>KAVYA TRANSPORTS</h1>
          <p>LIFE ON WHEELS</p>
          <p>{assetTierLabel}</p>
        </div>
      </div>

      {/* ── Scroll spacer ── */}
      <div className="scroll-spacer" style={{ height: `${SCROLL_PAGES * 100}vh` }} />

      {/* ── Scroll frame animation — 300-frame image sequence ── */}
      <ScrollFrameAnimation progressRef={progressRef} onReady={handleReady} initialProgress={enteredFromAboutScrollUp ? 0.995 : 0} />

      {/* ── Fixed overlay — section-driven, minimal re-renders ── */}
      <OverlayUI section={section} progressRef={progressRef} introComplete={introComplete} />

      {/* ── Custom cursor (desktop only) ── */}
      {!isMobile && <div className="kavya-cursor" />}

      {/* ── Film grain overlay ── */}
      <div className="film-grain-overlay" />

      {/* ── Page exit fade overlay ── */}
      <div className={`home-exit-fade ${exitingToPages ? 'home-exit-fade--active' : ''}`} />

      {showPerfHUD && <PerfHUD metrics={perfMetrics} tier={runtimeTier} />}
    </>
  )
}
