/**
 * KAVYA TRANSPORTS — Premium Animation Hooks
 * Innovative effects for maximum visual impact
 */

import { useEffect, useRef, useCallback, useState } from 'react'

// ═══════════════════════════════════════════════════════════════
// MAGNETIC BUTTON EFFECT
// Buttons subtly follow cursor when hovering
// ═══════════════════════════════════════════════════════════════
export function useMagneticEffect(strength = 0.3) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const handleMove = (e) => {
      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left - rect.width / 2
      const y = e.clientY - rect.top - rect.height / 2
      el.style.transform = `translate(${x * strength}px, ${y * strength}px)`
    }

    const handleLeave = () => {
      el.style.transform = 'translate(0, 0)'
      el.style.transition = 'transform 0.4s cubic-bezier(0.23, 1, 0.32, 1)'
    }

    const handleEnter = () => {
      el.style.transition = 'none'
    }

    el.addEventListener('mousemove', handleMove)
    el.addEventListener('mouseleave', handleLeave)
    el.addEventListener('mouseenter', handleEnter)

    return () => {
      el.removeEventListener('mousemove', handleMove)
      el.removeEventListener('mouseleave', handleLeave)
      el.removeEventListener('mouseenter', handleEnter)
    }
  }, [strength])

  return ref
}

