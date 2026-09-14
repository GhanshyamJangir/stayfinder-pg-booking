'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import StayFinderPlus from './StayFinderPlus';

const AMENITIES=['Wi-Fi','Food','AC','CCTV','Laundry','Housekeeping','Parking','Power Backup','Gym','Balcony','Attached Bathroom','Study Room','Geyser','Security','Lift','Refrigerator','Common Kitchen','RO Water','Daily Cleaning','TV'];
const geoDistanceKm=(a,b,c,d)=>{const R=6371,toRad=x=>x*Math.PI/180;const dLat=toRad(c-a),dLng=toRad(d-b);const q=Math.sin(dLat/2)**2+Math.cos(toRad(a))*Math.cos(toRad(c))*Math.sin(dLng/2)**2;return 2*R*Math.asin(Math.sqrt(q));};

export default function DashboardShell({user,role}){
 const router=useRouter(); const owner=role==='owner';
 const [notice,setNotice]=useState(''); const [loading,setLoading]=useState(false); const [processingText,setProcessingText]=useState(''); const [contactInfo,setContactInfo]=useState(null); const liveChannelRef=useRef(null); const liveSyncBusy=useRef(false); const liveSyncTimer=useRef(null); const pendingLiveSync=useRef(false); const ownerDraftDirty=useRef(false);
 // customer
 const [customerView,setCustomerView]=useState('explore'); const [pgs,setPgs]=useState([]); const [bookings,setBookings]=useState([]); const [payments,setPayments]=useState([]); const [customerRefunds,setCustomerRefunds]=useState([]); const [selectedPg,setSelectedPg]=useState(null); const [saved,setSaved]=useState([]);
 const [city,setCity]=useState('Jaipur'),[searchArea,setSearchArea]=useState(''),[listingType,setListingType]=useState('Any'),[roomType,setRoomType]=useState('Any'),[gender,setGender]=useState('Any'),[maxPrice,setMaxPrice]=useState('20000'),[activeCategory,setActiveCategory]=useState('All Listings'); const [customerLocation,setCustomerLocation]=useState(null); const [locationStatus,setLocationStatus]=useState('');
 const [bookingForm,setBookingForm]=useState({roomId:'',checkIn:'',checkOut:'',stayMonths:'1'}); const [paymentForm,setPaymentForm]=useState({bookingId:'',amount:'',mode:'UPI',transactionRef:'',proof:null}); const [paymentFileKey,setPaymentFileKey]=useState(0); const [customerPaySettings,setCustomerPaySettings]=useState(null); const [refundSettings,setRefundSettings]=useState(null); const [refundSettingsForm,setRefundSettingsForm]=useState({upiName:'',upiId:'',bankName:'',accountHolder:'',accountNumber:'',ifsc:'',qr:null}); const [refundQrKey,setRefundQrKey]=useState(0); const [customerProfile,setCustomerProfile]=useState({mobile:user?.phone||'',email:user?.email||''}); const [customerProfileForm,setCustomerProfileForm]=useState({mobile:user?.phone||'',email:user?.email||''});
 // owner
 const [ownerView,setOwnerView]=useState('overview'),[ownerPgs,setOwnerPgs]=useState([]),[rooms,setRooms]=useState([]),[ownerBookings,setOwnerBookings]=useState([]),[ownerPayments,setOwnerPayments]=useState([]),[ownerRefunds,setOwnerRefunds]=useState([]);
 const [pgForm,setPgForm]=useState({listingType:'PG',name:'',address:'',city:'Jaipur',description:'',gender:'Boys',amenities:['Wi-Fi','CCTV'],status:'Active',latitude:'',longitude:''}); const [photos,setPhotos]=useState([]); const [helpOpen,setHelpOpen]=useState(false); const [ownerPreviewPg,setOwnerPreviewPg]=useState(null); const [ownerPlaceQuery,setOwnerPlaceQuery]=useState(''); const [ownerPlaceSuggestions,setOwnerPlaceSuggestions]=useState([]); const [ownerPlaceSearching,setOwnerPlaceSearching]=useState(false); const skipOwnerPlaceSearch=useRef(false); const ownerBaseLoaded=useRef(false); const ownerViewLoaded=useRef(new Set());
 const [roomForm,setRoomForm]=useState({pgId:'',type:'Single',totalBeds:1,availableBeds:1,rent:'',deposit:''}); const [ownerPaySettings,setOwnerPaySettings]=useState(null); const [ownerPayForm,setOwnerPayForm]=useState({upiName:'',upiId:'',bankName:'',accountHolder:'',accountNumber:'',ifsc:'',note:'',qr:null}); const [refundForm,setRefundForm]=useState({refundId:'',transactionRef:'',proof:null}); const [refundFileKey,setRefundFileKey]=useState(0);

 async function logout(){
  if(typeof window!=='undefined'&&window.__stayfinderLoggingOut)return;
  if(typeof window!=='undefined')window.__stayfinderLoggingOut=true;
  setProcessingText('Signing out...');
  try{
   await Promise.race([
    fetch('/api/auth/logout',{method:'POST',cache:'no-store',credentials:'same-origin'}),
    new Promise(resolve=>setTimeout(resolve,1800))
   ]);
  }catch{}finally{
   if(typeof window!=='undefined')window.location.replace('/');
  }
 }
 useEffect(()=>{
  if(!owner)return;
  const q=ownerPlaceQuery.trim();
  if(skipOwnerPlaceSearch.current){skipOwnerPlaceSearch.current=false;return;}
  if(q.length<2){setOwnerPlaceSuggestions([]);setOwnerPlaceSearching(false);return;}
  const ctrl=new AbortController();
  const timer=setTimeout(async()=>{
   setOwnerPlaceSearching(true);
   try{
    const r=await fetch(`/api/location-search?q=${encodeURIComponent(q)}&city=${encodeURIComponent(pgForm.city||'Jaipur')}`,{signal:ctrl.signal,cache:'no-store'});
    const d=await r.json();
    if(!r.ok||!d.ok)throw new Error(d.error||'Location search failed.');
    setOwnerPlaceSuggestions(d.results||[]);
   }catch(e){if(e.name!=='AbortError'){setOwnerPlaceSuggestions([]);}}
   finally{setOwnerPlaceSearching(false);}
  },250);
  return()=>{clearTimeout(timer);ctrl.abort();};
 },[owner,ownerPlaceQuery]);
 async function chooseOwnerPlace(place){
  skipOwnerPlaceSearch.current=true;
  setOwnerPlaceQuery(place.name||place.displayName||'');
  setOwnerPlaceSuggestions([]);
  let selected=place;
  if(place.provider==='google' && place.placeId){
   try{
    const r=await fetch(`/api/location-search?id=${encodeURIComponent(place.placeId)}`,{cache:'no-store'});
    const d=await r.json();
    if(r.ok&&d.ok&&d.place) selected=d.place;
   }catch{}
  }
  setPgForm(x=>({...x,name:selected.name||x.name,address:selected.address||selected.displayName||x.address,city:selected.city||x.city,latitude:String(selected.latitude||''),longitude:String(selected.longitude||'')}));
  setNotice('Property location selected.');
 }

 function notifyLiveUpdate(scope='all'){
  const payload={scope,at:Date.now()};
  try{liveChannelRef.current?.postMessage(payload);}catch{}
  try{localStorage.setItem('stayfinder_live_update',JSON.stringify(payload));}catch{}
 }

 async function jsonFetch(url,opts){
  const r=await fetch(url,{cache:'no-store',...opts});
  const text=await r.text();
  let d=null;
  try{d=text?JSON.parse(text):{};}catch{
    throw new Error(`${url} returned an invalid response (HTTP ${r.status}). Check the server log for details.`);
  }
  if(!r.ok||!d.ok)throw new Error(d.error||`${url} request failed (HTTP ${r.status})`);
  const method=String(opts?.method||'GET').toUpperCase();
  if(method!=='GET'&&method!=='HEAD'){
   let scope='all';
   if(url.includes('/owner/pgs'))scope='owner-pgs';
   else if(url.includes('/owner/rooms'))scope='owner-rooms';
   else if(url.includes('/owner/bookings'))scope='owner-bookings';
   else if(url.includes('/owner/payments')||url.includes('/owner/payment-settings'))scope='owner-payments';
   else if(url.includes('/owner/refunds'))scope='owner-refunds';
   else if(url.includes('/customer/'))scope='customer';
   notifyLiveUpdate(scope);
  }
  return d;
 }

 async function loadCustomer(silent=false){
  if(!silent)setLoading(true);
  setNotice('');
  // Marketplace listing is the primary payload. Secondary history APIs must not blank the whole Explore screen.
  try{
    const a=await jsonFetch('/api/customer/pgs');
    setPgs(a.pgs||[]);
  }catch(e){
    // Never wipe already loaded marketplace data because of a temporary Sheets/API quota error.
    if(!silent)setNotice(e.message);
    if(!silent)setLoading(false);
    return;
  }
  const results=await Promise.allSettled([
    jsonFetch('/api/customer/bookings'),
    jsonFetch('/api/customer/payments'),
    jsonFetch('/api/customer/refunds'),
    jsonFetch('/api/customer/refund-settings')
  ]);
  if(results[0].status==='fulfilled')setBookings(results[0].value.bookings||[]);
  if(results[1].status==='fulfilled')setPayments(results[1].value.payments||[]);
  if(results[2].status==='fulfilled')setCustomerRefunds(results[2].value.refunds||[]);
  if(results[3].status==='fulfilled'){const rs=results[3].value.settings||null;setRefundSettings(rs);if(rs)setRefundSettingsForm({upiName:rs.upiName||'',upiId:rs.upiId||'',bankName:rs.bankName||'',accountHolder:rs.accountHolder||'',accountNumber:rs.accountNumber||'',ifsc:rs.ifsc||'',qr:null});}
  const failed=results.find(x=>x.status==='rejected');
  if(failed&&!silent)setNotice(`Some account data could not be loaded: ${failed.reason?.message||'Unknown error'}`);
  if(!silent)setLoading(false);
 }
 async function loadCustomerProfile(){try{const d=await jsonFetch('/api/customer/profile');const cp=d.profile||{};setCustomerProfile(cp);setCustomerProfileForm({mobile:cp.mobile||'',email:cp.email||''});}catch(e){setNotice(e.message);}}
 async function loadOwnerBase(force=false,silent=false){
  if(!force&&ownerBaseLoaded.current)return;
  if(!silent){setLoading(true);setNotice('');}
  const results=await Promise.allSettled([jsonFetch('/api/owner/pgs'),jsonFetch('/api/owner/rooms')]);
  const [a,b]=results;
  if(a.status==='fulfilled'){
   const list=a.value.pgs||[];
   setOwnerPgs(list);
   setRoomForm(x=>({...x,pgId:x.pgId||list?.[0]?.id||''}));
   if(!list.length)setOwnerView('add');
  }
  if(b.status==='fulfilled')setRooms(b.value.rooms||[]);
  const failed=results.find(x=>x.status==='rejected');
  if(failed){if(!silent)setNotice(failed.reason?.message||'Property data is temporarily unavailable.');}
  else ownerBaseLoaded.current=true;
  if(!silent)setLoading(false);
 }
 async function loadOwnerViewData(view,force=false,silent=false){
  if(!owner)return;
  if(!force&&ownerViewLoaded.current.has(view))return;
  const map={
   overview:['/api/owner/bookings','/api/owner/payments'],
   properties:['/api/owner/bookings'],
   bookings:['/api/owner/bookings','/api/owner/refunds'],
   payments:['/api/owner/payments','/api/owner/payment-settings','/api/owner/refunds'],
   rooms:[],add:[]
  };
  const urls=map[view]||[];
  if(!urls.length){ownerViewLoaded.current.add(view);return;}
  if(!silent)setLoading(true);
  const results=await Promise.allSettled(urls.map(u=>jsonFetch(u)));
  results.forEach((r,i)=>{
   if(r.status!=='fulfilled')return;
   const u=urls[i],v=r.value;
   if(u==='/api/owner/bookings')setOwnerBookings(v.bookings||[]);
   if(u==='/api/owner/payments')setOwnerPayments(v.payments||[]);
   if(u==='/api/owner/refunds')setOwnerRefunds(v.refunds||[]);
   if(u==='/api/owner/payment-settings'){
    const ps=v.settings||null;setOwnerPaySettings(ps);
    setOwnerPayForm({upiName:'',upiId:'',bankName:'',accountHolder:'',accountNumber:'',ifsc:'',note:'',qr:null});
   }
  });
  const failed=results.find(x=>x.status==='rejected');
  if(!failed)ownerViewLoaded.current.add(view);
  else if(!silent&&(view==='bookings'||view==='payments'))setNotice(failed.reason?.message||'This section is temporarily unavailable. Please try again shortly.');
  if(!silent)setLoading(false);
 }
 async function refreshOwner(targetView=ownerView,silent=false){
  ownerBaseLoaded.current=false;
  ownerViewLoaded.current.delete(targetView);
  await loadOwnerBase(true,silent);
  await loadOwnerViewData(targetView,true,silent);
 }
 const savedKey=`pg_saved_${String(user?.id||user?.sub||user?.username||'guest')}`;
 useEffect(()=>{try{setSaved(JSON.parse(localStorage.getItem(savedKey)||'[]'));}catch{setSaved([])} if(owner)loadOwnerBase();else loadCustomer();},[owner,savedKey]);
 useEffect(()=>{if(!owner)return;setNotice('');loadOwnerViewData(ownerView);},[owner,ownerView]);
 useEffect(()=>{
  if(typeof window==='undefined')return;
  // Event-driven sync only: no interval, no focus refresh, no visibility refresh.
  // Data reloads only when a real mutation is broadcast from another open tab/session.
  // Multiple mutation events are coalesced so Google Sheets receives one read burst.
  const runSync=async(scope='all')=>{
   if(document.visibilityState==='hidden'||liveSyncBusy.current)return;
   // Never touch the Add Listing screen while the Owner has an unsaved draft.
   if(owner&&ownerView==='add'&&ownerDraftDirty.current){pendingLiveSync.current=true;return;}
   liveSyncBusy.current=true;
   try{
    if(owner){
     if(scope==='owner-pgs'||scope==='owner-rooms'||scope==='all'){
      await refreshOwner(ownerView,true);
     }else if(scope==='owner-bookings'){
      ownerViewLoaded.current.delete('bookings');
      ownerViewLoaded.current.delete('overview');
      ownerViewLoaded.current.delete('properties');
      if(['bookings','overview','properties'].includes(ownerView))await loadOwnerViewData(ownerView,true,true);
     }else if(scope==='owner-payments'||scope==='owner-refunds'){
      ownerViewLoaded.current.delete('payments');
      ownerViewLoaded.current.delete('bookings');
      if(['payments','bookings'].includes(ownerView))await loadOwnerViewData(ownerView,true,true);
     }
    }else{
     await loadCustomer(true);
    }
   }catch{}finally{liveSyncBusy.current=false;}
  };
  const scheduleSync=(scope='all')=>{
   if(liveSyncTimer.current)clearTimeout(liveSyncTimer.current);
   liveSyncTimer.current=setTimeout(()=>runSync(scope),900);
  };
  let bc=null;
  try{bc=new BroadcastChannel('stayfinder-live');liveChannelRef.current=bc;bc.onmessage=e=>scheduleSync(e?.data?.scope||'all');}catch{}
  const onStorage=e=>{
   if(e.key!=='stayfinder_live_update'||!e.newValue)return;
   try{const data=JSON.parse(e.newValue);scheduleSync(data?.scope||'all');}catch{scheduleSync('all');}
  };
  window.addEventListener('storage',onStorage);
  return()=>{
   window.removeEventListener('storage',onStorage);
   if(liveSyncTimer.current){clearTimeout(liveSyncTimer.current);liveSyncTimer.current=null;}
   try{bc?.close();}catch{}
   if(liveChannelRef.current===bc)liveChannelRef.current=null;
  };
 },[owner,ownerView]);

 // Protect unsaved Owner Add-Listing data from any background/external sync.
 useEffect(()=>{
  if(!owner)return;
  const hasDraft=Boolean(
   ownerPlaceQuery.trim()||pgForm.name.trim()||pgForm.address.trim()||pgForm.description.trim()||
   pgForm.latitude||pgForm.longitude||photos.length
  );
  ownerDraftDirty.current=ownerView==='add'&&hasDraft;
  if(!ownerDraftDirty.current&&pendingLiveSync.current){
   pendingLiveSync.current=false;
   ownerBaseLoaded.current=false;
   ownerViewLoaded.current.delete(ownerView);
   // Run once after leaving/clearing the draft, not while the user is typing/uploading.
   setTimeout(()=>{if(!liveSyncBusy.current)refreshOwner(ownerView,true).catch(()=>{});},0);
  }
 },[owner,ownerView,ownerPlaceQuery,pgForm.name,pgForm.address,pgForm.description,pgForm.latitude,pgForm.longitude,photos.length]);

 const filteredPgs=useMemo(()=>{const list=pgs.filter(pg=>{const text=`${pg.name} ${pg.address} ${pg.city}`.toLowerCase();const minRent=Math.min(...(pg.rooms||[]).map(r=>r.rent).filter(Boolean),999999);return(!searchArea.trim()||text.includes(searchArea.trim().toLowerCase()))&&(!city||String(pg.city).toLowerCase()===city.toLowerCase())&&(listingType==='Any'||(pg.listingType||'PG')===listingType)&&(gender==='Any'||pg.gender===gender)&&(roomType==='Any'||(pg.rooms||[]).some(r=>String(r.type).toLowerCase().includes(roomType.toLowerCase())))&&(!maxPrice||minRent<=Number(maxPrice))&&(activeCategory==='All Listings'||(activeCategory==='Budget'&&minRent<=7000)||(activeCategory==='Girls'&&pg.gender==='Girls')||(activeCategory==='Boys'&&pg.gender==='Boys')||(activeCategory==='Co-Living'&&pg.gender==='Unisex')||(activeCategory==='Top Rated'));}); if(!customerLocation)return list;return [...list].sort((x,y)=>{const xd=x.latitude&&x.longitude?geoDistanceKm(customerLocation.lat,customerLocation.lng,Number(x.latitude),Number(x.longitude)):999999;const yd=y.latitude&&y.longitude?geoDistanceKm(customerLocation.lat,customerLocation.lng,Number(y.latitude),Number(y.longitude)):999999;return xd-yd;});},[pgs,searchArea,city,listingType,gender,roomType,maxPrice,activeCategory,customerLocation]);
 function toggleSaved(id){setSaved(prev=>{const n=prev.includes(id)?prev.filter(x=>x!==id):[...prev,id];localStorage.setItem(savedKey,JSON.stringify(n));return n;});}
 function useCustomerLocation(){if(!navigator.geolocation){setLocationStatus('Location is not supported on this device.');return;}setLocationStatus('Detecting current location...');navigator.geolocation.getCurrentPosition(pos=>{setCustomerLocation({lat:pos.coords.latitude,lng:pos.coords.longitude});setSearchArea('');setCity('');setLocationStatus('Near me is active · nearest PGs first');},()=>setLocationStatus('Please allow location permission and try again.'),{enableHighAccuracy:true,timeout:15000,maximumAge:60000});}
 function openPg(pg){setSelectedPg(pg);setBookingForm({roomId:pg.rooms?.[0]?.id||'',checkIn:'',checkOut:'',stayMonths:'1'});}
 async function createBooking(e){e.preventDefault();setProcessingText('Submitting booking request...');try{await jsonFetch('/api/customer/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(bookingForm)});setSelectedPg(null);setNotice('Booking request sent. Payment will unlock after Owner approval.');setCustomerView('bookings');await loadCustomer();}catch(e){setNotice(e.message);}finally{setProcessingText('');}}
 async function submitPayment(e){e.preventDefault();setProcessingText('Uploading payment proof...');try{if(!paymentForm.bookingId)throw new Error('Select an accepted booking.');if(!customerPaySettings)throw new Error('Owner payment details are not available yet.');if(!/^\d{12}$/.test(paymentForm.transactionRef))throw new Error('Transaction reference must be exactly 12 numeric digits.');if(!paymentForm.proof)throw new Error('Select a payment proof image.');const f=new FormData();Object.entries(paymentForm).forEach(([k,v])=>{if(v!==null)f.append(k==='proof'?'proof':k,v)});await jsonFetch('/api/customer/payments',{method:'POST',body:f});setPaymentForm({bookingId:'',amount:'',mode:'UPI',transactionRef:'',proof:null});setPaymentFileKey(k=>k+1);setCustomerPaySettings(null);setNotice('Payment proof submitted. Owner verification is pending.');setCustomerView('bookings');await loadCustomer();}catch(e){setNotice(e.message);}finally{setProcessingText('');}}
 async function selectPaymentBooking(id){const b=bookings.find(x=>x.id===id);setPaymentForm(x=>({...x,bookingId:id,amount:b?.amount||'',transactionRef:'',proof:null}));setCustomerPaySettings(null);if(!id)return;try{const d=await jsonFetch(`/api/customer/payment-settings?bookingId=${encodeURIComponent(id)}`);setCustomerPaySettings(d.settings||null);}catch(e){setNotice(e.message);}}
 async function saveCustomerProfile(e){e.preventDefault();setProcessingText('Saving profile...');try{const d=await jsonFetch('/api/customer/profile',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(customerProfileForm)});setCustomerProfile(d.profile||customerProfileForm);setCustomerProfileForm({mobile:d.profile?.mobile||customerProfileForm.mobile,email:d.profile?.email||customerProfileForm.email});setNotice('Profile updated successfully.');}catch(e){setNotice(e.message);}finally{setProcessingText('');}}
 async function saveRefundSettings(e){e.preventDefault();setProcessingText('Saving refund details...');try{const f=new FormData();Object.entries(refundSettingsForm).forEach(([k,v])=>{if(k==='qr'){if(v)f.append('qr',v);}else f.append(k,v??'')});const d=await jsonFetch('/api/customer/refund-settings',{method:'POST',body:f});setRefundSettings(d.settings);setRefundSettingsForm(x=>({...x,qr:null}));setRefundQrKey(k=>k+1);setNotice('Refund details saved successfully.');}catch(e){setNotice(e.message);}finally{setProcessingText('');}}


 function selectPhotos(files){const arr=Array.from(files||[]).filter(f=>f.type.startsWith('image/'));if(arr.length+photos.length>8){setNotice('You can upload a maximum of 8 images.');return;}setPhotos(prev=>[...prev,...arr]);setNotice('');}
 function removePhoto(i){setPhotos(p=>p.filter((_,x)=>x!==i));}
 function toggleAmenity(a){setPgForm(p=>({...p,amenities:p.amenities.includes(a)?p.amenities.filter(x=>x!==a):[...p.amenities,a]}));}
 async function savePg(e){e.preventDefault();if(photos.length<5||photos.length>8){setNotice('A listing requires 5 to 8 images.');return;}setProcessingText('Saving listing details and photos...');try{setLoading(true);const d=await jsonFetch('/api/owner/pgs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pgForm)});let photosSaved=false;try{const fd=new FormData();photos.forEach(f=>fd.append('photos',f));await jsonFetch(`/api/owner/pgs/${d.pg.id}/photos`,{method:'POST',body:fd});photosSaved=true;}catch(photoError){console.error('PG_PHOTO_UPLOAD_CLIENT_ERROR',photoError);}
 ownerDraftDirty.current=false;pendingLiveSync.current=false;setPgForm({listingType:'PG',name:'',address:'',city:'Jaipur',description:'',gender:'Boys',amenities:['Wi-Fi','CCTV'],status:'Active',latitude:'',longitude:''});setOwnerPlaceQuery('');setOwnerPlaceSuggestions([]);setPhotos([]);setOwnerView('rooms');await refreshOwner('rooms');setNotice(photosSaved?'Listing and photos saved successfully.':'Listing saved successfully. Photos could not be uploaded right now.');}catch(e){setNotice(e.message);}finally{setLoading(false);setProcessingText('');}}
 async function saveRoom(e){e.preventDefault();setProcessingText('Saving room inventory...');try{const out=await jsonFetch('/api/owner/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(roomForm)});setRoomForm(x=>({...x,type:'Single',totalBeds:1,availableBeds:1,rent:'',deposit:''}));setNotice(out?.room?.merged?'Room inventory increased successfully.':'Room type added successfully.');await refreshOwner(ownerView);}catch(e){setNotice(e.message);}finally{setProcessingText('');}}
 async function bookingAction(id,status){setProcessingText(`Updating booking status...`);try{await jsonFetch('/api/owner/bookings',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({bookingId:id,status})});setNotice(`Booking status updated successfully.`);await refreshOwner(ownerView);}catch(e){setNotice(e.message);}finally{setProcessingText('');}}
 async function saveOwnerPaymentSettings(e){e.preventDefault();setProcessingText('Saving payment settings...');try{setLoading(true);const f=new FormData();Object.entries(ownerPayForm).forEach(([k,v])=>{if(k==='qr'){if(v)f.append('qr',v);}else f.append(k,v??'')});const d=await jsonFetch('/api/owner/payment-settings',{method:'POST',body:f});setOwnerPaySettings(d.settings);setOwnerPayForm({upiName:'',upiId:'',bankName:'',accountHolder:'',accountNumber:'',ifsc:'',note:'',qr:null});setNotice('Payment details saved successfully.');}catch(e){setNotice(e.message);}finally{setLoading(false);setProcessingText('');}}
 async function paymentAction(id,status){let reason='';if(status==='Rejected'){reason=window.prompt('What needs to be corrected in the payment proof?','Unable to verify the transaction ID or screenshot.')||'';if(!reason.trim())return;}setProcessingText(status==='Verified'?'Verifying payment...':'Sending correction request...');try{await jsonFetch('/api/owner/payments',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({paymentId:id,status,reason})});setNotice(status==='Verified'?'Payment verified. Booking confirmed.':'Correction request sent to the customer.');await refreshOwner(ownerView);}catch(e){setNotice(e.message);}finally{setProcessingText('');}}

 async function startRefund(bookingId){const reason=window.prompt('Enter the cancellation reason shown to the customer:','Property or room availability issue')||'';if(!reason.trim())return;setProcessingText('Starting cancellation and refund...');try{await jsonFetch('/api/owner/refunds',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bookingId,reason})});setNotice('Booking cancelled and bed released. Send the full refund and upload proof.');setOwnerView('payments');await refreshOwner('payments');}catch(e){setNotice(e.message);}finally{setProcessingText('');}}
 async function submitRefund(e){e.preventDefault();if(!refundForm.refundId)throw new Error('Select a refund.');if(!/^\d{12}$/.test(refundForm.transactionRef)){setNotice('Refund transaction reference must be exactly 12 digits.');return;}if(!refundForm.proof){setNotice('Select a refund proof screenshot.');return;}setProcessingText('Uploading refund proof...');try{const f=new FormData();f.append('refundId',refundForm.refundId);f.append('transactionRef',refundForm.transactionRef);f.append('proof',refundForm.proof);await jsonFetch('/api/owner/refunds',{method:'POST',body:f});setRefundForm({refundId:'',transactionRef:'',proof:null});setRefundFileKey(k=>k+1);setNotice('Refund marked as sent. Customer confirmation is pending.');await refreshOwner(ownerView);}catch(e){setNotice(e.message);}finally{setProcessingText('');}}
 async function customerRefundAction(refundId,action){let note='';if(action==='issue'){note=window.prompt('Describe the refund issue:','Refund not received / transaction mismatch')||'';if(!note.trim())return;}setProcessingText(action==='received'?'Confirming refund receipt...':'Reporting refund issue...');try{await jsonFetch('/api/customer/refunds',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({refundId,action,note})});setNotice(action==='received'?'Refund receipt confirmed. Cancellation is complete.':'Refund issue reported to the owner.');await loadCustomer();}catch(e){setNotice(e.message);}finally{setProcessingText('');}}
 async function showConfirmedContact(bookingId){setProcessingText('Loading confirmed stay details...');try{const d=await jsonFetch(`/api/customer/bookings/${bookingId}/contact`);setContactInfo(d.contact);}catch(e){setNotice(e.message);}finally{setProcessingText('');}}
 async function captureLocation(pgId){if(!navigator.geolocation){setNotice('Location is not supported in this browser.');return;}setProcessingText('Capturing exact GPS location...');navigator.geolocation.getCurrentPosition(async pos=>{try{await jsonFetch('/api/owner/pgs',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({pgId,latitude:pos.coords.latitude,longitude:pos.coords.longitude})});setNotice('Exact GPS location saved.');await refreshOwner(ownerView);}catch(e){setNotice(e.message);}finally{setProcessingText('');}},err=>{setProcessingText('');setNotice(err.code===1?'Please allow location permission and try again.':'Unable to capture exact location.');},{enableHighAccuracy:true,timeout:15000,maximumAge:0});}
 function captureNewPgLocation(){if(!navigator.geolocation){setNotice('Location is not supported in this browser.');return;}setProcessingText('Capturing PG location...');navigator.geolocation.getCurrentPosition(pos=>{setPgForm(x=>({...x,latitude:String(pos.coords.latitude),longitude:String(pos.coords.longitude)}));setProcessingText('');setNotice('Exact location captured.');},err=>{setProcessingText('');setNotice(err.code===1?'Please allow location permission and try again.':'Unable to capture location.');},{enableHighAccuracy:true,timeout:15000,maximumAge:0});}

 if(!owner) return <><MobileResponsiveStyles/><CustomerApp user={user} logout={logout} view={customerView} setView={setCustomerView} loading={loading} notice={notice} pgs={pgs} filteredPgs={filteredPgs} saved={saved} toggleSaved={toggleSaved} openPg={openPg} selectedPg={selectedPg} setSelectedPg={setSelectedPg} bookingForm={bookingForm} setBookingForm={setBookingForm} createBooking={createBooking} bookings={bookings} payments={payments} refunds={customerRefunds} customerRefundAction={customerRefundAction} paymentForm={paymentForm} setPaymentForm={setPaymentForm} paymentFileKey={paymentFileKey} submitPayment={submitPayment} selectPaymentBooking={selectPaymentBooking} customerPaySettings={customerPaySettings} showConfirmedContact={showConfirmedContact} contactInfo={contactInfo} setContactInfo={setContactInfo} city={city} setCity={setCity} searchArea={searchArea} setSearchArea={setSearchArea} listingType={listingType} setListingType={setListingType} roomType={roomType} setRoomType={setRoomType} gender={gender} setGender={setGender} maxPrice={maxPrice} setMaxPrice={setMaxPrice} activeCategory={activeCategory} setActiveCategory={setActiveCategory} customerLocation={customerLocation} locationStatus={locationStatus} useCustomerLocation={useCustomerLocation} refundSettings={refundSettings} refundSettingsForm={refundSettingsForm} setRefundSettingsForm={setRefundSettingsForm} refundQrKey={refundQrKey} saveRefundSettings={saveRefundSettings} customerProfile={customerProfile} customerProfileForm={customerProfileForm} setCustomerProfileForm={setCustomerProfileForm} saveCustomerProfile={saveCustomerProfile} loadCustomerProfile={loadCustomerProfile} helpOpen={helpOpen} setHelpOpen={setHelpOpen}/><ProcessingOverlay text={processingText}/></>;
 return <><MobileResponsiveStyles/><OwnerApp user={user} logout={logout} view={ownerView} setView={setOwnerView} loading={loading} notice={notice} pgs={ownerPgs} rooms={rooms} bookings={ownerBookings} payments={ownerPayments} refunds={ownerRefunds} startRefund={startRefund} refundForm={refundForm} setRefundForm={setRefundForm} refundFileKey={refundFileKey} submitRefund={submitRefund} pgForm={pgForm} setPgForm={setPgForm} photos={photos} selectPhotos={selectPhotos} removePhoto={removePhoto} toggleAmenity={toggleAmenity} savePg={savePg} roomForm={roomForm} setRoomForm={setRoomForm} saveRoom={saveRoom} bookingAction={bookingAction} ownerPaySettings={ownerPaySettings} ownerPayForm={ownerPayForm} setOwnerPayForm={setOwnerPayForm} saveOwnerPaymentSettings={saveOwnerPaymentSettings} paymentAction={paymentAction} captureLocation={captureLocation} captureNewPgLocation={captureNewPgLocation} helpOpen={helpOpen} setHelpOpen={setHelpOpen} ownerPreviewPg={ownerPreviewPg} setOwnerPreviewPg={setOwnerPreviewPg} ownerPlaceQuery={ownerPlaceQuery} setOwnerPlaceQuery={setOwnerPlaceQuery} ownerPlaceSuggestions={ownerPlaceSuggestions} ownerPlaceSearching={ownerPlaceSearching} chooseOwnerPlace={chooseOwnerPlace}/><ProcessingOverlay text={processingText}/></>;
}


