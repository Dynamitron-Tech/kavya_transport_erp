import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import { TiltCard, FloatingElement, Marquee, MorphingBlob } from '../components/AnimatedComponents'

const fleetData = [
  {
    name: 'TATA Ace',
    capacity: '750 kg',
    type: 'Light Commercial',
    iconImage: '/image/r9.png',
    features: ['Urban deliveries', 'Last-mile logistics', 'Small consignments'],
  },
  {
    name: 'AL Dost',
    capacity: '1.5 Ton',
    type: 'Light Commercial',
    icon: 'fa-truck-front',
    iconImage: '/image/dl-dost.png',
    features: ['Intra-city transport', 'Quick deliveries', 'Cost effective'],
  },
  {
    name: '14ft / 17ft Trucks',
    capacity: '2.5T - 5T',
    type: 'Medium Commercial',
    iconImage: '/image/r8.png',
    features: ['Medium loads', 'Regional transport', 'Versatile cargo'],
  },
  {
    name: '20ft / 22ft Containers',
    capacity: '7T - 9T',
    type: 'Container',
    iconImage: '/image/con.png',
    features: ['SLX / MLX variants', 'Long-haul transport', 'Secure cargo'],
  },
  {
    name: '24ft / 32ft Containers',
    capacity: '10T - 15T',
    type: 'Large Container',
    iconImage: '/image/r4.png',
    features: ['SLX / MLX variants', 'Heavy consignments', 'Pan-India routes'],
  },
  {
    name: 'Taurus (16T - 35T)',
    capacity: '16T - 35T',
    type: 'Heavy Commercial',
    iconImage: '/image/r5.png',
    features: ['Bulk cargo', 'Industrial goods', 'High capacity'],
  },
  {
    name: 'Low Bed Trailers',
    capacity: '35T+',
    type: 'Specialized',
    iconImage: '/image/r6.png',
    features: ['Heavy machinery', 'ODC movement', 'Oversized cargo'],
  },
  {
    name: 'Semi Low / High Bed',
    capacity: '20T - 40T',
    type: 'Specialized',
    iconImage: '/image/r7.png',
    features: ['Industrial equipment', 'Construction material', 'Special cargo'],
  },
]

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

export default function Fleet() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => e.isIntersecting && e.target.classList.add('animate-in')),
      { threshold: 0.1 }
    )
    document.querySelectorAll('.fade-up, .slide-left, .slide-right, .scale-up, .stagger-grid, .blur-reveal, .slide-rotate').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <PageLayout>
      {/* Hero */}
      <section className="page-hero page-hero--fleet">
        <div className="page-hero-overlay" />
        <MorphingBlob color="rgba(245, 166, 35, 0.08)" size={450} style={{ position: 'absolute', top: '5%', right: '10%' }} />
        <MorphingBlob color="rgba(245, 166, 35, 0.05)" size={280} style={{ position: 'absolute', bottom: '10%', left: '5%' }} />
        <div className="page-hero-content">
          <span className="page-label slide-rotate">Our Fleet</span>
          <h1 className="blur-reveal">Vehicles at Your Service</h1>
          <p className="blur-reveal" style={{ animationDelay: '0.2s' }}>From 750kg to 35T+ — we have the right vehicle for every cargo</p>
        </div>
      </section>

      {/* Marquee Band */}
      <Marquee speed={28}>
        <span className="marquee-item">TATA Ace</span>
        <span className="marquee-item">AL Dost</span>
        <span className="marquee-item">14ft / 17ft Trucks</span>
        <span className="marquee-item">20ft Containers</span>
        <span className="marquee-item">24ft Containers</span>
        <span className="marquee-item">32ft Containers</span>
        <span className="marquee-item">Taurus 16T-35T</span>
        <span className="marquee-item">Low Bed Trailers</span>
        <span className="marquee-item">High Bed Trailers</span>
      </Marquee>

      {/* Fleet Grid */}
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
                <div
                  className={`fleet-card hover-lift ${v.bgImage ? 'fleet-card--with-bg' : ''}`}
                  style={v.bgImage ? { '--fleet-bg-image': `url(${v.bgImage})` } : undefined}
                >
                  <FloatingElement amplitude={4} duration={3 + i * 0.3}>
                    <div className={`fleet-card-icon hover-glow ${v.iconImage ? 'fleet-card-icon--photo' : ''}`}>
                      {v.iconImage ? (
                        <img
                          src={v.iconImage}
                          alt={`${v.name} vehicle`}
                          className={`fleet-card-image ${v.imageClass || ''}`}
                          loading="lazy"
                          onError={e => {
                            e.currentTarget.onerror = null
                            e.currentTarget.src = '/assets/tata-ace-clean.png'
                          }}
                        />
                      ) : (
                        <i className={`fas ${v.icon}`} />
                      )}
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

      {/* CTA */}
      <section className="section section-cta" style={{ position: 'relative', overflow: 'hidden' }}>
        <MorphingBlob color="rgba(245, 166, 35, 0.1)" size={320} style={{ position: 'absolute', top: '-15%', left: '-5%' }} />
        <div className="container text-center">
          <h2 className="cta-title blur-reveal">Need a Vehicle for Your Cargo?</h2>
          <p className="cta-desc blur-reveal" style={{ animationDelay: '0.15s' }}>From 750kg to 35T+ — we match the right vehicle to your requirements.</p>
          <div className="cta-buttons">
            <Link to="/contact" className="btn btn-primary hover-lift pulse">Request a Quote</Link>
            <a href="tel:+919047244000" className="btn btn-outline btn-glass hover-lift">+91 90472 44000</a>
          </div>
        </div>
      </section>
    </PageLayout>
  )
}
