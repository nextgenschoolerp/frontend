import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, LoaderCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import * as authApi from '../api/authService.js';
import AuthShell, { AuthAlert, PasswordInput, PASSWORD_HINT, PASSWORD_RULE } from '../components/AuthShell.jsx';

function checkNewPassword(next, confirm) {
  if (!PASSWORD_RULE.test(next)) return PASSWORD_HINT;
  if (next !== confirm) return 'The two new passwords do not match.';
  return '';
}

/** "Forgot password?" -> POST /api/v1/auth/forgot-password (US-01001). */
export function ForgotPassword() {
  const [identifier, setIdentifier] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  useEffect(() => { document.title = 'Oakridge Academy – Reset password'; }, []);

  async function submit(e) {
    e.preventDefault();
    if (!identifier.trim()) { setError('Enter your email or username.'); return; }
    setBusy(true);
    setError('');
    try {
      setResult(await authApi.forgotPassword(identifier.trim()));
    } catch (err) {
      setError(err.detail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <form onSubmit={submit} noValidate style={{ display: 'contents' }}>
        <div>
          <h1>Reset your password</h1>
          <p>Enter the email or username of your account and we will send you a reset link.</p>
        </div>
        {error && <AuthAlert>{error}</AuthAlert>}
        {result ? (
          <>
            <AuthAlert tone="success">{result.message || 'If the account exists, a reset link has been sent.'}</AuthAlert>
            {/* authservice returns the token directly in development builds; production sends it by email only */}
            {result.resetToken && (
              <Link className="btn primary login-submit" to={`/reset-password?token=${encodeURIComponent(result.resetToken)}`}>
                Continue to reset (development link)
              </Link>
            )}
          </>
        ) : (
          <>
            <label className="lfield">
              <span>Email or username</span>
              <span className="linput"><Mail size={15} />
                <input type="text" autoComplete="username" autoFocus placeholder="you@school.edu.in"
                  value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
              </span>
            </label>
            <button className="btn primary login-submit" disabled={busy}>
              {busy ? <><LoaderCircle size={15} className="spin" />Sending…</> : 'Send reset link'}
            </button>
          </>
        )}
        <Link to="/login" className="login-back"><ArrowLeft size={14} />Back to sign in</Link>
      </form>
    </AuthShell>
  );
}

/** Reset link -> POST /api/v1/auth/reset-password (US-01002). */
export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(params.get('token') || '');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { document.title = 'Oakridge Academy – Choose a new password'; }, []);

  async function submit(e) {
    e.preventDefault();
    const problem = !token.trim() ? 'The reset link is missing its token.' : checkNewPassword(next, confirm);
    if (problem) { setError(problem); return; }
    setBusy(true);
    setError('');
    try {
      await authApi.resetPassword(token.trim(), next, confirm);
      navigate('/login', { replace: true, state: { passwordReset: true } });
    } catch (err) {
      setError(err.detail);
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <form onSubmit={submit} noValidate style={{ display: 'contents' }}>
        <div>
          <h1>Choose a new password</h1>
          <p>{PASSWORD_HINT}</p>
        </div>
        {error && <AuthAlert>{error}</AuthAlert>}
        {!params.get('token') && (
          <label className="lfield">
            <span>Reset token</span>
            <span className="linput"><input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste the token from your email" /></span>
          </label>
        )}
        <PasswordInput label="New password" value={next} onChange={setNext} autoFocus />
        <PasswordInput label="Confirm new password" value={confirm} onChange={setConfirm} />
        <button className="btn primary login-submit" disabled={busy}>
          {busy ? <><LoaderCircle size={15} className="spin" />Saving…</> : 'Set new password'}
        </button>
        <Link to="/login" className="login-back"><ArrowLeft size={14} />Back to sign in</Link>
      </form>
    </AuthShell>
  );
}

/** Forced first-login change and voluntary change -> PUT /api/v1/auth/change-password (US-01003, US-01004). */
export function ChangePassword() {
  const { user, signOut, markPasswordChanged } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const forced = user?.mustChangePassword;
  useEffect(() => { document.title = 'Oakridge Academy – Change password'; }, []);

  async function submit(e) {
    e.preventDefault();
    const problem = !current ? 'Enter your current password.' : checkNewPassword(next, confirm);
    if (problem) { setError(problem); return; }
    setBusy(true);
    setError('');
    try {
      await authApi.changePassword(current, next, confirm);
      if (forced) {
        // The token issued on a forced-change login only allows this call; sign in again for a full session
        signOut();
        navigate('/login', { replace: true, state: { passwordReset: true } });
      } else {
        markPasswordChanged();
        navigate('/settings?tab=security', { replace: true });
      }
    } catch (err) {
      setError(err.detail);
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <form onSubmit={submit} noValidate style={{ display: 'contents' }}>
        <div>
          <h1>{forced ? 'Set a new password' : 'Change password'}</h1>
          <p>{forced ? 'Your administrator requires you to choose a new password before continuing.' : PASSWORD_HINT}</p>
        </div>
        {forced && <AuthAlert>{PASSWORD_HINT}</AuthAlert>}
        {error && <AuthAlert>{error}</AuthAlert>}
        <PasswordInput label={forced ? 'Temporary password' : 'Current password'} value={current} onChange={setCurrent}
          autoComplete="current-password" autoFocus />
        <PasswordInput label="New password" value={next} onChange={setNext} />
        <PasswordInput label="Confirm new password" value={confirm} onChange={setConfirm} />
        <button className="btn primary login-submit" disabled={busy}>
          {busy ? <><LoaderCircle size={15} className="spin" />Saving…</> : 'Update password'}
        </button>
        {forced
          ? <button type="button" className="login-back" onClick={() => { signOut(); navigate('/login', { replace: true }); }}><ArrowLeft size={14} />Sign out</button>
          : <Link to="/settings?tab=security" className="login-back"><ArrowLeft size={14} />Back to settings</Link>}
      </form>
    </AuthShell>
  );
}
