import { getSheets } from './google';
import { listAllPgs, listPgsByOwner } from './pgs';
import { listRooms } from './rooms';
const clean=(v)=>String(v??'').trim(); const SHEET='Bookings';
async function raw(){const s=await getSheets();const r=await s.spreadsheets.values.get({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!A2:L`});return r.data.values||[];}
function map(row){return {id:row[0],customerId:row[1],pgId:row[2],roomId:row[3],checkIn:row[4],checkOut:row[5],amount:Number(row[6]||0),status:row[7]||'Pending',createdAt:row[8]||'',stayDays:Number(row[9]||0),rentTotal:Number(row[10]||0),deposit:Number(row[11]||0)};}
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
 const b={id:`BK-${Date.now().toString(36).toUpperCase()}`,customerId:clean(customerId),pgId:pg.id,roomId:room.id,checkIn,checkOut,...totals,status:'Pending',createdAt:new Date().toISOString()};
 const s=await getSheets();await s.spreadsheets.values.update({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!J1:L1`,valueInputOption:'RAW',requestBody:{values:[['Stay Days','Rent Total','Deposit']]}});await s.spreadsheets.values.append({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!A:L`,valueInputOption:'RAW',insertDataOption:'INSERT_ROWS',requestBody:{values:[[b.id,b.customerId,b.pgId,b.roomId,b.checkIn,b.checkOut,b.amount,b.status,b.createdAt,b.stayDays,b.rentTotal,b.deposit]]}});return b;
}
export async function updateBookingStatus(ownerId,bookingId,status){
 const allowed=['Accepted','Rejected','Cancelled']; if(!allowed.includes(status)) throw new Error('Invalid status.');
 const pids=new Set((await listPgsByOwner(ownerId)).map(x=>x.id)); const rows=await raw(); const idx=rows.findIndex(r=>r[0]===bookingId&&pids.has(r[2])); if(idx<0) throw new Error('Booking not found.');
 const s=await getSheets(); await s.spreadsheets.values.update({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!H${idx+2}`,valueInputOption:'RAW',requestBody:{values:[[status]]}}); return true;
}
export async function setBookingConfirmed(bookingId){const rows=await raw();const idx=rows.findIndex(r=>clean(r[0])===clean(bookingId));if(idx<0)throw new Error('Booking not found.');const s=await getSheets();await s.spreadsheets.values.update({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!H${idx+2}`,valueInputOption:'RAW',requestBody:{values:[['Confirmed']]}});return true;}

export async function setBookingStatusById(bookingId,status){const rows=await raw();const idx=rows.findIndex(r=>clean(r[0])===clean(bookingId));if(idx<0)throw new Error('Booking not found.');const s=await getSheets();await s.spreadsheets.values.update({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!H${idx+2}`,valueInputOption:'RAW',requestBody:{values:[[clean(status)]]}});return true;}
