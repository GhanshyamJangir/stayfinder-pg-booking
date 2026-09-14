import { NextResponse } from 'next/server';
import { readSession } from '../../../../lib/session';
import { listCustomerBookings, listOwnerBookings } from '../../../../lib/bookings';
import { readRows, appendRow, updateRow, updateRowsByIds } from '../../../../lib/plus-store';
import { uploadBuffer } from '../../../../lib/drive';
import { sendPushToUser } from '../../../../lib/push';

const clean=v=>String(v??'').trim();
const now=()=>new Date().toISOString();
const id=()=>`MSG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
const allowedStatuses=new Set(['Accepted','Confirmed','Refund Pending','Refund Sent']);

async function context(){
  const u=await readSession();
  if(!u||!['customer','owner'].includes(u.role))return null;
  const bookings=u.role==='owner'?await listOwnerBookings(u.sub):await listCustomerBookings(u.sub);
  return {u,bookings};
}
function bookingFor(c,bookingId){const b=c.bookings.find(x=>clean(x.id)===clean(bookingId));if(!b||!allowedStatuses.has(clean(b.status)))throw new Error('Chat is available only for an active accepted booking.');return b;}
function otherUser(c,b){return c.u.role==='owner'?clean(b.customerId):clean(b.pg?.ownerId);}

export async function GET(req){
 try{
  const c=await context();if(!c)return NextResponse.json({ok:false,error:'Please login first.'},{status:401});
  const url=new URL(req.url);const summary=url.searchParams.get('summary');const all=await readRows('Messages');
  const bookingIds=new Set(c.bookings.filter(b=>allowedStatuses.has(clean(b.status))).map(b=>clean(b.id)));
  const mine=all.filter(m=>bookingIds.has(clean(m.booking_id)));
  const unread=mine.filter(m=>clean(m.sender_id)!==clean(c.u.sub)&&!clean(m.read_at)).length;
  if(summary)return NextResponse.json({ok:true,unread});
  const bookingId=clean(url.searchParams.get('bookingId'));bookingFor(c,bookingId);
  let messages=mine.filter(m=>clean(m.booking_id)===bookingId).sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));
  const t=now();const toRead=messages.filter(m=>clean(m.sender_id)!==clean(c.u.sub)&&!clean(m.read_at)).map(m=>({id:m.id,patch:{delivered_at:m.delivered_at||t,read_at:t}}));
  if(toRead.length){await updateRowsByIds('Messages',toRead);messages=messages.map(m=>toRead.some(x=>x.id===m.id)?{...m,delivered_at:m.delivered_at||t,read_at:t}:m);}
  const unreadAfter=mine.filter(m=>clean(m.booking_id)!==bookingId&&clean(m.sender_id)!==clean(c.u.sub)&&!clean(m.read_at)).length;
  return NextResponse.json({ok:true,messages,unread:unreadAfter});
 }catch(e){console.error('MESSAGES_GET_ERROR',e);return NextResponse.json({ok:false,error:e.message},{status:400});}
}

export async function POST(req){
 try{
  const c=await context();if(!c)return NextResponse.json({ok:false,error:'Please login first.'},{status:401});
  const type=req.headers.get('content-type')||'';let bookingId='',message='',file=null;
  if(type.includes('multipart/form-data')){const form=await req.formData();bookingId=clean(form.get('bookingId'));message=clean(form.get('message'));file=form.get('file');}
  else{const body=await req.json();bookingId=clean(body.bookingId);message=clean(body.message);}
  const booking=bookingFor(c,bookingId);if(!message&&(!file||typeof file.arrayBuffer!=='function'))throw new Error('Type a message or attach a file.');
  if(message.length>1000)throw new Error('Message is too long.');
  let attachment={attachment_file_id:'',attachment_name:'',attachment_type:''};
  if(file&&typeof file.arrayBuffer==='function'&&Number(file.size||0)>0){
    if(Number(file.size)>8*1024*1024)throw new Error('Attachment must be under 8 MB.');
    const mime=clean(file.type)||'application/octet-stream';const allowed=mime.startsWith('image/')||['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain'].includes(mime);
    if(!allowed)throw new Error('Only images, PDF, Word, Excel or text files are allowed.');
    const up=await uploadBuffer({buffer:Buffer.from(await file.arrayBuffer()),mimeType:mime,name:file.name||`chat-${Date.now()}`,folderName:`Chat-${bookingId}`});
    attachment={attachment_file_id:up.id,attachment_name:up.name||file.name||'Attachment',attachment_type:mime};
  }
  const item={id:id(),booking_id:bookingId,sender_id:clean(c.u.sub),sender_role:c.u.role,message,...attachment,delivered_at:'',read_at:'',created_at:now()};
  await appendRow('Messages',item);
  const target=otherUser(c,booking);if(target){try{const sent=await sendPushToUser(target,{title:'New StayFinder message',body:message||`Sent ${attachment.attachment_name||'an attachment'}`,url:c.u.role==='owner'?'/customer':'/owner',tag:`chat-${bookingId}`});if(sent?.sent>0){item.delivered_at=now();await updateRow('Messages',item.id,{delivered_at:item.delivered_at});}}catch(e){console.error('CHAT_PUSH_ERROR',e?.message||e);}}
  return NextResponse.json({ok:true,message:item},{status:201});
 }catch(e){console.error('MESSAGES_POST_ERROR',e);return NextResponse.json({ok:false,error:e.message},{status:400});}
}
