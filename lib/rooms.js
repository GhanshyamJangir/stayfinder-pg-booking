import { getSheets } from './google';
import { listPgsByOwner } from './pgs';
const SHEET='Rooms';
const clean=(v)=>String(v??'').trim();
const normType=(v)=>clean(v).toLowerCase().replace(/\s+/g,' ');

async function rawRooms(){
  const sheets=await getSheets();
  const r=await sheets.spreadsheets.values.get({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!A2:H`});
  return (r.data.values||[]).map((row,i)=>({id:row[0],pgId:row[1],type:row[2],totalBeds:Number(row[3]||0),availableBeds:Number(row[4]||0),rent:Number(row[5]||0),deposit:Number(row[6]||0),status:row[7]||'Active',rowNumber:i+2}));
}
function groupRooms(rows){
  const map=new Map();
  for(const r of rows.filter(x=>x.status!=='Inactive')){
    const key=`${clean(r.pgId)}::${normType(r.type)}`;
    if(!map.has(key)) map.set(key,{...r,sourceIds:[r.id]});
    else{
      const g=map.get(key);
      g.totalBeds+=Number(r.totalBeds||0);
      g.availableBeds+=Number(r.availableBeds||0);
      g.sourceIds.push(r.id);
      // Latest entered pricing wins so owner can correct rate while increasing inventory.
      if(Number(r.rent||0)>0) g.rent=Number(r.rent||0);
      g.deposit=Number(r.deposit||0);
    }
  }
  return [...map.values()].map(({rowNumber,...r})=>r);
}
export async function listRooms(){return groupRooms(await rawRooms());}
export async function listRoomsByPg(pgId){return (await listRooms()).filter(x=>clean(x.pgId)===clean(pgId));}
export async function listRoomsByOwner(ownerId){const ids=new Set((await listPgsByOwner(ownerId)).map(x=>x.id));return (await listRooms()).filter(x=>ids.has(x.pgId));}

export async function createRoom(ownerId,body){
  const pgs=await listPgsByOwner(ownerId); if(!pgs.some(x=>x.id===clean(body.pgId))) throw new Error('Invalid property.');
  const total=Math.max(1,Number(body.totalBeds||0)); const available=Math.max(0,Math.min(total,Number(body.availableBeds??total)));
  const rent=Math.max(0,Number(body.rent||0)); const deposit=Math.max(0,Number(body.deposit||0));
  const type=clean(body.type); if(!type||!rent) throw new Error('Room type aur rent required hai.');
  const rows=await rawRooms();
  const matches=rows.filter(x=>clean(x.pgId)===clean(body.pgId)&&normType(x.type)===normType(type)&&x.status!=='Inactive');
  const sheets=await getSheets();
  if(matches.length){
    const primary=matches[0];
    const mergedTotal=matches.reduce((s,x)=>s+Number(x.totalBeds||0),0)+total;
    const mergedAvailable=matches.reduce((s,x)=>s+Number(x.availableBeds||0),0)+available;
    await sheets.spreadsheets.values.update({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!C${primary.rowNumber}:H${primary.rowNumber}`,valueInputOption:'RAW',requestBody:{values:[[type,mergedTotal,mergedAvailable,rent,deposit,'Active']]}});
    // Old duplicate rows are hidden after consolidation. Existing booking IDs still remain resolvable by reserve/restore helpers below.
    for(const dup of matches.slice(1)){
      await sheets.spreadsheets.values.update({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!H${dup.rowNumber}`,valueInputOption:'RAW',requestBody:{values:[['Inactive']]}});
    }
    return {id:primary.id,pgId:clean(body.pgId),type,totalBeds:mergedTotal,availableBeds:mergedAvailable,rent,deposit,status:'Active',merged:true};
  }
  const room={id:`RM-${Date.now().toString(36).toUpperCase()}`,pgId:clean(body.pgId),type,totalBeds:total,availableBeds:available,rent,deposit,status:'Active'};
  await sheets.spreadsheets.values.append({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!A:H`,valueInputOption:'RAW',insertDataOption:'INSERT_ROWS',requestBody:{values:[[room.id,room.pgId,room.type,room.totalBeds,room.availableBeds,room.rent,room.deposit,room.status]]}});
  return room;
}

async function resolveActiveGroup(roomId){
  const rows=await rawRooms();
  const original=rows.find(x=>clean(x.id)===clean(roomId));
  if(!original) throw new Error('Room not found.');
  const group=rows.filter(x=>clean(x.pgId)===clean(original.pgId)&&normType(x.type)===normType(original.type)&&x.status!=='Inactive');
  if(!group.length) throw new Error('Room type inactive hai.');
  return {rows,original,group};
}
export async function reserveOneBed(roomId){
  const sheets=await getSheets(); const {group}=await resolveActiveGroup(roomId);
  const target=group.find(x=>Number(x.availableBeds||0)>0); if(!target) throw new Error('Room ab available nahi hai.');
  const next=Number(target.availableBeds||0)-1;
  await sheets.spreadsheets.values.update({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!E${target.rowNumber}`,valueInputOption:'RAW',requestBody:{values:[[next]]}});return next;
}
export async function restoreOneBed(roomId){
  const sheets=await getSheets(); const {group}=await resolveActiveGroup(roomId);
  const target=group[0]; const total=Number(target.totalBeds||0),current=Number(target.availableBeds||0);const next=Math.min(total,current+1);
  await sheets.spreadsheets.values.update({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!E${target.rowNumber}`,valueInputOption:'RAW',requestBody:{values:[[next]]}});return next;
}
