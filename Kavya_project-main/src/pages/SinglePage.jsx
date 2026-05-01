import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { ScrollProgress, CursorGlowTrail, AnimatedCounter, TiltCard, FloatingElement, GlowCard, Marquee, MorphingBlob } from '../components/AnimatedComponents'

/* ── Fleet Data ── */
const fleetData = [
  { name: 'TATA Ace', capacity: '750 kg', type: 'Light Commercial', iconImage: '/image/r9.png', features: ['Urban deliveries', 'Last-mile logistics', 'Small consignments'] },
  { name: 'AL Dost', capacity: '1.5 Ton', type: 'Light Commercial', iconImage: '/image/dl-dost.png', features: ['Intra-city transport', 'Quick deliveries', 'Cost effective'] },
  { name: '14ft / 17ft Trucks', capacity: '2.5T - 5T', type: 'Medium Commercial', iconImage: '/image/r8.png', features: ['Medium loads', 'Regional transport', 'Versatile cargo'] },
  { name: '20ft / 22ft Containers', capacity: '7T - 9T', type: 'Container', iconImage: '/image/con.png', features: ['SLX / MLX variants', 'Long-haul transport', 'Secure cargo'] },
  { name: '24ft / 32ft Containers', capacity: '10T - 15T', type: 'Large Container', iconImage: '/image/r4.png', features: ['SLX / MLX variants', 'Heavy consignments', 'Pan-India routes'] },
  { name: 'Taurus (16T - 35T)', capacity: '16T - 35T', type: 'Heavy Commercial', iconImage: '/image/r5.png', features: ['Bulk cargo', 'Industrial goods', 'High capacity'] },
  { name: 'Low Bed Trailers', capacity: '35T+', type: 'Specialized', iconImage: '/image/r6.png', features: ['Heavy machinery', 'ODC movement', 'Oversized cargo'] },
  { name: 'Semi Low / High Bed', capacity: '20T - 40T', type: 'Specialized', iconImage: '/image/r7.png', features: ['Industrial equipment', 'Construction material', 'Special cargo'] },
]

/* ── Client Logos ── */
const clients = [
  'aaditya-aswin.png', 'amazon.png', 'apex.png', 'britannia.png',
  'coca-cola.png', 'elgi.png', 'everest.png', 'indo-shell-cast.png',
  'jayachandran-groups.png', 'jcg-jayachandran.png', 'kpr-mill.png', 'mld.png',
  'navkar-international.png', 'peps.png', 'podaran.png', 'powergear.png',
  'pristine.png', 'propel.png', 'renacon.png', 'rsm-autokast.png',
  'safi-traders.png', 'sharoff-colours.png', 'sripathi.png', 'taiyo.png',
  'tvs.png', 'vasudha-genesys.png', 'walkaroo.png',
]

/* ── Capacity Data ── */
const capacityData = [
  { label: 'TATA Ace', cap: '750kg', pct: 5, tier: 'XS' },
  { label: 'AL Dost', cap: '1.5T', pct: 10, tier: 'SM' },
  { label: '14ft / 17ft', cap: '2.5-5T', pct: 20, tier: 'MD' },
  { label: '20ft / 22ft', cap: '7-9T', pct: 35, tier: 'LG' },
  { label: '24ft / 32ft', cap: '10-15T', pct: 55, tier: 'XL' },
  { label: 'Taurus', cap: '16-35T', pct: 80, tier: '2X' },
  { label: 'Trailers', cap: '35T+', pct: 100, tier: 'HVY' },
]

function CapacityChart() {
  const chartRef = useRef(null)
  const [visible, setVisible] = useState(false)
  const [hoveredIdx, setHoveredIdx] = useState(-1)

  useEffect(() => {
    const el = chartRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.2 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div className={`cap-chart-pro ${visible ? 'cap-chart-pro--visible' : ''}`} ref={chartRef}>
      {capacityData.map((c, i) => (
        <div
          className={`cap-row-pro ${hoveredIdx === i ? 'cap-row-pro--active' : ''}`}
          key={i}
          style={{ '--row-delay': `${i * 0.1}s`, '--bar-pct': `${c.pct}%` }}
          onMouseEnter={() => setHoveredIdx(i)}
          onMouseLeave={() => setHoveredIdx(-1)}
        >
          <span className="cap-tier-badge" data-tier={c.tier}>{c.tier}</span>
          <span className="cap-row-label">{c.label}</span>
          <div className="cap-row-track">
            <div className="cap-row-fill">
              <div className="cap-row-glow" />
            </div>
            <div className="cap-row-pulse" />
          </div>
          <span className="cap-row-value">{c.cap}</span>
        </div>
      ))}
    </div>
  )
}

function CinematicClientGrid({ items }) {
  const gridRef = useRef(null)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setRevealed(true); obs.disconnect() } },
      { threshold: 0.15 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div className={`cin-client-grid ${revealed ? 'cin-client-grid--revealed' : ''}`} ref={gridRef}>
      {items.map((img, i) => (
        <div
          className="cin-client-card"
          key={i}
          style={{ '--card-delay': `${i * 0.06}s` }}
        >
          <div className="cin-client-inner">
            <div className="cin-client-shine" />
            <img src={`/assets/clients/${img}`} alt={`Client ${i + 1}`} loading="lazy" />
          </div>
          <div className="cin-client-ring" />
        </div>
      ))}
    </div>
  )
}

