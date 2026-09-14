STAYFINDER - WHATSAPP STYLE PUSH NOTIFICATIONS

What this update adds
- Android / installed PWA notifications even when StayFinder is closed.
- Notification tap opens StayFinder.
- Push is event-driven; there is NO polling, so Google Sheets read quota is not continuously consumed.
- Existing PWA service worker is NOT replaced. Push uses its own /push/ service-worker scope.
- Notifications included now:
  * New booking -> Owner
  * Booking accepted/rejected -> Customer
  * Payment submitted -> Owner
  * Payment verified/rejected -> Customer
  * Cancellation/refund started -> Customer
  * Refund marked sent -> Customer
  * Customer refund receipt/issue update -> Owner

ONE-TIME SETUP

1) Copy all files from this ZIP into PG Booking New.

2) Install dependency:
   npm install web-push

3) Generate VAPID keys:
   npx web-push generate-vapid-keys

You will get Public Key and Private Key. Do not share the PRIVATE key.

4) Add these to Vercel -> Environment Variables -> Production:
   VAPID_PUBLIC_KEY=<Public Key>
   VAPID_PRIVATE_KEY=<Private Key>
   VAPID_SUBJECT=mailto:stayfinderjaipur@gmail.com

5) Commit and push:
   git add app/ui/DashboardShell.js app/ui/PushNotifications.js app/api/push public/push-sw.js lib/push.js lib/push-store.js package.json package-lock.json
   git commit -m "Add StayFinder push notifications"
   git push

6) Wait for Vercel Ready.

7) On each Owner/Customer phone:
   - Open installed StayFinder app.
   - Tap "Enable alerts" once.
   - Tap Allow on Android notification permission.
   - A test notification "StayFinder alerts are on" should arrive.

Google Sheet
- The code automatically creates a PushSubscriptions tab the first time a user enables alerts.
- No manual sheet creation is needed.

IMPORTANT
- HTTPS is required; your Vercel domain already provides this.
- Android Chrome/PWA supports Web Push.
- On iPhone/iPad, install the site to Home Screen first, then allow notifications.
- If a user blocks notification permission at OS/browser level, StayFinder cannot bypass that block; it must be re-enabled from phone/browser settings.