// ═══════════════════════════════════════════════════════════════
// 3D TILT CARD EFFECT
// Cards tilt based on mouse position with perspective
// ═══════════════════════════════════════════════════════════════
export function useTiltEffect(maxTilt = 8, scale = 1.02) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const handleMove = (e) => {
      const rect = el.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const rotateX = ((e.clientY - centerY) / (rect.height / 2)) * -maxTilt
      const rotateY = ((e.clientX - centerX) / (rect.width / 2)) * maxTilt

      el.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`
    }

    const handleLeave = () => {
      el.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale(1)'
    }

    el.addEventListener('mousemove', handleMove)
    el.addEventListener('mouseleave', handleLeave)

    return () => {
      el.removeEventListener('mousemove', handleMove)
      el.removeEventListener('mouseleave', handleLeave)
    }
  }, [maxTilt, scale])

  return ref
}

// ═══════════════════════════════════════════════════════════════
// ANIMATED COUNTER
// Numbers count up when element becomes visible
// ═══════════════════════════════════════════════════════════════
export function useCountUp(end, duration = 2000, startOnView = true) {
  const [count, setCount] = useState(0)
  const [hasStarted, setHasStarted] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!startOnView) {
      animateCount()
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setHasStarted(true)
          animateCount()
        }
      },
      { threshold: 0.3 }
    )

    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [end, duration, hasStarted, startOnView])

  const animateCount = () => {
    const startTime = performance.now()
    const numericEnd = parseFloat(String(end).replace(/[^0-9.]/g, ''))

    const tick = (now) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(numericEnd * eased))
      if (progress < 1) requestAnimationFrame(tick)
      else setCount(numericEnd)
    }

    requestAnimationFrame(tick)
  }

  return { count, ref }
}

// ═══════════════════════════════════════════════════════════════
// PARALLAX SCROLL EFFECT
// Elements move at different speeds based on scroll
// ═══════════════════════════════════════════════════════════════
export function useParallax(speed = 0.2) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const handleScroll = () => {
      const rect = el.getBoundingClientRect()
      const scrolled = window.scrollY
      const offset = (rect.top + scrolled) * speed
      el.style.transform = `translateY(${scrolled * speed - offset}px)`
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => window.removeEventListener('scroll', handleScroll)
  }, [speed])

  return ref
}

// ═══════════════════════════════════════════════════════════════
// TEXT CHARACTER REVEAL
// Animate text character by character
// ═══════════════════════════════════════════════════════════════
export function useTextReveal(text, delay = 30) {
  const [revealed, setRevealed] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const ref = useRef(null)
  const hasTriggered = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTriggered.current) {
          hasTriggered.current = true
          let i = 0
          const interval = setInterval(() => {
            if (i <= text.length) {
              setRevealed(text.slice(0, i))
              i++
            } else {
              clearInterval(interval)
              setIsComplete(true)
            }
          }, delay)
        }
      },
      { threshold: 0.5 }
    )

    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [text, delay])

  return { revealed, isComplete, ref }
}

// ═══════════════════════════════════════════════════════════════
// RIPPLE CLICK EFFECT
// Create ripple animation on click
// ═══════════════════════════════════════════════════════════════
export function useRipple() {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const handleClick = (e) => {
      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const size = Math.max(rect.width, rect.height) * 2

      const ripple = document.createElement('span')
      ripple.className = 'ripple-effect'
      ripple.style.cssText = `
        position: absolute;
        left: ${x}px;
        top: ${y}px;
        width: ${size}px;
        height: ${size}px;
        transform: translate(-50%, -50%) scale(0);
        background: rgba(245, 166, 35, 0.3);
        border-radius: 50%;
        pointer-events: none;
        animation: rippleExpand 0.6s ease-out forwards;
      `

      el.style.position = 'relative'
      el.style.overflow = 'hidden'
      el.appendChild(ripple)

      setTimeout(() => ripple.remove(), 600)
    }

    el.addEventListener('click', handleClick)
    return () => el.removeEventListener('click', handleClick)
  }, [])

  return ref
}

// ═══════════════════════════════════════════════════════════════
// SMOOTH SCROLL PROGRESS
// Track scroll progress for the page
// ═══════════════════════════════════════════════════════════════
export function useScrollProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      const scrolled = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0
      setProgress(scrolled)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return progress
}

// ═══════════════════════════════════════════════════════════════
// HOVER GLOW EFFECT
// Element glows on hover following mouse
// ═══════════════════════════════════════════════════════════════
export function useHoverGlow() {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const handleMove = (e) => {
      const rect = el.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      el.style.setProperty('--glow-x', `${x}%`)
      el.style.setProperty('--glow-y', `${y}%`)
    }

    el.addEventListener('mousemove', handleMove)
    return () => el.removeEventListener('mousemove', handleMove)
  }, [])

  return ref
}

// ═══════════════════════════════════════════════════════════════
// INTERSECTION OBSERVER HOOK (Enhanced)
// Trigger animations when elements enter viewport
// ═══════════════════════════════════════════════════════════════
export function useInView(options = {}) {
  const [isInView, setIsInView] = useState(false)
  const [hasAnimated, setHasAnimated] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          if (!options.repeat) setHasAnimated(true)
        } else if (options.repeat) {
          setIsInView(false)
        }
      },
      { threshold: options.threshold || 0.1, ...options }
    )

    if (ref.current && !hasAnimated) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [options, hasAnimated])

  return { ref, isInView }
}

// ═══════════════════════════════════════════════════════════════
// MOUSE POSITION TRACKING
// Track mouse position relative to element or viewport
// ═══════════════════════════════════════════════════════════════
export function useMousePosition(relative = false) {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const ref = useRef(null)

  useEffect(() => {
    const handleMove = (e) => {
      if (relative && ref.current) {
        const rect = ref.current.getBoundingClientRect()
        setPosition({
          x: (e.clientX - rect.left) / rect.width,
          y: (e.clientY - rect.top) / rect.height
        })
      } else {
        setPosition({ x: e.clientX, y: e.clientY })
      }
    }

    window.addEventListener('mousemove', handleMove, { passive: true })
    return () => window.removeEventListener('mousemove', handleMove)
  }, [relative])

  return { position, ref }
}

export default {
  useMagneticEffect,
  useTiltEffect,
  useCountUp,
  useParallax,
  useTextReveal,
  useRipple,
  useScrollProgress,
  useHoverGlow,
  useInView,
  useMousePosition
}
