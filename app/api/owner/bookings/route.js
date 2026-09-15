import { NextResponse } from 'next/server';
import { readSession } from '../../../../lib/session';
import { listOwnerBookings,updateBookingStatus } from '../../../../lib/bookings';
import { mailBookingStatus } from '../../../../lib/lifecycle-mail';
import { audit } from '../../../../lib/plus-store';
export async function GET(){const u=await readSession();if(!u||u.role!=='owner')return NextResponse.json({ok:false},{status:401});return NextResponse.json({ok:true,bookings:await listOwnerBookings(u.sub)});}
export async function PATCH(req){try{const u=await readSession();if(!u||u.role!=='owner')return NextResponse.json({ok:false},{status:401});const b=await req.json();await updateBookingStatus(u.sub,b.bookingId,b.status);await audit(u.sub,b.status==='Accepted'?'BOOKING_APPROVED':'BOOKING_STATUS','Booking',b.bookingId,b.status).catch(()=>{});mailBookingStatus(u.sub,b.bookingId,b.status).catch(e=>console.error('BOOKING_STATUS_MAIL_ERROR',e));return NextResponse.json({ok:true});}catch(e){return NextResponse.json({ok:false,error:e.message},{status:400});}}