/* ── City Network ── */
const cityData = [
  { name: 'Tirunelveli', state: 'Tamil Nadu', tag: 'HQ', km: '—', hub: true,
    img: '/assets/cities/tiru.png', grad: 'linear-gradient(135deg,#1a3a5c 0%,#0f2744 40%,#1F6FDD 100%)' },
  { name: 'Coimbatore', state: 'Tamil Nadu', tag: 'Hub', km: '175 km',
    img: '/assets/cities/coimbature.png', grad: 'linear-gradient(135deg,#2d4a22 0%,#1a3a18 40%,#2e7d32 100%)' },
  { name: 'Chennai', state: 'Tamil Nadu', tag: 'Hub', km: '530 km',
    img: '/assets/cities/chennai.png', grad: 'linear-gradient(135deg,#0d3349 0%,#0a2236 40%,#1565c0 100%)' },
  { name: 'Tuticorin', state: 'Tamil Nadu', tag: 'Port', km: '72 km',
    img: '/assets/cities/Tuticorin.png', grad: 'linear-gradient(135deg,#004d5a 0%,#00363f 40%,#00838f 100%)' },
  { name: 'Trichy', state: 'Tamil Nadu', tag: 'Hub', km: '320 km',
    img: '/assets/cities/Trichy.png', grad: 'linear-gradient(135deg,#4a2c0a 0%,#3e2008 40%,#bf6f0a 100%)' },
  { name: 'Madurai', state: 'Tamil Nadu', tag: 'Hub', km: '160 km',
    img: '/assets/cities/Madurai.png', grad: 'linear-gradient(135deg,#5c1a1a 0%,#420f0f 40%,#c62828 100%)' },
  { name: 'Salem', state: 'Tamil Nadu', tag: 'Route', km: '380 km',
    img: '/assets/cities/Salem.png', grad: 'linear-gradient(135deg,#1a3300 0%,#122600 40%,#558b2f 100%)' },
  { name: 'Erode', state: 'Tamil Nadu', tag: 'Route', km: '310 km',
    img: '/assets/cities/Erode.png', grad: 'linear-gradient(135deg,#4a1942 0%,#321030 40%,#8e24aa 100%)' },
  { name: 'Kanyakumari', state: 'Tamil Nadu', tag: 'Route', km: '90 km',
    img: '/assets/cities/kanyakumari.png?v=2', grad: 'linear-gradient(135deg,#1a2a3a 0%,#102030 40%,#37474f 100%)' },
  { name: 'Bangalore', state: 'Karnataka', tag: 'Hub', km: '480 km',
    img: '/assets/cities/Bangalore.png', grad: 'linear-gradient(135deg,#1a1a4a 0%,#0f0f38 40%,#303f9f 100%)' },
  { name: 'Hyderabad', state: 'Telangana', tag: 'Hub', km: '790 km',
    img: '/assets/cities/Hyderabad.png', grad: 'linear-gradient(135deg,#2a1a00 0%,#1e1200 40%,#e65100 100%)' },
  { name: 'Pune', state: 'Maharashtra', tag: 'Route', km: '1380 km',
    img: '/assets/cities/Pune.png', grad: 'linear-gradient(135deg,#003322 0%,#002018 40%,#00695c 100%)' },
  { name: 'Mumbai', state: 'Maharashtra', tag: 'Hub', km: '1560 km',
    img: '/assets/cities/Mumbai.png', grad: 'linear-gradient(135deg,#001a33 0%,#001020 40%,#01579b 100%)' },
  { name: 'Kolkata', state: 'West Bengal', tag: 'Hub', km: '2100 km',
    img: '/assets/cities/Kolkata.png', grad: 'linear-gradient(135deg,#2c1a00 0%,#1e1000 40%,#f57f17 100%)' },
  { name: 'Delhi', state: 'Delhi NCR', tag: 'Hub', km: '2400 km',
    img: '/assets/cities/Delhi.png', grad: 'linear-gradient(135deg,#1a0a2e 0%,#110520 40%,#6a1b9a 100%)' },
  { name: 'Cochin', state: 'Kerala', tag: 'Port', km: '390 km',
    img: '/assets/cities/Cochin.png', grad: 'linear-gradient(135deg,#003d2e 0%,#002820 40%,#00796b 100%)' },
]

const tagColors = {
  HQ:    { bg: 'rgba(31,111,221,0.9)', color: '#fff' },
  Hub:   { bg: 'rgba(31,111,221,0.75)', color: '#fff' },
  Port:  { bg: 'rgba(0,180,160,0.8)', color: '#fff' },
  Route: { bg: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.9)' },
}

function CityNetwork() {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  const [active, setActive] = useState(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect() }
    }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div className={`city-network ${visible ? 'city-network--visible' : ''}`} ref={ref}>
      {cityData.map((c, i) => {
        const tc = tagColors[c.tag]
        return (
          <div
            className={`city-card ${active === i ? 'city-card--active' : ''} ${c.hub ? 'city-card--hq' : ''}`}
            key={i}
            style={{ '--cd': `${i * 0.055}s` }}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
          >
            <div className="city-photo" style={c.img
                ? { backgroundImage: `url('${c.img}')`, backgroundSize: 'cover', backgroundPosition: 'center' }
                : { background: c.grad }} />
            <div className="city-overlay" />
            <div className="city-content">
              <div className="city-card-top">
                <span className="city-tag" style={{ background: tc.bg, color: tc.color }}>{c.tag}</span>
                {c.km !== '—' && <span className="city-km">{c.km}</span>}
              </div>
              <div className="city-name">{c.name}</div>
              <div className="city-state">{c.state}</div>
            </div>
            {c.hub && <div className="city-pulse-dot" />}
            <div className="city-shine" />
          </div>
        )
      })}
    </div>
  )
}

