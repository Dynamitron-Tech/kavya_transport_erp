/**
 * KAVYA TRANSPORTS — Premium Animated Components
 * Reusable components with built-in animations
 */

import React, { useEffect, useRef, useState, useMemo } from 'react'
import { useMagneticEffect, useTiltEffect, useCountUp, useScrollProgress, useRipple, useHoverGlow } from '../hooks/useAnimations'

// ═══════════════════════════════════════════════════════════════
// SCROLL PROGRESS BAR
// Shows reading progress at top of page
// ═══════════════════════════════════════════════════════════════
export function ScrollProgress() {
  const progress = useScrollProgress()

  return (
    <div className="scroll-progress-container">
      <div
        className="scroll-progress-bar"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAGNETIC BUTTON
// Button that attracts to cursor
// ═══════════════════════════════════════════════════════════════
export function MagneticButton({ children, className = '', onClick, ...props }) {
  const magnetRef = useMagneticEffect(0.25)
  const rippleRef = useRipple()

  return (
    <button
      ref={(el) => {
        magnetRef.current = el
        rippleRef.current = el
      }}
      className={`magnetic-btn ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════
// TILT CARD
// 3D perspective tilt on hover
// ═══════════════════════════════════════════════════════════════
export function TiltCard({ children, className = '', maxTilt = 6, ...props }) {
  const tiltRef = useTiltEffect(maxTilt)
  const glowRef = useHoverGlow()

  return (
    <div
      ref={(el) => {
        tiltRef.current = el
        glowRef.current = el
      }}
      className={`tilt-card ${className}`}
      {...props}
    >
      <div className="tilt-card-glow" />
      {children}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// ANIMATED COUNTER
// Numbers that count up when visible
// ═══════════════════════════════════════════════════════════════
export function AnimatedCounter({ value, suffix = '', prefix = '', duration = 2000 }) {
  const { count, ref } = useCountUp(value, duration)
  const displayValue = String(value).includes('+') ? `${count}+` : count

  return (
    <span ref={ref} className="animated-counter">
      {prefix}{displayValue}{suffix}
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════
// TEXT REVEAL
// Character by character text animation
// ═══════════════════════════════════════════════════════════════
export function TextReveal({ text, className = '', tag: Tag = 'span', delay = 25 }) {
  const [revealed, setRevealed] = useState('')
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
            }
          }, delay)
        }
      },
      { threshold: 0.3 }
    )

    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [text, delay])

  return (
    <Tag ref={ref} className={`text-reveal ${className}`}>
      {revealed}
      <span className="text-reveal-cursor">|</span>
    </Tag>
  )
}

// ═══════════════════════════════════════════════════════════════
// SPLIT TEXT (Word by word animation)
// Words animate in sequentially
// ═══════════════════════════════════════════════════════════════
export function SplitText({ text, className = '', tag: Tag = 'p' }) {
  const words = text.split(' ')
  const ref = useRef(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true)
      },
      { threshold: 0.2 }
    )

    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag ref={ref} className={`split-text ${className} ${isVisible ? 'animate' : ''}`}>
      {words.map((word, i) => (
        <span
          key={i}
          className="split-word"
          style={{ transitionDelay: `${i * 0.05}s` }}
        >
          {word}&nbsp;
        </span>
      ))}
    </Tag>
  )
}

// ═══════════════════════════════════════════════════════════════
// MARQUEE
// Infinite horizontal scrolling text
// ═══════════════════════════════════════════════════════════════
export function Marquee({ children, speed = 30, direction = 'left', pauseOnHover = true }) {
  const contentRef = useRef(null)
  const [contentWidth, setContentWidth] = useState(0)

  useEffect(() => {
    if (contentRef.current) {
      setContentWidth(contentRef.current.scrollWidth / 2)
    }
  }, [children])

  return (
    <div className={`marquee ${pauseOnHover ? 'marquee-pausable' : ''}`}>
      <div
        className="marquee-track"
        style={{
          animationDuration: `${contentWidth / speed}s`,
          animationDirection: direction === 'right' ? 'reverse' : 'normal'
        }}
        ref={contentRef}
      >
        <div className="marquee-content">{children}</div>
        <div className="marquee-content" aria-hidden="true">{children}</div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// FLOATING ELEMENT
// Element that floats up and down
// ═══════════════════════════════════════════════════════════════
export function FloatingElement({ children, className = '', amplitude = 10, duration = 3 }) {
  return (
    <div
      className={`floating-element ${className}`}
      style={{
        '--float-amplitude': `${amplitude}px`,
        '--float-duration': `${duration}s`
      }}
    >
      {children}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// GLOW CARD
// Card with cursor-following glow effect
// ═══════════════════════════════════════════════════════════════
export function GlowCard({ children, className = '', ...props }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const handleMove = (e) => {
      const rect = el.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      el.style.setProperty('--mouse-x', `${x}%`)
      el.style.setProperty('--mouse-y', `${y}%`)
    }

    el.addEventListener('mousemove', handleMove)
    return () => el.removeEventListener('mousemove', handleMove)
  }, [])

  return (
    <div ref={ref} className={`glow-card ${className}`} {...props}>
      <div className="glow-card-gradient" />
      <div className="glow-card-content">{children}</div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// REVEAL MASK
// Content revealed through animated mask
// ═══════════════════════════════════════════════════════════════
export function RevealMask({ children, className = '', direction = 'up' }) {
  const ref = useRef(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true)
      },
      { threshold: 0.1 }
    )

    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`reveal-mask reveal-mask--${direction} ${isVisible ? 'revealed' : ''} ${className}`}
    >
      <div className="reveal-mask-content">{children}</div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MORPHING BLOB
// Animated blob shape that morphs
// ═══════════════════════════════════════════════════════════════
export function MorphingBlob({ className = '', color = 'rgba(245, 166, 35, 0.15)' }) {
  return (
    <div className={`morphing-blob ${className}`} style={{ background: color }} />
  )
}

// ═══════════════════════════════════════════════════════════════
// PARALLAX SECTION
// Section with parallax background
// ═══════════════════════════════════════════════════════════════
export function ParallaxSection({ children, className = '', speed = 0.3 }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const handleScroll = () => {
      const rect = el.getBoundingClientRect()
      const scrolled = window.scrollY
      const start = rect.top + scrolled - window.innerHeight
      const offset = (scrolled - start) * speed
      el.style.setProperty('--parallax-offset', `${offset}px`)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => window.removeEventListener('scroll', handleScroll)
  }, [speed])

  return (
    <section ref={ref} className={`parallax-section ${className}`}>
      {children}
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════
// CURSOR GLOW TRAIL
// Glowing particles that follow cursor
// ═══════════════════════════════════════════════════════════════
export function CursorGlowTrail() {
  const trailRef = useRef([])
  const [particles, setParticles] = useState([])

  useEffect(() => {
    let frame
    const positions = []
    const numParticles = 8

    const handleMove = (e) => {
      positions.unshift({ x: e.clientX, y: e.clientY, id: Date.now() })
      if (positions.length > numParticles) positions.pop()
      setParticles([...positions])
    }

    window.addEventListener('mousemove', handleMove, { passive: true })
    return () => window.removeEventListener('mousemove', handleMove)
  }, [])

  return (
    <div className="cursor-glow-trail" aria-hidden="true">
      {particles.map((p, i) => (
        <div
          key={p.id}
          className="cursor-trail-particle"
          style={{
            left: p.x,
            top: p.y,
            opacity: 1 - (i * 0.12),
            transform: `translate(-50%, -50%) scale(${1 - i * 0.1})`
          }}
        />
      ))}
    </div>
  )
}

export default {
  ScrollProgress,
  MagneticButton,
  TiltCard,
  AnimatedCounter,
  TextReveal,
  SplitText,
  Marquee,
  FloatingElement,
  GlowCard,
  RevealMask,
  MorphingBlob,
  ParallaxSection,
  CursorGlowTrail
}
