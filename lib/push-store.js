import crypto from 'node:crypto';
import { getSheets } from './google';

const SHEET='PushSubscriptions';
const HEADERS=['id','user_id','endpoint','p256dh','auth','active','created_at','updated_at'];
const clean=v=>String(v??'').trim();
const sid=()=>process.env.GOOGLE_SHEET_ID;
const idFor=endpoint=>`PS-${crypto.createHash('sha256').update(String(endpoint)).digest('hex').slice(0,20)}`;
let ensured=false;

async function ensureSheet(){
  const sheets=await getSheets();
  if(!ensured){
    const meta=await sheets.spreadsheets.get({spreadsheetId:sid(),fields:'sheets.properties.title'});
    const exists=(meta.data.sheets||[]).some(x=>x.properties?.title===SHEET);
    if(!exists){
      await sheets.spreadsheets.batchUpdate({spreadsheetId:sid(),requestBody:{requests:[{addSheet:{properties:{title:SHEET}}}]}});
      await sheets.spreadsheets.values.update({spreadsheetId:sid(),range:`${SHEET}!A1:H1`,valueInputOption:'RAW',requestBody:{values:[HEADERS]}});
    }
    ensured=true;
  }
  return sheets;
}

export async function savePushSubscription(userId,subscription){
  const endpoint=clean(subscription?.endpoint),p256dh=clean(subscription?.keys?.p256dh),auth=clean(subscription?.keys?.auth);
  if(!endpoint||!p256dh||!auth)throw new Error('Invalid push subscription.');
  const sheets=await ensureSheet();
  const r=await sheets.spreadsheets.values.get({spreadsheetId:sid(),range:`${SHEET}!A2:H`});
  const rows=r.data.values||[]; const id=idFor(endpoint); const idx=rows.findIndex(x=>clean(x[0])===id);
  const now=new Date().toISOString();
  const row=[id,clean(userId),endpoint,p256dh,auth,'Active',idx>=0?(rows[idx][6]||now):now,now];
  if(idx>=0){
    await sheets.spreadsheets.values.update({spreadsheetId:sid(),range:`${SHEET}!A${idx+2}:H${idx+2}`,valueInputOption:'RAW',requestBody:{values:[row]}});
  }else{
    await sheets.spreadsheets.values.append({spreadsheetId:sid(),range:`${SHEET}!A:H`,valueInputOption:'RAW',insertDataOption:'INSERT_ROWS',requestBody:{values:[row]}});
  }
  return {id,endpoint};
}

export async function listUserPushSubscriptions(userId){
  const sheets=await ensureSheet();
  const r=await sheets.spreadsheets.values.get({spreadsheetId:sid(),range:`${SHEET}!A2:H`});
  return (r.data.values||[]).filter(x=>clean(x[1])===clean(userId)&&clean(x[5])!=='Inactive').map(x=>({id:x[0],userId:x[1],endpoint:x[2],keys:{p256dh:x[3],auth:x[4]}}));
}

export async function deactivatePushSubscription(id){
  const sheets=await ensureSheet();
  const r=await sheets.spreadsheets.values.get({spreadsheetId:sid(),range:`${SHEET}!A2:H`});
  const rows=r.data.values||[]; const idx=rows.findIndex(x=>clean(x[0])===clean(id)); if(idx<0)return;
  const row=[...rows[idx]]; while(row.length<8)row.push(''); row[5]='Inactive';row[7]=new Date().toISOString();
  await sheets.spreadsheets.values.update({spreadsheetId:sid(),range:`${SHEET}!A${idx+2}:H${idx+2}`,valueInputOption:'RAW',requestBody:{values:[row]}});
}
