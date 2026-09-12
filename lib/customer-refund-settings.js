import { getSheets } from './google';
import { uploadBuffer } from './drive';

const SHEET='CustomerRefundSettings';
const HEADERS=['Customer ID','UPI Name','UPI ID','QR File ID','Bank Name','Account Holder','Account Number','IFSC','Updated At'];
const clean=v=>String(v??'').trim();
let ready=false;
let readyPromise=null;
const cache=new Map();
const CACHE_MS=15000;

function codeOf(e){return Number(e?.code||e?.response?.status||e?.status||0);}
function missingRange(e){const m=String(e?.message||'').toLowerCase();return [400,404].includes(codeOf(e))||m.includes('unable to parse range')||m.includes('not found');}
async function ensureSheet(){
  if(ready)return getSheets();
  if(readyPromise)return readyPromise;
  readyPromise=(async()=>{
    const s=await getSheets();
    try{
      const r=await s.spreadsheets.values.get({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!A1:I1`});
      if(!(r.data.values?.[0]||[]).length)await s.spreadsheets.values.update({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!A1:I1`,valueInputOption:'RAW',requestBody:{values:[HEADERS]}});
    }catch(e){
      if(!missingRange(e))throw e;
      try{await s.spreadsheets.batchUpdate({spreadsheetId:process.env.GOOGLE_SHEET_ID,requestBody:{requests:[{addSheet:{properties:{title:SHEET}}}]}});}catch(addErr){if(!String(addErr?.message||'').toLowerCase().includes('already exists'))throw addErr;}
      await s.spreadsheets.values.update({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!A1:I1`,valueInputOption:'RAW',requestBody:{values:[HEADERS]}});
    }
    ready=true;return s;
  })().finally(()=>{readyPromise=null;});
  return readyPromise;
}
function map(r){return {customerId:r[0]||'',upiName:r[1]||'',upiId:r[2]||'',qrFileId:r[3]||'',bankName:r[4]||'',accountHolder:r[5]||'',accountNumber:r[6]||'',ifsc:r[7]||'',updatedAt:r[8]||''};}
export async function getCustomerRefundSettings(customerId){
  const id=clean(customerId);const c=cache.get(id);if(c&&Date.now()-c.at<CACHE_MS)return c.data;
  const s=await ensureSheet();const r=await s.spreadsheets.values.get({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!A2:I`});
  const row=(r.data.values||[]).find(x=>clean(x[0])===id);const data=row?map(row):null;cache.set(id,{at:Date.now(),data});return data;
}
export async function saveCustomerRefundSettings(customerId,{upiName,upiId,bankName,accountHolder,accountNumber,ifsc,qr}){
  const id=clean(customerId),name=clean(upiName),upi=clean(upiId);
  if(!name)throw new Error('Refund UPI display name required hai.');
  if(!upi||!upi.includes('@'))throw new Error('Valid refund UPI ID required hai.');
  const current=await getCustomerRefundSettings(id);
  let qrFileId=current?.qrFileId||'';
  if(qr&&typeof qr.arrayBuffer==='function'){
    const uploaded=await uploadBuffer({buffer:Buffer.from(await qr.arrayBuffer()),mimeType:qr.type,name:`refund-qr-${id}-${Date.now()}-${qr.name||'qr'}`,folderName:'Customer Refund QR'});
    qrFileId=uploaded.id;
  }
  const s=await ensureSheet();const r=await s.spreadsheets.values.get({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!A2:I`});
  const rows=r.data.values||[];const idx=rows.findIndex(x=>clean(x[0])===id);const now=new Date().toISOString();
  const values=[[id,name,upi,qrFileId,clean(bankName),clean(accountHolder),clean(accountNumber),clean(ifsc).toUpperCase(),now]];
  if(idx>=0)await s.spreadsheets.values.update({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!A${idx+2}:I${idx+2}`,valueInputOption:'RAW',requestBody:{values}});
  else await s.spreadsheets.values.append({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!A:I`,valueInputOption:'RAW',insertDataOption:'INSERT_ROWS',requestBody:{values}});
  const data=map(values[0]);cache.set(id,{at:Date.now(),data});return data;
}
