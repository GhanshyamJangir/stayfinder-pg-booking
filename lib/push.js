import webpush from 'web-push';
import { listUserPushSubscriptions, deactivatePushSubscription } from './push-store';

let configured=false;
function configure(){
  if(configured)return;
  const pub=process.env.VAPID_PUBLIC_KEY,priv=process.env.VAPID_PRIVATE_KEY,subject=process.env.VAPID_SUBJECT||'mailto:support@example.com';
  if(!pub||!priv)throw new Error('VAPID keys are missing.');
  webpush.setVapidDetails(subject,pub,priv);configured=true;
}

export async function sendPushToUser(userId,payload){
  if(!userId)return {sent:0};
  configure();
  const subs=await listUserPushSubscriptions(userId); let sent=0;
  await Promise.all(subs.map(async s=>{
    try{
      await webpush.sendNotification({endpoint:s.endpoint,keys:s.keys},JSON.stringify(payload),{TTL:60*60*12,urgency:'high'});sent++;
    }catch(e){
      if([404,410].includes(e?.statusCode))await deactivatePushSubscription(s.id).catch(()=>{});
      else console.error('PUSH_SEND_ERROR',e?.statusCode||'',e?.message||e);
    }
  }));
  return {sent};
}
