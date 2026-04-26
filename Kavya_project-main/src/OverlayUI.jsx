import { useMemo, useRef, useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getCameraPaused } from './CameraRig'

/*
  OverlayUI — AAA CINEMATIC SCROLL NARRATIVE + UI MOTION SYSTEM
  ──────────────────────────────────────────────────────────────
  React re-renders ONLY when section changes (~10 times total).
  Fine-grained animations run via rAF + DOM mutations at 60fps.
  
  Features:
  - Smooth progress lerp driven from App.jsx
  - Wider fade windows (+0.03 each side) for readable transitions
  - translateY(-20→0) section entry animation
  - Speed-reactive typography (letter-spacing, drift, opacity boost)
  - Magnetic cursor buttons (attraction effect)
  - Custom amber cursor follower
  - Number counter animations
  - Cinematic ending with logo reveal
  - Mobile sticky CTA bar
*/

const ENDING_START = 0.92

// Non-overlapping opacity ranges — each section fully fades before next begins
const SECTION_RANGES = {
  hero:       [-0.06, 0.005, 0.075, 0.095],
  about:      [ 0.10, 0.13, 0.19, 0.22],
  services:   [ 0.22, 0.25, 0.31, 0.34],
  fleet:      [ 0.34, 0.37, 0.43, 0.46],
  industries: [ 0.46, 0.49, 0.55, 0.58],
  clients:    [ 0.58, 0.61, 0.67, 0.70],
  network:    [ 0.70, 0.73, 0.79, 0.82],
  why:        [ 0.82, 0.85, 0.88, 0.91],
  locations:  [ 0.91, 0.93, 0.95, 0.97],
  cta:        [ 0.97, 0.98, 0.99, 1.01],
}

