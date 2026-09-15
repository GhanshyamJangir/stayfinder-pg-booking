import crypto from 'node:crypto';
import { readRows, appendRow, updateRow } from './plus-store';
import { findUserById } from './users';
import { notifyUser } from './mailer';

const clean=v=>String(v??'').trim();
const now=()=>new Date().toISOString();
const dayMs=86400000;
const overlap=(a1,a2,b1,b2)=>new Date(`${a1}T00:00:00`)<new Date(`${b2}T00:00:00`)&&new Date(`${b1}T00:00:00`)<new Date(`${a2}T00:00:00`);
const sha=v=>crypto.createHash('sha256').update(String(v)).digest('hex');

export async function propertyModerationMap(){
  const rows=await readRows('PropertyModeration');
  return new Map(rows.map(x=>[clean(x.pg_id),x]));
}
export async function markPropertyPending(pgId){
  const rows=await readRows('PropertyModeration');
  const existing=rows.find(x=>clean(x.pg_id)===clean(pgId));
  const payload={pg_id:clean(pgId),status:'Pending',note:'',updated_at:now(),reviewed_by:''};
  return existing?updateRow('PropertyModeration',existing.pg_id,payload):appendRow('PropertyModeration',payload);
}
export async function reviewProperty(adminId,pgId,status,note=''){
  if(!['Approved','Rejected','Pending'].includes(status))throw new Error('Invalid property approval status.');
  const rows=await readRows('PropertyModeration');
  const existing=rows.find(x=>clean(x.pg_id)===clean(pgId));
  const payload={pg_id:clean(pgId),status,note:clean(note),updated_at:now(),reviewed_by:clean(adminId)};
  return existing?updateRow('PropertyModeration',existing.pg_id,payload):appendRow('PropertyModeration',payload);
}

export async function submitVerification(user,{docType,fileId,fileName}){
  const rows=await readRows('UserVerification');
  const id=`VER-${Date.now().toString(36).toUpperCase()}`;
  const row={id,user_id:user.sub,role:user.role,doc_type:clean(docType)||'ID Proof',file_id:clean(fileId),file_name:clean(fileName),status:'Pending',note:'',created_at:now(),updated_at:now(),reviewed_by:''};
  await appendRow('UserVerification',row);return row;
}
export async function listVerificationForUser(userId){return (await readRows('UserVerification')).filter(x=>clean(x.user_id)===clean(userId)).sort((a,b)=>Date.parse(b.created_at||0)-Date.parse(a.created_at||0));}
export async function reviewVerification(adminId,id,status,note=''){
  if(!['Verified','Rejected','Pending'].includes(status))throw new Error('Invalid verification status.');
  return updateRow('UserVerification',id,{status,note:clean(note),updated_at:now(),reviewed_by:clean(adminId)});
}

export async function getRiskFlags(){return (await readRows('RiskFlags')).sort((a,b)=>Date.parse(b.created_at||0)-Date.parse(a.created_at||0));}
export async function createRiskFlag(entityType,entityId,level,reason){
  const rows=await readRows('RiskFlags');
  const duplicate=rows.find(x=>x.status!=='Resolved'&&clean(x.entity_type)===clean(entityType)&&clean(x.entity_id)===clean(entityId)&&clean(x.reason)===clean(reason));
  if(duplicate)return duplicate;
  const row={id:`RISK-${Date.now().toString(36).toUpperCase()}`,entity_type:clean(entityType),entity_id:clean(entityId),level:level||'Medium',reason:clean(reason),status:'Open',created_at:now(),resolved_at:'',resolved_by:''};
  await appendRow('RiskFlags',row);return row;
}
export async function resolveRiskFlag(adminId,id){return updateRow('RiskFlags',id,{status:'Resolved',resolved_at:now(),resolved_by:clean(adminId)});}
export async function scanRiskFlags({users=[],bookings=[],payments=[]}){
  const byMobile=new Map(),byEmail=new Map(),byRef=new Map(),cancelByUser=new Map();
  for(const u of users){const m=clean(u.mobile).replace(/\D/g,'');const e=clean(u.email).toLowerCase();if(m)(byMobile.get(m)||byMobile.set(m,[]).get(m)).push(u);if(e)(byEmail.get(e)||byEmail.set(e,[]).get(e)).push(u);}
  for(const [m,a] of byMobile)if(a.length>1)await createRiskFlag('User',a.map(x=>x.id).join(','),'High',`Duplicate mobile ${m} used by ${a.length} accounts`);
  for(const [e,a] of byEmail)if(a.length>1)await createRiskFlag('User',a.map(x=>x.id).join(','),'High',`Duplicate email ${e} used by ${a.length} accounts`);
  for(const p of payments){const ref=clean(p.transactionRef||p.txnRef||p.reference);if(ref)(byRef.get(ref)||byRef.set(ref,[]).get(ref)).push(p);}
  for(const [r,a] of byRef)if(a.length>1)await createRiskFlag('Payment',a.map(x=>x.id).join(','),'High',`Transaction reference ${r} appears ${a.length} times`);
  for(const b of bookings)if(['Cancelled','Rejected'].includes(b.status))cancelByUser.set(b.customerId,(cancelByUser.get(b.customerId)||0)+1);
  for(const [uid,count] of cancelByUser)if(count>=3)await createRiskFlag('User',uid,'Medium',`${count} cancelled/rejected bookings`);
  return getRiskFlags();
}

