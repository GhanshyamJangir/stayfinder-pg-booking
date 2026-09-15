'use client';

import { useEffect, useRef, useState } from 'react';

const FACE_API_SRC='https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
const FACE_MODEL_URL='https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';
const TESSERACT_SRC='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

function hasDoc(items,type){return items.some(x=>x.doc_type===type&&x.status!=='Rejected');}
function latestDoc(items,type){return items.find(x=>x.doc_type===type&&x.status!=='Rejected')||null;}
function docPreviewUrl(item){return item?.file_id?`/api/plus/verification?fileId=${encodeURIComponent(item.file_id)}`:'';}
function itemTime(item){const n=Date.parse(item?.updated_at||item?.created_at||'');return Number.isFinite(n)?n:0;}
function activeRejections(items=[]){
 const latestByType=new Map();
 items.forEach(x=>{const key=String(x.doc_type||'');const cur=latestByType.get(key);if(!cur||itemTime(x)>=itemTime(cur))latestByType.set(key,x);});
 return [...latestByType.values()].filter(x=>x.status==='Rejected').sort((a,b)=>itemTime(b)-itemTime(a));
}
export function verificationState(items=[]){
 const aadhaar=hasDoc(items,'Aadhaar Front')&&hasDoc(items,'Aadhaar Back');
 const other=['Driving Licence','Voter ID'].some(t=>hasDoc(items,t));
 return {documentComplete:aadhaar||other,ekycComplete:hasDoc(items,'eKYC Selfie')};
}


let tesseractPromise=null;
function loadTesseract(){
 if(typeof window==='undefined')return Promise.reject(new Error('Aadhaar scan is not available.'));
 if(window.Tesseract)return Promise.resolve(window.Tesseract);
 if(tesseractPromise)return tesseractPromise;
 tesseractPromise=new Promise((resolve,reject)=>{
  const old=document.querySelector('script[data-stayfinder-tesseract]');
  if(old){old.addEventListener('load',()=>resolve(window.Tesseract));old.addEventListener('error',()=>reject(new Error('Aadhaar scanner could not load.')));return;}
  const s=document.createElement('script');s.src=TESSERACT_SRC;s.async=true;s.dataset.stayfinderTesseract='1';
  s.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(new Error('Aadhaar scanner could not initialize.'));
  s.onerror=()=>reject(new Error('Aadhaar scanner could not load. Check internet and try again.'));
  document.head.appendChild(s);
 }).catch(e=>{tesseractPromise=null;throw e;});
 return tesseractPromise;
}
function hasTwelveDigitNumber(text=''){
 const normalized=String(text).replace(/[Oo]/g,'0').replace(/[Il|]/g,'1');
 return /(?:^|\D)\d{4}[\s-]*\d{4}[\s-]*\d{4}(?:\D|$)/.test(normalized)||/(?:^|\D)\d{12}(?:\D|$)/.test(normalized);
}
async function validateAadhaarImage(file){
 if(!file?.type?.startsWith('image/'))throw new Error('Please upload Aadhaar as an image.');
 const Tesseract=await loadTesseract();
 const result=await Tesseract.recognize(file,'eng',{logger:()=>{}});
 if(!hasTwelveDigitNumber(result?.data?.text||''))throw new Error('12-digit Aadhaar number not detected. Please upload a clear Aadhaar image and try again.');
 return true;
}

let faceApiPromise=null;
function loadFaceApi(){
 if(typeof window==='undefined')return Promise.reject(new Error('Face detection is not available.'));
 if(window.faceapi)return Promise.resolve(window.faceapi);
 if(faceApiPromise)return faceApiPromise;
 faceApiPromise=new Promise((resolve,reject)=>{
  const old=document.querySelector('script[data-stayfinder-faceapi]');
  if(old){old.addEventListener('load',()=>resolve(window.faceapi));old.addEventListener('error',()=>reject(new Error('Face detector could not load.')));return;}
  const s=document.createElement('script');s.src=FACE_API_SRC;s.async=true;s.dataset.stayfinderFaceapi='1';
  s.onload=()=>window.faceapi?resolve(window.faceapi):reject(new Error('Face detector could not initialize.'));
  s.onerror=()=>reject(new Error('Face detector could not load. Check internet and try again.'));
  document.head.appendChild(s);
 }).then(async api=>{await api.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL);return api;}).catch(e=>{faceApiPromise=null;throw e;});
 return faceApiPromise;
}

