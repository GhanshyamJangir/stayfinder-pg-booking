import { NextResponse } from 'next/server';
import { getSheets } from '../../../lib/google';

export async function GET() {
  try {
    const sheets = await getSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Users!A1:H2',
    });

    return NextResponse.json({
      ok: true,
      message: 'Google Sheet connection working.',
      rowsRead: (res.data.values || []).length,
    });
  } catch (error) {
    console.error('HEALTH_ERROR', error);
    return NextResponse.json({
      ok: false,
      message: 'Google Sheet connection failed.',
      error: error?.message || 'Unknown error',
    }, { status: 500 });
  }
}
