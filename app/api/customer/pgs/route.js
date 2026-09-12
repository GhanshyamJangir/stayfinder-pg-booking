import { NextResponse } from 'next/server';
import { readSession } from '../../../../lib/session';
import { listAllPgs } from '../../../../lib/pgs';
import { listRooms } from '../../../../lib/rooms';
export async function GET(){try{const u=await readSession();if(!u||u.role!=='customer')return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});const pgs=await listAllPgs();const rooms=await listRooms();return NextResponse.json({ok:true,pgs:pgs.map(p=>({...p,rooms:rooms.filter(r=>r.pgId===p.id&&r.status!=='Inactive')}))});}catch(e){console.error(e);return NextResponse.json({ok:false,error:'Listings load nahi ho saki.'},{status:500});}}