export async function acquireInventoryLock({bookingId,roomId,checkIn,checkOut,capacity}){
  const rows=await readRows('InventoryLocks');
  const active=rows.filter(x=>clean(x.room_id)===clean(roomId)&&['Held','Confirmed'].includes(x.status)&&overlap(x.check_in,x.check_out,checkIn,checkOut));
  if(active.length>=Number(capacity||1))throw new Error('Selected room is fully booked for these dates. Please choose another room or dates.');
  const row={id:`LOCK-${Date.now().toString(36).toUpperCase()}`,booking_id:clean(bookingId),room_id:clean(roomId),check_in:clean(checkIn),check_out:clean(checkOut),status:'Held',created_at:now(),released_at:''};
  await appendRow('InventoryLocks',row);return row;
}
export async function confirmInventoryLock(bookingId){const rows=await readRows('InventoryLocks');const x=rows.find(r=>clean(r.booking_id)===clean(bookingId)&&r.status==='Held');if(x)await updateRow('InventoryLocks',x.id,{status:'Confirmed'});}
export async function releaseInventoryLock(bookingId){const rows=await readRows('InventoryLocks');for(const x of rows.filter(r=>clean(r.booking_id)===clean(bookingId)&&['Held','Confirmed'].includes(r.status)))await updateRow('InventoryLocks',x.id,{status:'Released',released_at:now()});}

export async function lifecycleForBookings(ids=[]){const set=new Set(ids.map(clean));return (await readRows('StayLifecycle')).filter(x=>set.has(clean(x.booking_id)));}
export async function requestCheckinOtp(booking,customerId){
  const otp=String(Math.floor(100000+Math.random()*900000));const rows=await readRows('StayLifecycle');let rec=rows.find(x=>clean(x.booking_id)===clean(booking.id));
  const patch={booking_id:booking.id,checkin_otp_hash:sha(otp),checkin_otp_expires:new Date(Date.now()+10*60*1000).toISOString(),checkin_verified_at:rec?.checkin_verified_at||'',checkout_requested_at:rec?.checkout_requested_at||'',checkout_verified_at:rec?.checkout_verified_at||'',status:rec?.status||'Check-in OTP Sent',updated_at:now()};
  rec=rec?await updateRow('StayLifecycle',rec.booking_id,patch):await appendRow('StayLifecycle',patch);
  const user=await findUserById(customerId);if(user?.email)await notifyUser(user,{subject:`StayFinder check-in OTP ${booking.id}`,title:'Check-in verification code',lines:[`Booking: ${booking.id}`,`Your check-in OTP is ${otp}.`,`This code expires in 10 minutes.`]});
  return rec;
}
export async function verifyCheckinOtp(bookingId,otp){const rows=await readRows('StayLifecycle');const rec=rows.find(x=>clean(x.booking_id)===clean(bookingId));if(!rec||!rec.checkin_otp_hash)throw new Error('Check-in OTP has not been generated.');if(Date.parse(rec.checkin_otp_expires||0)<Date.now())throw new Error('Check-in OTP expired. Request a new OTP.');if(sha(clean(otp))!==rec.checkin_otp_hash)throw new Error('Invalid check-in OTP.');return updateRow('StayLifecycle',rec.booking_id,{checkin_verified_at:now(),status:'Checked In',updated_at:now()});}

