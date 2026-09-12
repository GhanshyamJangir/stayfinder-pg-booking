import { getSheets } from './google';
import { uploadBuffer } from './drive';
import { listCustomerBookings } from './bookings';

const SHEET = 'OwnerPaymentSettings';
const HEADERS = ['Owner ID','UPI Name','UPI ID','QR File ID','Bank Name','Account Holder','Account Number','IFSC','Payment Note','Updated At'];
const clean = (v) => String(v ?? '').trim();

async function ensureSheet() {
  const sheets = await getSheets();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, fields: 'sheets.properties' });
  const exists = (meta.data.sheets || []).some(s => s.properties?.title === SHEET);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: SHEET } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${SHEET}!A1:J1`,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS] },
    });
  }
  return sheets;
}

function map(r=[]) {
  return {
    ownerId: clean(r[0]), upiName: clean(r[1]), upiId: clean(r[2]), qrFileId: clean(r[3]),
    bankName: clean(r[4]), accountHolder: clean(r[5]), accountNumber: clean(r[6]), ifsc: clean(r[7]),
    note: clean(r[8]), updatedAt: clean(r[9]),
  };
}

async function rows() {
  const sheets = await ensureSheet();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `${SHEET}!A2:J` });
  return res.data.values || [];
}

export async function getOwnerPaymentSettings(ownerId) {
  const id = clean(ownerId);
  const row = (await rows()).find(r => clean(r[0]) === id);
  return row ? map(row) : null;
}

export async function saveOwnerPaymentSettings(ownerId, data, qrFile) {
  const id = clean(ownerId);
  const existing = await getOwnerPaymentSettings(id);
  const upiName = clean(data.upiName), upiId = clean(data.upiId);
  if (!upiName || !upiId) throw new Error('UPI name aur UPI ID required hain.');
  let qrFileId = existing?.qrFileId || '';
  if (qrFile) {
    if (!String(qrFile.type || '').startsWith('image/')) throw new Error('QR code image file honi chahiye.');
    if (Number(qrFile.size || 0) > 8 * 1024 * 1024) throw new Error('QR image maximum 8 MB ho sakti hai.');
    const uploaded = await uploadBuffer({
      buffer: Buffer.from(await qrFile.arrayBuffer()), mimeType: qrFile.type,
      name: `owner-${id}-qr-${Date.now()}-${qrFile.name || 'qr'}`, folderName: 'Owner Documents',
    });
    qrFileId = uploaded.id;
  }
  if (!qrFileId) throw new Error('QR code image required hai.');
  const record = {
    ownerId:id, upiName, upiId, qrFileId,
    bankName:clean(data.bankName), accountHolder:clean(data.accountHolder), accountNumber:clean(data.accountNumber),
    ifsc:clean(data.ifsc).toUpperCase(), note:clean(data.note), updatedAt:new Date().toISOString(),
  };
  const all = await rows();
  const idx = all.findIndex(r => clean(r[0]) === id);
  const values = [[record.ownerId,record.upiName,record.upiId,record.qrFileId,record.bankName,record.accountHolder,record.accountNumber,record.ifsc,record.note,record.updatedAt]];
  const sheets = await ensureSheet();
  if (idx >= 0) {
    await sheets.spreadsheets.values.update({ spreadsheetId:process.env.GOOGLE_SHEET_ID, range:`${SHEET}!A${idx+2}:J${idx+2}`, valueInputOption:'RAW', requestBody:{values} });
  } else {
    await sheets.spreadsheets.values.append({ spreadsheetId:process.env.GOOGLE_SHEET_ID, range:`${SHEET}!A:J`, valueInputOption:'RAW', insertDataOption:'INSERT_ROWS', requestBody:{values} });
  }
  return record;
}

export async function getCustomerBookingPaymentSettings(customerId, bookingId) {
  const booking = (await listCustomerBookings(customerId)).find(b => clean(b.id) === clean(bookingId));
  if (!booking) throw new Error('Booking not found.');
  const settings = booking.pg?.ownerId ? await getOwnerPaymentSettings(booking.pg.ownerId) : null;
  return { booking, settings };
}
