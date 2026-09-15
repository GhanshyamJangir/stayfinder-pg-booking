import { getSheets } from './google';
import { readRows, appendRow, updateRow, patchRows } from './plus-store';
import { listPgsByOwner } from './pgs';

const clean=v=>String(v??'').trim();
const now=()=>new Date().toISOString();
const dateOnly=v=>clean(v).slice(0,10);
const id=p=>`${p}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;

export async function couponForBooking({code,pgId,amount}){
 const c=clean(code).toUpperCase();
 if(!c)return {code:'',discount:0,originalAmount:Number(amount||0),finalAmount:Number(amount||0),coupon:null};
 const rows=await readRows('PromoCodes');
 const item=rows.find(x=>clean(x.code).toUpperCase()===c&&clean(x.status||'Active')==='Active');
 if(!item)throw new Error('Coupon code invalid or inactive.');
 if(item.pg_id&&clean(item.pg_id)!==clean(pgId))throw new Error('This coupon is not valid for this property.');
 if(item.expires_at&&Date.parse(item.expires_at)<Date.now())throw new Error('Coupon code has expired.');
 const max=Number(item.max_uses||0),used=Number(item.used_count||0);if(max>0&&used>=max)throw new Error('Coupon usage limit has been reached.');
 const original=Math.max(0,Number(amount||0));let discount=0;
 if(clean(item.discount_type)==='Fixed')discount=Math.max(0,Number(item.discount_value||0));else discount=Math.round(original*Math.max(0,Math.min(100,Number(item.discount_value||0)))/100);
 discount=Math.min(original,discount);return {code:c,discount,originalAmount:original,finalAmount:original-discount,coupon:item};
}
export async function consumeCoupon(item){if(!item)return;await updateRow('PromoCodes',item.id,{used_count:String(Number(item.used_count||0)+1),updated_at:now()});}

export async function createPromo(user,body){
 const role=clean(user.role);if(!['owner','admin'].includes(role))throw new Error('Not allowed.');const code=clean(body.code).toUpperCase().replace(/[^A-Z0-9_-]/g,'');if(code.length<3)throw new Error('Coupon code must be at least 3 characters.');
 const rows=await readRows('PromoCodes');if(rows.some(x=>clean(x.code).toUpperCase()===code&&clean(x.status||'Active')==='Active'))throw new Error('This coupon code already exists.');
 let pgId=clean(body.pgId);if(role==='owner'){const mine=await listPgsByOwner(user.sub);if(pgId&&!mine.some(x=>x.id===pgId))throw new Error('Invalid property.');}
 const type=clean(body.discountType)==='Fixed'?'Fixed':'Percent',value=Math.max(0,Number(body.discountValue||0));if(!value)throw new Error('Discount value is required.');if(type==='Percent'&&value>100)throw new Error('Percent discount cannot exceed 100.');
 const row={id:id('CPN'),code,creator_id:clean(user.sub),creator_role:role,pg_id:pgId,discount_type:type,discount_value:String(value),expires_at:clean(body.expiresAt),max_uses:String(Math.max(0,Number(body.maxUses||0))),used_count:'0',status:'Active',created_at:now(),updated_at:now()};await appendRow('PromoCodes',row);return row;
}
export async function listPromosFor(user){let rows=await readRows('PromoCodes');if(user.role==='owner')rows=rows.filter(x=>x.creator_role==='owner'&&clean(x.creator_id)===clean(user.sub));if(user.role==='customer')rows=[];return rows.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));}

async function rawBookings(){const s=await getSheets();const r=await s.spreadsheets.values.get({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:'Bookings!A2:O'});return {s,rows:r.data.values||[]};}
export async function createModification(user,body){
 if(user.role!=='customer')throw new Error('Customer only.');const bookingId=clean(body.bookingId);const {rows}=await rawBookings();const r=rows.find(x=>clean(x[0])===bookingId&&clean(x[1])===clean(user.sub));if(!r)throw new Error('Booking not found.');if(!['Accepted','Confirmed'].includes(clean(r[7])))throw new Error('Only accepted or confirmed bookings can be modified.');
 const newCheckIn=dateOnly(body.newCheckIn)||dateOnly(r[4]);let newCheckOut=dateOnly(body.newCheckOut);const months=Math.max(0,Number(body.stayMonths||0));if(!newCheckOut&&months){const d=new Date(`${newCheckIn}T00:00:00`);d.setMonth(d.getMonth()+months);newCheckOut=d.toISOString().slice(0,10);}if(!newCheckOut)newCheckOut=dateOnly(r[5]);if(new Date(`${newCheckOut}T00:00:00`)<=new Date(`${newCheckIn}T00:00:00`))throw new Error('Check-out must be after check-in.');
 const open=await readRows('BookingModifications');if(open.some(x=>x.booking_id===bookingId&&x.status==='Pending'))throw new Error('A modification request is already pending for this booking.');
 const row={id:id('MOD'),booking_id:bookingId,customer_id:clean(user.sub),owner_id:'',old_check_in:r[4]||'',old_check_out:r[5]||'',new_check_in:newCheckIn,new_check_out:newCheckOut,reason:clean(body.reason),status:'Pending',owner_note:'',created_at:now(),updated_at:now(),reviewed_by:''};await appendRow('BookingModifications',row);return row;
}
export async function modificationRows(user,bookings=[]){const ids=new Set(bookings.map(x=>clean(x.id)));return (await readRows('BookingModifications')).filter(x=>ids.has(clean(x.booking_id))).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));}
export async function reviewModification(user,body,bookings=[]){
 if(user.role!=='owner')throw new Error('Owner only.');const allowed=['Approved','Rejected'];if(!allowed.includes(clean(body.status)))throw new Error('Invalid decision.');const rows=await readRows('BookingModifications');const req=rows.find(x=>x.id===clean(body.id));if(!req||req.status!=='Pending')throw new Error('This request has already been processed.');const booking=bookings.find(x=>clean(x.id)===clean(req.booking_id));if(!booking)throw new Error('Booking not found for this owner.');
 const patch={status:clean(body.status),owner_note:clean(body.note),updated_at:now(),reviewed_by:clean(user.sub)};const out=await updateRow('BookingModifications',req.id,patch);
 if(body.status==='Approved'){
  const {s,rows:br}=await rawBookings();const idx=br.findIndex(r=>clean(r[0])===clean(req.booking_id));if(idx<0)throw new Error('Booking record not found.');
  const sourceIds=new Set(booking.room?.sourceIds?.length?booking.room.sourceIds:[booking.roomId]);const overlap=(a1,a2,b1,b2)=>new Date(`${a1}T00:00:00`)<new Date(`${b2}T00:00:00`)&&new Date(`${b1}T00:00:00`)<new Date(`${a2}T00:00:00`);const conflicts=br.filter((r,i)=>i!==idx&&sourceIds.has(clean(r[3]))&&['Pending','Accepted','Confirmed'].includes(clean(r[7]))&&overlap(r[4],r[5],req.new_check_in,req.new_check_out));if(conflicts.length>=Number(booking.room?.totalBeds||1))throw new Error('Requested dates are no longer available. Reject the request or choose different dates.');
  const oldDays=Math.max(1,Number(br[idx][9]||1)),oldRent=Number(br[idx][10]||0),deposit=Number(br[idx][11]||0);const start=new Date(`${req.new_check_in}T00:00:00`),end=new Date(`${req.new_check_out}T00:00:00`);const days=Math.max(1,Math.ceil((end-start)/86400000));const daily=oldRent/oldDays;const rent=Math.round(daily*days);const original=rent+deposit;const discount=Number(br[idx][13]||0);const amount=Math.max(0,original-discount);await s.spreadsheets.values.update({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`Bookings!E${idx+2}:L${idx+2}`,valueInputOption:'RAW',requestBody:{values:[[req.new_check_in,req.new_check_out,amount,br[idx][7]||'',br[idx][8]||'',days,rent,deposit]]}});if(br[idx].length>=15)await s.spreadsheets.values.update({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`Bookings!O${idx+2}`,valueInputOption:'RAW',requestBody:{values:[[original]]}});await patchRows('InventoryLocks',x=>clean(x.booking_id)===clean(req.booking_id)&&['Held','Confirmed'].includes(x.status),{check_in:req.new_check_in,check_out:req.new_check_out});
 }
 return out;
}

export async function syncDeposits(bookings=[]){const rows=await readRows('SecurityDeposits');const by=new Map(rows.map(x=>[clean(x.booking_id),x]));for(const b of bookings){if(Number(b.deposit||0)<=0||!['Accepted','Confirmed'].includes(b.status))continue;const existing=by.get(clean(b.id));if(existing){if(b.status==='Confirmed'&&existing.status==='Held'){const next=await updateRow('SecurityDeposits',existing.id,{status:'Received',updated_at:now()});by.set(clean(b.id),next);}continue;}const row={id:id('DEP'),booking_id:b.id,customer_id:b.customerId,owner_id:b.pg?.ownerId||'',amount:String(Number(b.deposit||0)),status:b.status==='Confirmed'?'Received':'Held',adjustment_amount:'0',note:'',created_at:now(),updated_at:now()};await appendRow('SecurityDeposits',row);by.set(clean(b.id),row);}return [...by.values()].filter(x=>bookings.some(b=>clean(b.id)===clean(x.booking_id)));}
export async function updateDeposit(user,body,bookings=[]){if(user.role!=='owner')throw new Error('Owner only.');const d=(await readRows('SecurityDeposits')).find(x=>x.id===clean(body.id));if(!d||!bookings.some(b=>clean(b.id)===clean(d.booking_id)))throw new Error('Deposit not found.');const next=clean(body.status),allowed={Received:['Held','Refunded','Adjusted'],Held:['Refunded','Adjusted'],Adjusted:[],Refunded:[]};if(!allowed[clean(d.status)]?.includes(next))throw new Error(`Deposit status cannot change from ${d.status} to ${next}.`);return updateRow('SecurityDeposits',d.id,{status:next,adjustment_amount:String(Math.max(0,Number(body.adjustmentAmount||0))),note:clean(body.note),updated_at:now()});}

export function dueReminders(bookings=[]){const today=new Date();today.setHours(0,0,0,0);return bookings.filter(b=>b.status==='Accepted').map(b=>{const check=new Date(`${b.checkIn}T00:00:00`);const due=new Date(check);due.setDate(due.getDate()-2);const days=Math.ceil((due-today)/86400000);return {bookingId:b.id,title:`Payment due for ${b.pg?.name||b.pgId}`,amount:b.amount,dueDate:due.toISOString().slice(0,10),daysLeft:days,overdue:days<0};}).sort((a,b)=>a.daysLeft-b.daysLeft);}
