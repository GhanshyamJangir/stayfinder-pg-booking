import tls from 'node:tls';

const clean=v=>String(v??'').trim();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const b64=s=>Buffer.from(String(s??''),'utf8').toString('base64');

function smtpConfig(){
  const user=clean(process.env.MAIL_USER);
  const pass=clean(process.env.MAIL_APP_PASSWORD).replace(/\s+/g,'');
  const host=clean(process.env.MAIL_SMTP_HOST)||'smtp.gmail.com';
  const port=Number(process.env.MAIL_SMTP_PORT||465);
  const fromName=clean(process.env.MAIL_FROM_NAME)||'StayFinder';
  return {user,pass,host,port,fromName};
}

export function mailConfigured(){const c=smtpConfig();return !!(c.user&&c.pass);}

function waitResponse(socket, expected, timeoutMs=15000){
  return new Promise((resolve,reject)=>{
    let buf='';
    const timer=setTimeout(()=>done(new Error('Mail server timeout.')),timeoutMs);
    const onData=data=>{buf+=data.toString('utf8');const lines=buf.split(/\r?\n/).filter(Boolean);const last=lines[lines.length-1]||'';if(/^\d{3} /.test(last)){const code=Number(last.slice(0,3));if(expected.includes(code))done(null,buf);else done(new Error(`Mail server error ${code}: ${last.slice(4)}`));}};
    const onErr=e=>done(e);
    function done(err,val){clearTimeout(timer);socket.off('data',onData);socket.off('error',onErr);err?reject(err):resolve(val);}
    socket.on('data',onData);socket.on('error',onErr);
  });
}
async function cmd(socket,text,expected){socket.write(text+'\r\n');return waitResponse(socket,expected);}
function dotStuff(s){return String(s).replace(/(^|\r?\n)\./g,'$1..');}

async function smtpSend({to,subject,text,html}){
  const c=smtpConfig();
  if(!c.user||!c.pass)throw new Error('Email service is not configured. Add MAIL_USER and MAIL_APP_PASSWORD in Vercel.');
  const recipient=clean(to);if(!recipient)throw new Error('Recipient email is missing.');
  const socket=tls.connect({host:c.host,port:c.port,servername:c.host,rejectUnauthorized:true});
  try{
    await waitResponse(socket,[220]);
    await cmd(socket,`EHLO stayfinder`,[250]);
    await cmd(socket,'AUTH LOGIN',[334]);
    await cmd(socket,b64(c.user),[334]);
    await cmd(socket,b64(c.pass),[235]);
    await cmd(socket,`MAIL FROM:<${c.user}>`,[250]);
    await cmd(socket,`RCPT TO:<${recipient}>`,[250,251]);
    await cmd(socket,'DATA',[354]);
    const boundary=`sf_${Date.now().toString(36)}`;
    const headers=[
      `From: ${c.fromName} <${c.user}>`,`To: ${recipient}`,`Subject: ${subject}`,
      `MIME-Version: 1.0`,`Content-Type: multipart/alternative; boundary="${boundary}"`
    ].join('\r\n');
    const body=`${headers}\r\n\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${dotStuff(text||'')}\r\n--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${dotStuff(html||`<p>${esc(text||'')}</p>`)}\r\n--${boundary}--\r\n.`;
    socket.write(body+'\r\n');
    await waitResponse(socket,[250]);
    await cmd(socket,'QUIT',[221]);
    return true;
  }finally{socket.destroy();}
}

export async function sendMail(payload){return smtpSend(payload);}
export async function sendMailSafe(payload){try{return await smtpSend(payload);}catch(e){console.error('MAIL_SEND_ERROR',e?.message||e);return false;}}

export function emailTemplate({title,lead='',lines=[],buttonText='',buttonUrl=''}){
  const bodyLines=(lines||[]).map(x=>`<p style="margin:8px 0;color:#425d5a;line-height:1.55">${esc(x)}</p>`).join('');
  const button=buttonText&&buttonUrl?`<p style="margin:22px 0"><a href="${esc(buttonUrl)}" style="display:inline-block;background:#2f6966;color:white;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">${esc(buttonText)}</a></p>`:'';
  return `<!doctype html><html><body style="margin:0;background:#f4f8f7;font-family:Arial,sans-serif;color:#103735"><div style="max-width:620px;margin:0 auto;padding:28px 16px"><div style="background:#fff;border:1px solid #dbe8e6;border-radius:18px;padding:28px"><div style="font-weight:900;color:#2f6966;margin-bottom:18px">StayFinder</div><h2 style="margin:0 0 12px;font-size:24px">${esc(title)}</h2>${lead?`<p style="margin:0 0 16px;color:#607673">${esc(lead)}</p>`:''}${bodyLines}${button}<hr style="border:0;border-top:1px solid #e7efee;margin:24px 0"><p style="font-size:12px;color:#81908e;margin:0">This is an automated StayFinder notification.</p></div></div></body></html>`;
}

export async function notifyUser(user,{subject,title,lead='',lines=[],buttonText='',buttonUrl=''}){
  if(!user?.email)return false;
  const text=[title,lead,...lines,buttonUrl?`${buttonText||'Open'}: ${buttonUrl}`:''].filter(Boolean).join('\n\n');
  return sendMailSafe({to:user.email,subject,text,html:emailTemplate({title,lead,lines,buttonText,buttonUrl})});
}
