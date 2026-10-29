import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Mail, LoaderCircle, ArrowLeft, CircleHelp, Phone } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import AuthShell, { AuthAlert, PasswordInput, PASSWORD_HINT, PASSWORD_RULE } from '../components/AuthShell.jsx';
import { checkNewPassword } from './PasswordPages.jsx';
import { currentBrand } from '../branding.js';
import { getBootstrapStatus, changePassword } from '../api/authService.js';

// Only the username is remembered on this browser, never the password; storage can be blocked, so every access is guarded.
const LAST_USER_KEY = 'oakridge.lastUser';
const lastUser = () => { try { return localStorage.getItem(LAST_USER_KEY) || ''; } catch { return ''; } };
const rememberUser = (name) => { try { localStorage.setItem(LAST_USER_KEY, name); } catch { /* private window or blocked storage */ } };
const forgetUser = () => { try { localStorage.removeItem(LAST_USER_KEY); } catch { /* ignore */ } };

// Sign in -> POST /api/v1/auth/login (authservice, US-00000). Username or email is accepted.
export default function Login() {
  const { user, signIn, signOut, notice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState(location.state?.prefilledUsername || lastUser());
  const remembered = useRef(!!(location.state?.prefilledUsername || lastUser())).current;
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusyState] = useState(false);
  // a ref, because two Enter presses can arrive before React has re-rendered with busy = true
  const sending = useRef(false);
  const setBusy = (v) => { sending.current = v; setBusyState(v); };
  // forced first-login change happens on this page: the temporary password was just typed, so only the new one is asked
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [updated, setUpdated] = useState(false);
  const [help, setHelp] = useState(false);
  const school = currentBrand();
  // the field the last error is about: it is outlined and receives focus (focusTick re-focuses on every new error)
  const [bad, setBad] = useState('');
  const [focusTick, setFocusTick] = useState(0);
  const refs = { identifier: useRef(null), password: useRef(null), temp: useRef(null), next: useRef(null), confirm: useRef(null) };
  const fail = (message, field = '') => { setError(message); setBad(field); setFocusTick((n) => n + 1); };
  const edited = (field, set) => (v) => { set(v); if (bad === field) setBad(''); };
  useEffect(() => { if (focusTick && bad) refs[bad]?.current?.focus(); }, [focusTick]); // eslint-disable-line react-hooks/exhaustive-deps
  // the cursor starts in the username field, after a remembered username
  useEffect(() => { const el = refs.identifier.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const statusChecked = useRef(false);
  useEffect(() => {
    document.title = `${currentBrand().name} – Sign in`;
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
  if (user && !user.mustChangePassword) return <Navigate to={dest} replace />;
  const forced = !!user?.mustChangePassword;

  async function submit(e) {
    e.preventDefault();
    if (sending.current) return; // Enter pressed twice must not send two requests
    if (!identifier.trim()) { fail('Enter your email or username.', 'identifier'); return; }
    if (!password) { fail('Enter your password.', 'password'); return; }
    setBusy(true);
    setError('');
    setBad('');
    try {
      const session = await signIn(identifier, password, remember);
      rememberUser(identifier.trim());
      // the spinner stays until the next page replaces this one; only the forced password change keeps the user here
      if (!session.mustChangePassword) navigate(dest, { replace: true });
      else setBusy(false);
    } catch (err) {
      // 401 covers wrong credentials, a locked account (with its unlock time) and inactive accounts
      fail(err.status === 401 ? err.message : err.detail, err.status === 401 ? 'password' : '');
      setBusy(false);
    }
  }

  async function changeNow(e) {
    e.preventDefault();
    if (sending.current) return;
    if (!password) { fail('Enter your temporary password.', 'temp'); return; }
    const problem = checkNewPassword(next, confirm);
    if (problem) { fail(problem, next && PASSWORD_RULE.test(next) ? 'confirm' : 'next'); return; }
    setBusy(true);
    setError('');
    setBad('');
    try {
      await changePassword(password, next, confirm);
      // the token of a forced-change sign-in only allows this call: sign in again with the new password
      signOut();
      setPassword('');
      setNext('');
      setConfirm('');
      setUpdated(true);
    } catch (err) {
      fail(err.detail, 'next');
    }
    setBusy(false);
  }

  if (forced) {
    return (
      <AuthShell>
        <form onSubmit={changeNow} noValidate style={{ display: 'contents' }}>
          <div>
            <h1>You must choose a new password</h1>
            <p>You signed in with a temporary password{user.username ? ` as ${user.username}` : ''}. For your security, choose a new password before you continue.</p>
          </div>
          <AuthAlert tone="success">Signed in with a temporary password. Your new password must be different from it.</AuthAlert>
          <p className="muted xs" style={{ margin: 0 }}>{PASSWORD_HINT}</p>
          {!password && <PasswordInput label="Temporary password" value={password} onChange={edited('temp', setPassword)} autoComplete="current-password" autoFocus inputRef={refs.temp} invalid={bad === 'temp'} />}
          <PasswordInput label="New password" value={next} onChange={edited('next', setNext)} autoFocus={!!password} inputRef={refs.next} invalid={bad === 'next'} />
          <PasswordInput label="Confirm new password" value={confirm} onChange={edited('confirm', setConfirm)} inputRef={refs.confirm} invalid={bad === 'confirm'} />
          {error && <AuthAlert>{error}</AuthAlert>}
          <button className="btn primary login-submit" disabled={busy}>
            {busy ? <><LoaderCircle size={15} className="spin" />Saving…</> : 'Set new password and continue'}
          </button>
          <button type="button" className="login-back" onClick={() => { signOut(); setPassword(''); }}><ArrowLeft size={14} />Sign out</button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <form onSubmit={submit} noValidate style={{ display: 'contents' }}>
        <div>
          <h1>Sign in</h1>
          <p>Welcome back. Sign in to your school workspace.</p>
        </div>

        {notice && !error && <AuthAlert>{notice}</AuthAlert>}
        {(updated || location.state?.passwordReset) && !error && <AuthAlert tone="success">Password updated. Sign in with your new password.</AuthAlert>}

        <label className="lfield">
          <span>Email or username</span>
          <span className={`linput${bad === 'identifier' ? ' invalid' : ''}`}><Mail size={15} />
            <input ref={refs.identifier} aria-invalid={bad === 'identifier' || undefined} type="text" autoComplete="username" autoFocus placeholder="you@school.edu.in"
              value={identifier} onChange={(e) => edited('identifier', setIdentifier)(e.target.value)} />
          </span>
        </label>

        <PasswordInput label="Password" value={password} onChange={edited('password', setPassword)} autoComplete="current-password" inputRef={refs.password} invalid={bad === 'password'} />
        {remembered && identifier && <button type="button" className="login-back" style={{ alignSelf: 'flex-start' }} onClick={() => { forgetUser(); setIdentifier(''); }}>Not you? Use a different account</button>}

        <div className="login-row">
          <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />Keep me signed in</label>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>

        {error && <AuthAlert>{error}</AuthAlert>}
        <button className="btn primary login-submit" disabled={busy}>
          {busy ? <><LoaderCircle size={15} className="spin" />Signing in…</> : 'Sign in'}
        </button>

        <button type="button" className="login-helpbtn" aria-expanded={help} aria-controls="login-help" onClick={() => setHelp((h) => !h)}>
          <CircleHelp size={14} />Need help signing in?</button>
        {help && (
          <div id="login-help" className="login-help">
            <ul>
              <li><b>Forgot your password?</b> <Link to="/forgot-password">Reset it by email</Link>.</li>
              <li><b>Account locked?</b> Too many wrong attempts lock it for a while; the message tells you when it opens again, or ask your administrator to unlock it.</li>
              <li><b>New here?</b> Sign in with the temporary password you were given. You will then choose your own.</li>
              <li><b>Username?</b> Use your school email or the username your administrator gave you.</li>
            </ul>
            <p>Still stuck? {school.email || school.phone ? <>Contact {school.name === 'School ERP' ? 'your school' : school.name}:</> : 'Ask your school’s IT administrator.'}</p>
            {school.email && <a href={`mailto:${school.email}?subject=${encodeURIComponent('Help signing in')}`}><Mail size={13} />{school.email}</a>}
            {school.phone && <a href={`tel:${school.phone.replace(/[^+\d]/g, '')}`}><Phone size={13} />{school.phone}</a>}
          </div>
        )}
      </form>
    </AuthShell>
  );
}
