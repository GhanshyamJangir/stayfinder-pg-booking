import { NextResponse } from 'next/server';
import { readSession } from '../../../../../../lib/session';
import { getConfirmedStayContact } from '../../../../../../lib/contacts';
export async function GET(req,{params}){try{const u=await readSession();if(!u||u.role!=='customer')return NextResponse.json({ok:false},{status:401});const {id}=await params;return NextResponse.json({ok:true,contact:await getConfirmedStayContact(u.sub,id)});}catch(e){return NextResponse.json({ok:false,error:e.message},{status:400});}}
