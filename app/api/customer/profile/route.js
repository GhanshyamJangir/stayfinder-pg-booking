import { NextResponse } from 'next/server';
import { readSession } from '../../../../lib/session';
import { getCustomerProfile, updateCustomerProfile, findUserById } from '../../../../lib/users';
import { mailProfileUpdated } from '../../../../lib/lifecycle-mail';

export async function GET(){
  try{const u=await readSession();if(!u||u.role!=='customer')return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});return NextResponse.json({ok:true,profile:await getCustomerProfile(u.sub)});}catch(e){return NextResponse.json({ok:false,error:e.message||'Unable to load profile.'},{status:400});}
}
export async function PATCH(req){
  try{const u=await readSession();if(!u||u.role!=='customer')return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});const body=await req.json();const profile=await updateCustomerProfile(u.sub,body);findUserById(u.sub).then(user=>mailProfileUpdated(user)).catch(e=>console.error('PROFILE_MAIL_ERROR',e));return NextResponse.json({ok:true,profile});}catch(e){return NextResponse.json({ok:false,error:e.message||'Unable to update profile.'},{status:400});}
}
