StayFinder Admin Mobile View Update

Changed file:
- app/ui/AdminControlCenter.js

What changed (mobile only):
- Admin layout now behaves like the Guest/Host mobile experience.
- Compact sticky top admin header.
- Bottom mobile navigation for Overview, Support, Users, Properties, Bookings, Payments, Reviews, Activity.
- Larger, easier touch targets.
- Overview stats become clean 2-column cards.
- Support tickets stack one-per-row.
- Ticket actions become full-width mobile buttons.
- Tables remain usable with smooth horizontal scrolling instead of breaking the page.
- Header/user/refresh area is compact on phones.
- Logout stays clearly visible at the top.
- Safe-area spacing added for phones with gesture bars/notches.

Desktop admin layout and all existing Admin/Guest/Host processes are unchanged.

After copying the file into the project:
  git add app/ui/AdminControlCenter.js
  git commit -m "Fix StayFinder admin mobile layout"
  git push

Vercel will deploy automatically if GitHub is connected.
