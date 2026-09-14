import { NextResponse } from 'next/server';
import { readSession } from '../../../../lib/session';
import { listCustomerBookings } from '../../../../lib/bookings';
import { lifecycleForBookings } from '../../../../lib/platform-controls';
import { readRows, appendRow } from '../../../../lib/plus-store';

const clean=v=>String(v??'').trim();
const num=(v,d=5)=>Math.min(5,Math.max(1,Number(v)||d));

async function customerContext(){const u=await readSession();if(!u||u.role!=='customer')return null;const bookings=await listCustomerBookings(u.sub);return {u,bookings};}
export async function GET(){
 try{
  const u=await readSession();if(!u||!['customer','owner'].includes(u.role))return NextResponse.json({ok:false,error:'Please login first.'},{status:401});
  const all=await readRows('Reviews');
  if(u.role==='customer'){
    const bookings=await listCustomerBookings(u.sub);const ids=bookings.map(b=>b.id);const lifecycle=await lifecycleForBookings(ids);const eligibleBookingIds=lifecycle.filter(x=>clean(x.checkout_verified_at)||clean(x.status)==='Checked Out').map(x=>clean(x.booking_id));
    return NextResponse.json({ok:true,reviews:all.filter(r=>clean(r.customer_id)===clean(u.sub)).reverse(),eligibleBookingIds});
  }
  return NextResponse.json({ok:true,reviews:all.filter(r=>clean(r.status)!=='Hidden').reverse(),eligibleBookingIds:[]});
 }catch(e){console.error('REVIEWS_GET_ERROR',e);return NextResponse.json({ok:false,error:e.message},{status:500});}
}
export async function POST(req){
 try{
  const c=await customerContext();if(!c)return NextResponse.json({ok:false,error:'Customer login required.'},{status:401});const b=await req.json();const bookingId=clean(b.bookingId);const booking=c.bookings.find(x=>clean(x.id)===bookingId);if(!booking)throw new Error('Booking not found.');
  const life=(await lifecycleForBookings([bookingId]))[0];if(!life||(!clean(life.checkout_verified_at)&&clean(life.status)!=='Checked Out'))throw new Error('Review can be submitted only after checkout is completed.');
  const reviews=await readRows('Reviews');if(reviews.some(r=>clean(r.booking_id)===bookingId&&clean(r.customer_id)===clean(c.u.sub)))throw new Error('You have already reviewed this stay.');
  const review={id:`REV-${Date.now().toString(36).toUpperCase()}`,booking_id:bookingId,pg_id:clean(booking.pgId),customer_id:clean(c.u.sub),rating:num(b.rating),cleanliness:num(b.cleanliness),food:num(b.food),location:num(b.location),host_behaviour:num(b.hostBehaviour),value_for_money:num(b.valueForMoney),comment:clean(b.comment).slice(0,1500),status:'Published',created_at:new Date().toISOString()};
  await appendRow('Reviews',review);return NextResponse.json({ok:true,review},{status:201});
 }catch(e){console.error('REVIEWS_POST_ERROR',e);return NextResponse.json({ok:false,error:e.message},{status:400});}
}
