import bcrypt from 'bcryptjs';
import { getSheets } from './google';

const SHEET = 'Users';
const RANGE = `${SHEET}!A2:I`;

function normalizeRole(value) {
  const role = String(value || '').trim().toLowerCase();
  return ['owner','customer','admin'].includes(role) ? role : '';
}
function isActive(value) {
  const status = String(value ?? 'Active').trim().toLowerCase();
  return !['inactive', 'false', '0', 'disabled', 'blocked'].includes(status);
}
const clean=v=>String(v??'').trim();
const safeUserFromRow=row=>{
  const [id,name,mobile,username,,roleValue,status,createdAt,email]=row;
  const role=normalizeRole(roleValue); if(!role)return null;
  return {id,username,role,name,phone:mobile,email:email||'',active:isActive(status),createdAt};
};

export async function findUserByUsername(username) {
  const sheets=await getSheets();
  const res=await sheets.spreadsheets.values.get({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:RANGE});
  const needle=clean(username).toLowerCase();
  for(const row of (res.data.values||[])){
    if(clean(row[3]).toLowerCase()!==needle)continue;
    const user=safeUserFromRow(row); if(!user)return null;
    return {...user,passwordHash:row[4]};
  }
  return null;
}


export async function findUserByEmail(email) {
  const sheets=await getSheets();
  const res=await sheets.spreadsheets.values.get({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:RANGE});
  const needle=clean(email).toLowerCase();
  for(const row of (res.data.values||[])){
    if(clean(row[8]).toLowerCase()!==needle)continue;
    const user=safeUserFromRow(row); if(!user)return null;
    return {...user,passwordHash:row[4]};
  }
  return null;
}

export async function findUserByIdentifier(identifier){
  const value=clean(identifier);
  if(!value)return null;
  return value.includes('@')?findUserByEmail(value):findUserByUsername(value);
}

export async function updateUserPassword(userId,newPassword){
  const password=String(newPassword||'');
  if(password.length<6)throw new Error('Password must be at least 6 characters.');
  const sheets=await getSheets();
  const res=await sheets.spreadsheets.values.get({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:RANGE});
  const rows=res.data.values||[]; const idx=rows.findIndex(r=>clean(r[0])===clean(userId));
  if(idx<0)throw new Error('Account not found.');
  const hash=await bcrypt.hash(password,12);
  await sheets.spreadsheets.values.update({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!E${idx+2}`,valueInputOption:'RAW',requestBody:{values:[[hash]]}});
  return safeUserFromRow(rows[idx]);
}

export async function findUserById(userId) {
  const sheets=await getSheets();
  const res=await sheets.spreadsheets.values.get({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:RANGE});
  const needle=clean(userId);
  for(const row of (res.data.values||[])){
    if(clean(row[0])!==needle)continue;
    return safeUserFromRow(row);
  }
  return null;
}

export async function verifyUser(username,password){
  const user=await findUserByUsername(username);
  if(!user||!user.active||!user.passwordHash)return null;
  let ok=false; try{ok=await bcrypt.compare(String(password||''),user.passwordHash);}catch{ok=false;}
  if(!ok)return null; const {passwordHash,...safeUser}=user; return safeUser;
}

export async function registerUser({name,mobile,email,username,password,role}){
  const safeRole=normalizeRole(role),safeName=clean(name),safeMobile=clean(mobile).replace(/\D/g,''),safeEmail=clean(email).toLowerCase(),safeUsername=clean(username).toLowerCase(),safePassword=String(password||'');
  if(!safeName||!safeUsername||!safePassword||!safeRole||!safeEmail)throw new Error('Name, mobile, email, username, password and role are required.');
  if(!['customer','owner'].includes(safeRole))throw new Error('Only Customer or Owner accounts can be created here.');
  if(!/^\d{10}$/.test(safeMobile))throw new Error('Mobile number must be exactly 10 digits.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail))throw new Error('Enter a valid email address.');
  if(!/^[a-z0-9._-]{4,30}$/.test(safeUsername))throw new Error('Username must be 4-30 characters using letters, numbers, dot, underscore or hyphen.');
  if(safePassword.length<6)throw new Error('Password must be at least 6 characters.');
  if(await findUserByUsername(safeUsername))throw new Error('This username is already registered.');
  const sheets=await getSheets();
  const rows=(await sheets.spreadsheets.values.get({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:RANGE})).data.values||[];
  if(rows.some(r=>String(r[2]||'').replace(/\D/g,'')===safeMobile))throw new Error('This mobile number is already registered.');
  if(rows.some(r=>clean(r[8]).toLowerCase()===safeEmail))throw new Error('This email is already registered.');
  const id=`USR-${Date.now().toString(36).toUpperCase()}`,passwordHash=await bcrypt.hash(safePassword,12),createdAt=new Date().toISOString();
  await sheets.spreadsheets.values.append({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:`${SHEET}!A:I`,valueInputOption:'RAW',insertDataOption:'INSERT_ROWS',requestBody:{values:[[id,safeName,safeMobile,safeUsername,passwordHash,safeRole,'Active',createdAt,safeEmail]]}});
  return {id,name:safeName,phone:safeMobile,email:safeEmail,username:safeUsername,role:safeRole,active:true,createdAt};
}

export async function getCustomerProfile(userId){
  const user=await findUserById(userId);
  if(!user||user.role!=='customer')throw new Error('Customer profile not found.');
  return {name:user.name,username:user.username,mobile:user.phone||'',email:user.email||''};
}

export async function updateCustomerProfile(userId,{mobile,email}){
  const safeMobile=clean(mobile).replace(/\D/g,''),safeEmail=clean(email).toLowerCase();
  if(!/^\d{10}$/.test(safeMobile))throw new Error('Mobile number must be exactly 10 digits.');
  if(safeEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail))throw new Error('Enter a valid email address.');
  const sheets=await getSheets();
  const res=await sheets.spreadsheets.values.get({spreadsheetId:process.env.GOOGLE_SHEET_ID,range:RANGE});
  const rows=res.data.values||[]; let rowIndex=-1,target=null;
  rows.forEach((row,i)=>{if(clean(row[0])===clean(userId)){rowIndex=i+2;target=row;}});
  if(rowIndex<0||normalizeRole(target?.[5])!=='customer')throw new Error('Customer profile not found.');
  if(rows.some(row=>clean(row[0])!==clean(userId)&&String(row[2]||'').replace(/\D/g,'')===safeMobile))throw new Error('This mobile number is already used by another account.');
  if(safeEmail&&rows.some(row=>clean(row[0])!==clean(userId)&&clean(row[8]).toLowerCase()===safeEmail))throw new Error('This email is already used by another account.');
  await sheets.spreadsheets.values.batchUpdate({spreadsheetId:process.env.GOOGLE_SHEET_ID,requestBody:{valueInputOption:'RAW',data:[{range:`${SHEET}!I1`,values:[['Email']]},{range:`${SHEET}!C${rowIndex}`,values:[[safeMobile]]},{range:`${SHEET}!I${rowIndex}`,values:[[safeEmail]]}]}});
  return {name:target[1]||'',username:target[3]||'',mobile:safeMobile,email:safeEmail};
}
