import { NextResponse } from 'next/server';
import { readSession } from '../../../../lib/session';
import { uploadBuffer, getDriveFile } from '../../../../lib/drive';
import { submitVerification, listVerificationForUser, reviewVerification } from '../../../../lib/platform-controls';

const ALLOWED=new Set(['Aadhaar Front','Aadhaar Back','Driving Licence','Voter ID','eKYC Selfie']);
export async function GET(req){try{const u=await readSession();if(!u)return NextResponse.json({ok:false},{status:401});const items=await listVerificationForUser(u.sub);const fileId=new URL(req.url).searchParams.get('fileId');if(fileId){const owned=items.find(x=>String(x.file_id)===String(fileId));if(!owned)return NextResponse.json({ok:false,error:'File not found.'},{status:404});const file=await getDriveFile(fileId);return new Response(file.buffer,{status:200,headers:{'Content-Type':file.mimeType||'application/octet-stream','Cache-Control':'private, max-age=60'}});}return NextResponse.json({ok:true,items});}catch(e){return NextResponse.json({ok:false,error:e.message},{status:500});}}
export async function POST(req){
 try{
  const u=await readSession();if(!u||!['customer','owner'].includes(u.role))return NextResponse.json({ok:false},{status:401});
  const form=await req.formData();const file=form.get('file'),docType=String(form.get('docType')||'').trim(),replace=String(form.get('replace')||'')==='1';
  if(!ALLOWED.has(docType))throw new Error('Please choose a valid verification document.');
  if(!file||typeof file.arrayBuffer!=='function'||!file.size)throw new Error('Document file is required.');
  if(Number(file.size||0)>8*1024*1024)throw new Error('Document must be under 8 MB.');
  if(['Aadhaar Front','Aadhaar Back','eKYC Selfie'].includes(docType)&&!String(file.type||'').startsWith('image/'))throw new Error('This verification step requires an image.');
  if(docType==='eKYC Selfie'&&String(form.get('faceDetected')||'')!=='1')throw new Error('Live face detection is required for eKYC selfie.');
  const existing=await listVerificationForUser(u.sub);
  const activeExisting=existing.filter(x=>x.doc_type===docType&&x.status!=='Rejected');
  if(activeExisting.length&&!replace)throw new Error(`${docType} is already submitted.`);
  if(docType==='Aadhaar Back'&&!existing.some(x=>x.doc_type==='Aadhaar Front'&&x.status!=='Rejected'))throw new Error('Upload Aadhaar Front first.');
  const safeName=String(file.name||`document-${Date.now()}`).replace(/[^a-zA-Z0-9._ -]/g,'_');
  const uploaded=await uploadBuffer({buffer:Buffer.from(await file.arrayBuffer()),mimeType:file.type||'application/octet-stream',name:safeName,folderName:`Verification-${u.sub}`});
  const item=await submitVerification(u,{docType,fileId:uploaded.id,fileName:uploaded.name});
  if(replace){for(const old of activeExisting){try{await reviewVerification(u.sub,old.id,'Rejected','Replaced by user with a newer image.');}catch{}}}
  return NextResponse.json({ok:true,item},{status:201});
 }catch(e){return NextResponse.json({ok:false,error:e.message},{status:400});}
}