function MobileResponsiveStyles(){return <style jsx global>{`
.mobileBottomNav,.hostMobileNav,.hostMobileLogout{display:none}
.compactSearchGrid{display:contents}.budgetField{min-width:130px}
 .mobileAirSearch,.mobileSearchBackdrop{display:none}
@media(max-width:820px){
 html,body{max-width:100%;overflow-x:hidden}
 body{padding-bottom:0!important}
 button,a,input,select,textarea{touch-action:manipulation}
 .marketApp,.hostApp{min-height:100dvh;background:#f6faf9}
 .marketHeader{position:sticky!important;top:0;z-index:45;min-height:62px;padding:8px 12px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;background:rgba(255,255,255,.96)!important;backdrop-filter:blur(12px);border-bottom:1px solid #dfe9e7}
 .marketBrand{gap:8px!important}.marketBrand span{width:36px!important;height:36px!important;border-radius:12px!important;font-size:12px!important}.marketBrand b{font-size:18px!important}
 .marketNav{display:none!important}.marketUser{gap:6px!important}.marketUser>.userPill{padding:4px 8px!important;min-width:0!important}.marketUser>.userPill>div{display:none!important}.marketUser>.userPill>span{width:34px!important;height:34px!important}.marketUser>button:not(.iconBtn){display:none!important}.marketUser .iconBtn{width:38px!important;height:38px!important}
 .globalNotice{margin:10px 12px!important;border-radius:12px!important;font-size:12px!important;line-height:1.35!important;padding:10px 12px!important}
 .mobileAirSearch{display:grid!important;grid-template-columns:34px minmax(0,1fr) 28px;align-items:center;gap:9px;width:100%;min-height:60px;border:1px solid #d7dfdd;border-radius:999px;background:#fff;padding:8px 10px;box-shadow:0 4px 16px rgba(0,0,0,.09);text-align:left;color:#172f2d}.mobileAirSearchIcon{width:34px;height:34px;display:grid;place-items:center;font-size:23px}.mobileAirSearch>span:nth-child(2){display:grid;min-width:0}.mobileAirSearch b{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mobileAirSearch small{font-size:10px;color:#74807f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}.mobileAirSearch i{font-style:normal;width:28px;height:28px;border:1px solid #d8dfde;border-radius:50%;display:grid;place-items:center;font-size:12px}.marketHero>.searchPanel{display:none!important}.marketHeroCopy{display:none!important}.marketHero{padding:10px 12px 8px!important;background:#fff!important}.mobileSearchBackdrop{display:flex!important;position:fixed;inset:0;z-index:120;background:rgba(0,0,0,.34);align-items:flex-end}.mobileSearchSheet{width:100%;max-height:92dvh;overflow:auto;background:#fff;border-radius:24px 24px 0 0;padding:10px 16px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -18px 50px rgba(0,0,0,.18)}.mobileSearchSheetHead{display:grid;grid-template-columns:44px 1fr 58px;align-items:center;min-height:50px;border-bottom:1px solid #eceeed;margin-bottom:14px}.mobileSearchSheetHead b{text-align:center;font-size:15px}.mobileSearchSheetHead button{border:0;background:transparent;font-weight:800;color:#263d3b;font-size:13px}.mobileSearchSheetHead button:first-child{font-size:24px;text-align:left}.airSearchWhere{display:grid;grid-template-columns:30px 1fr;align-items:center;border:1px solid #cfd8d6;border-radius:15px;padding:0 12px;min-height:54px}.airSearchWhere span{font-size:20px}.airSearchWhere input{border:0!important;outline:0!important;min-height:50px;font-size:16px;background:transparent;width:100%}.airNearMe{width:100%;margin:10px 0 4px;min-height:44px;border:1px solid #d7dfdd;border-radius:13px;background:#fff;font-weight:800;color:#245b57}.airSearchSection{padding:14px 0 4px}.airSearchSection h3{font-size:15px;margin:0 0 10px}.airChoiceRow{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.airChoiceRow button{min-height:44px;border:1px solid #d7dfdd;border-radius:13px;background:#fff;font-weight:800;color:#425452}.airChoiceRow button.active{border:2px solid #173f3d;background:#f5faf9;color:#173f3d}.airSearchTwo{display:grid;grid-template-columns:1fr 1fr;gap:9px;padding:14px 0}.airSearchTwo label{display:grid;gap:5px;border:1px solid #d7dfdd;border-radius:13px;padding:9px 11px;background:#fff}.airSearchTwo label>span{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#71817f;font-weight:800}.airSearchTwo input,.airSearchTwo select{border:0!important;background:transparent!important;min-height:30px;font-size:14px;outline:0;width:100%}.airSearchSheetFooter{position:sticky;bottom:0;display:grid;grid-template-columns:1fr auto;align-items:center;background:#fff;border-top:1px solid #e7ebea;padding:12px 0 0;margin-top:3px}.airSearchSheetFooter span{font-size:12px;font-weight:800}.airSearchSheetFooter button{min-height:46px;border:0;border-radius:12px;background:#185e58;color:#fff;padding:0 18px;font-weight:900}.marketContent{padding-top:8px!important}.marketTitleRow h2{font-size:18px!important}.marketTitleRow p{display:none!important}.categoryRow{margin-bottom:8px!important}.categoryRow button{border-radius:999px!important}.propertyGrid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:18px 10px!important}.propertyCard{border:0!important;box-shadow:none!important;background:transparent!important;border-radius:0!important;overflow:visible!important;cursor:pointer}.propertyImageWrap{height:auto!important;aspect-ratio:1/1!important;border-radius:14px!important;overflow:hidden!important;background:#eef3f2}.propertyImageWrap img{width:100%!important;height:100%!important;object-fit:cover!important}.propertyBadge{font-size:8px!important;padding:5px 7px!important;left:7px!important;top:7px!important}.photoCountBadge{display:none!important}.heartBtn{top:7px!important;right:7px!important;width:30px!important;height:30px!important;font-size:20px!important;background:rgba(255,255,255,.9)!important}.propertyBody{padding:7px 1px 0!important}.propertyTop{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:4px!important;align-items:start!important}.propertyBody h3{font-size:13px!important;line-height:1.2!important;margin:0!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.propertyTop p{font-size:10px!important;color:#6c7776!important;margin:2px 0 0!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rating{font-size:9px!important;white-space:nowrap}.propertyMeta{font-size:10px!important;color:#737e7d!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:3px 0!important}.propertyCard .tagRow{display:none!important}.propertyFooter{display:block!important;margin-top:3px!important}.propertyFooter>div b{font-size:12px!important}.propertyFooter>div span,.propertyFooter>div small{font-size:9px!important}.propertyFooter>button{display:none!important}
 .marketHero{padding:14px 12px 12px!important;min-height:0!important}.marketHeroCopy{text-align:left!important;max-width:none!important;margin:0 0 10px!important}.marketHeroCopy .heroMini{display:none!important}.marketHeroCopy h1{font-size:24px!important;line-height:1.05!important;margin:0 0 10px!important}.marketHeroCopy>p:last-child{display:none!important}
 .searchPanel{display:grid!important;grid-template-columns:1fr!important;gap:8px!important;padding:10px!important;border-radius:16px!important;margin:0!important}.searchField,.searchField.wide{width:100%!important;border:1px solid #dbe7e5!important;border-radius:11px!important;padding:7px 9px!important;background:#fff!important;box-sizing:border-box!important}.searchField label{font-size:9px!important;margin-bottom:4px!important}.searchField input,.searchField select{min-height:38px!important;font-size:13px!important;padding:0 8px!important}.whereFieldRow{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:6px!important}.whereFieldRow input{min-width:0!important}.nearMeBtn{white-space:nowrap!important;padding:0 10px!important;min-height:38px!important;font-size:11px!important;border-radius:9px!important}.compactSearchGrid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:7px!important}.budgetField{grid-column:auto!important}.nearMeStatus{font-size:9px!important;margin-top:4px!important}.searchBtn{width:100%!important;min-height:38px!important;border-radius:11px!important;font-size:12px!important}
 .quickStrip{display:none!important}.quickStrip::-webkit-scrollbar,.categoryRow::-webkit-scrollbar,.hostMobileNav::-webkit-scrollbar{display:none}
 .marketContent,.customerPage{padding:14px 12px 92px!important;max-width:none!important}.marketTitleRow{align-items:center!important;gap:8px!important;margin-bottom:8px!important}.marketTitleRow h2,.customerPage h1{font-size:22px!important;line-height:1.1!important;margin:0!important}.marketTitleRow p{font-size:10px!important;margin:3px 0 0!important}.priceFilter{display:none!important}.categoryRow{display:flex!important;flex-wrap:nowrap!important;overflow-x:auto!important;padding-bottom:4px!important;gap:6px!important;margin-bottom:10px!important}.categoryRow button{flex:0 0 auto!important;font-size:10px!important;padding:8px 11px!important;min-height:34px!important}
 .propertyGrid{grid-template-columns:1fr!important;gap:12px!important}.propertyCard{border-radius:16px!important;overflow:hidden!important}.propertyImageWrap{height:205px!important}.propertyBody{padding:11px!important}.propertyBody h3{font-size:17px!important}.propertyBody p,.propertyBody small{font-size:10px!important}.propertyFooter{gap:8px!important;align-items:center!important}.propertyFooter button{min-height:38px!important;font-size:11px!important}
 .dataCards,.bookingJourneyCards,.paymentProofCards,.refundCards{grid-template-columns:1fr!important}.dataCards>article,.bookingJourneyCards>article{padding:16px!important;border-radius:16px!important}.customerPage>div[style*='display:flex']{display:grid!important;grid-template-columns:1fr!important;gap:8px!important}.customerPage input[placeholder='Search PG or booking ID'],.customerPage select{width:100%!important;min-width:0!important}
 .paymentLayout,.customerPaymentLayout{grid-template-columns:1fr!important;gap:14px!important}.simpleForm{padding:16px!important}.payToHead,.payMethods{display:grid!important;grid-template-columns:1fr!important;gap:12px!important}.ownerQr{width:min(250px,75vw)!important;height:auto!important}.actionPair{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important}.actionPair button{min-width:0!important}
 .modalBackdrop{align-items:flex-end!important;padding:0!important}.pgModal,.ownerPreviewModal,.contactUnlockModal,.helpModal{width:100%!important;max-width:none!important;max-height:94dvh!important;border-radius:22px 22px 0 0!important;margin:0!important}.pgModal{overflow-y:auto!important}.galleryMain{height:280px!important}.galleryStrip{overflow-x:auto!important;display:flex!important}.galleryStrip button{flex:0 0 78px!important}.modalBody{padding:16px!important}.roomChoice{grid-template-columns:1fr!important}.stayDateGrid,.compactStayGrid{grid-template-columns:1fr!important}.fareCard{padding:14px!important}
 .modalBackdrop>div[style*='width:min(900px']{width:100%!important;max-width:none!important;max-height:94dvh!important;border-radius:22px 22px 0 0!important;padding:18px!important}.modalBackdrop>div[style*='width:min(900px']>div[style*='grid-template-columns']{grid-template-columns:1fr!important}.modalBackdrop>div[style*='width:min(900px'] form div[style*='grid-template-columns']{grid-template-columns:1fr!important}
 .mobileBottomNav{display:grid!important;grid-template-columns:repeat(4,1fr);position:fixed;left:0;right:0;bottom:0;z-index:70;background:rgba(255,255,255,.97);border-top:1px solid #d9e5e3;padding:7px max(8px,env(safe-area-inset-right)) calc(7px + env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left));box-shadow:0 -8px 24px rgba(20,57,54,.08)}
 .mobileBottomNav button{border:0;background:transparent;color:#6b7f7d;display:grid;place-items:center;gap:2px;font-size:10px;font-weight:800;min-height:50px;border-radius:12px}.mobileBottomNav button span{font-size:20px;line-height:1}.mobileBottomNav button.active{background:#e9f3f1;color:#245a57}
 .hostSidebar{display:none!important}.hostMain{margin-left:0!important;width:100%!important;min-width:0!important;padding-bottom:92px!important}.hostTopbar{position:sticky!important;top:0;z-index:44;padding:10px 14px!important;min-height:62px!important;background:rgba(247,251,250,.96)!important;backdrop-filter:blur(12px)}.hostTopbar .eyebrow{display:none!important}.hostTopbar h2{font-size:20px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:52vw}.hostTopActions{gap:7px!important}.hostTopActions .previewBtn,.hostTopActions .addPropertyTop{display:none!important}.hostTopActions .userPill{padding:4px 7px!important}.hostTopActions .userPill>div{display:none!important}
 .hostWelcome{margin:10px!important;padding:14px!important;grid-template-columns:1fr!important;gap:12px!important;border-radius:16px!important}.hostWelcome .heroMini{display:none!important}.hostWelcome h1{font-size:22px!important;line-height:1.08!important;margin:0 0 10px!important}.hostWelcomeActions{display:grid!important;grid-template-columns:1fr 1fr!important}.hostWelcomeActions button{min-width:0!important}.hostScore{padding:14px!important}
 .hostStats{grid-template-columns:1fr 1fr!important;gap:10px!important;padding:0 14px!important}.hostStats article{padding:14px!important;min-width:0!important}.hostStats strong{font-size:20px!important}.hostStats p{display:none!important}.hostTwoCol{grid-template-columns:1fr!important;gap:12px!important;padding:14px!important}.hostPanel{padding:14px!important}
 .ownerWorkspace{padding:14px 12px 96px!important}.workspaceHead .eyebrow{display:none!important}.workspaceHead h1,.ownerWorkspace>h1{font-size:22px!important;line-height:1.1!important}.ownerPropertyManageCard{grid-template-columns:1fr!important;overflow:hidden!important}.ownerManageCover{height:210px!important}.ownerManageInfo{padding:14px!important}.ownerManageTitle{display:block!important}.listingLiveBadge{display:inline-flex!important;margin-top:8px!important}.ownerManageMetrics{grid-template-columns:1fr 1fr!important;gap:8px!important}.ownerManageActions{grid-template-columns:1fr 1fr!important;gap:8px!important}.ownerManageActions button{min-width:0!important;padding:10px 8px!important}
 .addPgFormV2{grid-template-columns:1fr!important;gap:14px!important}.formMainCard,.photoPanel{padding:14px!important;border-radius:18px!important}.formGrid,.paySettingGrid{grid-template-columns:1fr!important}.formGrid .full{grid-column:auto!important}.locationCaptureBox{display:grid!important;gap:10px!important}.amenityPicker{gap:7px!important}.amenityPicker button{font-size:12px!important}.photoPanel{position:static!important}.photoPreviewGrid{grid-template-columns:repeat(2,1fr)!important}.formActions{position:sticky!important;bottom:76px!important;background:#fff!important;padding:10px 0 0!important;z-index:8!important}.formActions button{min-height:46px!important}
 .roomLayout,.roomsLayout,.paymentSettingsLayout,.paymentOwnerLayout{grid-template-columns:1fr!important}.roomFormCard,.roomInventory,.paymentSettingsCard,.paymentProofPanel{min-width:0!important;width:100%!important}.roomInventory{overflow-x:auto!important}.roomInventory table{min-width:620px!important}
 .bookingRequestGrid{grid-template-columns:1fr!important}.bookingRequestGrid article{min-width:0!important}.bookingFilters{display:grid!important;grid-template-columns:1fr!important}.bookingFilters input,.bookingFilters select{width:100%!important;min-width:0!important}
 .refundCards{grid-template-columns:1fr!important}.refundCards article{padding:16px!important}.refundProofForm input[type=file]{font-size:12px!important}
 .hostMobileNav{display:flex!important;position:fixed;left:0;right:0;bottom:0;z-index:72;overflow-x:auto;background:rgba(255,255,255,.98);border-top:1px solid #d8e5e3;padding:6px 6px calc(6px + env(safe-area-inset-bottom));box-shadow:0 -8px 24px rgba(20,57,54,.08);-webkit-overflow-scrolling:touch}
 .hostMobileNav button{flex:1 0 68px;min-width:68px;min-height:54px;border:0;background:transparent;color:#6b7f7d;border-radius:12px;display:grid;place-items:center;gap:1px;font-size:9px;font-weight:800}.hostMobileNav button span{font-size:18px}.hostMobileNav button.active{background:#e7f2f0;color:#245b57}
 .processingBox{width:min(320px,88vw)!important}
}
@media(max-width:430px){
 .marketHeroCopy h1{font-size:23px!important}.marketContent,.customerPage,.ownerWorkspace{padding-left:12px!important;padding-right:12px!important}.propertyImageWrap{height:210px!important}.hostStats{grid-template-columns:1fr 1fr!important;padding:0 12px!important}.hostWelcome{margin:12px!important}.hostTwoCol{padding:12px!important}.ownerManageMetrics{grid-template-columns:1fr 1fr!important}.ownerManageActions{grid-template-columns:1fr!important}.hostWelcomeActions{grid-template-columns:1fr!important}.actionPair{grid-template-columns:1fr!important}.mobileBottomNav button{font-size:9px}.photoPreviewGrid{grid-template-columns:repeat(2,1fr)!important}
 .hostMobileLogout{display:grid!important;place-items:center!important;width:42px!important;height:42px!important;min-width:42px!important;border:1px solid #d8e5e3!important;border-radius:13px!important;background:#fff!important;color:#245a57!important;font-size:20px!important;font-weight:900!important}
 .customerProfileModalRoot{width:100%!important;max-width:none!important;max-height:94dvh!important;border-radius:22px 22px 0 0!important;padding:16px 14px calc(22px + env(safe-area-inset-bottom))!important;background:#f5faf9!important}
 .customerProfileHero{padding:2px 42px 14px 2px!important;gap:11px!important;align-items:center!important}
 .customerProfileHero>div:first-child{width:48px!important;height:48px!important;border-radius:15px!important;font-size:20px!important;flex:0 0 48px!important}
 .customerProfileHero h2{font-size:22px!important;line-height:1.15!important;word-break:break-word!important}
 .customerProfileGrid{display:grid!important;grid-template-columns:1fr!important;gap:12px!important;margin-top:14px!important}
 .customerContactPanel,.customerRefundPanel{padding:15px!important;border-radius:16px!important;gap:12px!important;min-width:0!important}
 .customerContactPanel input,.customerRefundPanel input{font-size:16px!important;max-width:100%!important;box-sizing:border-box!important}
 .customerContactPanel button,.customerRefundPanel button{width:100%!important;min-height:48px!important}
 .refundTwoCol{grid-template-columns:1fr!important;gap:10px!important}
 .customerRefundPanel input[type=file]{font-size:12px!important;overflow:hidden!important}
 .ownerBookingToolbar{display:grid!important;grid-template-columns:1fr!important;gap:9px!important;margin:12px 0 14px!important}
 .ownerBookingToolbar select,.ownerBookingToolbar input{width:100%!important;min-width:0!important;min-height:46px!important;font-size:16px!important;box-sizing:border-box!important}
 .ownerBookingToolbar>span{font-size:11px!important;padding:0 2px!important}
 .mobileOwnerBookingCards{display:grid!important;grid-template-columns:1fr!important;gap:12px!important}
 .mobileOwnerBookingCards>article{padding:14px!important;border-radius:17px!important;overflow:hidden!important;min-width:0!important}
 .mobileOwnerBookingCards .bookingCardTop{align-items:center!important;gap:8px!important}
 .mobileOwnerBookingCards .bookingIdPill{max-width:52%!important;overflow:hidden!important;text-overflow:ellipsis!important}
 .mobileOwnerBookingCards .guestDetailsBlock{display:grid!important;grid-template-columns:42px minmax(0,1fr)!important;gap:9px 10px!important;padding:12px!important;margin:12px 0 14px!important;align-items:center!important}
 .mobileOwnerBookingCards .guestAvatar{grid-row:1 / span 2!important;width:42px!important;height:42px!important;border-radius:13px!important;font-size:16px!important}
 .mobileOwnerBookingCards .guestIdentity,.mobileOwnerBookingCards .guestContact{min-width:0!important;overflow:hidden!important}
 .mobileOwnerBookingCards .guestIdentity b,.mobileOwnerBookingCards .guestIdentity span,.mobileOwnerBookingCards .guestContact b{overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
 .mobileOwnerBookingCards .guestQuickActions{grid-column:1 / -1!important;display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;justify-content:stretch!important}
 .mobileOwnerBookingCards .guestQuickActions a{text-align:center!important;min-height:42px!important;display:grid!important;place-items:center!important;padding:8px!important}
 .mobileOwnerBookingCards h3{font-size:19px!important;margin:8px 0 5px!important}
 .mobileOwnerBookingCards p{font-size:13px!important;line-height:1.5!important;word-break:break-word!important;margin:5px 0!important}
 .mobileOwnerBookingCards .bookingTotal{display:block!important;font-size:18px!important;margin:10px 0!important}
 .mobileOwnerBookingCards .actionPair,.mobileOwnerBookingCards .confirmedRefundActions{display:grid!important;grid-template-columns:1fr!important;gap:8px!important}
 .mobileOwnerBookingCards .actionPair button,.mobileOwnerBookingCards .confirmedRefundActions button{width:100%!important;min-height:46px!important}
 /* Airbnb-style mobile explore: final overrides intentionally placed last */
 .marketContent .propertyGrid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:18px 10px!important}
 .marketContent .propertyCard{border:0!important;box-shadow:none!important;background:transparent!important;border-radius:0!important;overflow:visible!important}
 .marketContent .propertyCard .propertyImageWrap{height:auto!important;aspect-ratio:1/1!important;border-radius:14px!important;overflow:hidden!important}
 .marketContent .propertyCard .propertyBody{padding:7px 1px 0!important}
 .marketContent .propertyCard .propertyBody h3{font-size:13px!important;line-height:1.2!important;margin:0!important}
 .marketContent .propertyCard .propertyTop p{font-size:10px!important;margin:2px 0 0!important}
 .marketContent .propertyCard .propertyMeta{font-size:10px!important;margin:3px 0!important}
 .marketContent .propertyCard .propertyFooter{display:block!important;margin-top:3px!important}
 .marketContent .propertyCard .propertyFooter button{display:none!important}
 .marketContent .propertyCard .tagRow{display:none!important}

}
`}</style>}

