import { NextResponse } from 'next/server';
import { readSession } from '../../../../lib/session';
import { getOwnerPaymentSettings, saveOwnerPaymentSettings } from '../../../../lib/paymentSettings';

export async function GET(){
  const u=await readSession(); if(!u||u.role!=='owner') return NextResponse.json({ok:false},{status:401});
  return NextResponse.json({ok:true,settings:await getOwnerPaymentSettings(u.sub)});
}
export async function POST(req){
  try{
    const u=await readSession(); if(!u||u.role!=='owner') return NextResponse.json({ok:false},{status:401});
    const f=await req.formData(); const qr=f.get('qr');
    const settings=await saveOwnerPaymentSettings(u.sub,{
      upiName:f.get('upiName'),upiId:f.get('upiId'),bankName:f.get('bankName'),accountHolder:f.get('accountHolder'),
      accountNumber:f.get('accountNumber'),ifsc:f.get('ifsc'),note:f.get('note')
    },qr&&typeof qr.arrayBuffer==='function'&&qr.size?qr:null);
    return NextResponse.json({ok:true,settings});
  }catch(e){return NextResponse.json({ok:false,error:e.message},{status:400});}
}
