import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { SESSION_KEY, setUnauthorizedHandler } from './api/client.js';
import * as authApi from './api/authService.js';

// Display labels for authservice role codes (user_type / role_code).
const ROLE_LABELS = {
  SUPER_ADMIN: 'Super administrator', TRUSTEE: 'Trustee', PRINCIPAL: 'Principal', SCHOOL_PRINCIPAL: 'Principal',
  TEACHER: 'Teacher', FINANCE_OFFICER: 'Finance officer', IT_SYSTEM_ADMIN: 'IT administrator', SECURITY_AUDITOR: 'Security auditor',
  DEPARTMENT_HEAD: 'Head of department', ADMIN_CLERK: 'Administrative clerk', COMPLIANCE_OFFICER: 'Compliance officer',
  ADMISSION_OFFICER: 'Admission officer', FRONT_OFFICE_COUNSELOR: 'Front-office counselor', REGISTRAR: 'Registrar',
  ENTRANCE_EXAM_EVALUATOR: 'Entrance exam evaluator', FINANCE_CASHIER: 'Finance cashier', MARKETING_MANAGER: 'Marketing manager',
  APPLICANT_PARENT: 'Parent',
};

const AuthContext = createContext(null);
const BRANCH_KEY = 'oakridge.branch';

const normaliseRole = (r) => String(r || '').replace(/^ROLE_/, '');

/** The login/me responses carry no first or last name; derive one from the email or username. */
function displayName(email, username) {
  const local = (email || username || '').split('@')[0];
  const words = local.split(/[._-]+/).filter((w) => w && !/^\d+$/.test(w));
  return words.length ? words.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') : username || 'User';
}

function tokenExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function sessionFrom(res) {
  const roles = (res.roles || []).map(normaliseRole);
  const name = displayName(res.email, res.username);
  return {
    token: res.accessToken,
    expiresAt: tokenExpiry(res.accessToken),
    userId: res.userId,
    username: res.username,
    email: res.email,
    tenantId: res.tenantId,
    branchId: res.branchId || null,
    userType: res.userType,
    roles,
    mustChangePassword: !!res.mustChangePassword,
    mfaRequired: !!res.mfaRequired,
    name,
    initials: name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
    photoUrl: res.photoUrl || res.avatarUrl || null, // uploaded profile picture, when the sign-in response carries one
    role: ROLE_LABELS[normaliseRole(res.userType)] || ROLE_LABELS[roles[0]] || normaliseRole(res.userType),
  };
}

function readSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY));
    if (!s?.token || (s.expiresAt && s.expiresAt < Date.now())) return null;
    return s;
  } catch {
    return null;
  }
}

function persist(session, remember) {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  if (session) (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(session));
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readSession);
  const [notice, setNotice] = useState('');
  // Campus picked in the sidebar switcher (super admins); otherwise the user's own branch from the login response
  const [pickedBranch, setPickedBranch] = useState(() => { try { return localStorage.getItem(BRANCH_KEY) || ''; } catch { return ''; } });
  const selectBranch = (code) => { setPickedBranch(code); try { localStorage.setItem(BRANCH_KEY, code); } catch { /* private mode */ } };

  const signOut = useCallback((message = '') => {
    // authservice has no logout endpoint: the JWT is discarded client-side and expires on its own.
    persist(null);
    setUser(null);
    setNotice(message);
    setPickedBranch('');
    try { localStorage.removeItem(BRANCH_KEY); } catch { /* private mode */ }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => signOut('Your session has expired. Please sign in again.'));
  }, [signOut]);

  // Expire the session in the tab when the JWT runs out
  useEffect(() => {
    if (!user?.expiresAt) return undefined;
    const ms = user.expiresAt - Date.now();
    const t = setTimeout(() => signOut('Your session has expired. Please sign in again.'), Math.max(0, ms));
    return () => clearTimeout(t);
  }, [user, signOut]);

  async function signIn(identifier, password, remember) {
    const res = await authApi.login(identifier.trim(), password);
    const session = sessionFrom(res);
    persist(session, remember);
    setNotice('');
    // A new sign-in starts on the user's own campus, even if an earlier session ended without signing out
    setPickedBranch('');
    try { localStorage.removeItem(BRANCH_KEY); } catch { /* private mode */ }
    setUser(session);
    return session;
  }

  /** After a successful password change the account no longer needs the forced change. */
  function markPasswordChanged() {
    const remember = !!localStorage.getItem(SESSION_KEY);
    const next = { ...user, mustChangePassword: false };
    persist(next, remember);
    setUser(next);
  }

  const hasRole = (...codes) => !!user && codes.some((c) => user.roles.includes(c));
  // Only super administrators switch campus; everyone else always works on their own branch
  const branchId = (hasRole('SUPER_ADMIN') && pickedBranch) || user?.branchId || '';

  return (
    <AuthContext.Provider value={{ user, signIn, signOut, notice, hasRole, markPasswordChanged, branchId, pickedBranch, selectBranch }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export function RequireAuth({ children, allowPasswordChange = false }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  // US-01004: accounts flagged mustChangePassword only get a password-change token
  if (user.mustChangePassword && !allowPasswordChange) return <Navigate to="/change-password" replace />;
  return children;
}
