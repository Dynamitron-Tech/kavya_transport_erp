import PageLayout from '../components/PageLayout'

export default function Terms() {
  return (
    <PageLayout>
      <section className="page-hero page-hero--legal">
        <div className="page-hero-overlay" />
        <div className="page-hero-content">
          <span className="page-label">Legal</span>
          <h1>Terms of Service</h1>
          <p>Last updated: January 2025</p>
        </div>
      </section>

      <section className="section">
        <div className="container legal-content">
          <h2>1. Acceptance of Terms</h2>
          <p>By using Kavya Transports' services, you agree to these terms and conditions. Please read them carefully before engaging our logistics services.</p>

          <h2>2. Services</h2>
          <p>Kavya Transports provides road transportation, air & sea cargo, warehousing, 3PL solutions, and manpower services. Service availability may vary by location.</p>

          <h2>3. Booking & Payments</h2>
          <ul>
            <li>Bookings are confirmed upon acceptance of the quote and terms</li>
            <li>Payment terms are as agreed in individual service contracts</li>
            <li>Prices are subject to fuel surcharges and applicable taxes</li>
          </ul>

          <h2>4. Liability</h2>
          <p>Kavya Transports' liability for cargo is governed by the Carriage by Road Act and applicable transport regulations. We recommend cargo insurance for all shipments.</p>

          <h2>5. Cargo Restrictions</h2>
          <p>We reserve the right to refuse transportation of hazardous, illegal, or improperly packed goods. Clients must declare the nature and value of goods accurately.</p>

          <h2>6. Transit Times</h2>
          <p>Estimated transit times are provided in good faith. Actual delivery times may vary due to weather, road conditions, or regulatory requirements.</p>

          <h2>7. Claims</h2>
          <ul>
            <li>Damage claims must be reported within 24 hours of delivery</li>
            <li>Written claims with supporting documentation required within 7 days</li>
            <li>Claims are processed as per our claim settlement policy</li>
          </ul>

          <h2>8. Cancellation</h2>
          <p>Cancellation terms are as specified in individual service agreements. Standard cancellation charges may apply.</p>

          <h2>9. Contact</h2>
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
