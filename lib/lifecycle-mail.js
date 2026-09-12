import { getSheets } from './google';
import { findUserById } from './users';
import { notifyUser, sendMailSafe, emailTemplate } from './mailer';

const clean=v=>String(v??'').trim();
const appUrl=()=>String(process.env.NEXT_PUBLIC_APP_URL||process.env.APP_URL||'https://stayfinder-pg-booking.vercel.app').replace(/\/$/,'');
const money=n=>`₹${Number(n||0).toLocaleString('en-IN')}`;
async function values(range){const s=await getSheets();const r=await s.spreadsheets.values.get({spreadsheetId:process.env.GOOGLE_SHEET_ID,range});return r.data.values||[];}
async function pgInfo(pgId){const rows=await values('PGs!A2:M');const r=rows.find(x=>clean(x[0])===clean(pgId));return r?{id:r[0],ownerId:r[1],name:r[2],address:r[3],city:r[4]}:null;}
async function bookingInfo(bookingId){const rows=await values('Bookings!A2:L');const r=rows.find(x=>clean(x[0])===clean(bookingId));if(!r)return null;const pg=await pgInfo(r[2]);return{id:r[0],customerId:r[1],pgId:r[2],roomId:r[3],checkIn:r[4],checkOut:r[5],amount:Number(r[6]||0),status:r[7]||'',stayDays:Number(r[9]||0),rentTotal:Number(r[10]||0),deposit:Number(r[11]||0),pg};}
async function paymentInfo(paymentId){const rows=await values('Payments!A2:J');const r=rows.find(x=>clean(x[0])===clean(paymentId));return r?{id:r[0],bookingId:r[1],amount:Number(r[2]||0),mode:r[3],transactionRef:r[4],status:r[6],rejectionReason:r[9]||''}:null;}
async function refundInfo(refundId){const rows=await values('Refunds!A2:T');const r=rows.find(x=>clean(x[0])===clean(refundId));return r?{id:r[0],bookingId:r[1],paymentId:r[2],amount:Number(r[3]||0),reason:r[4],status:r[5],transactionRef:r[6]}:null;}

export async function mailAccountCreated(user){return notifyUser(user,{subject:'Welcome to StayFinder',title:`Welcome to StayFinder, ${user.name||user.username}`,lines:[`Your ${user.role==='owner'?'Host':'Guest'} account has been created successfully.`,`Username: ${user.username}`],buttonText:'Open StayFinder',buttonUrl:appUrl()});}
export async function mailProfileUpdated(user){return notifyUser(user,{subject:'StayFinder profile updated',title:'Profile updated',lines:['Your contact details were updated successfully.','If you did not make this change, contact StayFinder support.'],buttonText:'Open StayFinder',buttonUrl:appUrl()});}

export async function mailBookingCreated(customerId,booking){
  const full=await bookingInfo(booking.id);if(!full)return;const guest=await findUserById(customerId);const owner=await findUserById(full.pg?.ownerId||'');
  const lines=[`Booking ID: ${full.id}`,`Property: ${full.pg?.name||full.pgId}`,`Check-in: ${full.checkIn}`,`Check-out: ${full.checkOut}`,`Total: ${money(full.amount)}`];
  await notifyUser(guest,{subject:`Booking request submitted • ${full.id}`,title:'Booking request submitted',lines:[...lines,'The Host will review your request.'],buttonText:'View My Bookings',buttonUrl:`${appUrl()}/customer`});
  await notifyUser(owner,{subject:`New booking request • ${full.id}`,title:'You have a new booking request',lines:[...lines,`Guest: ${guest?.name||'Guest'}`],buttonText:'Review booking',buttonUrl:`${appUrl()}/owner`});
}

