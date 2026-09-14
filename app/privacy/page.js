export const metadata = {
  title: 'Privacy Policy | StayFinder',
  description: 'StayFinder Privacy Policy',
};

const updated = '12 September 2026';

export default function PrivacyPage() {
  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <a href="/" style={styles.back}>← Back to StayFinder</a>
        <section style={styles.hero}>
          <div style={styles.mark}>PG</div>
          <div>
            <p style={styles.eyebrow}>STAYFINDER</p>
            <h1 style={styles.h1}>Privacy Policy</h1>
            <p style={styles.updated}>Last updated: {updated}</p>
          </div>
        </section>

        <section style={styles.card}>
          <p>
            StayFinder helps guests discover and book PG accommodation and helps hosts manage properties,
            booking requests, payments, stays, support and related services. This Privacy Policy explains what
            information we collect, why we use it, and the choices available to you.
          </p>

          <h2 style={styles.h2}>1. Information we collect</h2>
          <p>Depending on how you use StayFinder, we may collect:</p>
          <ul style={styles.list}>
            <li>Account information such as name, mobile number, email address, username and account role.</li>
            <li>Property information submitted by hosts, including address, location, room details, amenities and photos.</li>
            <li>Booking information such as stay dates, selected room type, booking status and related preferences.</li>
            <li>Payment-related information such as payment amount, transaction reference and payment proof uploaded by users.</li>
            <li>Refund information, including refund status and payment destination details voluntarily provided by a user.</li>
            <li>Verification documents and support information when users choose to submit them.</li>
            <li>Technical information necessary to operate the service, such as session data and basic request logs.</li>
          </ul>

          <h2 style={styles.h2}>2. How we use information</h2>
          <p>We use information to:</p>
          <ul style={styles.list}>
            <li>Create and secure Guest and Host accounts.</li>
            <li>Display property listings and room availability.</li>
            <li>Process booking requests, payment verification, cancellations and refunds.</li>
            <li>Send service emails such as OTPs, booking updates, payment updates and support notifications.</li>
            <li>Prevent duplicate bookings, suspicious activity and misuse of the platform.</li>
            <li>Provide customer support and resolve disputes or reported issues.</li>
            <li>Improve reliability, usability and security of StayFinder.</li>
          </ul>

          <h2 style={styles.h2}>3. Google services</h2>
          <p>
            StayFinder may use Google services such as Google Drive, Google Sheets and Google APIs to store or
            process application data and uploaded files. Access to Google data is limited to what is required to
            provide StayFinder features. We do not sell Google user data.
          </p>

          <h2 style={styles.h2}>4. Sharing of information</h2>
          <p>
            We do not sell personal information. Information may be shared only when needed to operate a booking,
            for example between a Guest and Host after the relevant booking stage, with service providers used to
            operate StayFinder, or when required by law.
          </p>

          <h2 style={styles.h2}>5. Data security</h2>
          <p>
            We use reasonable technical and organizational measures to protect information. Passwords are stored
            as one-way hashes and are not stored as readable plain-text passwords. No internet service can guarantee
            absolute security, so users should also protect their account credentials.
          </p>

          <h2 style={styles.h2}>6. Data retention</h2>
          <p>
            We keep information for as long as reasonably necessary to provide the service, maintain booking and
            payment records, resolve disputes, meet legal obligations and protect the platform from abuse.
          </p>

          <h2 style={styles.h2}>7. Your choices</h2>
          <p>
            Users may update supported profile details within StayFinder. For account, privacy or data-related
            requests, contact us using the details below.
          </p>

          <h2 style={styles.h2}>8. Contact us</h2>
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
