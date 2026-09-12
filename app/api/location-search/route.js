import { NextResponse } from 'next/server';

const cache = new Map();
const GOOGLE_AUTOCOMPLETE = 'https://places.googleapis.com/v1/places:autocomplete';
const GOOGLE_PLACE = 'https://places.googleapis.com/v1/places/';

function apiKey(){ return String(process.env.GOOGLE_MAPS_API_KEY || '').trim(); }
function cityFromComponents(parts=[]){
  const wanted=['locality','administrative_area_level_3','administrative_area_level_2'];
  for(const type of wanted){ const hit=parts.find(x=>(x.types||[]).includes(type)); if(hit) return hit.longText||hit.shortText||''; }
  return '';
}

async function autocomplete(q,city){
  const key=apiKey();
  if(!key) return {configured:false,results:[]};
  const input=[q,city].filter(Boolean).join(', ');
  const r=await fetch(GOOGLE_AUTOCOMPLETE,{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat'},body:JSON.stringify({input,includedRegionCodes:['in'],languageCode:'en'}),cache:'no-store'});
  if(!r.ok){const text=await r.text();console.error('GOOGLE_PLACES_AUTOCOMPLETE',r.status,text.slice(0,500));throw new Error('Google Places search is not available. Check the API key and Places API setup.');}
  const d=await r.json();
  const results=(d.suggestions||[]).map((x,i)=>x.placePrediction).filter(Boolean).map((p,i)=>({id:p.placeId||`google-${i}`,placeId:p.placeId,provider:'google',name:p.structuredFormat?.mainText?.text||p.text?.text||'Place',address:p.text?.text||'',city:'',latitude:'',longitude:''}));
  return {configured:true,results};
}

async function details(id){
  const key=apiKey(); if(!key) return null;
  const r=await fetch(`${GOOGLE_PLACE}${encodeURIComponent(id)}`,{headers:{'X-Goog-Api-Key':key,'X-Goog-FieldMask':'id,displayName,formattedAddress,addressComponents,location'},cache:'no-store'});
  if(!r.ok){const text=await r.text();console.error('GOOGLE_PLACE_DETAILS',r.status,text.slice(0,500));throw new Error('Could not load the selected Google place.');}
  const p=await r.json();
  return {id:p.id||id,placeId:p.id||id,provider:'google',name:p.displayName?.text||String(p.formattedAddress||'').split(',')[0]||'Selected place',address:p.formattedAddress||'',city:cityFromComponents(p.addressComponents),latitude:String(p.location?.latitude??''),longitude:String(p.location?.longitude??'')};
}

export async function GET(request){
  const {searchParams}=new URL(request.url);
  const id=String(searchParams.get('id')||'').trim();
  try{
    if(id){const place=await details(id);if(!apiKey())return NextResponse.json({ok:false,error:'Google Places API is not configured yet.'},{status:503});return NextResponse.json({ok:true,place});}
    const q=String(searchParams.get('q')||'').trim(),city=String(searchParams.get('city')||'Jaipur').trim();
    if(q.length<2)return NextResponse.json({ok:true,configured:Boolean(apiKey()),provider:'google',results:[]});
    if(!apiKey())return NextResponse.json({ok:true,configured:false,provider:'google',results:[],message:'Google Places API key is not configured yet.'});
    const ck=`${q.toLowerCase()}|${city.toLowerCase()}`;const hit=cache.get(ck);if(hit&&Date.now()-hit.t<5*60*1000)return NextResponse.json({ok:true,configured:true,provider:'google',results:hit.v});
    const out=await autocomplete(q,city);cache.set(ck,{t:Date.now(),v:out.results});if(cache.size>250)cache.delete(cache.keys().next().value);
    return NextResponse.json({ok:true,configured:true,provider:'google',results:out.results});
  }catch(e){console.error('LOCATION_SEARCH_ERROR',e);return NextResponse.json({ok:false,error:e.message||'Location search failed.'},{status:502});}
}
