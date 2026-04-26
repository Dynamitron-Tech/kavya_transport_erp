import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import { TiltCard, FloatingElement, Marquee, MorphingBlob } from '../components/AnimatedComponents'

export default function Services() {
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
      <section className="page-hero page-hero--services">
        <div className="page-hero-overlay" />
        <MorphingBlob color="rgba(245, 166, 35, 0.08)" size={400} style={{ position: 'absolute', top: '10%', right: '5%' }} />
        <MorphingBlob color="rgba(245, 166, 35, 0.05)" size={300} style={{ position: 'absolute', bottom: '15%', left: '10%' }} />
        <div className="page-hero-content">
          <span className="page-label slide-rotate">Our Services</span>
          <h1 className="blur-reveal">Comprehensive Logistics Solutions</h1>
          <p className="blur-reveal" style={{ animationDelay: '0.2s' }}>End-to-end transportation, warehousing, and manpower services across India</p>
        </div>
      </section>

      {/* Marquee Band */}
      <Marquee>
        <span className="marquee-item">Road Transport</span>
        <span className="marquee-item">Air Freight</span>
        <span className="marquee-item">Sea Cargo</span>
        <span className="marquee-item">Warehousing</span>
        <span className="marquee-item">3PL Solutions</span>
        <span className="marquee-item">Manpower Services</span>
        <span className="marquee-item">Pan-India Coverage</span>
        <span className="marquee-item">24/7 Operations</span>
      </Marquee>

      {/* Road Transportation */}
      <section className="section" id="road">
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
                    <div>
                      <strong>{f.title}</strong>
                      <span>{f.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="service-visual slide-right">
              <FloatingElement amplitude={8} duration={4}>
                <div className="service-icon-large service-icon-large--photo hover-glow">
                  <img
                    src="/assets/truck-hero.png"
                    alt="Kavya Transports truck"
                    className="service-photo"
                    loading="lazy"
                  />
                </div>
              </FloatingElement>
            </div>
          </div>
        </div>
      </section>

      {/* Air & Sea Cargo */}
      <section className="section section-alt" id="air-sea">
        <div className="container">
          <div className="two-col">
            <div className="service-visual slide-left">
              <FloatingElement amplitude={10} duration={5}>
                <div className="service-icon-large service-icon-large--photo hover-glow">
                  <img
                    src="/assets/ship-hero.png"
                    alt="Cargo ship"
                    className="service-photo"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      const fallback = e.currentTarget.nextElementSibling
                      if (fallback) fallback.style.display = 'block'
                    }}
                  />
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
                    <div>
                      <strong>{f.title}</strong>
                      <span>{f.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Warehouse & Hub Operations */}
      <section className="section" id="warehouse">
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
                    <div>
                      <strong>{f.title}</strong>
                      <span>{f.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="service-visual slide-right">
              <FloatingElement amplitude={6} duration={4.5}>
                <div className="service-icon-large service-icon-large--photo hover-glow">
                  <img
                    src="/assets/house-hero.png"
                    alt="Warehouse facility"
                    className="service-photo"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      const fallback = e.currentTarget.nextElementSibling
                      if (fallback) fallback.style.display = 'block'
                    }}
                  />
                  <i className="fas fa-warehouse service-photo-fallback" aria-hidden="true" />
                </div>
              </FloatingElement>
            </div>
          </div>
        </div>
      </section>

      {/* Manpower Services */}
      <section className="section section-alt" id="manpower">
        <div className="container">
          <div className="two-col two-col--center">
            <div className="service-visual slide-left">
              <FloatingElement amplitude={8} duration={5.5}>
                <div className="service-icon-large hover-glow">
                  <img
                    src="/image/r11.png"
                    alt="Manpower services"
                    className="service-icon-image"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      const fallback = e.currentTarget.nextElementSibling
                      if (fallback) fallback.style.display = 'block'
                    }}
                  />
                  <i className="fas fa-people-carry-box service-photo-fallback" aria-hidden="true" />
                </div>
              </FloatingElement>
            </div>
            <div className="slide-right">
              <span className="section-label">04</span>
              <h2 className="section-title">Manpower Services (Coimbatore)</h2>
              <p className="section-text">
                Based out of our Coimbatore branch, we provide skilled manpower services for 
                loading, unloading, warehousing operations, and logistics support. Our trained 
                workforce ensures efficient handling of your goods.
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
                    <div>
                      <strong>{f.title}</strong>
                      <span>{f.desc}</span>
                    </div>
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

      {/* CTA */}
      <section className="section section-cta" style={{ position: 'relative', overflow: 'hidden' }}>
        <MorphingBlob color="rgba(245, 166, 35, 0.1)" size={350} style={{ position: 'absolute', top: '-10%', right: '-5%' }} />
        <div className="container text-center">
          <h2 className="cta-title blur-reveal">Need a Logistics Solution?</h2>
          <p className="cta-desc blur-reveal" style={{ animationDelay: '0.15s' }}>Our 15+ years of expertise ensures your cargo reaches safely, on time, every time.</p>
          <div className="cta-buttons">
            <Link to="/contact" className="btn btn-primary hover-lift pulse">Get a Quote</Link>
            <a href="tel:+919047244000" className="btn btn-outline btn-glass hover-lift">+91 90472 44000</a>
          </div>
        </div>
      </section>
    </PageLayout>
  )
}
