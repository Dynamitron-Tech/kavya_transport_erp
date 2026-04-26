import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import { ScrollProgress, CursorGlowTrail } from './AnimatedComponents'

const SCROLL_CHAIN = []

export default function PageLayout({ children, mainClassName = '' }) {
  const location = useLocation()
  const { pathname } = location
  const navigate = useNavigate()
  const entryStateRef = useRef(location.state)
  const [mounted, setMounted] = useState(false)

  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false
    return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || window.innerWidth < 768
  }, [])

  useEffect(() => {
    setMounted(true)
    const entryState = entryStateRef.current
    const direction = entryState?.fromHomeScroll ? 'down' : entryState?.scrollDirection

    if (direction === 'up') {
      requestAnimationFrame(() => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight
        const target = maxScroll > 0 ? maxScroll * 0.995 : 0
        window.scrollTo(0, target)
      })
    } else {
      window.scrollTo(0, 0)
    }

    if (entryState) {
      navigate(pathname, { replace: true, state: null })
    }
  }, [pathname])

  // Scroll continuity across pages: open next page at bottom edge and previous page at top edge.
  useEffect(() => {
    const index = SCROLL_CHAIN.indexOf(pathname)
    if (index === -1) return

    const prevPath = index === 0 ? '/' : SCROLL_CHAIN[index - 1]
    const nextPath = SCROLL_CHAIN[index + 1] || null
    const mountedAt = performance.now()
    const EDGE_TRANSITION_LOCK_MS = 700
    const WHEEL_INTENT_WINDOW_MS = 420

    let transitioning = false
    let wheelIntent = { dir: null, count: 0, time: 0 }
    const atTop = () => window.scrollY <= 2
    const atBottom = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      return maxScroll > 0 && window.scrollY >= maxScroll - 2
    }

    const transitionUnlocked = () => performance.now() - mountedAt >= EDGE_TRANSITION_LOCK_MS

    const registerWheelIntent = (dir) => {
      const now = performance.now()
      if (wheelIntent.dir === dir && now - wheelIntent.time <= WHEEL_INTENT_WINDOW_MS) {
        wheelIntent = { dir, count: wheelIntent.count + 1, time: now }
      } else {
        wheelIntent = { dir, count: 1, time: now }
      }
      return wheelIntent.count >= 2
    }

    const goToPrev = () => {
      if (transitioning) return
      transitioning = true
      if (prevPath === '/') {
        window.__kavyaSkipLoaderOnce = true
        navigate('/', { state: { fromAboutScrollUp: true } })
      } else {
        navigate(prevPath, { state: { fromScrollChain: true, scrollDirection: 'up' } })
      }
    }

    const goToNext = () => {
      if (!nextPath || transitioning) return
      transitioning = true
      navigate(nextPath, { state: { fromScrollChain: true, scrollDirection: 'down' } })
    }

    const onWheel = (e) => {
      if (!transitionUnlocked()) return

      if (e.deltaY < -12 && atTop() && registerWheelIntent('prev')) {
        goToPrev()
      } else if (e.deltaY > 12 && atBottom() && registerWheelIntent('next')) {
        goToNext()
      }
    }

    const onKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (!transitionUnlocked()) return

      const upKeys = ['ArrowUp', 'PageUp', 'Home']
      const downKeys = ['ArrowDown', 'PageDown', ' ', 'End']
      if (upKeys.includes(e.key) && atTop()) {
        goToPrev()
      } else if (downKeys.includes(e.key) && atBottom()) {
        goToNext()
      }
    }

    let touchStartY = null
    const onTouchStart = (e) => {
      touchStartY = e.touches?.[0]?.clientY ?? null
    }
    const onTouchEnd = (e) => {
      if (touchStartY === null) return
      if (!transitionUnlocked()) return

      const endY = e.changedTouches?.[0]?.clientY ?? touchStartY
      const deltaY = touchStartY - endY
      touchStartY = null
      if (deltaY > 20 && atBottom()) {
        goToNext()
      } else if (deltaY < -20 && atTop()) {
        goToPrev()
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
  }, [navigate, pathname])

  const entryDirection = entryStateRef.current?.fromHomeScroll
    ? 'down'
    : entryStateRef.current?.scrollDirection

  const transitionClass = entryDirection === 'down'
    ? 'page-enter-from-bottom'
    : entryDirection === 'up'
      ? 'page-enter-from-top'
      : ''

  const composedMainClass = `${mainClassName} ${transitionClass}`.trim()

  // Custom cursor follower for inner pages
  useEffect(() => {
    if (isMobile || !window.matchMedia('(hover: hover)').matches) return

    let cx = -100, cy = -100
    let tx = -100, ty = -100
    let running = true
    let cursorShown = false

    const cursor = document.querySelector('.page-cursor')
    if (!cursor) return

    const onMouseMove = (e) => {
      tx = e.clientX
      ty = e.clientY
      if (!cursorShown) {
        cursorShown = true
        cursor.classList.add('cursor-visible')
      }
      const target = e.target
      const isInteractive = target.closest('a, button, input, textarea, select, .btn, [role="button"]')
      if (isInteractive) {
        cursor.classList.add('cursor-expand')
      } else {
        cursor.classList.remove('cursor-expand')
      }
    }

    const followLoop = () => {
      if (!running) return
      cx += (tx - cx) * 0.15
      cy += (ty - cy) * 0.15
      cursor.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`
      requestAnimationFrame(followLoop)
    }

    window.addEventListener('mousemove', onMouseMove, { passive: true })
    requestAnimationFrame(followLoop)
    return () => { running = false; window.removeEventListener('mousemove', onMouseMove) }
  }, [isMobile])

  return (
    <div className="page-wrapper">
      {mounted && <ScrollProgress />}
      <Header />
    <main className={`page-main ${composedMainClass}`.trim()}>{children}</main>
      <Footer />
      {!isMobile && <div className="page-cursor" />}
      {!isMobile && mounted && <CursorGlowTrail />}
      <div className="noise-overlay" aria-hidden="true" />
    </div>
  )
}
