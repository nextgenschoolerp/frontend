import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Mail, LoaderCircle } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import AuthShell, { AuthAlert, PasswordInput } from '../components/AuthShell.jsx';
import { getBootstrapStatus } from '../api/authService.js';

// Sign in -> POST /api/v1/auth/login (authservice, US-00000). Username or email is accepted.
export default function Login() {
  const { user, signIn, notice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState(location.state?.prefilledUsername || '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const statusChecked = useRef(false);
  useEffect(() => {
    document.title = 'School ERP – Sign in';
    // If no tenants exist, route to the Initial Setup Wizard (checked once per visit)
    if (statusChecked.current) return;
    statusChecked.current = true;
    getBootstrapStatus().then(status => {
      if (status.bootstrapRequired) {
        navigate('/setup', { replace: true });
      }
    }).catch(() => {
      // Backend offline or normal flow
    });
  }, [navigate]);

  const dest = location.state?.from?.pathname || '/';
  if (user) return <Navigate to={user.mustChangePassword ? '/change-password' : dest} replace />;

  async function submit(e) {
    e.preventDefault();
    if (!identifier || !password) { setError('Enter your email or username and your password.'); return; }
    setBusy(true);
    setError('');
    try {
      const session = await signIn(identifier, password, remember);
      navigate(session.mustChangePassword ? '/change-password' : dest, { replace: true });
    } catch (err) {
      // 401 covers wrong credentials, a locked account (with its unlock time) and inactive accounts
      setError(err.status === 401 ? err.message : err.detail);
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <form onSubmit={submit} noValidate style={{ display: 'contents' }}>
        <div>
          <h1>Sign in</h1>
          <p>Welcome back. Sign in to your school workspace.</p>
        </div>

        {notice && !error && <AuthAlert>{notice}</AuthAlert>}
        {location.state?.passwordReset && !error && <AuthAlert tone="success">Password updated. Sign in with your new password.</AuthAlert>}
        {error && <AuthAlert>{error}</AuthAlert>}

        <label className="lfield">
          <span>Email or username</span>
          <span className="linput"><Mail size={15} />
            <input type="text" autoComplete="username" autoFocus placeholder="you@school.edu.in"
              value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
          </span>
        </label>

        <PasswordInput label="Password" value={password} onChange={setPassword} autoComplete="current-password" />

        <div className="login-row">
          <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />Keep me signed in</label>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>

        <button className="btn primary login-submit" disabled={busy}>
          {busy ? <><LoaderCircle size={15} className="spin" />Signing in…</> : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  );
}
