import { NextResponse } from 'next/server';
import { readSession } from '../../../../lib/session';
import { getSheets } from '../../../../lib/google';
import { sendPushToUser } from '../../../../lib/push';

const clean=v=>String(v??'').trim();
const same=(a,b)=>clean(a)===clean(b);
async function rows(range){const s=await getSheets();const r=await s.spreadsheets.values.get({spreadsheetId:process.env.GOOGLE_SHEET_ID,range});return r.data.values||[];}
async function bookingById(id){return (await rows('Bookings!A2:L')).find(r=>same(r[0],id))||null;}
async function paymentById(id){return (await rows('Payments!A2:K')).find(r=>same(r[0],id))||null;}
async function ownerForPg(pgId){const r=(await rows('PGs!A2:M')).find(x=>same(x[0],pgId));return r?.[1]||'';}

function bookingPayload(kind,status=''){
  if(kind==='booking-created')return {title:'New booking request',body:'A customer sent a new booking request.',url:'/owner',tag:'booking-new'};
  if(kind==='booking-status')return {title:status==='Accepted'?'Booking accepted':'Booking update',body:status==='Accepted'?'Your booking request was accepted.':'Your booking status has been updated.',url:'/customer',tag:'booking-status'};
  if(kind==='payment-submitted')return {title:'Payment proof received',body:'A customer submitted payment proof for verification.',url:'/owner',tag:'payment-new'};
  if(kind==='payment-status')return {title:status==='Verified'?'Payment verified':'Payment update',body:status==='Verified'?'Your payment was verified and booking is confirmed.':'Your payment needs attention. Open StayFinder for details.',url:'/customer',tag:'payment-status'};
  if(kind==='refund-started')return {title:'Booking cancelled / refund started',body:'The Owner started the cancellation and refund process.',url:'/customer',tag:'refund-started'};
  if(kind==='refund-sent')return {title:'Refund sent',body:'The Owner marked your refund as sent. Check the proof and confirm receipt.',url:'/customer',tag:'refund-sent'};
  if(kind==='refund-customer')return {title:'Refund update',body:'The customer updated the refund status.',url:'/owner',tag:'refund-customer'};
  return null;
}

export async function POST(req){
  try{
    const user=await readSession();if(!user)return NextResponse.json({ok:false,error:'Please login first.'},{status:401});
    const b=await req.json();const kind=clean(b.kind);let target='';let payload=null;
    if(['booking-created','booking-status','payment-submitted','refund-started','refund-sent','refund-customer'].includes(kind)){
      const booking=await bookingById(b.bookingId);if(!booking)throw new Error('Booking not found.');
      const customerId=booking[1],pgId=booking[2],ownerId=await ownerForPg(pgId);
      if(kind==='booking-created'||kind==='payment-submitted'){
        if(user.role!=='customer'||!same(user.sub,customerId))throw new Error('Not allowed.');target=ownerId;
      }else if(kind==='booking-status'||kind==='refund-started'||kind==='refund-sent'){
        if(user.role!=='owner'||!same(user.sub,ownerId))throw new Error('Not allowed.');target=customerId;
      }else if(kind==='refund-customer'){
        if(user.role!=='customer'||!same(user.sub,customerId))throw new Error('Not allowed.');target=ownerId;
      }
      payload=bookingPayload(kind,b.status);
    }else if(kind==='payment-status'){
      const p=await paymentById(b.paymentId);if(!p)throw new Error('Payment not found.');
      const booking=await bookingById(p[1]);if(!booking)throw new Error('Booking not found.');
      const ownerId=await ownerForPg(booking[2]);if(user.role!=='owner'||!same(user.sub,ownerId))throw new Error('Not allowed.');
      target=p[2]||booking[1];payload=bookingPayload(kind,b.status);
    }else throw new Error('Unknown notification event.');
    if(target&&payload)await sendPushToUser(target,payload);
    return NextResponse.json({ok:true});
  }catch(e){console.error('PUSH_EVENT_ERROR',e);return NextResponse.json({ok:false,error:e.message},{status:400});}
}
