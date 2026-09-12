import { getSheets } from './google';
import { listCustomerBookings, listOwnerBookings, setBookingConfirmed } from './bookings';
import { reserveOneBed } from './rooms';
import { uploadBuffer } from './drive';
const clean=v=>String(v??'').trim(); const SHEET='Payments';
async function raw(){const s=await getSheets();const r=await s.spreadsheets.values.get({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!A2:J`});return r.data.values||[];}
function map(r){return{id:r[0],bookingId:r[1],amount:Number(r[2]||0),mode:r[3]||'',transactionRef:r[4]||'',proofFileId:r[5]||'',status:r[6]||'Submitted',refundFileId:r[7]||'',createdAt:r[8]||'',rejectionReason:r[9]||''};}
export async function listCustomerPayments(customerId){const ids=new Set((await listCustomerBookings(customerId)).map(x=>x.id));return (await raw()).map(map).filter(x=>ids.has(x.bookingId)).reverse();}
export async function listOwnerPayments(ownerId){const ids=new Set((await listOwnerBookings(ownerId)).map(x=>x.id));return (await raw()).map(map).filter(x=>ids.has(x.bookingId)).reverse();}
export async function createPayment(customerId,{bookingId,amount,mode,transactionRef,file}){
 const booking=(await listCustomerBookings(customerId)).find(x=>x.id===clean(bookingId)); if(!booking) throw new Error('Booking not found.');
 if(booking.status!=='Accepted') throw new Error('Payment sirf accepted booking ke liye submit ho sakta hai.');
 const previous=(await listCustomerPayments(customerId)).find(p=>clean(p.bookingId)===clean(booking.id)&&['Submitted','Verified'].includes(p.status));
 if(previous) throw new Error(previous.status==='Verified'?'Is booking ka payment already verified hai.':'Is booking ka payment proof already submitted hai. Owner verification pending hai.');
 const ref=clean(transactionRef); if(!/^\d{12}$/.test(ref)) throw new Error('Transaction reference exactly 12 digit numeric hona chahiye.');
 if(!file) throw new Error('Payment proof image required hai.');
 const uploaded=await uploadBuffer({buffer:Buffer.from(await file.arrayBuffer()),mimeType:file.type,name:`${booking.id}-${Date.now()}-${file.name||'proof'}`,folderName:'Payment Proofs'});
 const p={id:`PAY-${Date.now().toString(36).toUpperCase()}`,bookingId:booking.id,amount:Number(booking.amount||0),mode:clean(mode)||'UPI',transactionRef:ref,proofFileId:uploaded.id,status:'Submitted',refundFileId:'',createdAt:new Date().toISOString(),rejectionReason:''};
 const s=await getSheets();await s.spreadsheets.values.update({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!J1`,valueInputOption:'RAW',requestBody:{values:[['Rejection Reason']]}});await s.spreadsheets.values.append({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!A:J`,valueInputOption:'RAW',insertDataOption:'INSERT_ROWS',requestBody:{values:[[p.id,p.bookingId,p.amount,p.mode,p.transactionRef,p.proofFileId,p.status,p.refundFileId,p.createdAt,p.rejectionReason]]}});return p;
}
export async function updatePaymentStatus(ownerId,paymentId,status,reason=''){
 if(!['Verified','Rejected'].includes(status)) throw new Error('Invalid payment status.');
 const bookings=await listOwnerBookings(ownerId); const ids=new Set(bookings.map(x=>x.id)); const rows=await raw();
 const idx=rows.findIndex(r=>clean(r[0])===clean(paymentId)&&ids.has(clean(r[1]))); if(idx<0) throw new Error('Payment not found.');
 const was=clean(rows[idx][6]); if(was==='Verified') throw new Error('Verified payment ko reject nahi kiya ja sakta. Cancellation/refund flow use karein.');
 const booking=bookings.find(b=>clean(b.id)===clean(rows[idx][1])); const rejectReason=clean(reason); if(status==='Rejected'&&!rejectReason) throw new Error('Correction reason required hai.');
 const s=await getSheets(); await s.spreadsheets.values.update({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!G${idx+2}`,valueInputOption:'RAW',requestBody:{values:[[status]]}}); await s.spreadsheets.values.update({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!J${idx+2}`,valueInputOption:'RAW',requestBody:{values:[[status==='Rejected'?rejectReason:'']]}});
 if(status==='Verified'&&was!=='Verified'&&booking){await setBookingConfirmed(booking.id);await reserveOneBed(booking.roomId);} return true;
}