export async function requestCheckinQr(booking){
  const token=crypto.randomBytes(24).toString('hex');
  const rows=await readRows('StayLifecycle');
  let rec=rows.find(x=>clean(x.booking_id)===clean(booking.id));
  const patch={booking_id:booking.id,checkin_otp_hash:rec?.checkin_otp_hash||'',checkin_otp_expires:rec?.checkin_otp_expires||'',checkin_verified_at:rec?.checkin_verified_at||'',checkout_requested_at:rec?.checkout_requested_at||'',checkout_verified_at:rec?.checkout_verified_at||'',status:rec?.status||'QR Ready',updated_at:now(),checkin_qr_hash:sha(token),checkin_qr_expires:new Date(Date.now()+15*60*1000).toISOString()};
  rec=rec?await updateRow('StayLifecycle',rec.booking_id,patch):await appendRow('StayLifecycle',patch);
  return {item:rec,token};
}
export async function verifyCheckinQr(bookingId,token){
  const rows=await readRows('StayLifecycle');
  const rec=rows.find(x=>clean(x.booking_id)===clean(bookingId));
  if(!rec||!rec.checkin_qr_hash)throw new Error('Check-in QR has not been generated.');
  if(Date.parse(rec.checkin_qr_expires||0)<Date.now())throw new Error('Check-in QR expired. Generate a new QR.');
  if(sha(clean(token))!==rec.checkin_qr_hash)throw new Error('Invalid check-in QR.');
  return updateRow('StayLifecycle',rec.booking_id,{checkin_verified_at:now(),status:'Checked In',updated_at:now(),checkin_qr_hash:'',checkin_qr_expires:''});
}

export async function requestCheckout(bookingId){const rows=await readRows('StayLifecycle');const rec=rows.find(x=>clean(x.booking_id)===clean(bookingId));if(!rec||!rec.checkin_verified_at)throw new Error('Check-in is not verified yet.');return updateRow('StayLifecycle',rec.booking_id,{checkout_requested_at:now(),status:'Checkout Requested',updated_at:now()});}
export async function confirmCheckout(bookingId){const rows=await readRows('StayLifecycle');const rec=rows.find(x=>clean(x.booking_id)===clean(bookingId));if(!rec||!rec.checkout_requested_at)throw new Error('Customer has not requested checkout yet.');return updateRow('StayLifecycle',rec.booking_id,{checkout_verified_at:now(),status:'Checked Out',updated_at:now()});}

export async function listPolicies(){return (await readRows('CancellationPolicies')).filter(x=>x.status!=='Inactive');}
export async function upsertPolicy(adminId,body){
  const policies=await readRows('CancellationPolicies');const scopeType=['Global','Property'].includes(body.scopeType)?body.scopeType:'Global';const scopeId=scopeType==='Global'?'*':clean(body.scopeId);if(scopeType==='Property'&&!scopeId)throw new Error('Property is required.');
  const cutoff=Math.max(0,Number(body.cutoffDays||0)),percent=Math.max(0,Math.min(100,Number(body.refundPercent||0)));const existing=policies.find(x=>x.scope_type===scopeType&&clean(x.scope_id)===scopeId&&x.status!=='Inactive');const patch={scope_type:scopeType,scope_id:scopeId,name:clean(body.name)||`${percent}% refund`,cutoff_days:String(cutoff),refund_percent:String(percent),status:'Active',created_at:existing?.created_at||now(),updated_at:now(),updated_by:clean(adminId)};
  return existing?updateRow('CancellationPolicies',existing.id,patch):appendRow('CancellationPolicies',{id:`POL-${Date.now().toString(36).toUpperCase()}`,...patch});
}
export async function cancellationQuote(booking){
  const policies=await listPolicies();const specific=policies.filter(x=>x.scope_type==='Property'&&clean(x.scope_id)===clean(booking.pgId)).sort((a,b)=>Number(b.cutoff_days)-Number(a.cutoff_days));const global=policies.filter(x=>x.scope_type==='Global').sort((a,b)=>Number(b.cutoff_days)-Number(a.cutoff_days));const days=Math.floor((new Date(`${booking.checkIn}T00:00:00`)-new Date())/dayMs);const applicable=[...specific,...global].filter(x=>days>=Number(x.cutoff_days||0)).sort((a,b)=>Number(b.cutoff_days)-Number(a.cutoff_days))[0]||null;const percent=applicable?Number(applicable.refund_percent||0):0;return {daysBeforeCheckIn:days,refundPercent:percent,refundAmount:Math.round(Number(booking.amount||0)*percent/100),policy:applicable};
}