async function detectFaces(canvas){
 if(typeof window!=='undefined'&&'FaceDetector' in window){
  try{const detector=new window.FaceDetector({fastMode:true,maxDetectedFaces:2});const faces=await detector.detect(canvas);return faces.length;}catch{}
 }
 const api=await loadFaceApi();
 const found=await api.detectAllFaces(canvas,new api.TinyFaceDetectorOptions({inputSize:128,scoreThreshold:.45}));
 return found.length;
}

export default function VerificationSetup({mode='all',items:externalItems,onItemsChange,title=true}){
 const [items,setItems]=useState(Array.isArray(externalItems)?externalItems:[]);
 const [docChoice,setDocChoice]=useState('Aadhaar');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [cameraOn,setCameraOn]=useState(false),[faceStatus,setFaceStatus]=useState('');
 const videoRef=useRef(null),streamRef=useRef(null);
 const state=verificationState(items);
 const showDoc=mode==='all'||mode==='document'; const showEkyc=mode==='all'||mode==='ekyc';
 const rejectionItems=activeRejections(items).filter(x=>showEkyc&&x.doc_type==='eKYC Selfie'||showDoc&&x.doc_type!=='eKYC Selfie');

 useEffect(()=>{if(Array.isArray(externalItems))setItems(externalItems);},[externalItems]);
 useEffect(()=>()=>stopCamera(),[]);
 async function refresh(){
  const r=await fetch('/api/plus/verification',{cache:'no-store'});const d=await r.json();
  if(!r.ok||!d.ok)throw new Error(d.error||'Unable to load verification.');
  const next=d.items||[];setItems(next);onItemsChange?.(next);return next;
 }
 useEffect(()=>{if(!externalItems)refresh().catch(e=>setError(e.message));},[]);
 function stopCamera(){try{streamRef.current?.getTracks()?.forEach(t=>t.stop());}catch{}streamRef.current=null;setCameraOn(false);}
 async function uploadDoc(file,docType,{replace=false}={}){
  if(!file)return;setBusy(true);setError('');setMessage('');
  try{
   if(docType==='Aadhaar Front'||docType==='Aadhaar Back'){
    setMessage('Checking Aadhaar number...');
    await validateAadhaarImage(file);
    setMessage('12-digit Aadhaar number detected. Uploading...');
   }
   const form=new FormData();form.append('docType',docType);form.append('file',file);if(replace)form.append('replace','1');
   const r=await fetch('/api/plus/verification',{method:'POST',body:form});const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||'Upload failed.');
   await refresh();setMessage(`${docType} uploaded successfully.`);
  }catch(e){setMessage('');setError(e.message||'Upload failed.');}finally{setBusy(false);}
 }
 async function startCamera(){
  setError('');setMessage('');setFaceStatus('Opening camera...');
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera is not supported on this device/browser.');
   stopCamera();const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:720},height:{ideal:720}},audio:false});
   streamRef.current=stream;if(videoRef.current){videoRef.current.srcObject=stream;await videoRef.current.play();}setCameraOn(true);setFaceStatus('Keep one face clearly inside the frame.');
   loadFaceApi().catch(()=>{});
  }catch(e){setFaceStatus('');setError(e.message||'Camera permission is required.');}
 }
 async function captureSelfie(){
  const video=videoRef.current;if(!video||!video.videoWidth){setError('Camera is not ready yet.');return;}
  setBusy(true);setError('');setMessage('');setFaceStatus('Detecting face...');
  try{
   const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;const ctx=canvas.getContext('2d');ctx.drawImage(video,0,0,canvas.width,canvas.height);
   const faces=await Promise.race([detectFaces(canvas),new Promise((_,reject)=>setTimeout(()=>reject(new Error('FACE_DETECT_TIMEOUT')),5000))]);
   if(faces===0)throw new Error('No face detected. Keep your face clearly visible and try again.');
   if(faces>1)throw new Error('More than one face detected. Only one person should be in the selfie.');
   setFaceStatus('Face detected ✓ Uploading eKYC selfie...');
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.9));if(!blob)throw new Error('Unable to capture selfie.');
   const file=new File([blob],`ekyc-selfie-${Date.now()}.jpg`,{type:'image/jpeg'});const form=new FormData();form.append('docType','eKYC Selfie');form.append('file',file);form.append('faceDetected','1');
   const r=await fetch('/api/plus/verification',{method:'POST',body:form});const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||'Selfie upload failed.');
   await refresh();stopCamera();setFaceStatus('Face detected and eKYC selfie uploaded ✓');setMessage('eKYC selfie completed successfully.');
  }catch(e){setFaceStatus('');const msg=String(e?.message||'');if(msg==='FACE_DETECT_TIMEOUT'||/fetch|model|detector|network|load|initialize/i.test(msg))setError('Face not detected. Please keep your face clearly visible and try again.');else setError(msg||'Face not detected. Please keep your face clearly visible and try again.');}finally{setBusy(false);}
 }
 const aadhaarFrontItem=latestDoc(items,'Aadhaar Front'),aadhaarBackItem=latestDoc(items,'Aadhaar Back');
 const aadhaarFront=!!aadhaarFrontItem,aadhaarBack=!!aadhaarBackItem;
 return <div className="verificationSetup">
  {title&&<div className="verificationHeading"><p>IDENTITY VERIFICATION</p><h2>Complete your verification</h2><span>Documents are uploaded securely. eKYC selfie can only be taken live from the camera.</span></div>}
  {rejectionItems.map(x=><div className="verificationRejected" key={`reject-${x.id||x.doc_type}`}><b>{x.doc_type} rejected</b><span>{x.note?.trim()||'Verification was rejected. Please submit a clear replacement and try again.'}</span></div>)}
  {error&&<div className="verificationError">{error}</div>}{message&&<div className="verificationSuccess">{message}</div>}
  {showDoc&&<section className={`verificationCard ${state.documentComplete?'complete':''}`}><div className="verificationCardHead"><span>{state.documentComplete?'✓':'1'}</span><div><h3>Document Verification</h3><p>{state.documentComplete?'Document submitted · you can still review or change the image':'Choose one identity document'}</p></div></div><label>Document type<select value={docChoice} onChange={e=>setDocChoice(e.target.value)} disabled={busy}><option>Aadhaar</option><option>Driving Licence</option><option>Voter ID</option></select></label>{docChoice==='Aadhaar'?<div className="aadhaarSteps"><label className={aadhaarFront?'done':''}><b>{aadhaarFront?'✓ Aadhaar Front uploaded':'Aadhaar Front'}</b>{aadhaarFrontItem&&<img className="docPreview" src={docPreviewUrl(aadhaarFrontItem)} alt="Uploaded Aadhaar Front"/>}<input id="aadhaar-front-file" className={aadhaarFront?'replaceInput':''} type="file" accept="image/*" disabled={busy} onChange={e=>{const f=e.target.files?.[0];e.target.value='';uploadDoc(f,'Aadhaar Front',{replace:aadhaarFront})}}/>{aadhaarFront&&<span className="changeHint">Choose another image to replace</span>}</label><label className={!aadhaarFront?'locked':aadhaarBack?'done':''}><b>{aadhaarBack?'✓ Aadhaar Back uploaded':'Aadhaar Back'}</b>{aadhaarBackItem&&<img className="docPreview" src={docPreviewUrl(aadhaarBackItem)} alt="Uploaded Aadhaar Back"/>}{aadhaarFront&&<input id="aadhaar-back-file" className={aadhaarBack?'replaceInput':''} type="file" accept="image/*" disabled={busy} onChange={e=>{const f=e.target.files?.[0];e.target.value='';uploadDoc(f,'Aadhaar Back',{replace:aadhaarBack})}}/>}{aadhaarBack&&<span className="changeHint">Choose another image to replace</span>}{!aadhaarFront&&<small>Upload Aadhaar Front first.</small>}</label></div>:<label><b>{docChoice}</b><input type="file" accept="image/*,.pdf" disabled={busy} onChange={e=>{const f=e.target.files?.[0];e.target.value='';uploadDoc(f,docChoice,{replace:hasDoc(items,docChoice)})}}/></label>}</section>}
  {showEkyc&&<section className={`verificationCard ${state.ekycComplete?'complete':''}`}><div className="verificationCardHead"><span>{state.ekycComplete?'✓':showDoc?'2':'1'}</span><div><h3>eKYC Selfie</h3><p>{state.ekycComplete?'Live selfie completed':'Camera only · live face detection required'}</p></div></div>{!state.ekycComplete&&<div className="ekycCamera"><video ref={videoRef} playsInline muted className={cameraOn?'show':''}/>{!cameraOn?<button type="button" className="cameraBtn" onClick={startCamera} disabled={busy}>Open camera</button>:<div className="cameraActions"><button type="button" onClick={captureSelfie} disabled={busy}>{busy?'Checking face...':'Capture & verify selfie'}</button><button type="button" className="soft" onClick={stopCamera} disabled={busy}>Cancel</button></div>}{faceStatus&&<small>{faceStatus}</small>}</div>}</section>}
  <style jsx>{`
   .verificationSetup{display:grid;gap:16px;max-width:760px;margin:0 auto;width:100%}.verificationHeading p{margin:0;color:#6e8481;font-size:10px;font-weight:900;letter-spacing:.15em}.verificationHeading h2{margin:5px 0 5px;color:#173f3d}.verificationHeading span{font-size:12px;color:#6b7d7b}.verificationCard{background:#fff;border:1px solid #dce8e6;border-radius:18px;padding:18px;display:grid;gap:14px}.verificationCard.complete{border-color:#a9d5cf;background:#f7fcfb}.verificationCardHead{display:flex;gap:12px;align-items:center}.verificationCardHead>span{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#e9f3f1;color:#215e59;font-weight:900}.verificationCardHead h3{margin:0;color:#173f3d}.verificationCardHead p{margin:3px 0 0;font-size:11px;color:#738684}.verificationCard label{display:grid;gap:7px;font-size:12px;font-weight:800;color:#315b58}.verificationCard select,.verificationCard input[type=file]{width:100%;box-sizing:border-box;border:1px solid #d6e4e2;border-radius:12px;padding:11px;background:#fff}.aadhaarSteps{display:grid;grid-template-columns:1fr 1fr;gap:10px}.aadhaarSteps label{border:1px solid #dce8e6;border-radius:14px;padding:12px}.aadhaarSteps label.done{background:#eef8f6;border-color:#add8d2}.aadhaarSteps label.locked{opacity:.55}.aadhaarSteps small{font-weight:600}.docPreview{width:100%;aspect-ratio:16/10;object-fit:contain;background:#f4f8f7;border:1px solid #d6e4e2;border-radius:10px}.changeHint{font-size:10px;color:#44706c;font-weight:700}.replaceInput{background:#f8fbfa!important}.ekycCamera{display:grid;gap:10px}.ekycCamera video{display:none;width:100%;aspect-ratio:4/3;object-fit:cover;background:#101817;border-radius:16px;transform:scaleX(-1)}.ekycCamera video.show{display:block}.cameraBtn,.cameraActions button{min-height:46px;border:0;border-radius:12px;background:#1f5e5a;color:#fff;font-weight:900;padding:0 16px}.cameraActions{display:grid;grid-template-columns:1fr auto;gap:8px}.cameraActions button.soft{background:#edf4f3;color:#315b58}.ekycCamera small{font-weight:800;color:#235d58}.ekycCamera p{margin:0;font-size:10px;color:#788a88}.verificationRejected{padding:12px 14px;border:1px solid #efc5c5;border-radius:12px;background:#fff3f3;color:#8d2d2d;display:grid;gap:3px}.verificationRejected b{font-size:12px}.verificationRejected span{font-size:11px;line-height:1.45}.verificationError,.verificationSuccess{padding:10px 12px;border-radius:11px;font-size:12px;font-weight:700}.verificationError{background:#fff0f0;color:#9b3030}.verificationSuccess{background:#eef9f6;color:#23665f}@media(max-width:620px){.verificationCard{padding:14px;border-radius:15px}.aadhaarSteps{grid-template-columns:1fr}.cameraActions{grid-template-columns:1fr}.verificationHeading h2{font-size:20px}}
  `}</style>
 </div>;
}
