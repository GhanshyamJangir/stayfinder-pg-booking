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

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' }).then(async r => {
      if (!r.ok) return;
      const data = await r.json();
      if (data.user?.role === 'owner') router.replace('/owner');
      if (data.user?.role === 'customer') router.replace('/customer');
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
      const target = data.user.role === 'owner' ? '/owner' : '/customer';
      // Full navigation is more reliable on mobile/LAN because it reloads with the new session cookie.
      window.location.replace(target);
    } catch (err) {
      setError(err?.message || 'Unable to connect to the login service. Check that the phone and PC are on the same Wi-Fi.');
      setLoading(false);
    }
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
      const target = data.user.role === 'owner' ? '/owner' : '/customer';
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
        {mode === 'login' ? (
          <form className="loginCard" onSubmit={login}>
            <div className="mobileBrand">StayFinder</div><p className="eyebrow">WELCOME BACK</p><h2>Login to your account</h2>
            <label>Username</label><input value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter username" autoComplete="username" />
            <label>Password</label><div className="passwordField"><input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" autoComplete="current-password" /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} style={{touchAction:'manipulation',pointerEvents:'auto'}} onClick={() => setShowPassword(v => !v)}>{showPassword ? 'Hide' : 'Show'}</button></div>
            {error && <div className="errorBox">{error}</div>}<button className="primaryBtn" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Login'}</button>
            <div className="firstVisitBox" style={{textAlign:'center',alignItems:'center',justifyContent:'center'}}><b>New to StayFinder?</b><button type="button" onClick={() => { setMode('register'); setError(''); }}>Create an account</button></div>
          </form>
        ) : (
          <form className="loginCard registerCard" onSubmit={createAccount}>
            <div className="mobileBrand">StayFinder</div><p className="eyebrow" style={{textAlign:'center'}}>NEW ACCOUNT</p><h2>Join StayFinder</h2><p className="muted">Join as a Guest to book a stay or as a Host to list your PG.</p>
            <div className="rolePicker"><button type="button" className={register.role === 'customer' ? 'active' : ''} onClick={() => setRegister({ ...register, role: 'customer' })}>Guest</button><button type="button" className={register.role === 'owner' ? 'active' : ''} onClick={() => setRegister({ ...register, role: 'owner' })}>Host</button></div>
            <label>Full name</label><input required value={register.name} onChange={e => setRegister({ ...register, name: e.target.value })} placeholder="Your full name" />
            <label>Mobile number</label><input required inputMode="numeric" maxLength={10} value={register.mobile} onChange={e => setRegister({ ...register, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="10 digit mobile" />
            <label>Email address</label><input required type="email" value={register.email} onChange={e => setRegister({ ...register, email: e.target.value })} placeholder="name@gmail.com" autoComplete="email" />
            <label>Username</label><input required value={register.username} onChange={e => setRegister({ ...register, username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') })} placeholder="Choose username" />
            <label>Password</label><div className="passwordField"><input required minLength={6} type={showRegisterPassword ? 'text' : 'password'} value={register.password} onChange={e => setRegister({ ...register, password: e.target.value })} placeholder="Minimum 6 characters" autoComplete="new-password" /><button type="button" aria-label={showRegisterPassword ? 'Hide password' : 'Show password'} style={{touchAction:'manipulation',pointerEvents:'auto'}} onClick={() => setShowRegisterPassword(v => !v)}>{showRegisterPassword ? 'Hide' : 'Show'}</button></div>
            {error && <div className="errorBox">{error}</div>}<button className="primaryBtn" type="submit" disabled={loading}>{loading ? 'Creating account…' : `Create ${register.role === 'owner' ? 'Host' : 'Guest'} account`}</button>
            <button className="linkBtn" style={{display:'block',margin:'0 auto'}} type="button" onClick={() => { setMode('login'); setError(''); }}>← Back to login</button>
          </form>
        )}
      </section>
      <style jsx global>{`
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
        }
      `}</style>
    </main>
  );
}
