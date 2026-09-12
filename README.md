# PG Booking System - New Unified Build

Single Next.js app for Customer + Owner. Designed for Vercel deployment.

## Storage
- Google Sheet: users and structured PG/room/booking/payment data
- Google Drive: PG photos, payment screenshots and refund proof files
- No Supabase required

## Setup
1. Create one Google Sheet and share it with the Google service-account email as Editor.
2. Create one Google Drive folder and share it with the same service-account email as Editor.
3. Copy `.env.example` to `.env.local` and fill all values.
4. Install packages: `npm install`
5. Create required Sheet tabs/headers: `node scripts/setup-sheet.mjs`
6. Create users:
   `node scripts/create-user.mjs customer1 Pass@123 customer "Customer Name" 9876543210`
   `node scripts/create-user.mjs owner1 Pass@123 owner "Owner Name" 9876543211`
7. Run: `npm run dev`

## Vercel
Add the same environment variables in Vercel Project Settings -> Environment Variables and deploy.
