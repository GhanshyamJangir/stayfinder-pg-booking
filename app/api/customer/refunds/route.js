import { NextResponse } from 'next/server';
import { readSession } from '../../../../lib/session';
import { listCustomerRefunds, customerRefundAction } from '../../../../lib/refunds';
import { mailRefundCustomerAction } from '../../../../lib/lifecycle-mail';
export async function GET(){const u=await readSession();if(!u||u.role!=='customer')return NextResponse.json({ok:false},{status:401});return NextResponse.json({ok:true,refunds:await listCustomerRefunds(u.sub)});}
export async function PATCH(req){try{const u=await readSession();if(!u||u.role!=='customer')return NextResponse.json({ok:false},{status:401});const b=await req.json();await customerRefundAction(u.sub,b.refundId,b.action,b.note||'');mailRefundCustomerAction(u.sub,b.refundId,b.action,b.note||'').catch(e=>console.error('REFUND_ACTION_MAIL_ERROR',e));return NextResponse.json({ok:true});}catch(e){return NextResponse.json({ok:false,error:e.message},{status:400});}}
