import { NextResponse } from 'next/server';
import { readSession } from '../../../../lib/session';
import { savePushSubscription } from '../../../../lib/push-store';
import { sendPushToUser } from '../../../../lib/push';
export async function POST(req){
  try{
    const user=await readSession();
    if(!user)return NextResponse.json({ok:false,error:'Please login first.'},{status:401});
    const body=await req.json();
    await savePushSubscription(user.sub,body.subscription);
    // First successful subscribe doubles as a real end-to-end test.
    await sendPushToUser(user.sub,{title:'StayFinder alerts are on',body:'You will receive booking and payment updates here.',url:user.role==='owner'?'/owner':'/customer',tag:'stayfinder-enabled'}).catch(()=>{});
    return NextResponse.json({ok:true});
  }catch(e){console.error('PUSH_SUBSCRIBE_ERROR',e);return NextResponse.json({ok:false,error:e.message},{status:500});}
}
