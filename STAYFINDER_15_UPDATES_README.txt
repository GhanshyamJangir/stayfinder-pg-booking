STAYFINDER - 15 UPDATES + ADMIN SUPPORT CENTER
================================================

IMPORTANT
- Existing Guest -> booking request -> Host approval -> payment -> verification -> contact/refund workflow is preserved.
- WATI integration is NOT included in this update. WhatsApp opens the normal WhatsApp app/web and logs that the user initiated support.
- No new npm dependency was added.

WHAT WAS ADDED
1. Stay Assistant / Host Tools floating panel.
2. Notification / Updates center based on current booking state.
3. Visual booking journey timeline: Requested -> Accepted -> Confirmed.
4. Refund/cancellation status stays visible alongside the journey.
5. Support ticket system with automatic SUP-* ticket IDs.
6. Support Interaction logging for Call / WhatsApp / Email clicks.
7. Admin Support Inbox with Open / In Progress / Waiting for User / Resolved states.
8. Guest review & rating system after a Confirmed booking.
9. Guest <-> Host booking chat for Accepted / Confirmed / refund-related active bookings.
10. Host Availability Calendar + upcoming check-ins.
11. First-time onboarding / setup progress for Guest and Host.
12. Admin Control Center: users, properties, bookings, payments, refunds, reviews, support, activity.
13. Verification/trust language and existing verified listing experience retained.
14. PWA offline fallback screen + updated service-worker cache version.
15. Data layer for the new modules is isolated in lib/plus-store.js, so future migration from Google Sheets to a database is easier.

NEW GOOGLE SHEET TABS
The following tabs are created AUTOMATICALLY the first time a new feature is used:
- SupportTickets
- SupportInteractions
- Reviews
- Messages
- AdminAudit
You do NOT need to manually create them.

ADMIN ACCOUNT - ONE TIME
Use your normal project folder CMD/Terminal. Your working .env.local must contain the existing GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY and GOOGLE_SHEET_ID.

Example:
  npm run admin:create -- admin1 StrongAdminPassword "StayFinder Admin" 8529812503 admin@example.com

Then login from the normal StayFinder login page. Admin is automatically routed to:
  /admin

DEPLOY TO GITHUB / VERCEL
After replacing the files from this ZIP:

  git add app lib public scripts package.json STAYFINDER_15_UPDATES_README.txt
  git commit -m "Add StayFinder admin support reviews chat calendar and PWA upgrades"
  git push

Vercel will redeploy automatically if the GitHub project is connected.

SUPPORT BEHAVIOUR WITHOUT WATI
- Raise Ticket: complete issue is saved and visible in Admin > Support Inbox.
- Call Support: opens phone dialer and creates an interaction log first.
- WhatsApp Support: opens WhatsApp to 8529812503 with ticket/booking context when available, and creates an interaction log first.
- Email Support: opens email compose to Ghanshyamjangir334@gmail.com and creates an interaction log first.
- The system cannot read the actual WhatsApp conversation or actual call duration without a future WhatsApp Business/WATI/telephony integration.

VALIDATION PERFORMED
- JSX/JavaScript parser validation completed successfully using TypeScript parser.
- Server-side JavaScript syntax checks completed successfully.
- Existing project process files were not rewritten; the new modules were added around the current workflow.
