import { getSheets } from './google';
import { listOwnerBookings, listCustomerBookings } from './bookings';
import { listOwnerPayments } from './payments';
import { restoreOneBed } from './rooms';
import { uploadBuffer } from './drive';
import { getCustomerRefundSettings } from './customer-refund-settings';

const SHEET='Refunds';
const HEADERS=['Refund ID','Booking ID','Payment ID','Amount','Reason','Status','Refund Transaction Ref','Refund Proof File ID','Requested At','Sent At','Received At','Customer Note','Refund UPI Name','Refund UPI ID','Refund QR File ID','Refund Bank Name','Refund Account Holder','Refund Account Number','Refund IFSC','Refund Snapshot At'];
const clean=v=>String(v??'').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

let sheetReady=false;
let sheetPromise=null;
let rowsCache={at:0,rows:[]};
const ownerCache=new Map();
const customerCache=new Map();
const CACHE_MS=12000;

function codeOf(e){return Number(e?.code||e?.response?.status||e?.status||0);}
function quotaError(e){return codeOf(e)===429||String(e?.message||'').includes('RESOURCE_EXHAUSTED')||String(e?.message||'').includes('Quota exceeded');}
function missingRange(e){const c=codeOf(e);const m=String(e?.message||'').toLowerCase();return c===400||c===404||m.includes('unable to parse range')||m.includes('not found');}
function friendlyQuota(){const e=new Error('Google Sheets temporary busy hai. 20-30 seconds baad retry karein. Data safe hai.');e.code=429;return e;}
async function qcall(fn){
  try{return await fn();}catch(e){
    if(!quotaError(e))throw e;
    await sleep(900);
    try{return await fn();}catch(e2){if(quotaError(e2))throw friendlyQuota();throw e2;}
  }
}
function clearCaches(){rowsCache={at:0,rows:[]};ownerCache.clear();customerCache.clear();}