export async function mailBookingStatus(ownerId,bookingId,status){
  const owner=await findUserById(ownerId);const b=await bookingInfo(bookingId);if(!b)return;const guest=await findUserById(b.customerId);const prop=b.pg?.name||b.pgId;
  await notifyUser(guest,{subject:`Booking ${status.toLowerCase()} • ${bookingId}`,title:`Booking ${status}`,lines:[`Booking ID: ${bookingId}`,`Property: ${prop}`,status==='Accepted'?'You can continue to payment from My Bookings.':status==='Rejected'?'The Host could not accept this request.':'The booking status was updated.'],buttonText:'View My Bookings',buttonUrl:`${appUrl()}/customer`});
  await notifyUser(owner,{subject:`Booking updated • ${bookingId}`,title:`Booking marked ${status}`,lines:[`Booking ID: ${bookingId}`,`Property: ${prop}`,`Guest: ${guest?.name||'Guest'}`],buttonText:'Open Host dashboard',buttonUrl:`${appUrl()}/owner`});
}

export async function mailPaymentSubmitted(customerId,payment){
  const guest=await findUserById(customerId);const b=await bookingInfo(payment.bookingId);const owner=await findUserById(b?.pg?.ownerId||'');const lines=[`Booking ID: ${payment.bookingId}`,`Amount: ${money(payment.amount)}`,`Transaction reference: ${payment.transactionRef}`];
  await notifyUser(guest,{subject:`Payment proof submitted • ${payment.bookingId}`,title:'Payment proof submitted',lines:[...lines,'Host verification is pending.'],buttonText:'View booking',buttonUrl:`${appUrl()}/customer`});
  await notifyUser(owner,{subject:`Payment proof received • ${payment.bookingId}`,title:'Payment verification required',lines:[...lines,`Guest: ${guest?.name||'Guest'}`],buttonText:'Verify payment',buttonUrl:`${appUrl()}/owner`});
}

export async function mailPaymentStatus(ownerId,paymentId,status,reason=''){
  const owner=await findUserById(ownerId);const p=await paymentInfo(paymentId);if(!p)return;const b=await bookingInfo(p.bookingId);const guest=await findUserById(b?.customerId||'');const lines=[`Booking ID: ${p.bookingId}`,`Amount: ${money(p.amount)}`,status==='Rejected'&&reason?`Reason: ${reason}`:''].filter(Boolean);
  await notifyUser(guest,{subject:`Payment ${status.toLowerCase()} • ${p.bookingId}`,title:`Payment ${status}`,lines:lines.concat(status==='Verified'?['Your stay is confirmed. Host contact and exact location are now available in My Bookings.']:['Please correct the payment details and submit again.']),buttonText:'View My Bookings',buttonUrl:`${appUrl()}/customer`});
  await notifyUser(owner,{subject:`Payment ${status.toLowerCase()} • ${p.bookingId}`,title:`Payment marked ${status}`,lines,buttonText:'Open Host dashboard',buttonUrl:`${appUrl()}/owner`});
}

export async function mailRefundInitiated(ownerId,refund){
  const owner=await findUserById(ownerId);const b=await bookingInfo(refund.bookingId);const guest=await findUserById(b?.customerId||'');const lines=[`Booking ID: ${refund.bookingId}`,`Refund amount: ${money(refund.amount)}`,`Reason: ${refund.reason}`];
  await notifyUser(guest,{subject:`Refund initiated • ${refund.bookingId}`,title:'Refund initiated',lines:[...lines,'The Host will send the refund to your saved refund destination.'],buttonText:'View refund status',buttonUrl:`${appUrl()}/customer`});
  await notifyUser(owner,{subject:`Refund started • ${refund.bookingId}`,title:'Refund process started',lines,buttonText:'Complete refund',buttonUrl:`${appUrl()}/owner`});
}

export async function mailRefundSent(ownerId,refund){
  const b=await bookingInfo(refund.bookingId);const guest=await findUserById(b?.customerId||'');const owner=await findUserById(ownerId);const lines=[`Booking ID: ${refund.bookingId}`,`Refund amount: ${money(refund.amount)}`,`Refund transaction reference: ${refund.transactionRef}`];
  await notifyUser(guest,{subject:`Refund sent • ${refund.bookingId}`,title:'Refund sent by Host',lines:[...lines,'Please confirm after the amount is received.'],buttonText:'Confirm refund',buttonUrl:`${appUrl()}/customer`});
  await notifyUser(owner,{subject:`Refund proof submitted • ${refund.bookingId}`,title:'Refund marked as sent',lines,buttonText:'Open Host dashboard',buttonUrl:`${appUrl()}/owner`});
}