function CustomerApp(p){
 const nav=[['explore','Explore'],['saved','Saved'],['bookings','My Bookings']];
 const paymentFor=bookingId=>p.payments.find(x=>x.bookingId===bookingId&&['Submitted','Verified'].includes(String(x.status)));
 const refundFor=bookingId=>p.refunds?.find(x=>x.bookingId===bookingId);
 const latestPaymentFor=bookingId=>p.payments.find(x=>x.bookingId===bookingId);
 const payableBookings=p.bookings.filter(b=>b.status==='Accepted'&&!paymentFor(b.id));
 const [bookingFilter,setBookingFilter]=useState('All'); const [bookingSearch,setBookingSearch]=useState(''); const [profileOpen,setProfileOpen]=useState(false); const [searchOpen,setSearchOpen]=useState(false);
 useEffect(()=>{
  if(!profileOpen)return;
  const body=document.body;
  const root=document.documentElement;
  const prevBodyOverflow=body.style.overflow;
  const prevRootOverflow=root.style.overflow;
  const prevBodyPaddingRight=body.style.paddingRight;
  const scrollbarWidth=Math.max(0,window.innerWidth-root.clientWidth);
  const onKeyDown=e=>{if(e.key==='Escape'){e.preventDefault();setProfileOpen(false);}};
  body.style.overflow='hidden';
  root.style.overflow='hidden';
  if(scrollbarWidth)body.style.paddingRight=`${scrollbarWidth}px`;
  window.addEventListener('keydown',onKeyDown);
  return ()=>{
   window.removeEventListener('keydown',onKeyDown);
   body.style.overflow=prevBodyOverflow;
   root.style.overflow=prevRootOverflow;
   body.style.paddingRight=prevBodyPaddingRight;
  };
 },[profileOpen]);
 useEffect(()=>{
  if(!searchOpen)return;
  const prev=document.body.style.overflow;
  const onKey=e=>{if(e.key==='Escape')setSearchOpen(false)};
  document.body.style.overflow='hidden';
  window.addEventListener('keydown',onKey);
  return()=>{document.body.style.overflow=prev;window.removeEventListener('keydown',onKey)};
 },[searchOpen]);
 const bookingTime=b=>{const t=Date.parse(b.createdAt||b.updatedAt||b.checkIn||'');return Number.isFinite(t)?t:0};
 const sortedBookings=useMemo(()=>[...p.bookings].sort((a,b)=>bookingTime(b)-bookingTime(a)),[p.bookings]);
 const visibleBookings=sortedBookings.filter(b=>{const f=bookingFilter==='All'||(bookingFilter==='Pending'&&b.status==='Pending')||(bookingFilter==='Active'&&['Accepted','Confirmed'].includes(b.status))||(bookingFilter==='Refunds'&&['Refund Pending','Refund Sent'].includes(b.status))||(bookingFilter==='Closed'&&['Rejected','Cancelled'].includes(b.status));const q=bookingSearch.trim().toLowerCase();const text=`${b.id||''} ${b.pg?.name||b.pgId||''} ${b.status||''}`.toLowerCase();return f&&(!q||text.includes(q));});
 return <div className="marketApp">
  <header className="marketHeader"><div className="marketBrand"><span>PG</span><b>StayFinder</b></div><nav className="marketNav">{nav.map(([k,l])=><button key={k} className={p.view===k?'active':''} onClick={()=>p.setView(k)}>{l}</button>)}</nav><div className="marketUser"><div className="userPill" role="button" tabIndex="0" onClick={()=>{setProfileOpen(true);p.loadCustomerProfile();}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setProfileOpen(true);p.loadCustomerProfile();}}} style={{cursor:'pointer'}}><span>{String(p.user.name||p.user.username)[0]?.toUpperCase()}</span><div><b>{p.user.name||p.user.username}</b><small>Customer</small></div></div><button type="button" onClick={()=>p.setHelpOpen(true)} style={{border:'1px solid #dce8e7',background:'#fff',borderRadius:12,padding:'9px 12px',fontWeight:800,color:'#315b58'}}>Help</button><button className="iconBtn" onClick={p.logout}>↪</button></div></header>
  {p.notice&&<div className="globalNotice">{p.notice}</div>}
  {p.view==='explore'&&<><section className="marketHero"><div className="marketHeroCopy"><p className="heroMini">STAYFINDER</p><h1>Find your stay.</h1></div><button type="button" className="mobileAirSearch" onClick={()=>setSearchOpen(true)}><span className="mobileAirSearchIcon">⌕</span><span><b>{p.searchArea||p.city||'Start your search'}</b><small>{[p.listingType!=='Any'?p.listingType:null,p.gender!=='Any'?p.gender:null,p.roomType!=='Any'?p.roomType:null,p.maxPrice&&p.maxPrice!=='999999'?`Up to ₹${Number(p.maxPrice).toLocaleString('en-IN')}`:null].filter(Boolean).join(' · ')||'Location · stay type · budget'}</small></span><i>☰</i></button><div className="searchPanel"><div className="searchField wide locationSearchField"><label>Where</label><div className="whereFieldRow"><input value={p.searchArea} onChange={e=>p.setSearchArea(e.target.value)} placeholder="Area, landmark or stay name"/><button type="button" className="nearMeBtn" onClick={p.useCustomerLocation}>⌖ Near me</button></div>{p.locationStatus&&<small className="nearMeStatus">{p.locationStatus}</small>}</div><div className="compactSearchGrid"><div className="searchField"><label>City</label><input value={p.city} onChange={e=>p.setCity(e.target.value)} placeholder="Jaipur"/></div><div className="searchField"><label>Stay type</label><select value={p.listingType} onChange={e=>p.setListingType(e.target.value)}><option>Any</option><option>PG</option><option>Single Room</option></select></div><div className="searchField"><label>Room</label><select value={p.roomType} onChange={e=>p.setRoomType(e.target.value)}><option>Any</option><option>Single</option><option>Double</option><option>Triple</option></select></div><div className="searchField"><label>For</label><select value={p.gender} onChange={e=>p.setGender(e.target.value)}><option>Any</option><option>Boys</option><option>Girls</option><option>Unisex</option></select></div><div className="searchField budgetField"><label>Budget</label><select value={p.maxPrice} onChange={e=>p.setMaxPrice(e.target.value)}><option value="6000">₹6k</option><option value="8000">₹8k</option><option value="10000">₹10k</option><option value="15000">₹15k</option><option value="20000">₹20k</option><option value="999999">Any</option></select></div></div><div className="searchBtn" aria-live="polite">{p.filteredPgs.length} {p.filteredPgs.length===1?'stay':'stays'} found</div></div></section>{searchOpen&&<div className="mobileSearchBackdrop" onMouseDown={()=>setSearchOpen(false)}><div className="mobileSearchSheet" onMouseDown={e=>e.stopPropagation()}><div className="mobileSearchSheetHead"><button type="button" onClick={()=>setSearchOpen(false)}>←</button><b>Search stays</b><button type="button" onClick={()=>{p.setSearchArea('');p.setCity('Jaipur');p.setListingType('Any');p.setRoomType('Any');p.setGender('Any');p.setMaxPrice('999999')}}>Clear</button></div><label className="airSearchWhere"><span>⌕</span><input autoFocus value={p.searchArea} onChange={e=>p.setSearchArea(e.target.value)} placeholder="Where do you want to stay?"/></label><button type="button" className="airNearMe" onClick={p.useCustomerLocation}>⌖ Use my current location</button><div className="airSearchSection"><h3>Stay type</h3><div className="airChoiceRow"><button type="button" className={p.listingType==='Any'?'active':''} onClick={()=>p.setListingType('Any')}>All</button><button type="button" className={p.listingType==='PG'?'active':''} onClick={()=>p.setListingType('PG')}>PG</button><button type="button" className={p.listingType==='Single Room'?'active':''} onClick={()=>p.setListingType('Single Room')}>Room</button></div></div><div className="airSearchTwo"><label><span>City</span><input value={p.city} onChange={e=>p.setCity(e.target.value)} placeholder="Jaipur"/></label><label><span>For</span><select value={p.gender} onChange={e=>p.setGender(e.target.value)}><option>Any</option><option>Boys</option><option>Girls</option><option>Unisex</option></select></label><label><span>Room</span><select value={p.roomType} onChange={e=>p.setRoomType(e.target.value)}><option>Any</option><option>Single</option><option>Double</option><option>Triple</option></select></label><label><span>Budget / month</span><select value={p.maxPrice} onChange={e=>p.setMaxPrice(e.target.value)}><option value="999999">Any budget</option><option value="6000">Up to ₹6,000</option><option value="8000">Up to ₹8,000</option><option value="10000">Up to ₹10,000</option><option value="15000">Up to ₹15,000</option><option value="20000">Up to ₹20,000</option></select></label></div><div className="airSearchSheetFooter"><span>{p.filteredPgs.length} {p.filteredPgs.length===1?'stay':'stays'}</span><button type="button" onClick={()=>setSearchOpen(false)}>Show stays</button></div></div></div>}<section className="quickStrip"><div><span>✓</span><p><b>Verified</b></p></div><div><span>₹</span><p><b>Clear pricing</b></p></div><div><span>⌂</span><p><b>Live rooms</b></p></div><div><span>⚡</span><p><b>Quick booking</b></p></div></section><section className="marketContent"><div className="marketTitleRow"><div><h2>{p.city||'Nearby'} stays</h2><p>{p.filteredPgs.length} available</p></div></div><div className="categoryRow">{['All Listings','Top Rated','Budget','Girls','Boys','Co-Living'].map(x=><button key={x} className={p.activeCategory===x?'active':''} onClick={()=>p.setActiveCategory(x)}>{x==='All Listings'?'All':x}</button>)}</div><PropertyGrid list={p.filteredPgs} saved={p.saved} toggleSaved={p.toggleSaved} openPg={p.openPg} customerLocation={p.customerLocation}/></section></>}
  {p.view==='saved'&&<CustomerSection title="Saved Stays"><PropertyGrid list={p.pgs.filter(x=>p.saved.includes(x.id))} saved={p.saved} toggleSaved={p.toggleSaved} openPg={p.openPg} customerLocation={p.customerLocation}/></CustomerSection>}
  {p.view==='bookings'&&<CustomerSection title="My Bookings"><div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center',margin:'18px 0'}}><select value={bookingFilter} onChange={e=>setBookingFilter(e.target.value)} style={{minHeight:42,border:'1px solid #d9e5e3',borderRadius:12,padding:'0 12px',background:'#fff'}}><option>All</option><option>Pending</option><option>Active</option><option>Refunds</option><option>Closed</option></select><input value={bookingSearch} onChange={e=>setBookingSearch(e.target.value)} placeholder="Search listing or booking ID" style={{minHeight:42,minWidth:240,border:'1px solid #d9e5e3',borderRadius:12,padding:'0 12px'}}/><span style={{color:'#6b7f7d',fontSize:12,fontWeight:700}}>{visibleBookings.length} bookings · Newest first</span></div><div className="dataCards bookingJourneyCards">{visibleBookings.length?visibleBookings.map(b=>{const pay=paymentFor(b.id);const latestPay=latestPaymentFor(b.id);const refund=refundFor(b.id);return <article key={b.id}><div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center'}}><span className={`status ${b.status.toLowerCase()}`}>{b.status}</span><span style={{fontSize:11,fontWeight:800,color:'#607a78'}}>{b.id}</span></div><h3>{b.pg?.name||b.pgId}</h3><p>{b.room?.type||'Room'} · {b.checkIn} → {b.checkOut}</p><p><b>{b.stayDays||'-'} days</b> · Rent ₹{Number(b.rentTotal||0).toLocaleString('en-IN')} + Deposit ₹{Number(b.deposit||0).toLocaleString('en-IN')}</p><strong className="bookingTotal">Total ₹{Number(b.amount||0).toLocaleString('en-IN')}</strong>{b.status==='Pending'&&<p className="journeyHint">Awaiting Owner approval.</p>}{b.status==='Accepted'&&!pay&&latestPay?.status!=='Rejected'&&<button className="payNowBtn" onClick={()=>{p.setView('payments');p.selectPaymentBooking(b.id)}}>Pay now · ₹{Number(b.amount||0).toLocaleString('en-IN')}</button>}{b.status==='Accepted'&&!pay&&latestPay?.status==='Rejected'&&<div className="paymentCorrectionCard"><b>Payment proof correction required</b><span>{latestPay.rejectionReason||'The owner could not verify the payment proof.'}</span><small>If the amount was already debited, do not pay again. Submit the correct transaction ID or screenshot.</small><button className="payNowBtn" onClick={()=>{p.setView('payments');p.selectPaymentBooking(b.id)}}>Submit corrected proof</button></div>}{b.status==='Accepted'&&pay?.status==='Submitted'&&<div className="paymentPendingCard"><b>✓ Payment proof submitted</b><span>Owner verification is pending. A duplicate payment is blocked.</span><button onClick={()=>window.open(`/api/file/${pay.proofFileId}`,'_blank')}>View submitted proof</button></div>}{b.status==='Confirmed'&&<div className="confirmedActions"><span>✓ Payment verified · Stay confirmed</span><button onClick={()=>p.showConfirmedContact(b.id)}>Owner contact & exact location</button></div>}{refund&&['Refund Pending','Refund Sent'].includes(b.status)&&<div className="refundCustomerCard"><b>↩ Owner cancelled · Full refund ₹{Number(refund.amount||0).toLocaleString('en-IN')}</b><span>Reason: {refund.reason}</span>{refund.status==='Pending'&&<small>The owner is processing your refund.</small>}{refund.status==='Sent'&&<><p><b>Refund transaction:</b> {refund.transactionRef}</p>{refund.proofFileId&&<button onClick={()=>window.open(`/api/file/${refund.proofFileId}`,'_blank')}>View refund proof</button>}<div className="actionPair"><button onClick={()=>p.customerRefundAction(refund.id,'received')}>✓ Refund received</button><button className="danger" onClick={()=>p.customerRefundAction(refund.id,'issue')}>Report issue</button></div></>}</div>}{refund?.status==='Received'&&b.status==='Cancelled'&&<div className="refundCompleteCard"><b>✓ Booking cancelled & full refund received</b><span>₹{Number(refund.amount||0).toLocaleString('en-IN')} refund completed.</span></div>}</article>}):<Empty text="No bookings found."/>}</div></CustomerSection>}
  {p.view==='payments'&&<CustomerSection title="Complete Payment"><div className="paymentLayout customerPaymentLayout"><div><form className="simpleForm" onSubmit={p.submitPayment}><h3>Booking payment</h3><label>Booking<select required value={p.paymentForm.bookingId} onChange={e=>p.selectPaymentBooking(e.target.value)}><option value="">Select accepted booking</option>{payableBookings.map(b=><option key={b.id} value={b.id}>{b.pg?.name||b.id} · ₹{b.amount}</option>)}</select></label>{p.paymentForm.bookingId&&<div className="payToBox">{p.customerPaySettings?<><div className="payToHead"><div><small>PAY TO OWNER</small><h3>{p.customerPaySettings.upiName}</h3></div><span>₹{Number(p.paymentForm.amount||0).toLocaleString('en-IN')}</span></div><div className="payMethods">{p.customerPaySettings.qrFileId&&<div className="customerQrWrap"><a href={`/api/file/${p.customerPaySettings.qrFileId}`} target="_blank" rel="noreferrer"><img className="ownerQr" src={`/api/file/${p.customerPaySettings.qrFileId}`} alt="Owner QR code"/></a><a className="openQrBtn" href={`/api/file/${p.customerPaySettings.qrFileId}`} target="_blank" rel="noreferrer">Open full size QR</a><small>Scan the QR with your phone camera or UPI app</small></div>}<div><small>UPI ID</small><strong>{p.customerPaySettings.upiId}</strong><button type="button" className="copyBtn" onClick={()=>navigator.clipboard?.writeText(p.customerPaySettings.upiId)}>Copy UPI</button>{p.customerPaySettings.bankName&&<div className="bankMini"><small>BANK TRANSFER</small><b>{p.customerPaySettings.bankName}</b><span>{p.customerPaySettings.accountHolder}</span><span>A/C {p.customerPaySettings.accountNumber}</span><span>IFSC {p.customerPaySettings.ifsc}</span></div>}</div></div>{p.customerPaySettings.note&&<p className="paymentNote">{p.customerPaySettings.note}</p>}</>:<div className="missingPay"><b>Owner payment details pending</b><p>UPI / QR details are not available yet.</p></div>}</div>}<label>Amount<input required readOnly type="number" value={p.paymentForm.amount}/></label><label>Mode<select value={p.paymentForm.mode} onChange={e=>p.setPaymentForm({...p.paymentForm,mode:e.target.value})}><option>UPI</option><option>Bank Transfer</option></select></label><label>Transaction reference · 12 digits<input required inputMode="numeric" pattern="[0-9]{12}" maxLength={12} value={p.paymentForm.transactionRef} onChange={e=>p.setPaymentForm({...p.paymentForm,transactionRef:e.target.value.replace(/\D/g,'').slice(0,12)})} placeholder="12 digit transaction ID"/><small className="fieldHelp">Only numeric · exactly 12 digits</small></label><label>Payment proof<input key={p.paymentFileKey} required type="file" accept="image/*" onChange={e=>p.setPaymentForm({...p.paymentForm,proof:e.target.files?.[0]||null})}/></label><button disabled={!p.customerPaySettings}>Submit proof</button><button className="secondaryAction" type="button" onClick={()=>p.setView('bookings')}>Back to My Bookings</button></form></div></div></CustomerSection>}
    {p.helpOpen&&<HelpModal role="customer" close={()=>p.setHelpOpen(false)} go={v=>{p.setHelpOpen(false);if(v==='profile'){setProfileOpen(true);p.loadCustomerProfile();}else p.setView(v)}}/>}{profileOpen&&<CustomerProfileModal p={p} close={()=>setProfileOpen(false)}/>}
  {p.selectedPg&&<PgModal pg={p.selectedPg} close={()=>p.setSelectedPg(null)} form={p.bookingForm} setForm={p.setBookingForm} submit={p.createBooking}/>} {p.contactInfo&&<ContactModal info={p.contactInfo} close={()=>p.setContactInfo(null)}/>}<StayFinderPlus user={p.user} role="customer" bookings={p.bookings} pgs={p.pgs} rooms={[]}/><nav className="mobileBottomNav">{nav.map(([k,l])=><button key={k} className={p.view===k?'active':''} onClick={()=>p.setView(k)}><span>{k==='explore'?'⌕':k==='saved'?'♡':k==='bookings'?'▣':'○'}</span>{l}</button>)}<button className={profileOpen?'active':''} onClick={()=>{setProfileOpen(true);p.loadCustomerProfile();}}><span>○</span>Account</button></nav>
 </div>
}

