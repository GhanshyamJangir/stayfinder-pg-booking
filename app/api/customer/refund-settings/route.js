import { NextResponse } from 'next/server';
import { readSession } from '../../../../lib/session';
import { getCustomerRefundSettings, saveCustomerRefundSettings } from '../../../../lib/customer-refund-settings';

export async function GET(){
  try{const u=await readSession();if(!u||u.role!=='customer')return NextResponse.json({ok:false},{status:401});return NextResponse.json({ok:true,settings:await getCustomerRefundSettings(u.sub)});}
  catch(e){return NextResponse.json({ok:false,error:e.message},{status:400});}
}
export async function POST(req){
  try{
    const u=await readSession();if(!u||u.role!=='customer')return NextResponse.json({ok:false},{status:401});
    const f=await req.formData();const qr=f.get('qr');
    const settings=await saveCustomerRefundSettings(u.sub,{upiName:f.get('upiName'),upiId:f.get('upiId'),bankName:f.get('bankName'),accountHolder:f.get('accountHolder'),accountNumber:f.get('accountNumber'),ifsc:f.get('ifsc'),qr:qr&&typeof qr.arrayBuffer==='function'?qr:null});
    return NextResponse.json({ok:true,settings});
  }catch(e){return NextResponse.json({ok:false,error:e.message},{status:400});}
}
