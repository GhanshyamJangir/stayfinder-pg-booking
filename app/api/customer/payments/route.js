import { NextResponse } from 'next/server';
import { readSession } from '../../../../lib/session';
import { listCustomerPayments,createPayment } from '../../../../lib/payments';
import { mailPaymentSubmitted } from '../../../../lib/lifecycle-mail';
export async function GET(){const u=await readSession();if(!u||u.role!=='customer')return NextResponse.json({ok:false},{status:401});return NextResponse.json({ok:true,payments:await listCustomerPayments(u.sub)});}
export async function POST(req){try{const u=await readSession();if(!u||u.role!=='customer')return NextResponse.json({ok:false},{status:401});const f=await req.formData();const file=f.get('proof');const p=await createPayment(u.sub,{bookingId:f.get('bookingId'),amount:f.get('amount'),mode:f.get('mode'),transactionRef:f.get('transactionRef'),file:file&&typeof file.arrayBuffer==='function'?file:null});mailPaymentSubmitted(u.sub,p).catch(e=>console.error('PAYMENT_MAIL_ERROR',e));return NextResponse.json({ok:true,payment:p},{status:201});}catch(e){return NextResponse.json({ok:false,error:e.message},{status:400});}}
