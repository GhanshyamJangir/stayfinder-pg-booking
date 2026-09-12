import { NextResponse } from 'next/server';
import { readSession } from '../../../../lib/session';
import { createPg, listPgsByOwner, updatePgLocation } from '../../../../lib/pgs';

async function ownerSession(){const user=await readSession();return user&&user.role==='owner'?user:null;}
export async function GET(){try{const user=await ownerSession();if(!user)return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});return NextResponse.json({ok:true,pgs:await listPgsByOwner(user.sub)});}catch(error){return NextResponse.json({ok:false,error:'Properties load nahi ho saki.'},{status:500});}}
export async function POST(request){try{const user=await ownerSession();if(!user)return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});return NextResponse.json({ok:true,pg:await createPg(user.sub,await request.json())},{status:201});}catch(error){return NextResponse.json({ok:false,error:error.message||'PG save nahi hua.'},{status:400});}}
export async function PATCH(request){try{const user=await ownerSession();if(!user)return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});const body=await request.json();const location=await updatePgLocation(user.sub,body.pgId,body.latitude,body.longitude);return NextResponse.json({ok:true,...location});}catch(error){return NextResponse.json({ok:false,error:error.message||'Exact location save nahi hui.'},{status:400});}}
