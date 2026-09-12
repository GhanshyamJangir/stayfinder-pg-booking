import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { google } from 'googleapis';
import crypto from 'node:crypto';

dotenv.config({ path: '.env.local' });
dotenv.config();

const [username, password, roleInput, name = '', mobile = ''] = process.argv.slice(2);
const role = String(roleInput || '').trim().toLowerCase();

if (!username || !password || !['customer', 'owner'].includes(role)) {
  console.log('Usage: npm run user:create -- <username> <password> <customer|owner> [name] [mobile]');
  process.exit(1);
}

const email = process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const spreadsheetId = process.env.GOOGLE_SHEET_ID;

if (!email || !key || !spreadsheetId) {
  console.error('Missing GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY or GOOGLE_SHEET_ID in .env.local');
  process.exit(1);
}

const auth = new google.auth.JWT({
  email,
  key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

const values = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Users!A2:H' });
const rows = values.data.values || [];
const usernameLower = username.trim().toLowerCase();

// Username is column D (index 3)
if (rows.some(r => String(r[3] || '').trim().toLowerCase() === usernameLower)) {
  console.error('Username already exists.');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
const userId = `USR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

await sheets.spreadsheets.values.append({
  spreadsheetId,
  range: 'Users!A:H',
  valueInputOption: 'RAW',
  insertDataOption: 'INSERT_ROWS',
  requestBody: {
    values: [[
      userId,
      name,
      mobile,
      username,
      hash,
      role,
      'Active',
      new Date().toISOString(),
    ]],
  },
});

console.log('User created successfully.');
console.log(`User ID : ${userId}`);
console.log(`Username: ${username}`);
console.log(`Role    : ${role}`);
