import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import { AnimatedCounter, FloatingElement, Marquee, MorphingBlob, GlowCard } from '../components/AnimatedComponents'

export default function GetQuote() {
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', company: '',
    origin: '', destination: '', cargoType: '', weight: '',
    service: '', message: ''
  })

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => e.isIntersecting && e.target.classList.add('animate-in')),
      { threshold: 0.1 }
    )
    document.querySelectorAll('.fade-up, .slide-left, .slide-right, .scale-up, .stagger-grid, .blur-reveal, .slide-rotate').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    alert('Thank you! Our team will send you a detailed quote within 24 hours.')
    setFormData({
      name: '', email: '', phone: '', company: '',
      origin: '', destination: '', cargoType: '', weight: '',
      service: '', message: ''
    })
  }

  return (
    <PageLayout>
      {/* Hero */}
      <section className="page-hero">
        <div className="page-hero-overlay" />
        <MorphingBlob color="rgba(245, 166, 35, 0.08)" size={400} style={{ position: 'absolute', top: '10%', right: '8%' }} />
        <MorphingBlob color="rgba(245, 166, 35, 0.05)" size={280} style={{ position: 'absolute', bottom: '15%', left: '5%' }} />
        <div className="page-hero-content">
          <span className="page-label slide-rotate">Get a Quote</span>
          <h1 className="blur-reveal">Request Your Free Quote</h1>
          <p className="blur-reveal" style={{ animationDelay: '0.2s' }}>Tell us about your logistics needs — we'll get back within 24 hours</p>
        </div>
      </section>

      {/* Marquee Band */}
      <Marquee speed={26}>
        <span className="marquee-item">Free Quotes</span>
        <span className="marquee-item">24hr Response</span>
        <span className="marquee-item">Competitive Rates</span>
        <span className="marquee-item">Expert Consultation</span>
        <span className="marquee-item">Transparent Pricing</span>
        <span className="marquee-item">Custom Solutions</span>
      </Marquee>

      {/* Quote Form + Info */}
      <section className="section">
        <div className="container">
          <div className="quote-hero-form">
            {/* Left: Info */}
            <div className="quote-info slide-left">
              <h2>Why Choose Kavya Transports?</h2>
              <div className="quote-features">
                <div className="quote-feature hover-lift">
                  <FloatingElement amplitude={4} duration={3}>
                    <div className="quote-feature-icon hover-glow"><i className="fas fa-clock" /></div>
                  </FloatingElement>
                  <div>
                    <h4>Quick Response</h4>
                    <p>Get your customized quote within 24 hours of submission</p>
                  </div>
                </div>
                <div className="quote-feature hover-lift">
                  <FloatingElement amplitude={4} duration={3.5}>
                    <div className="quote-feature-icon hover-glow"><i className="fas fa-shield-halved" /></div>
                  </FloatingElement>
                  <div>
                    <h4>Transit Safety</h4>
                    <p>100% insured shipments with real-time GPS tracking</p>
                  </div>
                </div>
                <div className="quote-feature hover-lift">
                  <FloatingElement amplitude={4} duration={4}>
                    <div className="quote-feature-icon hover-glow"><i className="fas fa-indian-rupee-sign" /></div>
                  </FloatingElement>
                  <div>
                    <h4>Competitive Pricing</h4>
                    <p>Transparent pricing with no hidden charges</p>
                  </div>
                </div>
                <div className="quote-feature hover-lift">
                  <FloatingElement amplitude={4} duration={4.5}>
                    <div className="quote-feature-icon hover-glow"><i className="fas fa-truck-fast" /></div>
                  </FloatingElement>
                  <div>
                    <h4>Pan-India Coverage</h4>
                    <p>50+ cities covered with our diverse fleet</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Form */}
            <div className="quote-form-card slide-right">
              <h3>Fill in Your Details</h3>
              <p>Our logistics experts will prepare a tailored quote for you</p>
              <form className="contact-form" onSubmit={handleSubmit}>
                <div className="form-row">
                  <input type="text" name="name" placeholder="Full Name *" required value={formData.name} onChange={handleChange} />
                  <input type="email" name="email" placeholder="Email Address *" required value={formData.email} onChange={handleChange} />
                </div>
                <div className="form-row">
                  <input type="tel" name="phone" placeholder="Phone Number *" required value={formData.phone} onChange={handleChange} />
                  <input type="text" name="company" placeholder="Company Name" value={formData.company} onChange={handleChange} />
                </div>
                <div className="form-row">
                  <input type="text" name="origin" placeholder="Origin City *" required value={formData.origin} onChange={handleChange} />
                  <input type="text" name="destination" placeholder="Destination City *" required value={formData.destination} onChange={handleChange} />
                </div>
                <div className="form-row">
                  <input type="text" name="cargoType" placeholder="Cargo Type" value={formData.cargoType} onChange={handleChange} />
                  <input type="text" name="weight" placeholder="Approx. Weight (kg/tons)" value={formData.weight} onChange={handleChange} />
                </div>
                <select name="service" value={formData.service} onChange={handleChange} required>
                  <option value="">Select Service *</option>
                  <option value="ftl">FTL Services</option>
                  <option value="ptl">Part Load Services</option>
                  <option value="odc">ODC Movement</option>
                  <option value="air-sea">Air & Sea Cargo</option>
                  <option value="warehouse">Warehousing & 3PL</option>
                  <option value="manpower">Manpower Services</option>
                  <option value="other">Other</option>
                </select>
                <textarea
                  name="message"
                  rows="4"
                  placeholder="Additional Details (dimensions, special requirements, etc.)"
                  value={formData.message}
                  onChange={handleChange}
                />
                <button type="submit" className="btn btn-primary hover-lift pulse">
                  Get My Quote <i className="fas fa-arrow-right" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="section section-dark">
        <div className="container">
          <div className="stats-grid stagger-grid">
            {[
              { num: 15, suffix: '+', label: 'Years Experience' },
              { num: 50, suffix: '+', label: 'Cities Covered' },
              { num: 24, suffix: 'hrs', label: 'Quote Response' },
              { num: 1000, suffix: '+', label: 'Happy Clients' },
            ].map((s, i) => (
              <div className="stat-card hover-lift" key={i}>
                <span className="stat-num">
                  <AnimatedCounter end={s.num} duration={2000} />{s.suffix}
                </span>
                <span className="stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section section-cta" style={{ position: 'relative', overflow: 'hidden' }}>
        <MorphingBlob color="rgba(245, 166, 35, 0.1)" size={320} style={{ position: 'absolute', top: '-15%', left: '-5%' }} />
        <div className="container text-center">
          <h2 className="cta-title blur-reveal">Prefer to Talk?</h2>
          <p className="cta-desc blur-reveal" style={{ animationDelay: '0.15s' }}>Call us directly for an instant quote or to discuss your requirements.</p>
          <div className="cta-buttons">
            <a href="tel:+919047244000" className="btn btn-primary hover-lift pulse">
              <i className="fas fa-phone" /> +91 90472 44000
            </a>
            <Link to="/contact" className="btn btn-outline btn-glass hover-lift">Visit Contact Page</Link>
          </div>
        </div>
      </section>
    </PageLayout>
  )
}
