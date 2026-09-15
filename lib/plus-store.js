import { getSheets } from './google';

const sid=()=>process.env.GOOGLE_SHEET_ID;
const esc=s=>String(s??'').trim();

export const PLUS_SHEETS={
  SupportTickets:['id','user_id','role','booking_id','pg_id','category','subject','message','priority','status','created_at','updated_at','admin_note'],
  SupportInteractions:['id','ticket_id','user_id','role','channel','target','created_at'],
  Reviews:['id','booking_id','pg_id','customer_id','rating','cleanliness','food','location','host_behaviour','value_for_money','comment','status','created_at'],
  Messages:['id','booking_id','sender_id','sender_role','message','created_at','attachment_id','attachment_name','attachment_type','delivered_at','read_at'],
  AdminAudit:['id','admin_id','action','entity_type','entity_id','details','created_at'],
  PasswordResetOTPs:['id','user_id','email','otp_hash','otp_expires_at','verified_at','reset_token_hash','reset_expires_at','used_at','attempts','created_at'],
  PropertyModeration:['pg_id','status','note','updated_at','reviewed_by'],
  UserVerification:['id','user_id','role','doc_type','file_id','file_name','status','note','created_at','updated_at','reviewed_by'],
  RiskFlags:['id','entity_type','entity_id','level','reason','status','created_at','resolved_at','resolved_by'],
  StayLifecycle:['booking_id','checkin_otp_hash','checkin_otp_expires','checkin_verified_at','checkout_requested_at','checkout_verified_at','status','updated_at','checkin_qr_hash','checkin_qr_expires'],
  InventoryLocks:['id','booking_id','room_id','check_in','check_out','status','created_at','released_at'],
  CancellationPolicies:['id','scope_type','scope_id','name','cutoff_days','refund_percent','status','created_at','updated_at','updated_by']
};

function col(n){let s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;}

let ensurePromise=null;
export async function ensurePlusSheets(){
  if(ensurePromise)return ensurePromise;
  ensurePromise=(async()=>{
  const sheets=await getSheets();
  const meta=await sheets.spreadsheets.get({spreadsheetId:sid(),fields:'sheets.properties.title'});
  const existing=new Set((meta.data.sheets||[]).map(x=>x.properties?.title));
  const missing=Object.keys(PLUS_SHEETS).filter(x=>!existing.has(x));
  const requests=missing.map(title=>({addSheet:{properties:{title}}}));
  if(requests.length){
    await sheets.spreadsheets.batchUpdate({spreadsheetId:sid(),requestBody:{requests}});
    const data=missing.map(name=>{const headers=PLUS_SHEETS[name];return {range:`${name}!A1:${col(headers.length)}1`,values:[headers]};});
    await sheets.spreadsheets.values.batchUpdate({spreadsheetId:sid(),requestBody:{valueInputOption:'RAW',data}});
  }
  const headerData=Object.entries(PLUS_SHEETS).map(([name,headers])=>({range:`${name}!A1:${col(headers.length)}1`,values:[headers]}));
  await sheets.spreadsheets.values.batchUpdate({spreadsheetId:sid(),requestBody:{valueInputOption:'RAW',data:headerData}});
  return sheets;
  })();
  try{return await ensurePromise;}catch(e){ensurePromise=null;throw e;}
}

export async function readRows(name){
  const sheets=await ensurePlusSheets(); const headers=PLUS_SHEETS[name];
  const r=await sheets.spreadsheets.values.get({spreadsheetId:sid(),range:`${name}!A2:${col(headers.length)}`});
  return (r.data.values||[]).map(row=>Object.fromEntries(headers.map((h,i)=>[h,row[i]??''])));
}
export async function appendRow(name,obj){
  const sheets=await ensurePlusSheets(); const headers=PLUS_SHEETS[name];
  await sheets.spreadsheets.values.append({spreadsheetId:sid(),range:`${name}!A:${col(headers.length)}`,valueInputOption:'RAW',insertDataOption:'INSERT_ROWS',requestBody:{values:[[...headers.map(h=>obj[h]??'')]]}});
  return obj;
}
export async function updateRow(name,id,patch){
  const sheets=await ensurePlusSheets(); const headers=PLUS_SHEETS[name];
  const r=await sheets.spreadsheets.values.get({spreadsheetId:sid(),range:`${name}!A2:${col(headers.length)}`});
  const rows=r.data.values||[]; const idx=rows.findIndex(x=>esc(x[0])===esc(id)); if(idx<0) throw new Error(`${name} record not found.`);
  const current=Object.fromEntries(headers.map((h,i)=>[h,rows[idx][i]??''])); const next={...current,...patch};
  await sheets.spreadsheets.values.update({spreadsheetId:sid(),range:`${name}!A${idx+2}:${col(headers.length)}${idx+2}`,valueInputOption:'RAW',requestBody:{values:[[...headers.map(h=>next[h]??'')]]}});
  return next;
}
export async function audit(adminId,action,entityType,entityId,details=''){
  return appendRow('AdminAudit',{id:`AUD-${Date.now().toString(36).toUpperCase()}`,admin_id:esc(adminId),action,entity_type:entityType,entity_id:esc(entityId),details:esc(details),created_at:new Date().toISOString()});
}

export async function patchRows(name,predicate,patch){
  const sheets=await ensurePlusSheets(); const headers=PLUS_SHEETS[name];
  const r=await sheets.spreadsheets.values.get({spreadsheetId:sid(),range:`${name}!A2:${col(headers.length)}`});
  const rows=r.data.values||[]; const data=[]; const out=[];
  rows.forEach((row,i)=>{const cur=Object.fromEntries(headers.map((h,j)=>[h,row[j]??'']));if(!predicate(cur))return;const next={...cur,...patch};data.push({range:`${name}!A${i+2}:${col(headers.length)}${i+2}`,values:[[...headers.map(h=>next[h]??'')]]});out.push(next);});
  if(data.length)await sheets.spreadsheets.values.batchUpdate({spreadsheetId:sid(),requestBody:{valueInputOption:'RAW',data}});
  return out;
}
