import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('')
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const links = [
    { to: '/', hash: '', label: 'Home' },
    { to: '/pages', hash: '#about', label: 'About' },
    { to: '/pages', hash: '#services', label: 'Services' },
    { to: '/pages', hash: '#fleet', label: 'Fleet' },
    { to: '/pages', hash: '#clients', label: 'Clients' },
    { to: '/pages', hash: '#contact', label: 'Contact' },
  ]

  // Track which section is in view
  useEffect(() => {
    if (pathname !== '/pages') return
    const ids = ['about', 'services', 'fleet', 'clients', 'contact']
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) setActiveSection(e.target.id)
        })
      },
      { rootMargin: '-30% 0px -60% 0px' }
    )
    ids.forEach(id => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [pathname])

  const handleNavClick = (link) => {
    setMenuOpen(false)
    if (link.hash) {
      if (pathname === '/pages') {
        // Already on single page, smooth scroll
        const el = document.querySelector(link.hash)
        if (el) el.scrollIntoView({ behavior: 'smooth' })
      } else {
        // Navigate to single page, then scroll
        navigate('/pages')
        setTimeout(() => {
          const el = document.querySelector(link.hash)
          if (el) el.scrollIntoView({ behavior: 'smooth' })
        }, 100)
      }
    }
  }

  const handleHomeClick = (e) => {
    setMenuOpen(false)
    if (pathname !== '/pages') return
    e.preventDefault()
    window.dispatchEvent(new CustomEvent('kavya:go-home'))
  }

  const isActive = (link) => {
    if (link.to === '/' && !link.hash) return pathname === '/'
    if (pathname === '/pages' && link.hash) return activeSection === link.hash.replace('#', '')
    return false
  }

  return (
    <header className="page-header">
      <div className="header-inner">
        <Link to="/" className="header-brand">
          <img src="/assets/logo.png" alt="Kavya Transports" className="header-logo" />
          <div className="header-brand-text">
            <span className="header-name">KAVYA</span>
            <span className="header-sub">TRANSPORTS</span>
          </div>
        </Link>

        <button
          className={`hamburger ${menuOpen ? 'hamburger--active' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>

        <nav className={`header-nav ${menuOpen ? 'header-nav--open' : ''}`}>
          {links.map(l => (
            l.to === '/' && !l.hash ? (
              <Link
                key="home"
                to="/"
                className={`header-link ${isActive(l) ? 'header-link--active' : ''}`}
                onClick={handleHomeClick}
              >
                {l.label}
              </Link>
            ) : (
              <a
                key={l.hash}
                href={`/pages${l.hash}`}
                className={`header-link ${isActive(l) ? 'header-link--active' : ''}`}
                onClick={(e) => { e.preventDefault(); handleNavClick(l) }}
              >
                {l.label}
              </a>
            )
          ))}
          <Link to="/quote" className="header-cta" onClick={() => setMenuOpen(false)}>
            Get Quote
          </Link>
        </nav>
      </div>
    </header>
  )
}
