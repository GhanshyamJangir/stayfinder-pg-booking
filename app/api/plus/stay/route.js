import { NextResponse } from 'next/server';
import { readSession } from '../../../../lib/session';
import { listCustomerBookings, listOwnerBookings } from '../../../../lib/bookings';
import { lifecycleForBookings, requestCheckinOtp, verifyCheckinOtp, requestCheckinQr, verifyCheckinQr, requestCheckout, confirmCheckout } from '../../../../lib/platform-controls';

const clean=v=>String(v??'').trim();

async function bookingsFor(user){
  if(user.role==='owner') return await listOwnerBookings(user.sub);
  if(user.role==='customer') return await listCustomerBookings(user.sub);
  return [];
}

export async function GET(){
  try{
    const user=await readSession();
    if(!user)return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
    const bookings=await bookingsFor(user);
    const confirmed=bookings.filter(b=>b.status==='Confirmed');
    const items=await lifecycleForBookings(confirmed.map(b=>b.id));
    return NextResponse.json({ok:true,items});
  }catch(e){
    console.error('PLUS_STAY_GET_ERROR',e);
    return NextResponse.json({ok:false,error:e?.message||'Stay service failed.'},{status:500});
  }
}

export async function POST(req){
  try{
    const user=await readSession();
    if(!user)return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
    const body=await req.json();
    const bookingId=clean(body.bookingId);
    const action=clean(body.action);
    if(!bookingId)throw new Error('Booking is required.');

    const bookings=await bookingsFor(user);
    const booking=bookings.find(b=>clean(b.id)===bookingId);
    if(!booking) return NextResponse.json({ok:false,error:'Booking not found.'},{status:404});
    if(booking.status!=='Confirmed') throw new Error('Stay actions are available only after booking confirmation.');

    let item;
    if(action==='request-checkin'){
      if(user.role!=='owner')return NextResponse.json({ok:false,error:'Owner only.'},{status:403});
      item=await requestCheckinOtp(booking,booking.customerId);
    }else if(action==='verify-checkin'){
      if(user.role!=='customer')return NextResponse.json({ok:false,error:'Customer only.'},{status:403});
      item=await verifyCheckinOtp(bookingId,body.otp);
    }else if(action==='request-checkin-qr'){
      if(user.role!=='customer')return NextResponse.json({ok:false,error:'Customer only.'},{status:403});
      const out=await requestCheckinQr(booking);
      return NextResponse.json({ok:true,item:out.item,qrToken:out.token});
    }else if(action==='verify-checkin-qr'){
      if(user.role!=='owner')return NextResponse.json({ok:false,error:'Owner only.'},{status:403});
      item=await verifyCheckinQr(bookingId,body.qrToken);
    }else if(action==='request-checkout'){
      if(user.role!=='customer')return NextResponse.json({ok:false,error:'Customer only.'},{status:403});
      item=await requestCheckout(bookingId);
    }else if(action==='confirm-checkout'){
      if(user.role!=='owner')return NextResponse.json({ok:false,error:'Owner only.'},{status:403});
      item=await confirmCheckout(bookingId);
    }else{
      return NextResponse.json({ok:false,error:'Invalid stay action.'},{status:400});
    }
    return NextResponse.json({ok:true,item});
  }catch(e){
    console.error('PLUS_STAY_POST_ERROR',e);
    return NextResponse.json({ok:false,error:e?.message||'Stay action failed.'},{status:400});
  }
}
