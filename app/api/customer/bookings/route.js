import { NextResponse } from 'next/server';
import { readSession } from '../../../../lib/session';
import { listCustomerBookings,createBooking } from '../../../../lib/bookings';
import { mailBookingCreated } from '../../../../lib/lifecycle-mail';
export async function GET(){const u=await readSession();if(!u||u.role!=='customer')return NextResponse.json({ok:false},{status:401});return NextResponse.json({ok:true,bookings:await listCustomerBookings(u.sub)});}
export async function POST(req){try{const u=await readSession();if(!u||u.role!=='customer')return NextResponse.json({ok:false},{status:401});const booking=await createBooking(u.sub,await req.json());mailBookingCreated(u.sub,booking).catch(e=>console.error('BOOKING_MAIL_ERROR',e));return NextResponse.json({ok:true,booking},{status:201});}catch(e){return NextResponse.json({ok:false,error:e.message},{status:400});}}
