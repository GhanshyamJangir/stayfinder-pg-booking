Fixes Owner Command Center invalid JSON error on Check-in/out.

Changed files:
- app/ui/StayFinderPlus.js
- app/api/plus/stay/route.js

The UI now checks content-type before parsing JSON, so an HTML 404/error page can no longer become the raw "Unexpected token <" message.
The missing/required check-in/out API route is included so OTP/check-in/check-out actions have a real JSON backend.
