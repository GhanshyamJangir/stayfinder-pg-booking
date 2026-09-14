'use client';

import { useEffect, useState } from 'react';

function urlBase64ToUint8Array(base64String){
  const padding='='.repeat((4-(base64String.length%4))%4);
  const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(base64);
  return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
}

export default function PushNotifications(){
  const [supported,setSupported]=useState(false);
  const [permission,setPermission]=useState('default');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');

  async function subscribe(silent=false){
    if(typeof window==='undefined'||!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))return;
    setBusy(true); if(!silent)setMessage('');
    try{
      let perm=Notification.permission;
      if(perm==='default'&&!silent)perm=await Notification.requestPermission();
      setPermission(perm);
      if(perm!=='granted'){
        if(!silent&&perm==='denied')setMessage('Notifications are blocked in phone settings.');
        return;
      }
      const cfg=await fetch('/api/push/config',{cache:'no-store',credentials:'same-origin'}).then(r=>r.json());
      if(!cfg?.ok||!cfg.publicKey)throw new Error(cfg?.error||'Notification setup is incomplete.');
      // Dedicated /push/ scope keeps the existing PWA service worker untouched.
      const reg=await navigator.serviceWorker.register('/push-sw.js',{scope:'/push/'});
      let sub=await reg.pushManager.getSubscription();
      if(!sub){
        sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(cfg.publicKey)});
      }
      const out=await fetch('/api/push/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({subscription:sub.toJSON()})}).then(r=>r.json());
      if(!out?.ok)throw new Error(out?.error||'Could not enable notifications.');
      if(!silent)setMessage('Notifications enabled.');
    }catch(e){
      if(!silent)setMessage(e?.message||'Could not enable notifications.');
    }finally{setBusy(false);}
  }

  useEffect(()=>{
    const ok=typeof window!=='undefined'&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
    setSupported(ok);
    if(!ok)return;
    setPermission(Notification.permission);
    if(Notification.permission==='granted')subscribe(true);
  },[]);

  if(!supported||permission==='granted')return message?<div className="pushToast ok">{message}</div>:null;
  if(permission==='denied')return null;
  return <div className="pushEnableWrap">
    <button type="button" className="pushEnableBtn" onClick={()=>subscribe(false)} disabled={busy}>🔔 {busy?'Enabling...':'Enable alerts'}</button>
    {message&&<div className="pushMiniMsg">{message}</div>}
    <style jsx>{`
      .pushEnableWrap{position:fixed;right:16px;bottom:92px;z-index:1200;display:grid;justify-items:end;gap:6px}
      .pushEnableBtn{border:0;border-radius:999px;background:#124f4a;color:#fff;font-weight:800;padding:11px 15px;box-shadow:0 8px 24px rgba(18,79,74,.22)}
      .pushMiniMsg,.pushToast{font-size:12px;background:#fff;border:1px solid #d8e5e3;border-radius:12px;padding:8px 10px;max-width:240px;box-shadow:0 8px 24px rgba(0,0,0,.09)}
      .pushToast{position:fixed;right:16px;bottom:92px;z-index:1200;color:#17433f}
      @media(min-width:800px){.pushEnableWrap,.pushToast{bottom:24px;right:24px}}
    `}</style>
  </div>;
}
