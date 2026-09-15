import { NextResponse } from 'next/server';
import { readSession } from '../../../../lib/session';
import { listCustomerBookings, listOwnerBookings } from '../../../../lib/bookings';
import { listPgsByOwner, listAllPgs } from '../../../../lib/pgs';
import { listRooms } from '../../../../lib/rooms';
import { readRows } from '../../../../lib/plus-store';
import { dueReminders } from '../../../../lib/booking-enhancements';
const clean=v=>String(v??'').trim();
export async function GET(){
 try{const u=await readSession();if(!u)return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
  if(u.role==='admin'){const [tickets,reviews,interactions]=await Promise.all([readRows('SupportTickets'),readRows('Reviews'),readRows('SupportInteractions')]);return NextResponse.json({ok:true,role:'admin',stats:{openTickets:tickets.filter(x=>x.status!=='Resolved').length,reviews:reviews.length,interactions:interactions.length},tickets:tickets.sort((a,b)=>Date.parse(b.created_at||0)-Date.parse(a.created_at||0)).slice(0,8)});}
  const bookings=u.role==='owner'?await listOwnerBookings(u.sub):await listCustomerBookings(u.sub);const confirmed=bookings.filter(x=>x.status==='Confirmed');const upcoming=confirmed.filter(x=>new Date(`${x.checkIn}T00:00:00`)>=new Date(new Date().toDateString())).sort((a,b)=>String(a.checkIn).localeCompare(String(b.checkIn))).slice(0,6);const reviews=await readRows('Reviews');const myReviews=u.role==='customer'?reviews.filter(x=>x.customer_id===clean(u.sub)):reviews.filter(x=>bookings.some(b=>b.pgId===x.pg_id));const notifications=bookings.slice(0,8).map(b=>({id:`B-${b.id}`,title:`${b.pg?.name||'Booking'} · ${b.status}`,body:b.status==='Pending'?'Waiting for Host approval':b.status==='Accepted'?'Booking accepted. Payment can be submitted.':b.status==='Confirmed'?'Stay confirmed. Host contact is available.':`Booking status: ${b.status}`,createdAt:b.createdAt||b.checkIn,type:'booking'}));const reminders=dueReminders(bookings).filter(x=>x.daysLeft<=3).map(x=>({id:`DUE-${x.bookingId}`,title:x.overdue?'Payment overdue':'Payment due soon',body:`${x.title} · ₹${Number(x.amount||0).toLocaleString('en-IN')} · due ${x.dueDate}`,createdAt:x.dueDate,type:'payment_due'}));notifications.unshift(...reminders);
  let extras={};if(u.role==='owner'){const pgs=await listPgsByOwner(u.sub);const rooms=await listRooms();extras={propertyCount:pgs.length,totalBeds:rooms.filter(r=>pgs.some(p=>p.id===r.pgId)).reduce((s,r)=>s+r.totalBeds,0),availableBeds:rooms.filter(r=>pgs.some(p=>p.id===r.pgId)).reduce((s,r)=>s+r.availableBeds,0)};}else{extras={marketplaceCount:(await listAllPgs()).length};}
  return NextResponse.json({ok:true,role:u.role,bookings,upcoming,reviews:myReviews,notifications,...extras});
 }catch(e){return NextResponse.json({ok:false,error:e.message},{status:500});}
}
