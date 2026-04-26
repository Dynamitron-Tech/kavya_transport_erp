import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import { TiltCard, GlowCard, Marquee, MorphingBlob } from '../components/AnimatedComponents'

const clients = [
  'aaditya-aswin.png', 'amazon.png', 'apex.png', 'britannia.png',
  'coca-cola.png', 'elgi.png', 'everest.png', 'indo-shell-cast.png',
  'jayachandran-groups.png', 'jcg-jayachandran.png', 'kpr-mill.png', 'mld.png',
  'navkar-international.png', 'peps.png', 'podaran.png', 'powergear.png',
  'pristine.png', 'propel.png', 'renacon.png', 'rsm-autokast.png',
  'safi-traders.png', 'sharoff-colours.png', 'sripathi.png', 'taiyo.png',
  'tvs.png', 'vasudha-genesys.png', 'walkaroo.png',
]

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

const testimonials = [
  {
    text: 'Kavya Transports has been our trusted logistics partner for over 5 years. Their reliability and on-time delivery record is outstanding.',
    name: 'Supply Chain Manager',
    company: 'Engineering Firm',
    rating: 5,
  },
  {
    text: 'The ODC movement expertise of Kavya Transports is remarkable. They handled our heavy machinery transport with utmost care.',
    name: 'Operations Head',
    company: 'Construction Company',
    rating: 5,
  },
  {
    text: 'Professional service, competitive pricing, and excellent communication throughout. Highly recommended for FTL services.',
    name: 'Logistics Director',
    company: 'FMCG Brand',
    rating: 5,
  },
  {
    text: 'Their 3PL warehousing solution helped streamline our distribution network. The MIS reporting is a real plus.',
    name: 'Distribution Manager',
    company: 'Textile Company',
    rating: 4,
  },
]

export default function Testimonials() {
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
      <section className="page-hero page-hero--clients">
        <div className="page-hero-overlay" />
        <MorphingBlob color="rgba(245, 166, 35, 0.08)" size={380} style={{ position: 'absolute', top: '10%', right: '8%' }} />
        <MorphingBlob color="rgba(245, 166, 35, 0.05)" size={260} style={{ position: 'absolute', bottom: '15%', left: '5%' }} />
        <div className="page-hero-content">
          <span className="page-label slide-rotate">Our Clients</span>
          <h1 className="blur-reveal">Trusted by Industry Leaders</h1>
          <p className="blur-reveal" style={{ animationDelay: '0.2s' }}>Building lasting partnerships across 8+ industries since 2004</p>
        </div>
      </section>

      {/* Marquee Band */}
      <Marquee speed={22}>
        <span className="marquee-item">27+ Trusted Clients</span>
        <span className="marquee-item">8+ Industries</span>
        <span className="marquee-item">15+ Years Experience</span>
        <span className="marquee-item">Pan-India Network</span>
        <span className="marquee-item">5-Star Reviews</span>
        <span className="marquee-item">Reliable Partner</span>
      </Marquee>

      {/* Client Logos */}
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
                    {Array.from({ length: t.rating }, (_, j) => (
                      <i className="fas fa-star" key={j} />
                    ))}
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

      {/* Industries */}
      <section className="section section-dark">
        <div className="container text-center">
          <span className="section-label">Industries</span>
          <h2 className="section-title section-title--light">Serving Diverse Sectors</h2>
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

      {/* CTA */}
      <section className="section section-cta" style={{ position: 'relative', overflow: 'hidden' }}>
        <MorphingBlob color="rgba(245, 166, 35, 0.1)" size={300} style={{ position: 'absolute', bottom: '-10%', right: '-3%' }} />
        <div className="container text-center">
          <h2 className="cta-title blur-reveal">Join Our Growing Client Base</h2>
          <p className="cta-desc blur-reveal" style={{ animationDelay: '0.15s' }}>Experience the Kavya Transports difference — reliability, safety, and on-time delivery.</p>
          <div className="cta-buttons">
            <Link to="/contact" className="btn btn-primary hover-lift pulse">Get Started</Link>
            <a href="tel:+919047244000" className="btn btn-outline btn-glass hover-lift">+91 90472 44000</a>
          </div>
        </div>
      </section>
    </PageLayout>
  )
}
