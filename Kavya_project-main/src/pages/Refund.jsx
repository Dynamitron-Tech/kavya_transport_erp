import PageLayout from '../components/PageLayout'

export default function Refund() {
  return (
    <PageLayout>
      <section className="page-hero page-hero--legal">
        <div className="page-hero-overlay" />
        <div className="page-hero-content">
          <span className="page-label">Legal</span>
          <h1>Refund Policy</h1>
          <p>Last updated: January 2025</p>
        </div>
      </section>

      <section className="section">
        <div className="container legal-content">
          <h2>1. Overview</h2>
          <p>Kavya Transports is committed to customer satisfaction. This policy outlines the conditions and process for refunds related to our transportation and logistics services.</p>

          <h2>2. Eligibility for Refund</h2>
          <ul>
            <li>Service not rendered as per the agreed terms</li>
            <li>Significant delay beyond the committed timeline (subject to terms)</li>
            <li>Duplicate payment or overcharge</li>
            <li>Cancellation within the permitted window</li>
          </ul>

          <h2>3. Non-Refundable Cases</h2>
          <ul>
            <li>Services already completed and delivered</li>
            <li>Delays due to force majeure (natural disasters, strikes, etc.)</li>
            <li>Cancellation after the permitted window</li>
            <li>Issues arising from incorrect information provided by the client</li>
          </ul>

          <h2>4. How to Request a Refund</h2>
          <ol>
            <li>Contact our support at +91 90472 44000 or email info@kavyatransports.com</li>
            <li>Provide your booking reference and reason for refund</li>
            <li>Submit any supporting documentation</li>
            <li>Our team will review and respond within 5-7 business days</li>
          </ol>

          <h2>5. Refund Processing</h2>
          <ul>
            <li>Approved refunds are processed within 10-15 business days</li>
            <li>Refunds are issued to the original payment method</li>
            <li>Partial refunds may apply depending on the service utilized</li>
          </ul>

          <h2>6. Disputes</h2>
          <p>If you disagree with a refund decision, you may escalate the matter by writing to our management. All disputes will be resolved as per the jurisdiction of Tirunelveli, Tamil Nadu.</p>

          <h2>7. Contact</h2>
          <div className="legal-contact-box">
            <p><strong>Kavya Transports — Refunds Department</strong></p>
            <p>Door No.5/71C, Jyothivinayakar Temple Street, Rediyarpatti, Tirunelveli – 627007</p>
            <p>Phone: +91 90472 44000</p>
            <p>Email: info@kavyatransports.com</p>
            <p>Working Hours: Monday – Saturday, 9 AM – 7 PM</p>
          </div>
        </div>
      </section>
    </PageLayout>
  )
}