export async function mailRefundCustomerAction(customerId,refundId,action,note=''){
  const guest=await findUserById(customerId);const r=await refundInfo(refundId);if(!r)return;const b=await bookingInfo(r.bookingId);const owner=await findUserById(b?.pg?.ownerId||'');const title=action==='received'?'Refund received confirmed':'Refund issue reported';const lines=[`Booking ID: ${r.bookingId}`,`Refund amount: ${money(r.amount)}`,note?`Note: ${note}`:''].filter(Boolean);
  await notifyUser(guest,{subject:`${title} • ${r.bookingId}`,title,lines,buttonText:'View My Bookings',buttonUrl:`${appUrl()}/customer`});
  await notifyUser(owner,{subject:`${title} • ${r.bookingId}`,title,lines:[...lines,`Guest: ${guest?.name||'Guest'}`],buttonText:'Open Host dashboard',buttonUrl:`${appUrl()}/owner`});
}

export async function mailSupportCreated(user,ticket){
  await notifyUser(user,{subject:`Support ticket created • ${ticket.id}`,title:'Support ticket created',lines:[`Ticket ID: ${ticket.id}`,`Category: ${ticket.category}`,`Priority: ${ticket.priority}`,`Status: ${ticket.status}`],buttonText:'Open StayFinder',buttonUrl:appUrl()});
  const support=process.env.SUPPORT_EMAIL||'Ghanshyamjangir334@gmail.com';
  await sendMailSafe({to:support,subject:`New StayFinder support ticket • ${ticket.id}`,text:`${ticket.id}\n${user?.name||user?.username||ticket.user_id}\n${ticket.category}\n${ticket.message}`,html:emailTemplate({title:'New support ticket',lines:[`Ticket ID: ${ticket.id}`,`User: ${user?.name||user?.username||ticket.user_id}`,`Role: ${ticket.role}`,`Category: ${ticket.category}`,`Priority: ${ticket.priority}`,`Message: ${ticket.message}`],buttonText:'Open Admin',buttonUrl:`${appUrl()}/admin`})});
}
export async function mailSupportUpdated(ticket){const user=await findUserById(ticket.user_id);if(!user)return;await notifyUser(user,{subject:`Support ticket updated • ${ticket.id}`,title:'Support ticket updated',lines:[`Ticket ID: ${ticket.id}`,`Status: ${ticket.status}`,ticket.admin_note?`Admin note: ${ticket.admin_note}`:''].filter(Boolean),buttonText:'Open StayFinder',buttonUrl:appUrl()});}

export async function mailChatMessage(senderId,bookingId,message){
  const b=await bookingInfo(bookingId);if(!b)return;const sender=await findUserById(senderId);const recipient=await findUserById(clean(senderId)===clean(b.customerId)?(b.pg?.ownerId||''):b.customerId);if(!recipient)return;
  await notifyUser(recipient,{subject:`New StayFinder message • ${bookingId}`,title:'You have a new message',lines:[`Booking ID: ${bookingId}`,`From: ${sender?.name||sender?.username||'StayFinder user'}`,`Message: ${String(message||'').slice(0,300)}`],buttonText:'Open chat',buttonUrl:`${appUrl()}/${recipient.role==='owner'?'owner':'customer'}`});
}

export async function mailReviewSubmitted(customerId,review){
  const b=await bookingInfo(review.booking_id);if(!b)return;const guest=await findUserById(customerId);const owner=await findUserById(b.pg?.ownerId||'');
  await notifyUser(guest,{subject:`Review submitted • ${review.booking_id}`,title:'Thank you for your review',lines:[`Property: ${b.pg?.name||b.pgId}`,`Rating: ${review.rating}/5`],buttonText:'Open StayFinder',buttonUrl:`${appUrl()}/customer`});
  await notifyUser(owner,{subject:`New review • ${b.pg?.name||b.pgId}`,title:'Your property received a review',lines:[`Guest: ${guest?.name||'Guest'}`,`Rating: ${review.rating}/5`,review.comment?`Comment: ${review.comment}`:''].filter(Boolean),buttonText:'Open Host dashboard',buttonUrl:`${appUrl()}/owner`});
}
