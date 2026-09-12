PG All Current Errors + Google Sheets Quota Fix

Changed files only:
- app/ui/DashboardShell.js
- lib/refunds.js
- app/api/owner/refunds/route.js
- app/api/customer/refunds/route.js

Fixes:
1. Owner Bookings RuntimeReferenceError: idx is not defined.
2. Refund API 404/500 handling.
3. Google Sheets 429 / RESOURCE_EXHAUSTED caused by repeated Refunds metadata/header calls.
4. Refund sheet is checked/created once per server process, not every refresh.
5. Refund reads use a short cache and stale-safe fallback so Payments/Bookings do not break during temporary quota pressure.
6. Owner dashboard uses Promise.allSettled; refund sync failure no longer blocks core owner data.
7. Customer/owner refund routes remain available.

After copying files:
Ctrl + C
rmdir /s /q .next
npm run dev -- -p 5555

If Google itself has already rate-limited the service account, wait about 30-60 seconds after restart before rapid repeated refreshes.
