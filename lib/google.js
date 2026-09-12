import { google } from 'googleapis';

function privateKey() {
  return (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
}

export function getGoogleAuth(scopes = []) {
  const email = process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  if (!email) throw new Error('GOOGLE_CLIENT_EMAIL is missing');
  if (!process.env.GOOGLE_PRIVATE_KEY) throw new Error('GOOGLE_PRIVATE_KEY is missing');

  return new google.auth.JWT({
    email,
    key: privateKey(),
    scopes,
  });
}

export async function getSheets() {
  // Google Sheet access stays on the existing service account.
  const auth = getGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);
  return google.sheets({ version: 'v4', auth });
}

function getDriveOAuthAuth() {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI || 'http://localhost:5556/oauth2callback';

  if (!clientId) throw new Error('GOOGLE_DRIVE_CLIENT_ID is missing');
  if (!clientSecret) throw new Error('GOOGLE_DRIVE_CLIENT_SECRET is missing');
  if (!refreshToken) throw new Error('GOOGLE_DRIVE_REFRESH_TOKEN is missing');

  const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  auth.setCredentials({ refresh_token: refreshToken });
  return auth;
}

export async function getDrive() {
  // File uploads must run as the real Google account so they use that account's
  // My Drive storage quota. Service accounts have no personal My Drive quota.
  const auth = getDriveOAuthAuth();
  return google.drive({ version: 'v3', auth });
}