/* ── Testimonials ── */
const testimonials = [
  { text: 'Kavya Transports has been our trusted logistics partner for over 5 years. Their reliability and on-time delivery record is outstanding.', name: 'Supply Chain Manager', company: 'Engineering Firm', rating: 5 },
  { text: 'The ODC movement expertise of Kavya Transports is remarkable. They handled our heavy machinery transport with utmost care.', name: 'Operations Head', company: 'Construction Company', rating: 5 },
  { text: 'Professional service, competitive pricing, and excellent communication throughout. Highly recommended for FTL services.', name: 'Logistics Director', company: 'FMCG Brand', rating: 5 },
  { text: 'Their 3PL warehousing solution helped streamline our distribution network. The MIS reporting is a real plus.', name: 'Distribution Manager', company: 'Textile Company', rating: 4 },
]

export default function SinglePage() {
  const statsRef = useRef(null)
  const [mounted, setMounted] = useState(false)
  const [exitingToHome, setExitingToHome] = useState(false)
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', company: '', service: '', message: '' })
  const location = useLocation()
  const navigate = useNavigate()
  const fromHome = location.state?.fromHomeScroll === true
  const homeTransitionRef = useRef(false)

  const goHomeWithTransition = useCallback(() => {
    if (homeTransitionRef.current) return
    homeTransitionRef.current = true
    setExitingToHome(true)

    const frozenScrollY = window.scrollY
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${frozenScrollY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'

    window.__kavyaSkipLoaderOnce = true

    setTimeout(() => {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      window.scrollTo(0, frozenScrollY)
      navigate('/', { state: { fromAboutScrollUp: true } })
    }, 460)
  }, [navigate])

  const isMobile = typeof window !== 'undefined' && (
    /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768
  )

  useEffect(() => {
    // Temporarily disable smooth scrolling so the initial reset is instant
    document.documentElement.style.scrollBehavior = 'auto'
    window.scrollTo(0, 0)
    setMounted(true)
    // If there's a hash (e.g. #services), scroll to it after layout
    const hash = location.hash
    if (hash) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = document.querySelector(hash)
          if (el) el.scrollIntoView({ behavior: 'smooth' })
          // Restore smooth scrolling after hash scroll
          document.documentElement.style.scrollBehavior = ''
        })
      })
    } else {
      // Restore smooth scrolling after a frame
      requestAnimationFrame(() => {
        document.documentElement.style.scrollBehavior = ''
      })
    }
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => e.isIntersecting && e.target.classList.add('animate-in')),
      { threshold: 0.1 }
    )
    document.querySelectorAll('.fade-up, .slide-left, .slide-right, .scale-up, .stagger-grid, .blur-reveal, .slide-rotate').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [mounted])

  // Custom cursor
  useEffect(() => {
    if (isMobile || !window.matchMedia('(hover: hover)').matches) return
    let cx = -100, cy = -100, tx = -100, ty = -100, running = true, cursorShown = false
    const cursor = document.querySelector('.page-cursor')
    if (!cursor) return
    const onMouseMove = (e) => {
      tx = e.clientX; ty = e.clientY
      if (!cursorShown) { cursorShown = true; cursor.classList.add('cursor-visible') }
      const isInteractive = e.target.closest('a, button, input, textarea, select, .btn, [role="button"]')
      cursor.classList.toggle('cursor-expand', !!isInteractive)
    }
    const loop = () => { if (!running) return; cx += (tx - cx) * 0.15; cy += (ty - cy) * 0.15; cursor.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`; requestAnimationFrame(loop) }
    window.addEventListener('mousemove', onMouseMove, { passive: true })
    requestAnimationFrame(loop)
    return () => { running = false; window.removeEventListener('mousemove', onMouseMove) }
  }, [isMobile])

  // Scroll up at top → go back to home (cinematic 3D page)
  useEffect(() => {
    const mountedAt = performance.now()
    const LOCK_MS = 700
    let wheelIntent = { count: 0, time: 0 }

    const atTop = () => window.scrollY <= 2
    const unlocked = () => performance.now() - mountedAt >= LOCK_MS

    const onWheel = (e) => {
      if (!unlocked() || e.deltaY >= -12 || !atTop()) return
      const now = performance.now()
      if (now - wheelIntent.time <= 420) {
        wheelIntent = { count: wheelIntent.count + 1, time: now }
      } else {
        wheelIntent = { count: 1, time: now }
      }
      if (wheelIntent.count >= 2) goHomeWithTransition()
    }

    const onKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (!unlocked()) return
      if (['ArrowUp', 'PageUp', 'Home'].includes(e.key) && atTop()) goHomeWithTransition()
    }

    let touchStartY = null
    const onTouchStart = (e) => { touchStartY = e.touches?.[0]?.clientY ?? null }
    const onTouchEnd = (e) => {
      if (touchStartY === null || !unlocked()) return
      const endY = e.changedTouches?.[0]?.clientY ?? touchStartY
      const delta = touchStartY - endY
      touchStartY = null
      if (delta < -40 && atTop()) goHomeWithTransition()
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
  }, [goHomeWithTransition])

  // Header home click from /pages triggers this custom event.
  useEffect(() => {
    const onGoHome = () => goHomeWithTransition()
    window.addEventListener('kavya:go-home', onGoHome)
    return () => window.removeEventListener('kavya:go-home', onGoHome)
  }, [goHomeWithTransition])

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  const handleSubmit = (e) => {
    e.preventDefault()
    alert('Thank you for your inquiry! We will get back to you within 24 hours.')
    setFormData({ name: '', email: '', phone: '', company: '', service: '', message: '' })
  }

  return (
    <div className={`page-wrapper ${fromHome ? 'page-fade-in' : ''} ${exitingToHome ? 'page-exit-to-home' : ''}`}>
      {mounted && <ScrollProgress />}
      <Header />
      <main className="page-main">

        {/* ════════════════════════════════════════
            ABOUT SECTION
           ════════════════════════════════════════ */}
        <section className="page-hero" id="about">
          <MorphingBlob className="morphing-blob" style={{ top: '10%', left: '10%' }} />
          <MorphingBlob className="morphing-blob" style={{ bottom: '20%', right: '15%', animationDelay: '-4s' }} />
          <div className="page-hero-overlay" />
          <div className="page-hero-content">
            <span className="page-label">About Us</span>
            <h1>Pioneer in Indian Transport Industry</h1>
            <p>15+ years of delivering qualitative logistics and packing services across India</p>
          </div>
        </section>

        <div className="marquee-band">
          <Marquee speed={25}>
            <span className="marquee-item">Pan-India Coverage</span>
            <span className="marquee-separator" />
            <span className="marquee-item">ODC Specialists</span>
            <span className="marquee-separator" />
            <span className="marquee-item">15+ Years Experience</span>
            <span className="marquee-separator" />
            <span className="marquee-item">50+ Cities</span>
            <span className="marquee-separator" />
            <span className="marquee-item">3PL Solutions</span>
            <span className="marquee-separator" />
            <span className="marquee-item">Transit Safety</span>
            <span className="marquee-separator" />
          </Marquee>
        </div>

        {/* Vision */}
        <section className="section section-alt">
          <div className="container">
            <div className="two-col">
              <div className="slide-left">
                <span className="section-label">Our Vision</span>
                <h2 className="section-title">Providing Qualitative Logistics</h2>
                <p className="section-text">
                  At Kavya Transports, we provide qualitative logistics and packing services to all segments
                  on agreed service level at an optimized cost to our clients. Our services include dedicated
                  full truck load services, part load services, Over Dimensional Cargo (ODC) movements,
                  warehouse services – including 3PL, repacking, Air and Sea cargo services, Milk Run
                  services, and manpower services.
                </p>
              </div>
              <div className="slide-right">
                <FloatingElement amplitude={8} duration={4}>
                  <div className="about-experience-badge hover-glow">
                    <span className="badge-number">15+</span>
                    <span className="badge-text">Years of<br />Excellence</span>
                  </div>
                </FloatingElement>
              </div>
            </div>
          </div>
        </section>

        {/* Company Story + Timeline */}
        <section className="section">
          <div className="container">
            <div className="text-center fade-up">
              <span className="section-label">Our Journey</span>
              <h2 className="section-title">Since 2004</h2>
              <p className="section-text section-text--wide">
                With a humble beginning as a small transport service with a handful of vehicles,
                Kavya Transports today has grown into pan-India transportation, warehousing and
                3PL operations. Our motto of on-time deliveries with transit safety at an optimum
                cost has enabled us to serve some of the biggest brands across India.
              </p>
            </div>
            <div className="timeline fade-up">
              <div className="timeline-line" />
              {[
                { year: '2004', title: 'Started as a Fleet Operator', side: 'top' },
                { year: '2007', title: 'Increased the Fleet Strength', side: 'bottom' },
                { year: '2011', title: 'Entered into Kavya Travels', side: 'bottom' },
                { year: '2015', title: 'TN37 Office Branch', side: 'top' },
                { year: '2016', title: 'TN72 Head Office', side: 'bottom' },
                { year: '2017', title: 'TN01 Office Branch', side: 'top' },
                { year: '2017-2018', title: 'TN72 Started as a Transport Contractor', side: 'bottom' },
                { year: '2018', title: 'TN37 Office — Started as a Transport Contractor', side: 'top' },
                { year: '2018', title: 'MH10 Office Branch', side: 'bottom', yearHidden: true },
                { year: '2019-2020', title: 'Expanded Pan-India Operations', side: 'top' },
              ].map((item, i) => (
                <div className={`timeline-item timeline-item--${item.side}`} key={i}>
                  <div className="timeline-dot" />
                  <div className="timeline-content">
                    <span className="timeline-year">{item.year}</span>
                    <p className="timeline-title">{item.title}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Specializations */}
            <div className="feature-grid stagger-grid">
              {[
                { icon: 'fa-truck', title: 'ODC Movement', desc: 'Over Dimensional Cargo with specialized trailers' },
                { icon: 'fa-boxes-stacked', title: '3PL Services', desc: 'Complete third-party logistics solutions' },
                { icon: 'fa-box-open', title: 'Repacking Services', desc: 'Professional repacking and labelling' },
                { icon: 'fa-ship', title: 'Air & Sea Cargo', desc: 'Multi-modal global connectivity' },
                { icon: 'fa-route', title: 'Milk Run Services', desc: 'Optimized multi-point pickup & delivery' },
                { icon: 'fa-people-carry-box', title: 'Manpower Services', desc: 'Skilled labour for logistics operations' },
              ].map((item, i) => (
                <TiltCard key={i} className="feature-card" maxTilt={5}>
                  <div className="feature-icon"><i className={`fas ${item.icon}`} /></div>
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </TiltCard>
              ))}
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="section section-dark" ref={statsRef}>
          <div className="container">
            <div className="stats-grid stats-grid--3 stagger-grid">
              {[
                { num: 15, suffix: '+', label: 'Years Experience', icon: 'fa-calendar-check' },
                { num: 50, suffix: '+', label: 'Cities Covered', icon: 'fa-map-marked-alt' },
                { num: 1000, suffix: '+', label: 'Successful Deliveries', icon: 'fa-truck-loading' },
              ].map((s, i) => (
                <div className="stat-card stat-card--pro hover-lift" key={i} style={{ animationDelay: `${i * 0.15}s` }}>
                  <div className="stat-card-glow" />
                  <div className="stat-card-icon">
                    <i className={`fas ${s.icon}`} />
                  </div>
                  <span className="stat-num"><AnimatedCounter value={s.num} suffix={s.suffix} duration={2500} /></span>
                  <span className="stat-label">{s.label}</span>
                  <div className="stat-card-shimmer" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Mission & Values */}
        <section className="section">
          <div className="container">
            <div className="two-col">
              <div className="slide-left">
                <span className="section-label">Mission</span>
                <h2 className="section-title">Delivering Excellence</h2>
                <p className="section-text">
                  To provide innovative, effective and value-based transport and logistics solutions
                  across India. We strive to be the most trusted logistics partner by continuously
                  improving our services, expanding our reach, and maintaining the highest standards
                  of safety and reliability.
                </p>
              </div>
              <div className="slide-right">
                <span className="section-label">Values</span>
                <h2 className="section-title">What Drives Us</h2>
                <ul className="values-list">
                  {['On-time deliveries with transit safety', 'Optimized cost for clients', 'Transparent and reliable operations', 'Customer-centric approach', 'Continuous innovation'].map((value, i) => (
                    <li key={i} style={{ transitionDelay: `${i * 0.1}s` }}>
                      <i className="fas fa-check-circle" /> {value}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════
            SERVICES SECTION
           ════════════════════════════════════════ */}
        <section className="page-hero page-hero--services" id="services">
          <div className="page-hero-overlay" />
          <MorphingBlob color="rgba(245, 166, 35, 0.08)" size={400} style={{ position: 'absolute', top: '10%', right: '5%' }} />
          <MorphingBlob color="rgba(245, 166, 35, 0.05)" size={300} style={{ position: 'absolute', bottom: '15%', left: '10%' }} />
          <div className="page-hero-content">
            <span className="page-label slide-rotate">Our Services</span>
            <h1 className="blur-reveal">Comprehensive Logistics Solutions</h1>
            <p className="blur-reveal" style={{ animationDelay: '0.2s' }}>End-to-end transportation, warehousing, and manpower services across India</p>
          </div>
        </section>

        {/* Road Transportation */}
        <section className="section">
          <div className="container">
            <div className="two-col two-col--reverse">
              <div className="slide-left">
                <span className="section-label">01</span>
                <h2 className="section-title">Road Transportation</h2>
                <p className="section-text">
                  Our core strength lies in road transportation with a diverse fleet covering all of India.
                  We handle everything from small consignments to Over Dimensional Cargo (ODC) with
                  specialized vehicles and experienced drivers.
                </p>
                <div className="service-features">
                  {[
                    { title: 'FTL Services', desc: 'Full Truck Load for dedicated shipments' },
                    { title: 'Special Vehicle Transport', desc: 'Customized solutions for unique cargo' },
                    { title: 'OEM Transportation', desc: 'Original equipment manufacturer logistics' },
                    { title: 'Milk Run Services', desc: 'Multi-point pickup and delivery optimization' },
                    { title: 'Linehaul Operations', desc: 'Long-distance trunk route movements' },
                  ].map((f, i) => (
                    <div className="service-feature" key={i}>
                      <i className="fas fa-check" />
                      <div><strong>{f.title}</strong><span>{f.desc}</span></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="service-visual slide-right">
                <FloatingElement amplitude={8} duration={4}>
                  <div className="service-icon-large service-icon-large--photo hover-glow">
                    <img src="/assets/truck-hero.png" alt="Kavya Transports truck" className="service-photo" loading="lazy" />
                  </div>
                </FloatingElement>
              </div>
            </div>
          </div>
        </section>

        {/* Air & Sea Cargo */}
        <section className="section section-alt">
          <div className="container">
            <div className="two-col">
              <div className="service-visual slide-left">
                <FloatingElement amplitude={10} duration={5}>
                  <div className="service-icon-large service-icon-large--photo hover-glow">
                    <img src="/assets/ship-hero.png" alt="Cargo ship" className="service-photo" loading="lazy"
                      onError={(e) => { e.currentTarget.style.display = 'none'; const fb = e.currentTarget.nextElementSibling; if (fb) fb.style.display = 'block' }} />
                    <i className="fas fa-ship service-photo-fallback" aria-hidden="true" />
                  </div>
                </FloatingElement>
              </div>
              <div className="slide-right">
                <span className="section-label">02</span>
                <h2 className="section-title">Air & Sea Cargo</h2>
                <p className="section-text">
                  Expanding beyond roads, we provide reliable air and sea freight services for
                  domestic and international shipments. Our multi-modal approach ensures your
                  cargo reaches anywhere in the world.
                </p>
                <div className="service-features">
                  {[
                    { title: 'Air Freight', desc: 'Fast delivery for time-critical shipments' },
                    { title: 'Sea Freight', desc: 'Cost-effective ocean cargo solutions' },
                    { title: 'Multi-modal Transport', desc: 'Seamless road-air-sea integration' },
                    { title: 'Custom Clearance', desc: 'End-to-end documentation support' },
                  ].map((f, i) => (
                    <div className="service-feature" key={i}>
                      <i className="fas fa-check" />
                      <div><strong>{f.title}</strong><span>{f.desc}</span></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Warehouse */}
        <section className="section">
          <div className="container">
            <div className="two-col two-col--reverse">
              <div className="slide-left">
                <span className="section-label">03</span>
                <h2 className="section-title">Warehouse & Hub Operations</h2>
                <p className="section-text">
                  Our strategically located warehouses provide comprehensive storage and distribution
                  solutions. From inventory management to last-mile fulfillment, we handle the entire
                  supply chain.
                </p>
                <div className="service-features">
                  {[
                    { title: '3PL Solutions', desc: 'Complete third-party logistics management' },
                    { title: 'Repacking Services', desc: 'Professional repacking and labelling' },
                    { title: 'Inventory Management', desc: 'Real-time stock tracking and MIS' },
                    { title: 'Distribution Hub', desc: 'Strategic hub and spoke operations' },
                  ].map((f, i) => (
                    <div className="service-feature" key={i}>
                      <i className="fas fa-check" />
                      <div><strong>{f.title}</strong><span>{f.desc}</span></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="service-visual slide-right">
                <FloatingElement amplitude={6} duration={4.5}>
                  <div className="service-icon-large service-icon-large--photo hover-glow">
                    <img src="/assets/house-hero.png" alt="Warehouse facility" className="service-photo" loading="lazy"
                      onError={(e) => { e.currentTarget.style.display = 'none'; const fb = e.currentTarget.nextElementSibling; if (fb) fb.style.display = 'block' }} />
                    <i className="fas fa-warehouse service-photo-fallback" aria-hidden="true" />
                  </div>
                </FloatingElement>
              </div>
            </div>
          </div>
        </section>

        {/* Manpower */}
        <section className="section section-alt">
          <div className="container">
            <div className="two-col two-col--center">
              <div className="service-visual slide-left">
                <FloatingElement amplitude={8} duration={5.5}>
                  <div className="service-icon-large hover-glow">
                    <img src="/image/r11.png" alt="Manpower services" className="service-icon-image" loading="lazy"
                      onError={(e) => { e.currentTarget.style.display = 'none'; const fb = e.currentTarget.nextElementSibling; if (fb) fb.style.display = 'block' }} />
                    <i className="fas fa-people-carry-box service-photo-fallback" aria-hidden="true" />
                  </div>
                </FloatingElement>
              </div>
              <div className="slide-right">
                <span className="section-label">04</span>
                <h2 className="section-title">Manpower Services (Coimbatore)</h2>
                <p className="section-text">
                  Based out of our Coimbatore branch, we provide skilled manpower services for
                  loading, unloading, warehousing operations, and logistics support.
                </p>
                <div className="service-features">
                  {[
                    { title: 'Loading & Unloading', desc: 'Trained labour for cargo handling' },
                    { title: 'Warehouse Staff', desc: 'Skilled workers for warehouse operations' },
                    { title: 'Packing Teams', desc: 'Professional packaging and crating' },
                    { title: 'Logistics Support', desc: 'End-to-end operational support' },
                  ].map((f, i) => (
                    <div className="service-feature" key={i}>
                      <i className="fas fa-check" />
                      <div><strong>{f.title}</strong><span>{f.desc}</span></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Industries */}
        <section className="section section-dark">
          <div className="container text-center">
            <span className="section-label">Industries We Serve</span>
            <h2 className="section-title section-title--light">Trusted Across Sectors</h2>
            <div className="industry-grid stagger-grid">
              {[
                { icon: 'fa-gears', name: 'Engineering' },
                { icon: 'fa-building', name: 'Construction' },
                { icon: 'fa-box', name: 'Paper Board' },
                { icon: 'fa-industry', name: 'Steel' },
                { icon: 'fa-anchor', name: 'Marine' },
                { icon: 'fa-car', name: 'Auto Parts' },
                { icon: 'fa-shirt', name: 'Textile' },
                { icon: 'fa-basket-shopping', name: 'FMCG' },
              ].map((ind, i) => (
                <TiltCard key={i} maxTilt={12} scale={1.05}>
                  <div className="industry-card hover-lift">
                    <i className={`fas ${ind.icon}`} />
                    <span>{ind.name}</span>
                  </div>
                </TiltCard>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════
            FLEET SECTION
           ════════════════════════════════════════ */}
        <section className="page-hero page-hero--fleet" id="fleet">
          <div className="page-hero-overlay" />
          <MorphingBlob color="rgba(245, 166, 35, 0.08)" size={450} style={{ position: 'absolute', top: '5%', right: '10%' }} />
          <MorphingBlob color="rgba(245, 166, 35, 0.05)" size={280} style={{ position: 'absolute', bottom: '10%', left: '5%' }} />
          <div className="page-hero-content">
            <span className="page-label slide-rotate">Our Fleet</span>
            <h1 className="blur-reveal">Vehicles at Your Service</h1>
            <p className="blur-reveal" style={{ animationDelay: '0.2s' }}>From 750kg to 35T+ — we have the right vehicle for every cargo</p>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="text-center fade-up">
              <span className="section-label">Our Vehicles</span>
              <h2 className="section-title">Diverse Fleet for Every Need</h2>
              <p className="section-text section-text--wide">
                Our fleet ranges from light commercial vehicles for last-mile delivery to heavy-duty
                trailers for Over Dimensional Cargo. Every vehicle is well-maintained and GPS-tracked.
              </p>
            </div>
            <div className="fleet-grid stagger-grid">
              {fleetData.map((v, i) => (
                <TiltCard key={i} maxTilt={10} scale={1.03}>
                  <div className={`fleet-card hover-lift ${v.bgImage ? 'fleet-card--with-bg' : ''}`}
                    style={v.bgImage ? { '--fleet-bg-image': `url(${v.bgImage})` } : undefined}>
                    <FloatingElement amplitude={4} duration={3 + i * 0.3}>
                      <div className={`fleet-card-icon hover-glow ${v.iconImage ? 'fleet-card-icon--photo' : ''}`}>
                        {v.iconImage ? (
                          <img src={v.iconImage} alt={`${v.name} vehicle`} className={`fleet-card-image ${v.imageClass || ''}`} loading="lazy"
                            onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = '/assets/tata-ace-clean.png' }} />
                        ) : (<i className={`fas ${v.icon}`} />)}
                      </div>
                    </FloatingElement>
                    <h3 className="fleet-card-name">{v.name}</h3>
                    <div className="fleet-card-meta">
                      <span className="fleet-card-cap">{v.capacity}</span>
                      <span className="fleet-card-type">{v.type}</span>
                    </div>
                    <ul className="fleet-card-features">
                      {v.features.map((f, j) => (
                        <li key={j} style={{ animationDelay: `${j * 0.1}s` }}><i className="fas fa-check" /> {f}</li>
                      ))}
                    </ul>
                  </div>
                </TiltCard>
              ))}
            </div>
          </div>
        </section>

        {/* Capacity Chart */}
        <section className="section section-alt">
          <div className="container">
            <div className="text-center fade-up">
              <span className="section-label">Capacity Range</span>
              <h2 className="section-title">From Small to Massive</h2>
            </div>
            <CapacityChart />
          </div>
        </section>

        {/* ════════════════════════════════════════
            CLIENTS SECTION
           ════════════════════════════════════════ */}
        <section className="page-hero page-hero--clients" id="clients">
          <div className="page-hero-overlay" />
          <MorphingBlob color="rgba(245, 166, 35, 0.08)" size={380} style={{ position: 'absolute', top: '10%', right: '8%' }} />
          <MorphingBlob color="rgba(245, 166, 35, 0.05)" size={260} style={{ position: 'absolute', bottom: '15%', left: '5%' }} />
          <div className="page-hero-content">
            <span className="page-label slide-rotate">Our Clients</span>
            <h1 className="blur-reveal">Trusted by Industry Leaders</h1>
            <p className="blur-reveal" style={{ animationDelay: '0.2s' }}>Building lasting partnerships across 8+ industries since 2004</p>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="text-center fade-up">
              <span className="section-label">Our Partners</span>
              <h2 className="section-title">Brands That Trust Us</h2>
              <p className="section-text section-text--wide">
                Proudly serving some of India's leading companies across engineering, construction,
                steel, marine, auto parts, textile, and FMCG sectors.
              </p>
            </div>
            <CinematicClientGrid items={clients} />
          </div>
        </section>

        {/* Testimonials */}
        <section className="section section-alt">
          <div className="container">
            <div className="text-center fade-up">
              <span className="section-label">Testimonials</span>
              <h2 className="section-title">What Our Clients Say</h2>
            </div>
            <div className="testimonial-grid stagger-grid">
              {testimonials.map((t, i) => (
                <GlowCard key={i} glowColor="rgba(245, 166, 35, 0.4)">
                  <div className="testimonial-card hover-lift">
                    <div className="testimonial-stars">
                      {Array.from({ length: t.rating }, (_, j) => <i className="fas fa-star" key={j} />)}
                    </div>
                    <p className="testimonial-text">"{t.text}"</p>
                    <div className="testimonial-author">
                      <strong>{t.name}</strong>
                      <span>{t.company}</span>
                    </div>
                  </div>
                </GlowCard>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════
            CONTACT SECTION
           ════════════════════════════════════════ */}
        <section className="page-hero page-hero--contact" id="contact">
          <div className="page-hero-overlay" />
          <MorphingBlob color="rgba(245, 166, 35, 0.08)" size={420} style={{ position: 'absolute', top: '8%', right: '5%' }} />
          <MorphingBlob color="rgba(245, 166, 35, 0.05)" size={300} style={{ position: 'absolute', bottom: '12%', left: '8%' }} />
          <div className="page-hero-content">
            <span className="page-label slide-rotate">Contact Us</span>
            <h1 className="blur-reveal">Let's Move Together</h1>
            <p className="blur-reveal" style={{ animationDelay: '0.2s' }}>Get in touch for reliable pan-India logistics solutions</p>
          </div>
        </section>

        {/* Contact Cards */}
        <section className="section">
          <div className="container">
            <div className="contact-cards stagger-grid">
              <GlowCard glowColor="rgba(245, 166, 35, 0.4)">
                <div className="contact-card hover-lift">
                  <FloatingElement amplitude={5} duration={3}>
                    <div className="contact-card-icon hover-glow"><i className="fas fa-phone" /></div>
                  </FloatingElement>
                  <h3>Call Us</h3>
                  <a href="tel:+919047244000">+91 90472 44000</a>
                  <span>24/7 Available</span>
                </div>
              </GlowCard>
              <GlowCard glowColor="rgba(245, 166, 35, 0.4)">
                <div className="contact-card hover-lift">
                  <FloatingElement amplitude={5} duration={3.5}>
                    <div className="contact-card-icon hover-glow"><i className="fas fa-envelope" /></div>
                  </FloatingElement>
                  <h3>Email Us</h3>
                  <a href="mailto:info@kavyatransports.com">info@kavyatransports.com</a>
                  <a href="mailto:Yogendiran.c@kavyatransports.com">Yogendiran.c@kavyatransports.com</a>
                </div>
              </GlowCard>
              <GlowCard glowColor="rgba(245, 166, 35, 0.4)">
                <div className="contact-card hover-lift">
                  <FloatingElement amplitude={5} duration={4}>
                    <div className="contact-card-icon hover-glow"><i className="fas fa-clock" /></div>
                  </FloatingElement>
                  <h3>Working Hours</h3>
                  <span>Mon - Sat: 9 AM - 7 PM</span>
                  <span>24/7 for transit support</span>
                </div>
              </GlowCard>
            </div>
          </div>
        </section>

        {/* Form + Offices */}
        <section className="section section-alt">
          <div className="container">
            <div className="two-col">
              <div className="slide-left">
                <span className="section-label">Get a Quote</span>
                <h2 className="section-title">Send Us a Message</h2>
                <form className="contact-form" onSubmit={handleSubmit}>
                  <div className="form-row">
                    <input type="text" name="name" placeholder="Your Name *" required value={formData.name} onChange={handleChange} />
                    <input type="email" name="email" placeholder="Email Address *" required value={formData.email} onChange={handleChange} />
                  </div>
                  <div className="form-row">
                    <input type="tel" name="phone" placeholder="Phone Number" value={formData.phone} onChange={handleChange} />
                    <input type="text" name="company" placeholder="Company Name" value={formData.company} onChange={handleChange} />
                  </div>
                  <select name="service" value={formData.service} onChange={handleChange}>
                    <option value="">Select Service</option>
                    <option value="ftl">FTL Services</option>
                    <option value="road">Road Transportation</option>
                    <option value="air-sea">Air & Sea Cargo</option>
                    <option value="warehouse">Warehousing & 3PL</option>
                    <option value="odc">ODC Movement</option>
                    <option value="manpower">Manpower Services</option>
                    <option value="other">Other</option>
                  </select>
                  <textarea name="message" rows="5" placeholder="Your Message *" required value={formData.message} onChange={handleChange} />
                  <button type="submit" className="btn btn-primary hover-lift pulse">Send Message <i className="fas fa-paper-plane" /></button>
                </form>
              </div>
              <div className="slide-right">
                <span className="section-label">Our Offices</span>
                <h2 className="section-title">Visit Us</h2>
                <div className="office-list">
                  <div className="office-card">
                    <span className="office-tag">Head Office</span>
                    <h3>Tirunelveli</h3>
                    <p><i className="fas fa-map-marker-alt" /> Door No.5/71C, Jyothivinayakar Temple Street,<br />Rediyarpatti, Palayangottai Taluk,<br />Tirunelveli – 627007</p>
                    <p><i className="fas fa-phone" /> <a href="tel:+919047244000">+91 90472 44000</a></p>
                    <p><i className="fas fa-envelope" /> <a href="mailto:info@kavyatransports.com">info@kavyatransports.com</a></p>
                  </div>
                  <div className="office-card">
                    <span className="office-tag">Branch Office</span>
                    <h3>Coimbatore</h3>
                    <p><i className="fas fa-map-marker-alt" /> No 2/664-B-3, L&T Bypass Road,<br />Kulathur, Coimbatore – 641062</p>
                  </div>
                  <div className="office-card">
                    <span className="office-tag">Branch Office</span>
                    <h3>Chennai</h3>
                    <p><i className="fas fa-map-marker-alt" /> Door No. 24D, Truck Terminal Complex,<br />Madhavaram, Chennai – 600060</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Service Locations */}
        <section className="section">
          <div className="container">
            <div className="text-center fade-up">
              <span className="section-label">Service Locations</span>
              <h2 className="section-title">Pan-India Network</h2>
              <p className="section-text section-text--wide" style={{ marginTop: '0.5rem' }}>
                Operating out of Tirunelveli HQ — connecting 16 key cities across 7 states via established truck routes.
              </p>
            </div>
            <CityNetwork />
          </div>
        </section>

        {/* FAQ */}
        <section className="section section-alt">
          <div className="container">
            <div className="text-center fade-up">
              <span className="section-label">FAQ</span>
              <h2 className="section-title">Frequently Asked Questions</h2>
            </div>
            <div className="faq-list fade-up">
              {[
                { q: 'What areas do you serve?', a: 'We provide pan-India logistics services covering 50+ cities across all major routes including Tirunelveli, Coimbatore, Chennai, Bangalore, Hyderabad, Mumbai, Delhi, and more.' },
                { q: 'What types of vehicles do you have?', a: 'Our fleet ranges from TATA Ace (750kg) to heavy trailers (35T+), including containers in 20ft, 22ft, 24ft, and 32ft sizes with SLX/MLX variants.' },
                { q: 'Do you handle ODC movements?', a: 'Yes, we specialize in Over Dimensional Cargo with low bed, semi low, and high bed trailers for heavy machinery and oversized equipment.' },
                { q: 'How can I get a quote?', a: 'You can fill out the contact form above, call us at +91 90472 44000, or email info@kavyatransports.com for a custom quote.' },
              ].map((faq, i) => (
                <details className="faq-item hover-lift" key={i}>
                  <summary>{faq.q}</summary>
                  <p>{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="section section-cta" style={{ position: 'relative', overflow: 'hidden' }}>
          <MorphingBlob color="rgba(245, 166, 35, 0.1)" size={350} style={{ position: 'absolute', top: '-10%', right: '-5%' }} />
          <div className="container text-center" style={{ position: 'relative', zIndex: 1 }}>
            <h2 className="cta-title blur-reveal">Partner With Us</h2>
            <p className="cta-desc blur-reveal">Experience 15+ years of logistics excellence. Let's move your business forward.</p>
            <div className="cta-buttons">
              <Link to="/quote" className="btn btn-primary hover-lift pulse">Get a Quote</Link>
              <a href="tel:+919047244000" className="btn btn-glass hover-lift">+91 90472 44000</a>
            </div>
          </div>
        </section>

      </main>
      <Footer />
      {!isMobile && <div className="page-cursor" />}
      {!isMobile && mounted && <CursorGlowTrail />}
      <div className={`home-exit-fade ${exitingToHome ? 'home-exit-fade--active' : ''}`} aria-hidden="true" />
      <div className="noise-overlay" aria-hidden="true" />
    </div>
  )
}