const SECTION_NAMES = ['hero', 'about', 'services', 'fleet', 'industries', 'clients', 'network', 'why', 'locations', 'cta']

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function fade(t, a, b, c, d) {
  if (t < a) return 0
  if (t < b) return smoothstep(a, b, t)
  if (t < c) return 1
  if (t < d) return 1 - smoothstep(c, d, t)
  return 0
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

/* ── Number Counter — animates 0→target when section becomes visible ── */
function useCountUp(target, isVisible, duration = 1200) {
  const [value, setValue] = useState(0)
  const rafRef = useRef(null)

  useEffect(() => {
    if (!isVisible) { setValue(0); return }
    const numTarget = parseInt(target, 10)
    if (isNaN(numTarget)) { setValue(target); return }
    
    const startTime = performance.now()
    const animate = (now) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(numTarget * eased))
      if (progress < 1) rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [isVisible, target, duration])

  return value
}

function CounterStat({ num, label, isVisible }) {
  // Extract number and suffix (e.g., "15+" → 15, "+")
  const match = num.match(/^(\d+)(.*)$/)
  const numPart = match ? match[1] : num
  const suffix = match ? match[2] : ''
  const count = useCountUp(numPart, isVisible, 1400)
  
  return (
    <div className="ov-stat">
      <span className="ov-stat-num ov-speed-text ov-counter">
        {typeof count === 'number' ? count + suffix : num}
      </span>
      <span className="ov-stat-label">{label}</span>
    </div>
  )
}

/* ── Magnetic Button Component ── */
function MagneticButton({ children, className, ...props }) {
  const ref = useRef(null)

  const handleMouseMove = useCallback((e) => {
    const btn = ref.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = e.clientX - cx
    const dy = e.clientY - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    const radius = 120
    if (dist < radius) {
      const strength = (1 - dist / radius) * 0.25
      btn.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`
    } else {
      btn.style.transform = ''
    }
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (ref.current) ref.current.style.transform = ''
  }, [])

  return (
    <div
      ref={ref}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ transition: 'transform 0.3s cubic-bezier(0.23, 1, 0.32, 1)' }}
    >
      {children}
    </div>
  )
}

export default function OverlayUI({ section, progressRef, introComplete }) {
  const sectionRefs = useRef({})
  const navRef = useRef(null)
  const footerRef = useRef(null)
  const progressBarRef = useRef(null)
  const scrollHintRef = useRef(null)
  const cursorRef = useRef({ x: -200, y: -200 })
  const cursorElRef = useRef(null)

  // ── Hide nav on scroll (mobile only) ──
  useEffect(() => {
    const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768
    if (!isMobile) return
    const onScroll = () => {
      const nav = navRef.current
      if (!nav) return
      if (window.scrollY > 40) {
        nav.classList.add('nav--scrolled-away')
      } else {
        nav.classList.remove('nav--scrolled-away')
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // ── Custom cursor follower — smooth lerp ──
  useEffect(() => {
    const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768
    if (isMobile) return

    // Hide cursor on non-hover devices (touch)
    if (!window.matchMedia('(hover: hover)').matches) {
      const el = document.querySelector('.kavya-cursor')
      if (el) el.style.display = 'none'
      return
    }

    let cx = -100, cy = -100
    let tx = -100, ty = -100
    let running = true
    let cursorShown = false

    const onMouseMove = (e) => {
      tx = e.clientX
      ty = e.clientY
      cursorRef.current.x = e.clientX
      cursorRef.current.y = e.clientY

      // Show cursor on first mouse move
      if (!cursorShown) {
        cursorShown = true
        const el = document.querySelector('.kavya-cursor')
        if (el) el.classList.add('cursor-visible')
      }

      // Expand cursor over interactive elements
      const el = document.querySelector('.kavya-cursor')
      if (!el) return
      const target = e.target
      const isInteractive = target.closest('a, button, .ov-magnetic-wrap, .ov-btn, [role="button"]')
      if (isInteractive) {
        el.classList.add('cursor-expand')
      } else {
        el.classList.remove('cursor-expand')
      }
    }

    const followLoop = () => {
      if (!running) return
      cx += (tx - cx) * 0.15
      cy += (ty - cy) * 0.15
      const el = document.querySelector('.kavya-cursor')
      if (el) {
        el.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`
      }
      requestAnimationFrame(followLoop)
    }

    window.addEventListener('mousemove', onMouseMove, { passive: true })
    requestAnimationFrame(followLoop)
    return () => { running = false; window.removeEventListener('mousemove', onMouseMove) }
  }, [])

  // ── rAF loop: all fine-grained UI animations ──
  useEffect(() => {
    let running = true
    let prevT = 0
    let prevTime = performance.now()
    let smoothScrollSpeed = 0

    const loop = (now) => {
      if (!running) return
      const t = progressRef.current || 0
      const isPaused = getCameraPaused(t)
      const pauseBoost = isPaused ? 1.0 : 0.75

      // ── Calculate scroll speed for motion sync ──
      const dtMs = now - prevTime
      const dt = Math.max(dtMs * 0.001, 0.001)
      prevTime = now
      const scrollDelta = Math.abs(t - prevT)
      prevT = t
      const rawSpeed = Math.min(scrollDelta / dt * 8, 1)
      smoothScrollSpeed += (rawSpeed - smoothScrollSpeed) * Math.min(dt * 3, 1)
      const speedNorm = Math.min(smoothScrollSpeed, 1)

      // ── Push speed to CSS for motion-synced UI ──
      document.documentElement.style.setProperty('--speed-norm', speedNorm.toFixed(3))
      document.documentElement.style.setProperty('--scroll-progress', t.toFixed(4))

      // ── Speed-reactive typography ──
      const letterSpacing = speedNorm * 8  // max 8px at full speed
      const textDriftY = -speedNorm * 12   // drift upward
      const opacityBoost = speedNorm * 0.15
      document.documentElement.style.setProperty('--speed-letter-spacing', `${letterSpacing}px`)
      document.documentElement.style.setProperty('--speed-drift-y', `${textDriftY}px`)
      document.documentElement.style.setProperty('--speed-opacity-boost', opacityBoost.toFixed(3))

      // ── Section opacity with translateY entry + speed-linked reveals ──
      SECTION_NAMES.forEach((name) => {
        const el = sectionRefs.current[name]
        if (!el) return
        const [a, b, c, d] = SECTION_RANGES[name]
        let opacity = fade(t, a, b, c, d)
        if (name === 'hero') {
          // hero stays full
        } else if (name === 'cta') {
          opacity *= 1.0 // always fully visible
        } else {
          opacity *= pauseBoost
        }
        el.style.opacity = opacity
        el.style.pointerEvents = opacity > 0.1 ? 'auto' : 'none'
        el.style.visibility = opacity < 0.05 ? 'hidden' : 'visible'
        // Entry animation: translateY(-20→0) based on fade-in progress + speed drift
        const entryProgress = clamp((opacity - 0) / 0.6, 0, 1) // 0→1 over first 60% of fade (faster entry)
        const entryY = (1 - entryProgress) * 20 + speedNorm * -4
        el.style.transform = `translateY(${entryY}px)`

        // About section: no opacity fade — box transform handles the visual entry
        if (name === 'about') {
          el.style.opacity = '1'
          el.style.transform = 'none'
        }

        // Fleet box: cinematic entry from right with scale grow (wrapper only)
        if (name === 'fleet') {
          el.style.opacity = '1'
          el.style.transform = 'none'
          const wrapEl = el.querySelector('.ov-fleet-box-anim')
          if (wrapEl) {
            const eased = 1 - Math.pow(1 - entryProgress, 3)
            const spring = eased >= 1 ? 1 : eased + Math.sin(eased * Math.PI) * 0.06
            const boxX = (1 - spring) * 320
            const boxScale = 0.55 + spring * 0.45
            wrapEl.style.transform = `translateX(${boxX.toFixed(1)}px) scale(${boxScale.toFixed(4)})`
          }
        }

        // Network section: office cards fly in one-by-one from alternating sides
        if (name === 'network') {
          el.style.opacity = '1'
          el.style.transform = 'none'
          const cards = el.querySelectorAll('.ov-office-card')
          cards.forEach((card, i) => {
            const cardT = clamp((entryProgress - i * 0.25) / 0.5, 0, 1)
            const eased = 1 - Math.pow(1 - cardT, 4)
            const spring = eased < 1 ? eased + Math.sin(eased * Math.PI) * 0.05 : 1
            const dir = (i % 2 === 0) ? -1 : 1
            const tx = (1 - eased) * dir * 180
            const sc = 0.3 + spring * 0.7
            card.style.transform = `translateX(${tx.toFixed(1)}px) scale(${sc.toFixed(4)})`
            card.style.opacity = eased.toFixed(4)
          })
        }

        // Services section: cards fly in one-by-one from alternating sides
        if (name === 'services') {
          el.style.opacity = '1'
          el.style.transform = 'none'
          const cards = el.querySelectorAll('.ov-service-card')
          cards.forEach((card, i) => {
            // stagger: each card starts 0.22 behind the previous
            const cardT = clamp((entryProgress - i * 0.22) / 0.45, 0, 1)
            // ease-out quart — snappy start, smooth settle
            const eased = 1 - Math.pow(1 - cardT, 4)
            // overshoot spring on scale only
            const spring = eased < 1 ? eased + Math.sin(eased * Math.PI) * 0.05 : 1
            // left column (0,2) from left; right column (1,3) from right
            const dir = (i % 2 === 0) ? -1 : 1
            const tx = (1 - eased) * dir * 180
            const sc = 0.3 + spring * 0.7
            card.style.transform = `translateX(${tx.toFixed(1)}px) scale(${sc.toFixed(4)})`
            card.style.opacity = eased.toFixed(4)
          })
        }

        // Add active class when fully visible for clip-path reveal
        if (opacity > 0.25) {
          el.classList.add('section-active')
        } else {
          el.classList.remove('section-active')
        }

        // About box: cinematic entry from left with scale grow (wrapper only, keeps glass panel intact)
        if (name === 'about') {
          const wrapEl = el.querySelector('.ov-about-box-anim')
          if (wrapEl) {
            // ease-out cubic: snappy entry, settles smoothly
            const eased = 1 - Math.pow(1 - entryProgress, 3)
            // overshoot spring: slight bounce past final position
            const spring = eased >= 1
              ? 1
              : eased + Math.sin(eased * Math.PI) * 0.06
            const boxX = (1 - spring) * -320
            const boxScale = 0.55 + spring * 0.45
            wrapEl.style.transform = `translateX(${boxX.toFixed(1)}px) scale(${boxScale.toFixed(4)})`
          }
        }
      })

      // ── Footer: hide as soon as scrolling starts (gone by t=0.04) ──
      if (footerRef.current) {
        const footerOpacity = clamp(1 - t * 25, 0, 1)
        const footerY = (1 - footerOpacity) * 40
        footerRef.current.style.opacity = footerOpacity
        footerRef.current.style.transform = `translateY(${footerY.toFixed(1)}px)`
        footerRef.current.style.pointerEvents = footerOpacity < 0.05 ? 'none' : 'auto'
      }

      // Progress bar
      if (progressBarRef.current) {
        progressBarRef.current.style.height = `${t * 100}%`
      }

      // Scroll hint — show only at start
      if (scrollHintRef.current) {
        if (t < 0.04) {
          scrollHintRef.current.classList.add('visible')
        } else {
          scrollHintRef.current.classList.remove('visible')
        }
      }

      // ── Motion sync: hero buttons glow ──
      const heroButtons = document.querySelector('.ov-hero-buttons')
      if (heroButtons) {
        const glowAmount = speedNorm * 12
        heroButtons.style.filter = `drop-shadow(0 0 ${glowAmount}px rgba(245, 166, 35, ${speedNorm * 0.25}))`
      }

      // ── Navbar motion response ──
      if (navRef.current) {
        const navScale = 1 - speedNorm * 0.02
        // Fade out and slide up as soon as user scrolls (gone by t=0.04)
        const navOpacity = clamp(1 - t * 25, 0, 1)
        const navY = (1 - navOpacity) * -60
        navRef.current.style.opacity = navOpacity
        navRef.current.style.transform = `translateY(${navY.toFixed(1)}px)`
        navRef.current.style.pointerEvents = navOpacity < 0.05 ? 'none' : 'auto'
        const navPad = 1.8 - speedNorm * 0.4
        navRef.current.style.padding = `${navPad}rem 3rem`

        // Active nav highlighting based on scroll progress
        const sectionMap = [
          ['about', 0.10, 0.22],
          ['services', 0.22, 0.34],
          ['fleet', 0.34, 0.46],
          ['clients', 0.58, 0.70],
        ]
        const navLinks = navRef.current.querySelectorAll('.ov-nav-right a[data-section]')
        navLinks.forEach(link => {
          const sec = link.getAttribute('data-section')
          const match = sectionMap.find(s => s[0] === sec)
          if (match && t >= match[1] && t <= match[2]) {
            link.classList.add('nav-active')
          } else {
            link.classList.remove('nav-active')
          }
        })
      }

      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
    return () => { running = false }
  }, [progressRef])

  const setSectionRef = useCallback((name) => (el) => {
    sectionRefs.current[name] = el
  }, [])

  return (
    <div className="overlay">

      {/* ───── NAV ───── */}
      <nav className="ov-nav" ref={navRef}>
        <div className="ov-nav-left">
          <img src="/assets/logo.png" alt="Kavya" className="ov-nav-logo" />
          <div>
            <span className="ov-logo">KAVYA</span>
            <span className="ov-logo-sub">TRANSPORTS</span>
          </div>
        </div>
        <div className="ov-nav-right">
          <Link to="/pages#about" data-section="about">About</Link>
          <Link to="/pages#services" data-section="services">Services</Link>
          <Link to="/pages#fleet" data-section="fleet">Fleet</Link>
          <Link to="/pages#clients" data-section="clients">Clients</Link>
          <Link to="/pages#contact" className="ov-nav-cta">Contact</Link>
        </div>
      </nav>

      {/* ───── HERO — section 0 ───── */}
      <section className="ov-section ov-hero" ref={setSectionRef('hero')}>
        <div className="ov-hero-inner">
          <span className="ov-label ov-label--glow ov-speed-text">Since 2004 • Life on Wheels</span>
          <h1 className="ov-title ov-speed-text">
            Pan-India Logistics,<br />
            Built on <span className="ov-accent">Trust.</span>
          </h1>
          <p className="ov-desc ov-speed-text">
            Qualitative logistics and packing services to all segments — dedicated FTL, 
            ODC movements, 3PL warehousing, Air & Sea cargo, and Milk Run services 
            connecting 50+ cities across India.
          </p>
          <div className="ov-hero-buttons">
            <MagneticButton className="ov-magnetic-wrap ov-hero-quote-wrap">
              <Link to="/pages#contact" className="ov-btn ov-btn--primary ov-glass-btn">
                Request a Quote <span>&rarr;</span>
              </Link>
            </MagneticButton>
            <MagneticButton className="ov-magnetic-wrap ov-hero-phone-wrap">
              <a href="tel:+919047244000" className="ov-btn ov-btn--outline ov-glass-btn">
                <i className="fas fa-phone" style={{ marginRight: 8 }} />+91 90472 44000
              </a>
            </MagneticButton>
          </div>
        </div>
        <div className="ov-stats">
          {[
            ['15', '+', 'Years'],
            ['50', '+', 'Cities'],
            ['27', '', 'Major Clients'],
          ].map(([num, suffix, label], i) => (
            <CounterStat num={`${num}${suffix}`} label={label} isVisible={introComplete && section === 0} key={i} />
          ))}
        </div>
      </section>

      {/* ───── ABOUT — section 1 ───── */}
      <section className="ov-section ov-about" ref={setSectionRef('about')}>
        <div className="ov-about-box-anim">
        <div className="ov-about-content ov-glass-panel">
          <span className="ov-label ov-speed-text">About Us</span>
          <h2 className="ov-heading ov-speed-text">Pioneer in Indian Transport</h2>
          <p className="ov-desc">
            With a humble beginning as a small transport service, Kavya Transports today has 
            grown into pan-India transportation, warehousing and 3PL operations. Our motto of 
            on-time deliveries with transit safety at an optimum cost has enabled us to serve 
            some of the biggest brands across India.
          </p>
          <div className="ov-about-highlights">
            {[
              { icon: 'fa-truck', text: 'ODC Movement' },
              { icon: 'fa-boxes-stacked', text: '3PL Services' },
              { icon: 'fa-ship', text: 'Air & Sea Cargo' },
              { icon: 'fa-route', text: 'Milk Run' },
            ].map((h, i) => (
              <div className="ov-highlight" key={i}>
                <i className={`fas ${h.icon}`} />
                <span>{h.text}</span>
              </div>
            ))}
          </div>
          <Link to="/pages#about" className="ov-text-link">Learn More &rarr;</Link>
        </div>
        </div>
      </section>

      {/* ───── SERVICES — section 2 ───── */}
      <section className="ov-section ov-services" ref={setSectionRef('services')}>
        <span className="ov-label ov-speed-text">Our Services</span>
        <h2 className="ov-heading ov-speed-text">Complete Logistics Solutions</h2>
        <div className="ov-service-grid">
          {[
            ['01', 'Road Transportation', 'FTL, Special Vehicle, OEM, Milk Run, Linehaul — covering all of India', 'fa-truck-moving'],
            ['02', 'Air & Sea Cargo', 'Multi-modal global connectivity for domestic & international shipments', 'fa-ship'],
            ['03', 'Warehouse & 3PL', 'Hub operations, distribution, labelling, repacking, inventory MIS', 'fa-warehouse'],
            ['04', 'Manpower Services', 'Skilled workforce for loading, unloading, and logistics operations (Coimbatore)', 'fa-people-carry-box'],
          ].map(([num, title, desc, icon], i) => (
              <div className="ov-service-card ov-glass-card" key={i}>
              <div className="ov-service-card-head">
                <span className="ov-service-num">{num}</span>
                <i className={`fas ${icon}`} />
              </div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>
        <Link to="/pages#services" className="ov-text-link">View All Services &rarr;</Link>
      </section>

      {/* ───── FLEET — section 3 ───── */}
      <section className="ov-section ov-fleet" ref={setSectionRef('fleet')}>
        <div className="ov-fleet-box-anim">
        <div className="ov-fleet-content ov-glass-panel">
          <span className="ov-label ov-speed-text">Our Fleet</span>
          <h2 className="ov-heading ov-speed-text">750kg to 35T+</h2>
          <p className="ov-desc" style={{ maxWidth: 400, marginBottom: '1.5rem' }}>
            Diverse fleet for every cargo need — from last-mile delivery to Over Dimensional Cargo movement.
          </p>
          <div className="ov-fleet-grid">
            {[
              { name: 'TATA Ace', cap: '750kg' },
              { name: 'AL Dost', cap: '1.5T' },
              { name: '14ft / 17ft', cap: '2.5–5T' },
              { name: '20–32ft SLX/MLX', cap: '7–15T' },
              { name: 'Taurus', cap: '16–35T' },
              { name: 'Low Bed Trailer', cap: '35T+' },
              { name: 'Semi Low Bed', cap: 'ODC' },
              { name: 'High Bed Trailer', cap: 'Special' },
            ].map((v, i) => (
              <div className="ov-fleet-item" key={i}>
                <span className="ov-fleet-name">{v.name}</span>
                <span className="ov-fleet-cap">{v.cap}</span>
              </div>
            ))}
          </div>
          <Link to="/pages#fleet" className="ov-text-link">Full Fleet Details &rarr;</Link>
        </div>
        </div>
      </section>

      {/* ───── INDUSTRIES — section 4 (3D only, no overlay) ───── */}
      <section className="ov-section ov-industries ov-empty" ref={setSectionRef('industries')} />

      {/* ───── CLIENTS — section 5 (3D only, no overlay) ───── */}
      <section className="ov-section ov-clients ov-empty" ref={setSectionRef('clients')} />

      {/* ───── NETWORK — section 6 ───── */}
      <section className="ov-section ov-network" ref={setSectionRef('network')}>
          <span className="ov-label ov-speed-text">Our Network</span>
        <h2 className="ov-heading ov-speed-text">Pan-India Presence</h2>
        <div className="ov-net-layout">
          <div className="ov-net-offices">
            {[
              { city: 'Tirunelveli', tag: 'HQ', addr: 'Door No.5/71C, Jyothivinayakar Temple St' },
              { city: 'Coimbatore', tag: 'Branch', addr: 'No 2/664-B-3, L&T Bypass Road' },
              { city: 'Chennai', tag: 'Branch', addr: 'Door No. 24D, Truck Terminal Complex' },
            ].map((n, i) => (
              <div className="ov-office-card ov-glass-card" key={i}>
                <span className="ov-net-tag">{n.tag}</span>
                <span className="ov-net-city">{n.city}</span>
                <span className="ov-net-addr">{n.addr}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── WHY KAVYA — section 7 ───── */}
      <section className="ov-section ov-why" ref={setSectionRef('why')}>
        <span className="ov-label ov-speed-text">Why Choose Us</span>
        <h2 className="ov-heading ov-speed-text">Pioneer Since 2004</h2>
        <div className="ov-why-bars">
          {[
            ['On-Time Delivery', 96],
            ['Pan-India Coverage', 90],
            ['Fleet Diversity', 94],
            ['Transit Safety', 98],
            ['Customer Trust', 92],
          ].map(([label, pct], i) => (
            <div className="ov-bar-row" key={i}>
              <span className="ov-bar-label">{label}</span>
              <div className="ov-bar-track">
                <div
                  className="ov-bar-fill"
                  style={{
                    width: section >= 7 ? `${pct}%` : '0%',
                    transition: 'width 0.8s ease',
                    transitionDelay: `${i * 0.1}s`,
                  }}
                />
              </div>
              <span className="ov-bar-pct">{pct}%</span>
            </div>
          ))}
        </div>
      </section>

      {/* ───── LOCATIONS — section 8 ───── */}
      <section className="ov-section ov-locations" ref={setSectionRef('locations')}>
        <span className="ov-label">Service Locations</span>
        <h2 className="ov-heading">We Reach Everywhere</h2>
        <div className="ov-location-tags">
          {[
            'Tirunelveli', 'Coimbatore', 'Chennai', 'Tuticorin', 'Trichy',
            'Madurai', 'Salem', 'Erode', 'Hosur', 'Bangalore',
            'Hyderabad', 'Pune', 'Mumbai', 'Kolkata', 'Delhi', 'Cochin',
          ].map((city, i) => (
            <span className="ov-loc-tag" key={i} style={{
              opacity: section >= 8 ? 1 : 0,
              transform: section >= 8 ? 'translateY(0)' : 'translateY(15px)',
              transition: `all 0.5s ease ${i * 0.05}s`,
            }}>{city}</span>
          ))}
        </div>
      </section>

      {/* ───── CTA — section 9 ───── */}
      <section className="ov-section ov-cta" ref={setSectionRef('cta')}>
        <div className="ov-cta-block ov-glass-panel">
          <span className="ov-label ov-label--light ov-speed-text">Let's Move Together</span>
          <h2 className="ov-cta-title ov-speed-text">Ready to Move<br/>Your Goods?</h2>
          <p className="ov-cta-desc">
            From Tirunelveli to pan-India — partner with 15+ years of logistics excellence. 
            On-time delivery, transit safety, optimized costs.
          </p>
          <div className="ov-cta-buttons">
            <MagneticButton className="ov-magnetic-wrap">
              <Link to="/pages#contact" className="ov-btn ov-btn--primary ov-glass-btn">
                Request Quote <span>&rarr;</span>
              </Link>
            </MagneticButton>
            <MagneticButton className="ov-magnetic-wrap">
              <a href="tel:+919047244000" className="ov-btn ov-btn--outline ov-glass-btn">
                +91 90472 44000
              </a>
            </MagneticButton>
          </div>
          <div className="ov-cta-emails">
            <a href="mailto:info@kavyatransports.com">info@kavyatransports.com</a>
            <span className="ov-cta-divider">|</span>
            <a href="mailto:Yogendiran.c@kavyatransports.com">Yogendiran.c@kavyatransports.com</a>
          </div>
        </div>
      </section>

      {/* ───── Footer ───── */}
      <footer className="ov-footer" ref={footerRef}>
        <div className="ov-footer-inner">
          <div className="ov-footer-brand">
            <span className="ov-logo">KAVYA</span>
            <p>Life on Wheels — Professional logistics since 2004.</p>
          </div>

          <div className="ov-footer-contact">
            <p>+91 90472 44000</p>
            <p>info@kavyatransports.com</p>
            <p>Tirunelveli, Tamil Nadu</p>
          </div>
        </div>
        <div className="ov-footer-copy">&copy; 2026 Kavya Transports. All rights reserved.</div>
      </footer>

      {/* ───── Scroll progress indicator with section dots ───── */}
      <div className="ov-progress">
        <div className="ov-progress-fill" ref={progressBarRef} />
        {[
          [0.04, 'Hero'], [0.13, 'About'], [0.23, 'Services'], [0.34, 'Fleet'],
          [0.44, 'Industries'], [0.53, 'Clients'], [0.62, 'Network'],
          [0.72, 'Why Us'], [0.82, 'Locations'], [0.93, 'Contact'],
        ].map(([p, name], i) => (
          <div
            key={i}
            className="ov-progress-dot"
            title={name}
            style={{ top: `${p * 100}%` }}
            onClick={() => window.scrollTo({
              top: p * (document.documentElement.scrollHeight - window.innerHeight),
              behavior: 'smooth',
            })}
          />
        ))}
      </div>

      {/* ───── Scroll hint — only visible after intro completes ───── */}
      <div className="ov-scroll-hint" ref={scrollHintRef} style={{ opacity: introComplete ? 1 : 0 }}>
        <span>Scroll to explore</span>
        <div className="ov-scroll-arrow" />
      </div>

      {/* ───── Mobile sticky CTA bar ───── */}
      <div className="mobile-sticky-cta">
        <a href="tel:+919047244000" className="ov-btn ov-btn--outline">
          <i className="fas fa-phone" style={{ marginRight: 6 }} />+91 90472 44000
        </a>
        <Link to="/pages#contact" className="ov-btn ov-btn--primary">
          Get Quote <span>&rarr;</span>
        </Link>
      </div>
    </div>
  )
}
