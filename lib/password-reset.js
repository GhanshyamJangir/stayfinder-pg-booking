import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { appendRow, readRows, updateRow } from './plus-store';
import { findUserByIdentifier, updateUserPassword } from './users';
import { sendMail, emailTemplate } from './mailer';

const clean=v=>String(v??'').trim();
const hash=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
const nowIso=()=>new Date().toISOString();
const plusMinutes=m=>new Date(Date.now()+m*60000).toISOString();

export async function requestPasswordOtp(identifier){
  const user=await findUserByIdentifier(identifier);
  // Generic success for unknown users prevents account enumeration.
  if(!user||!user.active||!user.email)return {ok:true};
  const recent=(await readRows('PasswordResetOTPs')).filter(r=>clean(r.user_id)===clean(user.id)&&!r.used_at).sort((a,b)=>Date.parse(b.created_at||0)-Date.parse(a.created_at||0))[0];
  if(recent&&Date.now()-Date.parse(recent.created_at||0)<60000)throw new Error('Please wait 60 seconds before requesting another OTP.');
  const otp=String(crypto.randomInt(100000,1000000));
  const id=`OTP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  await appendRow('PasswordResetOTPs',{id,user_id:user.id,email:user.email,otp_hash:await bcrypt.hash(otp,10),otp_expires_at:plusMinutes(10),verified_at:'',reset_token_hash:'',reset_expires_at:'',used_at:'',attempts:'0',created_at:nowIso()});
  const html=emailTemplate({title:'Your password reset OTP',lead:`Hello ${user.name||user.username},`,lines:[`Your StayFinder OTP is ${otp}.`,`It is valid for 10 minutes. Do not share this OTP with anyone.`,`If you did not request a password reset, you can ignore this email.`]});
  await sendMail({to:user.email,subject:'StayFinder password reset OTP',text:`Your StayFinder password reset OTP is ${otp}. It is valid for 10 minutes.`,html});
  return {ok:true};
}

export async function verifyPasswordOtp(identifier,otp){
  const user=await findUserByIdentifier(identifier);if(!user)throw new Error('Invalid or expired OTP.');
  const rows=(await readRows('PasswordResetOTPs')).filter(r=>clean(r.user_id)===clean(user.id)&&!r.used_at).sort((a,b)=>Date.parse(b.created_at||0)-Date.parse(a.created_at||0));
  const rec=rows[0];if(!rec||Date.parse(rec.otp_expires_at||0)<Date.now())throw new Error('OTP has expired. Request a new OTP.');
  const attempts=Number(rec.attempts||0);if(attempts>=5)throw new Error('Too many incorrect attempts. Request a new OTP.');
  const valid=await bcrypt.compare(clean(otp),rec.otp_hash||'');
  if(!valid){await updateRow('PasswordResetOTPs',rec.id,{attempts:String(attempts+1)});throw new Error('Incorrect OTP.');}
  const token=crypto.randomBytes(32).toString('hex');
  await updateRow('PasswordResetOTPs',rec.id,{verified_at:nowIso(),reset_token_hash:hash(token),reset_expires_at:plusMinutes(15)});
  return {resetToken:token};
}

export async function resetPassword(resetToken,newPassword,confirmPassword){
  const token=clean(resetToken);if(!token)throw new Error('Password reset session is invalid.');
  if(String(newPassword||'').length<6)throw new Error('New password must be at least 6 characters.');
  if(String(newPassword)!==String(confirmPassword))throw new Error('New password and confirm password do not match.');
  const tokenHash=hash(token);const rows=await readRows('PasswordResetOTPs');
  const rec=rows.find(r=>r.reset_token_hash===tokenHash&&!r.used_at&&r.verified_at);
  if(!rec||Date.parse(rec.reset_expires_at||0)<Date.now())throw new Error('Password reset session has expired. Start again.');
  const user=await updateUserPassword(rec.user_id,newPassword);
  await updateRow('PasswordResetOTPs',rec.id,{used_at:nowIso(),reset_token_hash:''});
  if(user?.email){
    await sendMail({to:user.email,subject:'StayFinder password changed',text:'Your StayFinder password was changed successfully.',html:emailTemplate({title:'Password changed successfully',lead:`Hello ${user.name||user.username},`,lines:['Your StayFinder account password has been updated.','If you did not make this change, contact StayFinder support immediately.']})});
  }
  return {ok:true};
}
