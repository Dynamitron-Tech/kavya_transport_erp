import PageLayout from '../components/PageLayout'

export default function Privacy() {
  return (
    <PageLayout>
      <section className="page-hero page-hero--legal">
        <div className="page-hero-overlay" />
        <div className="page-hero-content">
          <span className="page-label">Legal</span>
          <h1>Privacy Policy</h1>
          <p>Last updated: January 2025</p>
        </div>
      </section>

      <section className="section">
        <div className="container legal-content">
          <h2>1. Information We Collect</h2>
          <p>We collect personal information that you voluntarily provide when you use our services, including:</p>
          <ul>
            <li>Name and contact information (email, phone, address)</li>
            <li>Business details and shipping requirements</li>
            <li>Payment and billing information</li>
            <li>Communication records and correspondence</li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <p>Your information is used to:</p>
          <ul>
            <li>Provide and manage transportation and logistics services</li>
            <li>Process bookings, shipments, and payments</li>
            <li>Communicate about your shipments and service updates</li>
            <li>Improve our services and customer experience</li>
            <li>Comply with legal and regulatory requirements</li>
          </ul>

          <h2>3. Information Sharing</h2>
          <p>We do not sell your personal information. We may share information with:</p>
          <ul>
            <li>Service partners and subcontractors for shipment fulfillment</li>
            <li>Insurance providers for cargo coverage</li>
            <li>Government authorities as required by law</li>
          </ul>

          <h2>4. Data Security</h2>
          <p>We implement industry-standard security measures to protect your personal information from unauthorized access, alteration, or disclosure.</p>

          <h2>5. Your Rights</h2>
          <p>You have the right to access, correct, or delete your personal information. Contact us at the details below to exercise these rights.</p>

          <h2>6. Cookies</h2>
          <p>Our website uses cookies to enhance your browsing experience. You can control cookie settings through your browser preferences.</p>

          <h2>7. Contact Us</h2>
          <div className="legal-contact-box">
            <p><strong>Kavya Transports</strong></p>
            <p>Door No.5/71C, Jyothivinayakar Temple Street, Rediyarpatti, Tirunelveli – 627007</p>
            <p>Phone: +91 90472 44000</p>
            <p>Email: info@kavyatransports.com</p>
          </div>
        </div>
      </section>
    </PageLayout>
  )
}
