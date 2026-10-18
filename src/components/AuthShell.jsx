import { useState } from 'react';
import { School, CircleAlert, CircleCheck, Lock, Eye, EyeOff } from 'lucide-react';

/** Two-column layout shared by sign-in and the password screens. */
export default function AuthShell({ children }) {
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
        <div className="login-form">
          <div className="brand login-mobile-brand">
            <div className="crest"><School size={22} /></div>
            <div><b>Oakridge</b><small>ACADEMY</small></div>
          </div>
          {children}
        </div>
      </section>
    </div>
  );
}

export const AuthAlert = ({ tone = 'error', children }) => (
  <div className={tone === 'success' ? 'login-success' : 'login-error'} role={tone === 'success' ? 'status' : 'alert'}>
    {tone === 'success' ? <CircleCheck size={15} /> : <CircleAlert size={15} />}{children}
  </div>
);

export function PasswordInput({ label, value, onChange, autoComplete = 'new-password', autoFocus, placeholder = 'Enter your password' }) {
  const [show, setShow] = useState(false);
  return (
    <label className="lfield">
      <span>{label}</span>
      <span className="linput"><Lock size={15} />
        <input type={show ? 'text' : 'password'} autoComplete={autoComplete} autoFocus={autoFocus} placeholder={placeholder}
          value={value} onChange={(e) => onChange(e.target.value)} />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </span>
    </label>
  );
}

/** authservice password rule (ChangePasswordRequest / ResetPasswordRequest). */
export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
export const PASSWORD_HINT = 'At least 8 characters with upper and lower case letters, a number and one of @$!%*?&.';
