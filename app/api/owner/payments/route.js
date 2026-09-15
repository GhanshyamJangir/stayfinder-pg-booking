import { NextResponse } from 'next/server';
import { readSession } from '../../../../lib/session';
import { listOwnerPayments, updatePaymentStatus } from '../../../../lib/payments';
import { mailPaymentStatus } from '../../../../lib/lifecycle-mail';
import { audit } from '../../../../lib/plus-store';
export async function GET(){const u=await readSession();if(!u||u.role!=='owner') return NextResponse.json({ok:false},{status:401});return NextResponse.json({ok:true,payments:await listOwnerPayments(u.sub)});}
export async function PATCH(req){try{const u=await readSession();if(!u||u.role!=='owner') return NextResponse.json({ok:false},{status:401});const b=await req.json();await updatePaymentStatus(u.sub,b.paymentId,b.status,b.reason||'');await audit(u.sub,b.status==='Verified'?'PAYMENT_VERIFIED':'PAYMENT_STATUS','Payment',b.paymentId,`${b.status}${b.reason?`: ${b.reason}`:''}`).catch(()=>{});mailPaymentStatus(u.sub,b.paymentId,b.status,b.reason||'').catch(e=>console.error('PAYMENT_STATUS_MAIL_ERROR',e));return NextResponse.json({ok:true});}catch(e){return NextResponse.json({ok:false,error:e.message},{status:400});}}
