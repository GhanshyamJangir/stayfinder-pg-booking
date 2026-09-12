import 'dotenv/config';
import { google } from 'googleapis';

const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const auth = new google.auth.JWT({ email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const sheets = google.sheets({ version: 'v4', auth });
const spreadsheetId = process.env.GOOGLE_SHEET_ID;
const meta = await sheets.spreadsheets.get({ spreadsheetId });
const existing = new Set((meta.data.sheets || []).map(s => s.properties.title));
const defs = {
  Users: ['id','username','password_hash','role','name','phone','active','created_at'],
  PGs: ['id','owner_id','name','address','city','description','status','created_at'],
  Rooms: ['id','pg_id','room_type','total_beds','available_beds','rent','deposit','status'],
  Bookings: ['id','customer_id','pg_id','room_id','status','start_date','end_date','amount','created_at'],
  Payments: ['id','booking_id','customer_id','amount','drive_file_id','drive_url','status','created_at'],
  OwnerProfiles: ['owner_id','upi_id','bank_name','account_name','account_no','ifsc','updated_at']
};
const requests = Object.keys(defs).filter(n => !existing.has(n)).map(title => ({ addSheet: { properties: { title } } }));
if (requests.length) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
for (const [name, headers] of Object.entries(defs)) {
  await sheets.spreadsheets.values.update({ spreadsheetId, range: `${name}!A1:${String.fromCharCode(64 + headers.length)}1`, valueInputOption: 'RAW', requestBody: { values: [headers] } });
}
console.log('Google Sheet structure ready.');
