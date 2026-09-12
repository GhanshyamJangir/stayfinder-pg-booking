import { NextResponse } from 'next/server';
import { readSession } from '../../../../lib/session';
import { listOwnerPayments, updatePaymentStatus } from '../../../../lib/payments';
import { mailPaymentStatus } from '../../../../lib/lifecycle-mail';
export async function GET(){const u=await readSession();if(!u||u.role!=='owner') return NextResponse.json({ok:false},{status:401});return NextResponse.json({ok:true,payments:await listOwnerPayments(u.sub)});}
export async function PATCH(req){try{const u=await readSession();if(!u||u.role!=='owner') return NextResponse.json({ok:false},{status:401});const b=await req.json();await updatePaymentStatus(u.sub,b.paymentId,b.status,b.reason||'');mailPaymentStatus(u.sub,b.paymentId,b.status,b.reason||'').catch(e=>console.error('PAYMENT_STATUS_MAIL_ERROR',e));return NextResponse.json({ok:true});}catch(e){return NextResponse.json({ok:false,error:e.message},{status:400});}}
