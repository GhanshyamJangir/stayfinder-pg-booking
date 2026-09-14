self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?event.data.json():{};}catch{data={title:'StayFinder',body:event.data?.text()||'You have a new update.'};}
  const title=data.title||'StayFinder';
  const options={
    body:data.body||'You have a new update.',
    tag:data.tag||'stayfinder-update',
    renotify:true,
    data:{url:data.url||'/'},
    vibrate:[180,80,180],
    requireInteraction:false
  };
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification?.data?.url||'/',self.location.origin).href;
  event.waitUntil((async()=>{
    const list=await clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of list){
      if('focus' in client){
        try{await client.navigate(target);}catch{}
        return client.focus();
      }
    }
    return clients.openWindow?clients.openWindow(target):undefined;
  })());
});