function PropertyGrid({list,saved,toggleSaved,openPg,customerLocation}){if(!list.length)return <Empty text="No stays found."/>;return <div className="propertyGrid">{list.map(pg=>{const rents=(pg.rooms||[]).map(r=>r.rent).filter(Boolean);const price=rents.length?Math.min(...rents):0;const cover=pg.images?.[0];const available=(pg.rooms||[]).reduce((sum,r)=>sum+Number(r.availableBeds||0),0);return <article className="propertyCard" key={pg.id} role="button" tabIndex="0" onClick={()=>openPg(pg)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openPg(pg)}}}><div className="propertyImageWrap">{cover?<img src={`/api/file/${cover}`} alt={pg.name}/>:<div className="noPhoto">Stay</div>}<span className="propertyBadge">Verified</span>{pg.images?.length>1&&<span className="photoCountBadge">▧ {pg.images.length}</span>}<button aria-label="Save listing" className={`heartBtn ${saved.includes(pg.id)?'saved':''}`} onClick={e=>{e.stopPropagation();toggleSaved(pg.id)}}>{saved.includes(pg.id)?'♥':'♡'}</button></div><div className="propertyBody"><div className="propertyTop"><div><h3>{pg.name}</h3><p>{pg.city}{pg.address?` · ${pg.address}`:''}</p></div><span className="rating">★ New</span></div><p className="propertyMeta">{pg.listingType||'PG'} · {pg.gender||'Unisex'}{customerLocation&&pg.latitude&&pg.longitude?` · ${geoDistanceKm(customerLocation.lat,customerLocation.lng,Number(pg.latitude),Number(pg.longitude)).toFixed(1)} km`:''}</p><div className="tagRow">{(pg.amenities||[]).slice(0,3).map(a=><span key={a}>{a}</span>)}</div><div className="propertyFooter"><div><b>{price?`₹${price.toLocaleString('en-IN')}`:'Price on request'}</b>{price?<span> / month</span>:null}<small>{available?` · ${available} available`:''}</small></div><button onClick={e=>{e.stopPropagation();openPg(pg)}}>View details</button></div></div></article>})}</div>}


