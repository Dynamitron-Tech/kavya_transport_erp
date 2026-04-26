import { Link, useLocation, useNavigate } from 'react-router-dom'

function FooterScrollLink({ hash, children }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const handleClick = (e) => {
    e.preventDefault()
    if (pathname === '/pages') {
      const el = document.querySelector(hash)
      if (el) el.scrollIntoView({ behavior: 'smooth' })
    } else {
      navigate('/pages')
      setTimeout(() => {
        const el = document.querySelector(hash)
        if (el) el.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    }
  }
  return <a href={`/pages${hash}`} onClick={handleClick}>{children}</a>
}

export default function Footer() {
  return (
    <footer className="page-footer">
      <div className="footer-container">
        <div className="footer-grid">
          {/* Brand */}
          <div className="footer-brand">
            <div className="footer-logo-group">
              <img src="/assets/logo.png" alt="Kavya Transports" className="footer-logo-img" />
              <div>
                <span className="footer-brand-name">KAVYA TRANSPORTS</span>
                <span className="footer-tagline">Life on Wheels</span>
              </div>
            </div>
            <p className="footer-desc">
              Your trusted partner for reliable logistics and transport solutions across India. 
              Delivering excellence since 2004.
            </p>
          </div>

          {/* Quick Links */}
          <div className="footer-col">
            <h4>Quick Links</h4>
            <ul>
              <li><Link to="/">Home</Link></li>
              <li><FooterScrollLink hash="#about">About Us</FooterScrollLink></li>
              <li><FooterScrollLink hash="#services">Services</FooterScrollLink></li>
              <li><FooterScrollLink hash="#fleet">Fleet</FooterScrollLink></li>
              <li><FooterScrollLink hash="#clients">Clients</FooterScrollLink></li>
              <li><FooterScrollLink hash="#contact">Contact</FooterScrollLink></li>
            </ul>
          </div>

          {/* Services */}
          <div className="footer-col">
            <h4>Services</h4>
            <ul>
              <li><FooterScrollLink hash="#services">Road Transportation</FooterScrollLink></li>
              <li><FooterScrollLink hash="#services">Air & Sea Cargo</FooterScrollLink></li>
              <li><FooterScrollLink hash="#services">Warehousing</FooterScrollLink></li>
              <li><FooterScrollLink hash="#services">3PL Solutions</FooterScrollLink></li>
              <li><FooterScrollLink hash="#services">Manpower Services</FooterScrollLink></li>
            </ul>
          </div>

          {/* Contact */}
          <div className="footer-col footer-col-contact">
            <h4>Contact Us</h4>
            <ul>
              <li>
                <i className="fas fa-map-marker-alt" />
                <span>Door No.5/71C, Jyothivinayakar Temple Street,<br />Rediyarpatti, Tirunelveli – 627007</span>
              </li>
              <li>
                <i className="fas fa-phone" />
                <a href="tel:+919047244000">+91 90472 44000</a>
              </li>
              <li>
                <i className="fas fa-envelope" />
                <a href="mailto:info@kavyatransports.com">info@kavyatransports.com</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; 2026 Kavya Transports. All rights reserved.</p>
          <div className="footer-legal">
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Service</Link>
            <Link to="/refund">Refund Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
