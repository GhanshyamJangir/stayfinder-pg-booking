import { getSheets } from './google';

const SHEET='PGs';
const clean=v=>String(v??'').trim();
function parseImages(v){try{const a=JSON.parse(v||'[]');return Array.isArray(a)?a:[];}catch{return clean(v)?clean(v).split(',').map(x=>x.trim()).filter(Boolean):[];}}
function mapsUrl(lat,lng,address=''){if(Number.isFinite(Number(lat))&&Number.isFinite(Number(lng)))return `https://www.google.com/maps/search/?api=1&query=${Number(lat)},${Number(lng)}`;return address?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`:'';}
function map(row){
 const rawDesc=clean(row[5]); const gender=rawDesc.match(/\[For: ([^\]]+)\]/)?.[1]||'';
 const description=rawDesc.replace(/\s*\[For: [^\]]+\]\s*/,'').trim(); const latitude=clean(row[11]),longitude=clean(row[12]);
 return{id:row[0],ownerId:row[1],name:row[2],address:row[3],city:row[4],description,gender,amenities:clean(row[6]).split(',').map(x=>x.trim()).filter(Boolean),images:parseImages(row[7]),status:row[8]||'Active',createdAt:row[9]||'',mapLink:clean(row[10])||mapsUrl(latitude,longitude,`${row[3]||''}, ${row[4]||''}`),latitude,longitude,hasExactLocation:!!(latitude&&longitude)};
}
async function rows(){const s=await getSheets();const r=await s.spreadsheets.values.get({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!A2:M`});return r.data.values||[];}
export async function listAllPgs(activeOnly=true){const out=(await rows()).map(map).reverse();return activeOnly?out.filter(x=>String(x.status).toLowerCase()==='active'):out;}
export async function listPgsByOwner(ownerId){return (await rows()).filter(r=>clean(r[1])===clean(ownerId)).map(map).reverse();}
export async function createPg(ownerId,body){
 const name=clean(body.name),address=clean(body.address),city=clean(body.city); if(!name||!address||!city) throw new Error('PG name, city aur address required hai.');
 const id=`PG-${Date.now().toString(36).toUpperCase()}`; const gender=clean(body.gender)||'Unisex'; const desc=`${clean(body.description)}${clean(body.description)?' ':''}[For: ${gender}]`;
 const amenities=Array.isArray(body.amenities)?body.amenities.map(clean).filter(Boolean).join(', '):''; const status=['Active','Draft','Inactive'].includes(body.status)?body.status:'Active'; const createdAt=new Date().toISOString();
 const latitude=clean(body.latitude),longitude=clean(body.longitude),mapLink=mapsUrl(latitude,longitude,`${address}, ${city}`);
 const s=await getSheets(); await s.spreadsheets.values.update({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!K1:M1`,valueInputOption:'RAW',requestBody:{values:[['Map Link','Latitude','Longitude']]}}); await s.spreadsheets.values.append({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!A:M`,valueInputOption:'RAW',insertDataOption:'INSERT_ROWS',requestBody:{values:[[id,clean(ownerId),name,address,city,desc,amenities,'',status,createdAt,mapLink,latitude,longitude]]}});
 return{id,ownerId:clean(ownerId),name,address,city,description:clean(body.description),gender,amenities:Array.isArray(body.amenities)?body.amenities:[],images:[],status,createdAt,mapLink,latitude,longitude,hasExactLocation:!!(latitude&&longitude)};
}
export async function setPgImages(ownerId,pgId,fileIds){
 const all=await rows(); const idx=all.findIndex(r=>r[0]===pgId&&clean(r[1])===clean(ownerId)); if(idx<0) throw new Error('PG not found.');
 const s=await getSheets(); await s.spreadsheets.values.update({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!H${idx+2}`,valueInputOption:'RAW',requestBody:{values:[[JSON.stringify(fileIds)]]}}); return true;
}
export async function updatePgLocation(ownerId,pgId,latitude,longitude){
 const all=await rows(); const idx=all.findIndex(r=>clean(r[0])===clean(pgId)&&clean(r[1])===clean(ownerId)); if(idx<0) throw new Error('PG not found.');
 const lat=Number(latitude),lng=Number(longitude); if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<-90||lat>90||lng<-180||lng>180) throw new Error('Valid GPS location nahi mili. Location permission allow karke retry karein.');
 const link=mapsUrl(lat,lng); const s=await getSheets(); await s.spreadsheets.values.update({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!K${idx+2}:M${idx+2}`,valueInputOption:'RAW',requestBody:{values:[[link,String(lat),String(lng)]]}}); return {mapLink:link,latitude:String(lat),longitude:String(lng)};
}
