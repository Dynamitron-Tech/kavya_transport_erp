import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import { AnimatedCounter, TiltCard, FloatingElement, Marquee, MorphingBlob, SplitText } from '../components/AnimatedComponents'

export default function About() {
  const statsRef = useRef(null)

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
      {/* Hero Banner */}
      <section className="page-hero">
        <MorphingBlob className="morphing-blob" style={{ top: '10%', left: '10%' }} />
        <MorphingBlob className="morphing-blob" style={{ bottom: '20%', right: '15%', animationDelay: '-4s' }} />
        <div className="page-hero-overlay" />
        <div className="page-hero-content">
          <span className="page-label">About Us</span>
          <h1>Pioneer in Indian Transport Industry</h1>
          <p>15+ years of delivering qualitative logistics and packing services across India</p>
        </div>
      </section>

      {/* Marquee Band */}
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

      {/* Vision Section */}
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

      {/* Company Story */}
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

          {/* Timeline */}
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
                <div className="feature-icon">
                  <i className={`fas ${item.icon}`} />
                </div>
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
                <span className="stat-num">
                  <AnimatedCounter value={s.num} suffix={s.suffix} duration={2500} />
                </span>
                <span className="stat-label">{s.label}</span>
                <div className="stat-card-shimmer" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
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
                {[
                  'On-time deliveries with transit safety',
                  'Optimized cost for clients',
                  'Transparent and reliable operations',
                  'Customer-centric approach',
                  'Continuous innovation'
                ].map((value, i) => (
                  <li key={i} style={{ transitionDelay: `${i * 0.1}s` }}>
                    <i className="fas fa-check-circle" /> {value}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section section-cta">
        <MorphingBlob className="morphing-blob" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} color="rgba(245, 166, 35, 0.08)" />
        <div className="container text-center" style={{ position: 'relative', zIndex: 1 }}>
          <h2 className="cta-title blur-reveal">Partner With Us</h2>
          <p className="cta-desc blur-reveal">Experience 15+ years of logistics excellence. Let's move your business forward.</p>
          <div className="cta-buttons">
            <Link to="/contact" className="btn btn-primary hover-lift pulse">Contact Us</Link>
            <a href="tel:+919047244000" className="btn btn-glass hover-lift">+91 90472 44000</a>
          </div>
        </div>
      </section>
    </PageLayout>
  )
}
