import { NextResponse } from 'next/server';
import { readSession } from '../../../../lib/session';
export const dynamic='force-dynamic';
export async function GET(){
  const user=await readSession();
  if(!user)return NextResponse.json({ok:false,error:'Please login first.'},{status:401});
  const publicKey=process.env.VAPID_PUBLIC_KEY||'';
  if(!publicKey)return NextResponse.json({ok:false,error:'Push notifications are not configured yet.'},{status:503});
  return NextResponse.json({ok:true,publicKey});
}
