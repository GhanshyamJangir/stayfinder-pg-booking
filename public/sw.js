const VERSION='stayfinder-pwa-v3';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k.startsWith('stayfinder-pwa-')&&k!==VERSION).map(k=>caches.delete(k)));
  await self.clients.claim();
})()));
// Network-first/pass-through: do not cache HTML/API, so app data and deployments never go stale.
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));
});