async function ensureSheet(){
  if(sheetReady)return getSheets();
  if(sheetPromise)return sheetPromise;
  sheetPromise=(async()=>{
    const s=await getSheets();
    try{
      const h=await qcall(()=>s.spreadsheets.values.get({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!A1:T1`}));
      const row=h.data.values?.[0]||[];
      if(!row.length)await qcall(()=>s.spreadsheets.values.update({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!A1:T1`,valueInputOption:'RAW',requestBody:{values:[HEADERS]}}));
    }catch(e){
      if(!missingRange(e))throw e;
      try{await qcall(()=>s.spreadsheets.batchUpdate({spreadsheetId:process.env.GOOGLE_SHEET_ID,requestBody:{requests:[{addSheet:{properties:{title:SHEET}}}]}}));}catch(addErr){
        if(!String(addErr?.message||'').toLowerCase().includes('already exists'))throw addErr;
      }
      await qcall(()=>s.spreadsheets.values.update({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!A1:T1`,valueInputOption:'RAW',requestBody:{values:[HEADERS]}}));
    }
    sheetReady=true;
    return s;
  })().finally(()=>{sheetPromise=null;});
  return sheetPromise;
}

async function raw(force=false){
  const now=Date.now();
  if(!force&&rowsCache.at&&now-rowsCache.at<CACHE_MS)return rowsCache.rows;
  try{
    const s=await ensureSheet();
    const r=await qcall(()=>s.spreadsheets.values.get({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!A2:T`}));
    const rows=r.data.values||[];rowsCache={at:Date.now(),rows};return rows;
  }catch(e){
    if(quotaError(e)||codeOf(e)===429){if(rowsCache.at)return rowsCache.rows;return [];}
    throw e;
  }
}
function map(r){return{id:r[0],bookingId:r[1],paymentId:r[2],amount:Number(r[3]||0),reason:r[4]||'',status:r[5]||'Pending',transactionRef:r[6]||'',proofFileId:r[7]||'',requestedAt:r[8]||'',sentAt:r[9]||'',receivedAt:r[10]||'',customerNote:r[11]||'',refundDestination:{upiName:r[12]||'',upiId:r[13]||'',qrFileId:r[14]||'',bankName:r[15]||'',accountHolder:r[16]||'',accountNumber:r[17]||'',ifsc:r[18]||'',snapshotAt:r[19]||''}};}

async function setBookingStatusById(bookingId,status){
  const s=await getSheets();
  const r=await qcall(()=>s.spreadsheets.values.get({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:'Bookings!A2:H'}));
  const rows=r.data.values||[];const idx=rows.findIndex(row=>clean(row[0])===clean(bookingId));
  if(idx<0)throw new Error('Booking not found.');
  await qcall(()=>s.spreadsheets.values.update({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`Bookings!H${idx+2}`,valueInputOption:'RAW',requestBody:{values:[[clean(status)]]}}));
  return true;
}

export async function listOwnerRefunds(ownerId){
  const key=clean(ownerId),cached=ownerCache.get(key);if(cached&&Date.now()-cached.at<CACHE_MS)return cached.data;
  try{const ids=new Set((await listOwnerBookings(ownerId)).map(x=>clean(x.id)));const data=(await raw()).map(map).filter(x=>ids.has(clean(x.bookingId))).reverse();ownerCache.set(key,{at:Date.now(),data});return data;}
  catch(e){if(quotaError(e)||codeOf(e)===429)return cached?.data||[];throw e;}
}
export async function listCustomerRefunds(customerId){
  const key=clean(customerId),cached=customerCache.get(key);if(cached&&Date.now()-cached.at<CACHE_MS)return cached.data;
  try{const ids=new Set((await listCustomerBookings(customerId)).map(x=>clean(x.id)));const data=(await raw()).map(map).filter(x=>ids.has(clean(x.bookingId))).reverse();customerCache.set(key,{at:Date.now(),data});return data;}
  catch(e){if(quotaError(e)||codeOf(e)===429)return cached?.data||[];throw e;}
}

export async function initiateOwnerRefund(ownerId,bookingId,reason){
  const bookings=await listOwnerBookings(ownerId);const booking=bookings.find(x=>clean(x.id)===clean(bookingId));
  if(!booking)throw new Error('Booking not found.');if(booking.status!=='Confirmed')throw new Error('Refund sirf confirmed booking ko cancel karne par initiate ho sakta hai.');
  const why=clean(reason);if(!why)throw new Error('Cancellation reason required hai.');
  const existing=(await listOwnerRefunds(ownerId)).find(x=>clean(x.bookingId)===clean(booking.id)&&!['Received','Closed'].includes(x.status));if(existing)throw new Error('Is booking ka refund already process me hai.');
  const payment=(await listOwnerPayments(ownerId)).find(x=>clean(x.bookingId)===clean(booking.id)&&x.status==='Verified');if(!payment)throw new Error('Verified payment nahi mila. Refund start nahi ho sakta.');
  const customerId=booking.customerId||booking.userId||booking.customer?.id||booking.customer?.userId;
  if(!customerId)throw new Error('Booking me customer ID missing hai. Refund destination resolve nahi ho pa rahi.');
  const dest=await getCustomerRefundSettings(customerId);
  if(!dest?.upiId)throw new Error('Customer ne Refund Details add nahi ki hain. Customer ko Profile > Refund Details me UPI add karne ko bolein, phir refund start karein.');
  const snapAt=new Date().toISOString();
  const r={id:`RF-${Date.now().toString(36).toUpperCase()}`,bookingId:booking.id,paymentId:payment.id,amount:Number(payment.amount||booking.amount||0),reason:why,status:'Pending',transactionRef:'',proofFileId:'',requestedAt:snapAt,sentAt:'',receivedAt:'',customerNote:'',refundDestination:{...dest,snapshotAt:snapAt}};
  const s=await ensureSheet();await qcall(()=>s.spreadsheets.values.append({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!A:T`,valueInputOption:'RAW',insertDataOption:'INSERT_ROWS',requestBody:{values:[[r.id,r.bookingId,r.paymentId,r.amount,r.reason,r.status,'','',r.requestedAt,'','','',dest.upiName,dest.upiId,dest.qrFileId,dest.bankName,dest.accountHolder,dest.accountNumber,dest.ifsc,snapAt]]}}));
  await setBookingStatusById(booking.id,'Refund Pending');await restoreOneBed(booking.roomId);clearCaches();return r;
}

export async function submitRefundProof(ownerId,{refundId,transactionRef,file}){
  const rows=await raw(true);const ownerIds=new Set((await listOwnerBookings(ownerId)).map(x=>clean(x.id)));const idx=rows.findIndex(r=>clean(r[0])===clean(refundId)&&ownerIds.has(clean(r[1])));if(idx<0)throw new Error('Refund not found.');
  const current=map(rows[idx]);if(!['Pending','Disputed'].includes(current.status))throw new Error('Refund proof ab submit nahi kiya ja sakta.');
  const ref=clean(transactionRef);if(!/^\d{12}$/.test(ref))throw new Error('Refund transaction reference exactly 12 digit numeric hona chahiye.');if(!file)throw new Error('Refund proof screenshot required hai.');
  const uploaded=await uploadBuffer({buffer:Buffer.from(await file.arrayBuffer()),mimeType:file.type,name:`refund-${current.bookingId}-${Date.now()}-${file.name||'proof'}`,folderName:'Refund Proofs'});
  const now=new Date().toISOString();const s=await ensureSheet();await qcall(()=>s.spreadsheets.values.update({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!F${idx+2}:L${idx+2}`,valueInputOption:'RAW',requestBody:{values:[['Sent',ref,uploaded.id,current.requestedAt,now,'','']]}}));
  await setBookingStatusById(current.bookingId,'Refund Sent');clearCaches();return {...current,status:'Sent',transactionRef:ref,proofFileId:uploaded.id,sentAt:now};
}

export async function customerRefundAction(customerId,refundId,action,note=''){
  const rows=await raw(true);const customerIds=new Set((await listCustomerBookings(customerId)).map(x=>clean(x.id)));const idx=rows.findIndex(r=>clean(r[0])===clean(refundId)&&customerIds.has(clean(r[1])));if(idx<0)throw new Error('Refund not found.');
  const current=map(rows[idx]);if(current.status!=='Sent')throw new Error('Refund abhi customer confirmation ke liye ready nahi hai.');const s=await ensureSheet();
  if(action==='received'){const now=new Date().toISOString();await qcall(()=>s.spreadsheets.values.update({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!F${idx+2}:L${idx+2}`,valueInputOption:'RAW',requestBody:{values:[['Received',current.transactionRef,current.proofFileId,current.requestedAt,current.sentAt,now,'']]}}));await setBookingStatusById(current.bookingId,'Cancelled');clearCaches();return true;}
  if(action==='issue'){const msg=clean(note);if(!msg)throw new Error('Refund issue detail required hai.');await qcall(()=>s.spreadsheets.values.update({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!F${idx+2}:L${idx+2}`,valueInputOption:'RAW',requestBody:{values:[['Disputed',current.transactionRef,current.proofFileId,current.requestedAt,current.sentAt,'',msg]]}}));await setBookingStatusById(current.bookingId,'Refund Pending');clearCaches();return true;}
  throw new Error('Invalid refund action.');
}
