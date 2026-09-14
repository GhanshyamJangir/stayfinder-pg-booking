export const metadata = {
  title: 'Terms of Service | StayFinder',
  description: 'StayFinder Terms of Service',
};

const updated = '12 September 2026';

export default function TermsPage() {
  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <a href="/" style={styles.back}>← Back to StayFinder</a>
        <section style={styles.hero}>
          <div style={styles.mark}>PG</div>
          <div>
            <p style={styles.eyebrow}>STAYFINDER</p>
            <h1 style={styles.h1}>Terms of Service</h1>
            <p style={styles.updated}>Last updated: {updated}</p>
          </div>
        </section>

        <section style={styles.card}>
          <p>
            These Terms of Service govern your use of StayFinder. By creating an account or using the service,
            you agree to these terms. If you do not agree, please do not use StayFinder.
          </p>

          <h2 style={styles.h2}>1. StayFinder platform</h2>
          <p>
            StayFinder is a platform that helps Guests discover PG accommodation and helps Hosts list and manage
            PG properties, booking requests, payments, stays, cancellations, refunds and support interactions.
            Unless explicitly stated otherwise, StayFinder is not the owner of a listed property.
          </p>

          <h2 style={styles.h2}>2. Accounts</h2>
          <ul style={styles.list}>
            <li>You must provide accurate account information.</li>
            <li>You are responsible for protecting your login credentials and account access.</li>
            <li>You must not impersonate another person or create accounts for fraudulent activity.</li>
            <li>StayFinder may suspend or restrict accounts involved in abuse, fraud or policy violations.</li>
          </ul>

          <h2 style={styles.h2}>3. Host responsibilities</h2>
          <ul style={styles.list}>
            <li>Hosts must provide accurate property, room, pricing, availability and contact information.</li>
            <li>Property photos and descriptions must reasonably represent the actual accommodation.</li>
            <li>Hosts are responsible for complying with applicable local laws and accommodation requirements.</li>
            <li>Hosts must honor confirmed bookings or follow the applicable cancellation and refund process.</li>
          </ul>

          <h2 style={styles.h2}>4. Guest responsibilities</h2>
          <ul style={styles.list}>
            <li>Guests must provide accurate booking and payment information.</li>
            <li>Guests must follow reasonable property rules shared by the Host.</li>
            <li>Guests must not submit false payment proofs, fraudulent transaction references or misleading documents.</li>
          </ul>

          <h2 style={styles.h2}>5. Bookings and payments</h2>
          <p>
            Booking requests may require Host approval. Payment status may remain pending until payment proof is
            verified. A booking is considered confirmed only when the status shown in StayFinder indicates that it
            is confirmed. Users should review the amount, stay dates and booking details before making payment.
          </p>

          <h2 style={styles.h2}>6. Cancellations and refunds</h2>
          <p>
            Refund eligibility may depend on the applicable cancellation policy, booking stage and timing of the
            cancellation. StayFinder may display an estimated or policy-based refundable amount. A refund is not
            complete until it is actually sent and, where applicable, acknowledged by the recipient.
          </p>

          <h2 style={styles.h2}>7. Verification and safety</h2>
          <p>
            StayFinder may request identity, property or supporting documents and may apply verification badges,
            risk flags or account restrictions. Verification reduces risk but does not guarantee the conduct of any
            Guest, Host or property.
          </p>

          <h2 style={styles.h2}>8. Prohibited use</h2>
          <p>You may not use StayFinder for fraud, harassment, illegal activity, unauthorized access, false listings, false payment claims or attempts to interfere with the service.</p>

          <h2 style={styles.h2}>9. Availability of the service</h2>
          <p>
            We aim to keep StayFinder reliable, but the service may occasionally be unavailable because of maintenance,
            internet connectivity, third-party APIs or other technical reasons. Features may be improved or updated over time.
          </p>

          <h2 style={styles.h2}>10. Limitation of responsibility</h2>
          <p>
            To the extent permitted by law, StayFinder is not responsible for indirect losses arising from arrangements
            between Guests and Hosts, inaccurate information supplied by users, or events outside the platform's reasonable control.
          </p>

          <h2 style={styles.h2}>11. Changes to these terms</h2>
          <p>
            We may update these Terms when the service changes. The updated date will be shown at the top of this page.
            Continued use after an update means you accept the revised terms.
          </p>

          <h2 style={styles.h2}>12. Contact us</h2>
          <p>
            Email: <a style={styles.link} href="mailto:stayfinderjaipur@gmail.com">stayfinderjaipur@gmail.com</a><br />
            Support mobile / WhatsApp: <a style={styles.link} href="tel:+918529812503">+91 8529812503</a>
          </p>
        </section>
      </div>
    </main>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#f4f8f7', color: '#123c3b', fontFamily: 'Arial, sans-serif', padding: '24px 14px 48px' },
  shell: { width: 'min(920px, 100%)', margin: '0 auto' },
  back: { display: 'inline-block', marginBottom: 16, color: '#2f6966', textDecoration: 'none', fontWeight: 800 },
  hero: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 },
  mark: { width: 54, height: 54, borderRadius: 16, background: '#2f6966', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 20 },
  eyebrow: { margin: 0, fontSize: 11, letterSpacing: 2, fontWeight: 900, color: '#2f6966' },
  h1: { margin: '4px 0 2px', fontSize: 'clamp(30px, 5vw, 44px)', lineHeight: 1.05 },
  updated: { margin: 0, color: '#67807e', fontSize: 13 },
  card: { background: '#fff', border: '1px solid #d8e5e3', borderRadius: 22, padding: 'clamp(20px, 4vw, 36px)', boxShadow: '0 18px 50px rgba(35,80,77,.08)', lineHeight: 1.7, fontSize: 15 },
  h2: { marginTop: 28, marginBottom: 8, fontSize: 21, color: '#153f3d' },
  list: { paddingLeft: 22 },
  link: { color: '#2f6966', fontWeight: 800 },
};
