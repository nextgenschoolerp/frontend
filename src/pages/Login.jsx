import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { School, Mail, Lock, Eye, EyeOff, CircleAlert, LoaderCircle } from 'lucide-react';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = 'Oakridge Academy – Sign in'; }, []);

  const dest = location.state?.from?.pathname || '/';
  if (user) return <Navigate to={dest} replace />;

  async function submit(e) {
    e.preventDefault();
    if (!email || !password) { setError('Enter your email and password.'); return; }
    setBusy(true);
    setError('');
    try {
      await signIn(email, password, remember);
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <section className="login-art">
        <div className="brand">
          <div className="crest"><School size={22} /></div>
          <div><b>Oakridge</b><small>ACADEMY</small></div>
        </div>
        <div className="login-quote">
          <h2>Everything your school runs on, in one place.</h2>
          <p>Students, staff, attendance, fees and communications — managed from a single workspace.</p>
        </div>
        <small className="login-foot">© 2026 Oakridge Academy · Main campus</small>
      </section>

      <section className="login-panel">
        <form className="login-form" onSubmit={submit} noValidate>
          <div className="brand login-mobile-brand">
            <div className="crest"><School size={22} /></div>
            <div><b>Oakridge</b><small>ACADEMY</small></div>
          </div>
          <div>
            <h1>Sign in</h1>
            <p>Welcome back. Sign in to your school workspace.</p>
          </div>

          {error && <div className="login-error" role="alert"><CircleAlert size={15} />{error}</div>}

          <label className="lfield">
            <span>Email address</span>
            <span className="linput"><Mail size={15} />
              <input type="email" autoComplete="username" autoFocus placeholder="you@oakridge.edu"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </span>
          </label>

          <label className="lfield">
            <span>Password</span>
            <span className="linput"><Lock size={15} />
              <input type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password"
                value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </span>
          </label>

          <div className="login-row">
            <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />Keep me signed in</label>
            <a href="#" onClick={(e) => e.preventDefault()}>Forgot password?</a>
          </div>

          <button className="btn primary login-submit" disabled={busy}>
            {busy ? <><LoaderCircle size={15} className="spin" />Signing in…</> : 'Sign in'}
          </button>

          <div className="login-demo">
            Demo account: <b>admin@oakridge.edu</b> / <b>oakridge123</b>
          </div>
        </form>
      </section>
    </div>
  );
}
