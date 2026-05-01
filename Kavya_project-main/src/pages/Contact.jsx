import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import { GlowCard, FloatingElement, Marquee, MorphingBlob } from '../components/AnimatedComponents'

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
            <div
              className="city-photo"
              style={c.img
                ? { backgroundImage: `url('${c.img}')`, backgroundSize: 'cover', backgroundPosition: 'center' }
                : { background: c.grad }}
            />
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

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', company: '', service: '', message: ''
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
    alert('Thank you for your inquiry! We will get back to you within 24 hours.')
    setFormData({ name: '', email: '', phone: '', company: '', service: '', message: '' })
  }

  return (
    <PageLayout>
      {/* Hero */}
      <section className="page-hero page-hero--contact">
        <div className="page-hero-overlay" />
        <MorphingBlob color="rgba(245, 166, 35, 0.08)" size={420} style={{ position: 'absolute', top: '8%', right: '5%' }} />
        <MorphingBlob color="rgba(245, 166, 35, 0.05)" size={300} style={{ position: 'absolute', bottom: '12%', left: '8%' }} />
        <div className="page-hero-content">
          <span className="page-label slide-rotate">Contact Us</span>
          <h1 className="blur-reveal">Let's Move Together</h1>
          <p className="blur-reveal" style={{ animationDelay: '0.2s' }}>Get in touch for reliable pan-India logistics solutions</p>
        </div>
      </section>

      {/* Marquee Band */}
      <Marquee speed={24}>
        <span className="marquee-item">24/7 Support</span>
        <span className="marquee-item">Pan-India Coverage</span>
        <span className="marquee-item">Quick Response</span>
        <span className="marquee-item">Free Quotes</span>
        <span className="marquee-item">Expert Consultation</span>
        <span className="marquee-item">Custom Solutions</span>
      </Marquee>

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
            {/* Form */}
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
                <textarea
                  name="message"
                  rows="5"
                  placeholder="Your Message *"
                  required
                  value={formData.message}
                  onChange={handleChange}
                />
                <button type="submit" className="btn btn-primary hover-lift pulse">
                  Send Message <i className="fas fa-paper-plane" />
                </button>
              </form>
            </div>

            {/* Offices */}
            <div className="slide-right">
              <span className="section-label">Our Offices</span>
              <h2 className="section-title">Visit Us</h2>
              <div className="office-list">
                <div className="office-card">
                  <span className="office-tag">Head Office</span>
                  <h3>Tirunelveli</h3>
                  <p>
                    <i className="fas fa-map-marker-alt" />
                    Door No.5/71C, Jyothivinayakar Temple Street,<br />
                    Rediyarpatti, Palayangottai Taluk,<br />
                    Tirunelveli – 627007
                  </p>
                  <p><i className="fas fa-phone" /> <a href="tel:+919047244000">+91 90472 44000</a></p>
                  <p><i className="fas fa-envelope" /> <a href="mailto:info@kavyatransports.com">info@kavyatransports.com</a></p>
                </div>

                <div className="office-card">
                  <span className="office-tag">Branch Office</span>
                  <h3>Coimbatore</h3>
                  <p>
                    <i className="fas fa-map-marker-alt" />
                    No 2/664-B-3, L&T Bypass Road,<br />
                    Kulathur, Coimbatore – 641062
                  </p>
                </div>

                <div className="office-card">
                  <span className="office-tag">Branch Office</span>
                  <h3>Chennai</h3>
                  <p>
                    <i className="fas fa-map-marker-alt" />
                    Door No. 24D, Truck Terminal Complex,<br />
                    Madhavaram, Chennai – 600060
                  </p>
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
    </PageLayout>
  )
}
