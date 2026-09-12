import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { google } from 'googleapis';

dotenv.config({ path: '.env.local' });
dotenv.config();

const [username,password,name='StayFinder Admin',mobile='9999999999',adminEmail='admin@stayfinder.local']=process.argv.slice(2);
if(!username||!password){console.log('Usage: npm run admin:create -- <username> <password> [name] [mobile] [email]');process.exit(1)}
const key=(process.env.GOOGLE_PRIVATE_KEY||'').replace(/\\n/g,'\n');
const serviceEmail=process.env.GOOGLE_CLIENT_EMAIL||process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const spreadsheetId=process.env.GOOGLE_SHEET_ID;
if(!serviceEmail||!key||!spreadsheetId){console.error('Missing GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY or GOOGLE_SHEET_ID in .env.local');process.exit(1)}
const auth=new google.auth.JWT({email:serviceEmail,key,scopes:['https://www.googleapis.com/auth/spreadsheets']});
const sheets=google.sheets({version:'v4',auth});
const rows=(await sheets.spreadsheets.values.get({spreadsheetId,range:'Users!A2:I'})).data.values||[];
if(rows.some(r=>String(r[3]||'').trim().toLowerCase()===username.trim().toLowerCase())){console.error('Username already exists.');process.exit(2)}
const hash=await bcrypt.hash(password,12);const id=`ADM-${Date.now().toString(36).toUpperCase()}`;
await sheets.spreadsheets.values.append({spreadsheetId,range:'Users!A:I',valueInputOption:'RAW',insertDataOption:'INSERT_ROWS',requestBody:{values:[[id,name,String(mobile).replace(/\D/g,''),username.toLowerCase(),hash,'admin','Active',new Date().toISOString(),adminEmail]]}});
console.log('Admin created successfully.');
console.log(`Username: ${username}`);
console.log('Login at the normal StayFinder login page; admin is routed to /admin automatically.');
