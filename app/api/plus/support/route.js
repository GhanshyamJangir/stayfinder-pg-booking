import { NextResponse } from 'next/server';
import { readSession } from '../../../../lib/session';
import { appendRow, readRows, updateRow, audit } from '../../../../lib/plus-store';
import { findUserById } from '../../../../lib/users';
import { mailSupportCreated, mailSupportUpdated } from '../../../../lib/lifecycle-mail';

const clean=v=>String(v??'').trim();
export async function GET(){
 try{const u=await readSession();if(!u)return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});let rows=await readRows('SupportTickets');if(u.role!=='admin')rows=rows.filter(x=>clean(x.user_id)===clean(u.sub));rows.sort((a,b)=>Date.parse(b.created_at||0)-Date.parse(a.created_at||0));return NextResponse.json({ok:true,tickets:rows});}catch(e){return NextResponse.json({ok:false,error:e.message},{status:500});}
}
export async function POST(req){
 try{const u=await readSession();if(!u)return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});const b=await req.json();const msg=clean(b.message),cat=clean(b.category)||'Other';if(msg.length<5)throw new Error('Please describe the issue.');const now=new Date().toISOString();const t={id:`SUP-${Date.now().toString(36).toUpperCase()}`,user_id:clean(u.sub),role:u.role,booking_id:clean(b.bookingId),pg_id:clean(b.pgId),category:cat,subject:clean(b.subject)||cat,message:msg,priority:clean(b.priority)||'Normal',status:'Open',created_at:now,updated_at:now,admin_note:''};await appendRow('SupportTickets',t);findUserById(u.sub).then(user=>mailSupportCreated(user,t)).catch(e=>console.error('SUPPORT_MAIL_ERROR',e));return NextResponse.json({ok:true,ticket:t},{status:201});}catch(e){return NextResponse.json({ok:false,error:e.message},{status:400});}
}
export async function PATCH(req){
 try{const u=await readSession();if(!u||u.role!=='admin')return NextResponse.json({ok:false,error:'Admin only'},{status:403});const b=await req.json();const allowed=['Open','In Progress','Waiting for User','Resolved'];if(!allowed.includes(b.status))throw new Error('Invalid status.');const row=await updateRow('SupportTickets',b.id,{status:b.status,admin_note:clean(b.adminNote),updated_at:new Date().toISOString()});await audit(u.sub,'support_status','SupportTicket',b.id,`${b.status} ${clean(b.adminNote)}`);mailSupportUpdated(row).catch(e=>console.error('SUPPORT_UPDATE_MAIL_ERROR',e));return NextResponse.json({ok:true,ticket:row});}catch(e){return NextResponse.json({ok:false,error:e.message},{status:400});}
}
