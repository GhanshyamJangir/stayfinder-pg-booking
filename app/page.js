'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [register, setRegister] = useState({ name: '', mobile: '', email: '', username: '', password: '', role: 'customer' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [forgotStep, setForgotStep] = useState('request');
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
    setIsStandalone(Boolean(standalone));

    if (!document.querySelector('link[rel="manifest"]')) {
      const manifest = document.createElement('link');
      manifest.rel = 'manifest';
      manifest.href = '/manifest.webmanifest';
      document.head.appendChild(manifest);
    }
    if (!document.querySelector('meta[name="theme-color"]')) {
      const theme = document.createElement('meta');
      theme.name = 'theme-color';
      theme.content = '#2f6966';
      document.head.appendChild(theme);
    }
    if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
      const apple = document.createElement('meta');
      apple.name = 'apple-mobile-web-app-capable';
      apple.content = 'yes';
      document.head.appendChild(apple);
    }
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const appleIcon = document.createElement('link');
      appleIcon.rel = 'apple-touch-icon';
      appleIcon.href = '/icons/stayfinder-192.png';
      document.head.appendChild(appleIcon);
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const onBeforeInstall = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const onInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
      setShowInstallHelp(false);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function installApp() {
    if (installPrompt) {
      try {
        await installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        if (choice?.outcome === 'accepted') {
          setInstallPrompt(null);
          setIsStandalone(true);
        }
      } catch {}
      return;
    }
    setShowInstallHelp(true);
  }

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' }).then(async r => {
      if (!r.ok) return;
      const data = await r.json();
      if (data.user?.role === 'owner') router.replace('/owner');
      if (data.user?.role === 'customer') router.replace('/customer');
      if (data.user?.role === 'admin') router.replace('/admin');
    }).catch(() => {});
  }, [router]);

  async function login(e) {
    e.preventDefault();
    if (loading) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({ username: username.trim(), password })
      });
      const text = await res.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch { throw new Error(`Login service returned an invalid response (HTTP ${res.status}).`); }
      if (!res.ok || !data?.user) throw new Error(data.error || 'Login failed. Please check your username and password.');
      const target = data.user.role === 'admin' ? '/admin' : data.user.role === 'owner' ? '/owner' : '/customer';
      // Full navigation is more reliable on mobile/LAN because it reloads with the new session cookie.
      window.location.replace(target);
    } catch (err) {
      setError(err?.message || 'Unable to connect to the login service. Check that the phone and PC are on the same Wi-Fi.');
      setLoading(false);
    }
  }

  function openForgot(){
    setMode('forgot'); setForgotStep('request'); setForgotIdentifier(username.trim()); setForgotOtp(''); setResetToken(''); setNewPassword(''); setConfirmPassword(''); setError(''); setMessage('');
  }

  async function requestOtp(e){
    e.preventDefault(); if(loading)return; setLoading(true); setError(''); setMessage('');
    try{
      const res=await fetch('/api/auth/forgot-password/request',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({identifier:forgotIdentifier.trim()})});
      const data=await res.json(); if(!res.ok)throw new Error(data.error||'Unable to send OTP.');
      setMessage(data.message||'OTP sent to your registered email.'); setForgotStep('verify');
    }catch(err){setError(err?.message||'Unable to send OTP.');}finally{setLoading(false);}
  }

  async function verifyOtp(e){
    e.preventDefault(); if(loading)return; setLoading(true); setError(''); setMessage('');
    try{
      const res=await fetch('/api/auth/forgot-password/verify',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({identifier:forgotIdentifier.trim(),otp:forgotOtp.trim()})});
      const data=await res.json(); if(!res.ok||!data.resetToken)throw new Error(data.error||'OTP verification failed.');
      setResetToken(data.resetToken); setForgotStep('reset'); setMessage('OTP verified. Create your new password.');
    }catch(err){setError(err?.message||'OTP verification failed.');}finally{setLoading(false);}
  }

  async function resetForgotPassword(e){
    e.preventDefault(); if(loading)return; setLoading(true); setError(''); setMessage('');
    try{
      if(newPassword.length<6)throw new Error('New password must be at least 6 characters.');
      if(newPassword!==confirmPassword)throw new Error('New password and confirm password do not match.');
      const res=await fetch('/api/auth/forgot-password/reset',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({resetToken,newPassword,confirmPassword})});
      const data=await res.json(); if(!res.ok)throw new Error(data.error||'Password could not be updated.');
      setMode('login'); setPassword(''); setError(''); setMessage(data.message||'Password updated successfully. You can now login.');
    }catch(err){setError(err?.message||'Password could not be updated.');}finally{setLoading(false);}
  }

  async function createAccount(e) {
    e.preventDefault();
    if (loading) return;
    setLoading(true); setError('');
    try {
      const payload = {
        ...register,
        name: register.name.trim(),
        email: register.email.trim().toLowerCase(),
        username: register.username.trim().toLowerCase(),
        mobile: register.mobile.replace(/\D/g, '').slice(0, 10)
      };
      if (payload.mobile.length !== 10) throw new Error('Enter a valid 10 digit mobile number.');
      if (payload.password.length < 6) throw new Error('Password must be at least 6 characters.');
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify(payload)
      });
      const text = await res.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch { throw new Error(`Account service returned an invalid response (HTTP ${res.status}).`); }
      if (!res.ok || !data?.user) throw new Error(data.error || 'Account could not be created.');
      const target = data.user.role === 'admin' ? '/admin' : data.user.role === 'owner' ? '/owner' : '/customer';
      window.location.replace(target);
    } catch (err) {
      setError(err?.message || 'Unable to create the account. Please try again.');
      setLoading(false);
    }
  }

  return (
    <main className="loginShell">
      <section className="brandPanel">
        <div className="brandMark">PG</div>
        <div><p className="eyebrow">SMART STAY</p><h1>StayFinder</h1><p className="brandText">Find the right stay. Book with confidence.</p></div>
        <div className="featureStrip"><span>✓ Guest & Host access</span><span>✓ Verified payments</span><span>✓ Google Drive storage</span></div>
      </section>
      <section className="loginCardWrap">
        {!isStandalone && <button className="installAppBtn" type="button" onClick={installApp} aria-label="Install StayFinder app"><span aria-hidden="true">↓</span> Install App</button>}
        {mode === 'login' ? (
          <form className="loginCard" onSubmit={login}>
            <div className="mobileBrand">StayFinder</div><p className="eyebrow">WELCOME BACK</p><h2>Login to your account</h2>
            <label>Username</label><input value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter username" autoComplete="username" />
            <label>Password</label><div className="passwordField"><input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" autoComplete="current-password" /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} style={{touchAction:'manipulation',pointerEvents:'auto'}} onClick={() => setShowPassword(v => !v)}>{showPassword ? 'Hide' : 'Show'}</button></div>
            <button className="forgotLink" type="button" onClick={openForgot}>Forgot password?</button>
            {message && <div className="successBox">{message}</div>}{error && <div className="errorBox">{error}</div>}<button className="primaryBtn" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Login'}</button>
            <div className="firstVisitBox" style={{textAlign:'center',alignItems:'center',justifyContent:'center'}}><b>New to StayFinder?</b><button type="button" onClick={() => { setMode('register'); setError(''); }}>Create an account</button></div>
          </form>
        ) : mode === 'register' ? (
          <form className="loginCard registerCard" onSubmit={createAccount}>
            <div className="mobileBrand">StayFinder</div><p className="eyebrow" style={{textAlign:'center'}}>NEW ACCOUNT</p><h2>Join StayFinder</h2><p className="muted">Join as a Guest to book a stay or as a Host to list your PG.</p>
            <div className="rolePicker"><button type="button" className={register.role === 'customer' ? 'active' : ''} onClick={() => setRegister({ ...register, role: 'customer' })}>Guest</button><button type="button" className={register.role === 'owner' ? 'active' : ''} onClick={() => setRegister({ ...register, role: 'owner' })}>Host</button></div>
            <label>Full name</label><input required value={register.name} onChange={e => setRegister({ ...register, name: e.target.value })} placeholder="Your full name" />
            <label>Mobile number</label><input required inputMode="numeric" maxLength={10} value={register.mobile} onChange={e => setRegister({ ...register, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="10 digit mobile" />
            <label>Email address</label><input required type="email" value={register.email} onChange={e => setRegister({ ...register, email: e.target.value })} placeholder="name@gmail.com" autoComplete="email" />
            <label>Username</label><input required value={register.username} onChange={e => setRegister({ ...register, username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') })} placeholder="Choose username" />
            <label>Password</label><div className="passwordField"><input required minLength={6} type={showRegisterPassword ? 'text' : 'password'} value={register.password} onChange={e => setRegister({ ...register, password: e.target.value })} placeholder="Minimum 6 characters" autoComplete="new-password" /><button type="button" aria-label={showRegisterPassword ? 'Hide password' : 'Show password'} style={{touchAction:'manipulation',pointerEvents:'auto'}} onClick={() => setShowRegisterPassword(v => !v)}>{showRegisterPassword ? 'Hide' : 'Show'}</button></div>
            {error && <div className="errorBox">{error}</div>}<button className="primaryBtn" type="submit" disabled={loading}>{loading ? 'Creating account…' : `Create ${register.role === 'owner' ? 'Host' : 'Guest'} account`}</button>
            <button className="linkBtn" style={{display:'block',margin:'0 auto'}} type="button" onClick={() => { setMode('login'); setError(''); setMessage(''); }}>← Back to login</button>
          </form>
        ) : (
          <form className="loginCard registerCard" onSubmit={forgotStep==='request'?requestOtp:forgotStep==='verify'?verifyOtp:resetForgotPassword}>
            <div className="mobileBrand">StayFinder</div><p className="eyebrow" style={{textAlign:'center'}}>ACCOUNT RECOVERY</p><h2>{forgotStep==='request'?'Forgot password':forgotStep==='verify'?'Verify OTP':'Create new password'}</h2>
            {forgotStep==='request' && <><p className="muted">Enter your registered email or username. We will send a 6 digit OTP to the registered email.</p><label>Email or username</label><input required value={forgotIdentifier} onChange={e=>setForgotIdentifier(e.target.value)} placeholder="Registered email or username" autoComplete="username" /></>}
            {forgotStep==='verify' && <><p className="muted">Enter the OTP sent to your registered email. It is valid for 10 minutes.</p><label>6 digit OTP</label><input required inputMode="numeric" maxLength={6} value={forgotOtp} onChange={e=>setForgotOtp(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="000000" autoComplete="one-time-code" /><button className="forgotLink" type="button" onClick={requestOtp}>Resend OTP</button></>}
            {forgotStep==='reset' && <><p className="muted">OTP verified. Enter and confirm your new password.</p><label>New password</label><div className="passwordField"><input required minLength={6} type={showNewPassword?'text':'password'} value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Minimum 6 characters" autoComplete="new-password"/><button type="button" onClick={()=>setShowNewPassword(v=>!v)}>{showNewPassword?'Hide':'Show'}</button></div><label>Re-enter new password</label><div className="passwordField"><input required minLength={6} type={showConfirmPassword?'text':'password'} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Re-enter new password" autoComplete="new-password"/><button type="button" onClick={()=>setShowConfirmPassword(v=>!v)}>{showConfirmPassword?'Hide':'Show'}</button></div></>}
            {message && <div className="successBox">{message}</div>}{error && <div className="errorBox">{error}</div>}
            <button className="primaryBtn" type="submit" disabled={loading}>{loading?'Please wait…':forgotStep==='request'?'Send OTP':forgotStep==='verify'?'Verify OTP':'Update password'}</button>
            <button className="linkBtn" style={{display:'block',margin:'0 auto'}} type="button" onClick={()=>{setMode('login');setError('');setMessage('');}}>← Back to login</button>
          </form>
        )}
      </section>
      {showInstallHelp && (
        <div className="installHelpBackdrop" role="dialog" aria-modal="true" aria-label="Install StayFinder" onClick={() => setShowInstallHelp(false)}>
          <div className="installHelpCard" onClick={e => e.stopPropagation()}>
            <button className="installHelpClose" type="button" onClick={() => setShowInstallHelp(false)} aria-label="Close">×</button>
            <div className="installHelpIcon">PG</div>
            <h3>Install StayFinder</h3>
            <p><b>Android / Chrome:</b> Open the browser menu and tap <b>Install app</b> or <b>Add to Home screen</b>.</p>
            <p><b>iPhone / Safari:</b> Tap <b>Share</b> and then <b>Add to Home Screen</b>.</p>
            <button className="primaryBtn" type="button" onClick={() => setShowInstallHelp(false)}>Got it</button>
          </div>
        </div>
      )}
      <style jsx global>{`
        .forgotLink { border:0; background:transparent; color:#24615e; font-weight:800; padding:6px 0 12px; text-align:right; cursor:pointer; align-self:flex-end; }
        .successBox { border:1px solid #bfe2d8; background:#effaf6; color:#1c6253; border-radius:10px; padding:11px 12px; font-size:13px; line-height:1.45; }
        .installAppBtn { position: fixed; top: 18px; right: 18px; z-index: 80; border: 1px solid rgba(22,83,80,.18); background: #ffffff; color: #174f4d; border-radius: 999px; min-height: 44px; padding: 0 16px; font-weight: 800; box-shadow: 0 10px 30px rgba(18,70,68,.12); cursor: pointer; display: inline-flex; align-items: center; gap: 8px; }
        .installAppBtn span { font-size: 20px; line-height: 1; }
        .installHelpBackdrop { position: fixed; inset: 0; z-index: 9999; background: rgba(8,32,31,.52); display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(5px); }
        .installHelpCard { width: min(100%, 430px); position: relative; background: #fff; border-radius: 24px; padding: 28px; box-shadow: 0 24px 80px rgba(0,0,0,.25); color: #0d3433; }
        .installHelpCard h3 { margin: 12px 0 14px; font-size: 24px; }
        .installHelpCard p { margin: 10px 0; line-height: 1.55; color: #526967; }
        .installHelpClose { position: absolute; right: 14px; top: 12px; border: 0; background: #edf5f4; width: 38px; height: 38px; border-radius: 50%; font-size: 24px; cursor: pointer; }
        .installHelpIcon { width: 58px; height: 58px; border-radius: 16px; background: linear-gradient(135deg,#2f6966,#73aaa6); display: grid; place-items: center; color: #fff; font-size: 20px; font-weight: 900; }
        @media (max-width: 760px) {
          html, body { width: 100%; max-width: 100%; overflow-x: hidden; }
          .loginShell { min-height: 100dvh !important; display: block !important; background: #f5f9f8 !important; }
          .brandPanel { display: none !important; }
          .loginCardWrap { min-height: 100dvh !important; width: 100% !important; padding: 20px 14px calc(24px + env(safe-area-inset-bottom)) !important; display: flex !important; align-items: center !important; justify-content: center !important; }
          .loginCard { width: min(100%, 430px) !important; max-width: 430px !important; padding: 24px 18px !important; margin: 0 auto !important; border-radius: 22px !important; box-sizing: border-box !important; }
          .registerCard { margin-top: max(0px, env(safe-area-inset-top)) !important; }
          .mobileBrand { display: block !important; font-weight: 900 !important; font-size: 20px !important; margin-bottom: 18px !important; }
          .loginCard input { width: 100% !important; min-height: 50px !important; font-size: 16px !important; box-sizing: border-box !important; }
          .passwordField { width: 100% !important; position: relative !important; }
          .passwordField input { padding-right: 72px !important; }
          .passwordField button { position: absolute !important; right: 7px !important; top: 50% !important; transform: translateY(-50%) !important; min-width: 58px !important; min-height: 38px !important; z-index: 4 !important; cursor: pointer !important; }
          .primaryBtn { min-height: 50px !important; width: 100% !important; font-size: 15px !important; }
          .rolePicker { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
          .rolePicker button { min-height: 48px !important; }
          .firstVisitBox { width: 100% !important; box-sizing: border-box !important; }
          .errorBox { line-height: 1.4 !important; word-break: break-word !important; }
          .installAppBtn { top: auto !important; right: 14px !important; bottom: calc(14px + env(safe-area-inset-bottom)) !important; min-height: 48px !important; padding: 0 18px !important; }
          .installHelpBackdrop { align-items: flex-end !important; padding: 0 !important; }
          .installHelpCard { width: 100% !important; max-width: none !important; border-radius: 24px 24px 0 0 !important; padding: 26px 20px calc(24px + env(safe-area-inset-bottom)) !important; }
        }
      `}</style>
    </main>
  );
}
