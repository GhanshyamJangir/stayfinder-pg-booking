import { getSheets } from './google';
import { listAllPgs, listPgsByOwner } from './pgs';
import { listRooms } from './rooms';
import { acquireInventoryLock, confirmInventoryLock, releaseInventoryLock } from './platform-controls';
import { couponForBooking, consumeCoupon } from './booking-enhancements';
const clean=(v)=>String(v??'').trim(); const SHEET='Bookings';
async function raw(){const s=await getSheets();const r=await s.spreadsheets.values.get({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!A2:O`});return r.data.values||[];}
function map(row){return {id:row[0],customerId:row[1],pgId:row[2],roomId:row[3],checkIn:row[4],checkOut:row[5],amount:Number(row[6]||0),status:row[7]||'Pending',createdAt:row[8]||'',stayDays:Number(row[9]||0),rentTotal:Number(row[10]||0),deposit:Number(row[11]||0),couponCode:row[12]||'',discount:Number(row[13]||0),originalAmount:Number(row[14]||row[6]||0)};}
async function enrich(items,{includeCustomer=false}={}){
 const pgs=await listAllPgs(false);
 const rooms=await listRooms();
 let customers=new Map();
 if(includeCustomer&&items.length){
  const s=await getSheets();
  const r=await s.spreadsheets.values.get({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:'Users!A2:H'});
  customers=new Map((r.data.values||[]).map(row=>[clean(row[0]),{id:clean(row[0]),name:clean(row[1]),phone:clean(row[2]),username:clean(row[3]),role:clean(row[5]).toLowerCase()}]));
 }
 return items.map(x=>({...x,pg:pgs.find(p=>p.id===x.pgId)||null,room:rooms.find(r=>r.id===x.roomId)||null,customer:includeCustomer?(customers.get(clean(x.customerId))||null):undefined}));
}
export async function listCustomerBookings(id){return enrich((await raw()).map(map).filter(x=>clean(x.customerId)===clean(id)).reverse());}
export async function listOwnerBookings(id){const ids=new Set((await listPgsByOwner(id)).map(x=>x.id));return enrich((await raw()).map(map).filter(x=>ids.has(x.pgId)).reverse(),{includeCustomer:true});}
function fare(room,checkIn,checkOut){
 const start=new Date(`${checkIn}T00:00:00`); const end=new Date(`${checkOut}T00:00:00`);
 if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start) throw new Error('Valid check-in aur check-out dates select karein.');
 const stayDays=Math.max(1,Math.ceil((end-start)/86400000));
 const rentTotal=Math.round((Number(room.rent||0)/30)*stayDays); const deposit=Number(room.deposit||0); return {stayDays,rentTotal,deposit,amount:rentTotal+deposit};
}
export async function createBooking(customerId,body){
 const room=(await listRooms()).find(r=>r.id===clean(body.roomId)); if(!room||room.availableBeds<=0) throw new Error('Selected room available nahi hai.');
 const pg=(await listAllPgs()).find(p=>p.id===room.pgId); if(!pg) throw new Error('Property active nahi hai.');
 const checkIn=clean(body.checkIn); let checkOut=clean(body.checkOut);
 if(!checkIn) throw new Error('Check-in date required hai.');
 if(!checkOut && /^\d+$/.test(clean(body.stayMonths))){const d=new Date(`${checkIn}T00:00:00`);d.setMonth(d.getMonth()+Number(body.stayMonths));checkOut=d.toISOString().slice(0,10);}
 if(!checkOut) throw new Error('Custom stay ke liye check-out date required hai.');
 const totals=fare(room,checkIn,checkOut);
 const promo=await couponForBooking({code:body.couponCode,pgId:pg.id,amount:totals.amount});
 const b={id:`BK-${Date.now().toString(36).toUpperCase()}`,customerId:clean(customerId),pgId:pg.id,roomId:room.id,checkIn,checkOut,...totals,amount:promo.finalAmount,couponCode:promo.code,discount:promo.discount,originalAmount:promo.originalAmount,status:'Pending',createdAt:new Date().toISOString()};
 const sourceIds=new Set(room.sourceIds?.length?room.sourceIds:[room.id]);const overlap=(a1,a2,b1,b2)=>new Date(`${a1}T00:00:00`)<new Date(`${b2}T00:00:00`)&&new Date(`${b1}T00:00:00`)<new Date(`${a2}T00:00:00`);const existing=(await raw()).map(map).filter(x=>sourceIds.has(x.roomId)&&['Pending','Accepted','Confirmed'].includes(x.status)&&overlap(x.checkIn,x.checkOut,checkIn,checkOut));if(existing.length>=Number(room.totalBeds||1))throw new Error('Selected room is fully booked for these dates. Please choose another room or dates.');
 await acquireInventoryLock({bookingId:b.id,roomId:room.id,checkIn,checkOut,capacity:room.totalBeds||1});
 try{const s=await getSheets();await s.spreadsheets.values.update({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!J1:O1`,valueInputOption:'RAW',requestBody:{values:[['Stay Days','Rent Total','Deposit','Coupon Code','Discount','Original Amount']]}});await s.spreadsheets.values.append({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!A:O`,valueInputOption:'RAW',insertDataOption:'INSERT_ROWS',requestBody:{values:[[b.id,b.customerId,b.pgId,b.roomId,b.checkIn,b.checkOut,b.amount,b.status,b.createdAt,b.stayDays,b.rentTotal,b.deposit,b.couponCode,b.discount,b.originalAmount]]}});await consumeCoupon(promo.coupon);return b;}catch(e){await releaseInventoryLock(b.id).catch(()=>{});throw e;}
}
export async function updateBookingStatus(ownerId,bookingId,status){
 const allowed=['Accepted','Rejected','Cancelled']; if(!allowed.includes(status)) throw new Error('Invalid status.');
 const pids=new Set((await listPgsByOwner(ownerId)).map(x=>x.id)); const rows=await raw(); const idx=rows.findIndex(r=>r[0]===bookingId&&pids.has(r[2])); if(idx<0) throw new Error('Booking not found.');
 const s=await getSheets(); await s.spreadsheets.values.update({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!H${idx+2}`,valueInputOption:'RAW',requestBody:{values:[[status]]}}); if(status==='Accepted')await confirmInventoryLock(bookingId).catch(()=>{});if(['Rejected','Cancelled'].includes(status))await releaseInventoryLock(bookingId).catch(()=>{}); return true;
}
export async function setBookingConfirmed(bookingId){const rows=await raw();const idx=rows.findIndex(r=>clean(r[0])===clean(bookingId));if(idx<0)throw new Error('Booking not found.');const s=await getSheets();await s.spreadsheets.values.update({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!H${idx+2}`,valueInputOption:'RAW',requestBody:{values:[['Confirmed']]}});return true;}

export async function setBookingStatusById(bookingId,status){const rows=await raw();const idx=rows.findIndex(r=>clean(r[0])===clean(bookingId));if(idx<0)throw new Error('Booking not found.');const s=await getSheets();await s.spreadsheets.values.update({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!H${idx+2}`,valueInputOption:'RAW',requestBody:{values:[[clean(status)]]}});if(['Rejected','Cancelled','Refund Pending','Refund Sent'].includes(clean(status)))await releaseInventoryLock(bookingId).catch(()=>{});return true;}
