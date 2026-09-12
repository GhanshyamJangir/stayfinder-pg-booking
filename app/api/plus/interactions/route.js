import { NextResponse } from 'next/server';
import { readSession } from '../../../../lib/session';
import { appendRow, readRows } from '../../../../lib/plus-store';
const clean=v=>String(v??'').trim();
export async function GET(){try{const u=await readSession();if(!u||u.role!=='admin')return NextResponse.json({ok:false,error:'Admin only'},{status:403});const rows=(await readRows('SupportInteractions')).sort((a,b)=>Date.parse(b.created_at||0)-Date.parse(a.created_at||0));return NextResponse.json({ok:true,interactions:rows});}catch(e){return NextResponse.json({ok:false,error:e.message},{status:500});}}
export async function POST(req){try{const u=await readSession();if(!u)return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});const b=await req.json();const row={id:`INT-${Date.now().toString(36).toUpperCase()}`,ticket_id:clean(b.ticketId),user_id:clean(u.sub),role:u.role,channel:clean(b.channel)||'Help',target:clean(b.target),created_at:new Date().toISOString()};await appendRow('SupportInteractions',row);return NextResponse.json({ok:true,interaction:row},{status:201});}catch(e){return NextResponse.json({ok:false,error:e.message},{status:400});}}
