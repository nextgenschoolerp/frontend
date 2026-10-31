import { useState } from 'react';
import { Link } from 'react-router-dom';
import { currentBrand } from '../branding.js';
import { School, CircleAlert, CircleCheck, Lock, Eye, EyeOff, ArrowBigUp } from 'lucide-react';

/** Version line of the footer: package version, and the commit when the build was made by CI. */
const VERSION = `v${typeof __APP_VERSION__ === 'undefined' ? '0.0.0' : __APP_VERSION__}${typeof __APP_BUILD__ !== 'undefined' && __APP_BUILD__ ? ` · ${__APP_BUILD__}` : ''}`;

/** Privacy and terms: the app's own pages, or the school's own URLs when VITE_PRIVACY_URL / VITE_TERMS_URL are set. */
function LegalLink({ to, url, children }) {
  return url ? <a href={url} target="_blank" rel="noreferrer">{children}</a> : <Link to={to}>{children}</Link>;
}

function FootBlock({ brand }) {
  return (
    <>
      <span>{brand.foot}</span>
      <span>Powered by School ERP · {VERSION}</span>
      <span className="foot-links">
        <LegalLink to="/privacy" url={import.meta.env.VITE_PRIVACY_URL}>Privacy policy</LegalLink>
        <LegalLink to="/terms" url={import.meta.env.VITE_TERMS_URL}>Terms of use</LegalLink>
      </span>
    </>
  );
}

/** Two-column layout shared by sign-in, the password screens and setup. `brand` names the product on the art panel. */
export const SCHOOL_BRAND = { name: 'School ERP', tag: 'WORKSPACE', foot: '© 2026 School ERP' };
export default function AuthShell({ children, brand = currentBrand() }) {
  return (
    <div className="login">
      <section className="login-art">
        <div className="brand">
          <div className="crest">{brand.crest ? <img src={brand.crest} alt="" /> : <School size={22} />}</div>
          <div><b>{brand.name}</b><small>{brand.tag}</small></div>
        </div>
        <div className="login-quote">
          <h2>Everything your school runs on, in one place.</h2>
          <p>Students, staff, attendance, fees and communications — managed from a single workspace.</p>
        </div>
        <div className="login-foot"><FootBlock brand={brand} /></div>
      </section>
      <section className="login-panel">
        <div className="login-form">
          {children}
          <div className="login-foot-mobile"><FootBlock brand={brand} /></div>
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

export function PasswordInput({ label, value, onChange, autoComplete = 'new-password', autoFocus, placeholder = 'Enter your password', inputRef, invalid }) {
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  // Caps Lock is only known from key events; the warning goes away when the field loses focus
  const watchCaps = (e) => { if (e.getModifierState) setCaps(e.getModifierState('CapsLock')); };
  return (
    <label className="lfield">
      <span>{label}</span>
      <span className={`linput${invalid ? ' invalid' : ''}`}><Lock size={15} />
        <input ref={inputRef} aria-invalid={invalid || undefined} type={show ? 'text' : 'password'} autoComplete={autoComplete} autoFocus={autoFocus} placeholder={placeholder}
          value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={watchCaps} onKeyUp={watchCaps} onBlur={() => setCaps(false)}
          aria-describedby={caps ? 'caps-lock-warning' : undefined} />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </span>
      {caps && !show && <span id="caps-lock-warning" className="caps-warn" role="status"><ArrowBigUp size={13} />Caps Lock is on</span>}
    </label>
  );
}

/** authservice password rule (ChangePasswordRequest / ResetPasswordRequest). */
export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
export const PASSWORD_HINT = 'At least 8 characters with upper and lower case letters, a number and one of @$!%*?&.';
