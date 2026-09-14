import { NextResponse } from 'next/server';
import { readSession } from '../../../../lib/session';
import { listCustomerBookings, listOwnerBookings } from '../../../../lib/bookings';
import { cancellationQuote, listPolicies } from '../../../../lib/platform-controls';
const clean=v=>String(v??'').trim();
export async function GET(req){try{const u=await readSession();if(!u)return NextResponse.json({ok:false},{status:401});const bookingId=clean(new URL(req.url).searchParams.get('bookingId'));if(!bookingId)return NextResponse.json({ok:true,policies:await listPolicies()});const list=u.role==='owner'?await listOwnerBookings(u.sub):await listCustomerBookings(u.sub);const booking=list.find(x=>clean(x.id)===bookingId);if(!booking)throw new Error('Booking not found.');return NextResponse.json({ok:true,quote:await cancellationQuote(booking)});}catch(e){return NextResponse.json({ok:false,error:e.message},{status:400});}}
