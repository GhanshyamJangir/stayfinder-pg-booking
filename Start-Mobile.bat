@echo off
cd /d "%~dp0"
echo.
echo ================================================
echo   StayFinder - Mobile/LAN Development Server
echo ================================================
echo.
echo PC:    http://localhost:5555
echo Phone: http://172.150.1.165:5555
 echo.
echo Keep this window open while testing on mobile.
echo.
npm run dev -- -H 0.0.0.0 -p 5555
pause
