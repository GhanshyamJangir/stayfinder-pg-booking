import { NextResponse } from 'next/server';
import { readSession } from '../../../../lib/session';
import { getCustomerBookingPaymentSettings } from '../../../../lib/paymentSettings';

export async function GET(req){
  try{
    const u=await readSession(); if(!u||u.role!=='customer') return NextResponse.json({ok:false},{status:401});
    const bookingId=new URL(req.url).searchParams.get('bookingId');
    if(!bookingId) return NextResponse.json({ok:false,error:'Booking required hai.'},{status:400});
    const data=await getCustomerBookingPaymentSettings(u.sub,bookingId);
    return NextResponse.json({ok:true,...data});
  }catch(e){return NextResponse.json({ok:false,error:e.message},{status:400});}
}
