StayFinder Admin Compact Mobile UI

Changed only:
- app/ui/AdminControlCenter.js

What changed only in Admin UI:
- Completely different compact mobile command-center layout.
- No horizontal scrolling on mobile data views: tables become compact cards.
- 8 admin modules visible in a fixed 2-row launcher (4 columns x 2 rows).
- Overview stats are 3 columns to reduce vertical scrolling.
- Support tickets are paginated (4 per page).
- All list/data modules are paginated (6 records per page).
- Payments and refunds are compact stacked panels on mobile.
- Support interactions are collapsed by default in a details panel.
- Desktop admin sidebar remains intact and polished.
- Existing APIs, booking/payment/refund process and Guest/Host UI are unchanged.

Deploy:
git add app/ui/AdminControlCenter.js
git commit -m "Redesign compact admin mobile command center"
git push
