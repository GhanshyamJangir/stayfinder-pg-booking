import 'dotenv/config';
import fs from 'node:fs';
import http from 'node:http';
import crypto from 'node:crypto';
import { exec } from 'node:child_process';
import { google } from 'googleapis';

// Load .env.local as well as .env because Next projects usually keep secrets there.
try {
  const dotenv = await import('dotenv');
  if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local', override: false });
  if (fs.existsSync('.env')) dotenv.config({ path: '.env', override: false });
} catch {}

const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI || 'http://localhost:5556/oauth2callback';

if (!clientId || !clientSecret) {
  console.error('\nMissing GOOGLE_DRIVE_CLIENT_ID or GOOGLE_DRIVE_CLIENT_SECRET in .env.local\n');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
const state = crypto.randomBytes(18).toString('hex');
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/drive'],
  state,
});

const callbackUrl = new URL(redirectUri);
const port = Number(callbackUrl.port || 5556);
const callbackPath = callbackUrl.pathname || '/oauth2callback';

const server = http.createServer(async (req, res) => {
  try {
    const incoming = new URL(req.url, `http://localhost:${port}`);
    if (incoming.pathname !== callbackPath) {
      res.writeHead(404).end('Not found');
      return;
    }
    if (incoming.searchParams.get('state') !== state) {
      res.writeHead(400).end('Invalid state');
      return;
    }
    const code = incoming.searchParams.get('code');
    if (!code) {
      res.writeHead(400).end('Authorization code missing');
      return;
    }
    const { tokens } = await oauth2Client.getToken(code);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h2>Google Drive connected.</h2><p>You can close this tab and return to CMD.</p>');

    console.log('\nSUCCESS - copy this line into .env.local:\n');
    console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token || ''}`);
    console.log('\nKeep this token private. Do not upload .env.local to GitHub.\n');
    server.close(() => process.exit(0));
  } catch (error) {
    console.error('\nOAuth error:', error?.message || error);
    try { res.writeHead(500).end('OAuth failed. Check CMD.'); } catch {}
    server.close(() => process.exit(1));
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log('\nOpening Google authorization in your browser...\n');
  console.log(authUrl, '\n');
  if (process.platform === 'win32') exec(`start "" "${authUrl.replace(/&/g, '^&')}"`);
});