function HelpModal({close,go,role='owner'}){const supportWa='https://wa.me/918529812503?text=I%20have%20an%20issue';const supportEmail='mailto:Ghanshyamjangir334@gmail.com?subject=StayFinder%20Support&body=I%20have%20an%20issue';return <div className="modalBackdrop" onMouseDown={close}><div className="helpModal" onMouseDown={e=>e.stopPropagation()}><button className="modalClose" onClick={close}>×</button><p className="eyebrow">SUPPORT</p><h2>How can we help?</h2><div className="helpActions">{role==='owner'?<><button onClick={()=>go('bookings')}><b>Booking support</b></button><button onClick={()=>go('payments')}><b>Payment & refund support</b></button><button onClick={()=>go('rooms')}><b>Room & availability support</b></button><button onClick={()=>go('properties')}><b>Listing support</b></button></>:<><button onClick={()=>go('bookings')}><b>Booking, payment or refund issue</b></button><button onClick={()=>go('explore')}><b>Listing search or location issue</b></button><button onClick={()=>go('profile')}><b>Account & refund details</b></button></>}<a href={supportWa} target="_blank" rel="noreferrer" style={{textDecoration:'none',border:'1px solid #dce8e6',background:'#f7fbfa',borderRadius:14,padding:16,display:'flex',flexDirection:'column',gap:5,color:'#173f3d'}}><b>WhatsApp Support</b><span>8529812503</span></a><a href={supportEmail} style={{textDecoration:'none',border:'1px solid #dce8e6',background:'#f7fbfa',borderRadius:14,padding:16,display:'flex',flexDirection:'column',gap:5,color:'#173f3d'}}><b>Email Support</b><span>Ghanshyamjangir334@gmail.com</span></a></div></div></div>}
function OwnerPreviewModal({pg,rooms,close}){const imgs=pg.images||[];const [activeImage,setActiveImage]=useState(imgs[0]||'');return <div className="modalBackdrop" onMouseDown={close}><div className="pgModal ownerPreviewModal" onMouseDown={e=>e.stopPropagation()}><button className="modalClose" onClick={close}>×</button><div className="galleryMain galleryContain">{activeImage?<img src={`/api/file/${activeImage}`} alt={pg.name}/>:<div className="noPhoto">Stay</div>}</div>{imgs.length>1&&<div className="galleryStrip">{imgs.slice(0,8).map((id,i)=><button type="button" className={activeImage===id?'active':''} onClick={()=>setActiveImage(id)} key={id}><img src={`/api/file/${id}`} alt={`${pg.name} ${i+1}`}/></button>)}</div>}<div className="modalBody"><p className="eyebrow">CUSTOMER PREVIEW</p><h1>{pg.name}</h1><p>{pg.address}, {pg.city}</p><p>{pg.description}</p><div className="tagRow">{pg.amenities?.map(a=><span key={a}>{a}</span>)}</div><h3>Room inventory</h3><div className="roomChoice">{rooms.length?rooms.map(r=><div className="previewRoom" key={r.id}><b>{r.type}</b><span>{r.availableBeds}/{r.totalBeds} beds available</span><strong>₹{r.rent.toLocaleString('en-IN')}/month</strong><small>Deposit ₹{r.deposit.toLocaleString('en-IN')}</small></div>):<p>No rooms added yet.</p>}</div></div></div></div>}

function OwnerSection({title,sub,children}){return <section className="ownerWorkspace"><div className="workspaceHead"><div><p className="eyebrow">STAYFINDER OWNER</p><h1>{title}</h1></div></div>{children}</section>}
function SectionTitle({n,h,p}){return <div className="formSectionTitle"><span>{n}</span><div><h3>{h}</h3></div></div>}
function Stat({t,v,x,i}){return <article><div className="statIcon">{i}</div><div><small>{t}</small><strong>{v}</strong><p>{x}</p></div></article>}
function PanelHead({e,h,action}){return <div className="panelHead"><div><p className="eyebrow">{e}</p><h3>{h}</h3></div><button onClick={action}>View all</button></div>}
function Empty({text}){return <div className="workspaceEmpty compact"><span>⌂</span><h3>{text}</h3></div>}
