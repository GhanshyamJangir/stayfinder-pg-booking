import { NextResponse } from 'next/server';
import { readSession } from '../../../../lib/session';
import { listAllPgs } from '../../../../lib/pgs';
import { listRooms } from '../../../../lib/rooms';
import { readRows } from '../../../../lib/plus-store';
const avg=a=>a.length?a.reduce((s,n)=>s+Number(n||0),0)/a.length:0;
export async function GET(){try{const u=await readSession();if(!u||u.role!=='customer')return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});const [pgs,rooms,reviews]=await Promise.all([listAllPgs(),listRooms(),readRows('Reviews')]);return NextResponse.json({ok:true,pgs:pgs.map(p=>{const rr=reviews.filter(x=>x.pg_id===p.id&&x.status!=='Hidden');return {...p,rooms:rooms.filter(r=>r.pgId===p.id&&r.status!=='Inactive'),rating:avg(rr.map(x=>x.rating)),ratingBreakdown:{overall:avg(rr.map(x=>x.rating)),cleanliness:avg(rr.map(x=>x.cleanliness)),food:avg(rr.map(x=>x.food)),location:avg(rr.map(x=>x.location)),ownerBehaviour:avg(rr.map(x=>x.host_behaviour)),safety:avg(rr.map(x=>x.safety||x.rating)),value:avg(rr.map(x=>x.value_for_money)),count:rr.length},recentReviews:rr.slice(-3).reverse()};})});}catch(e){console.error(e);return NextResponse.json({ok:false,error:'Listings load nahi ho saki.'},{status:500});}}
