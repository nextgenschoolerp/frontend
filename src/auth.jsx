import { createContext, useContext, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const KEY = 'oakridge.session';

// Demo accounts until the backend auth API exists. Replace `signIn` with a real request.
const USERS = [
  { email: 'admin@oakridge.edu', password: 'oakridge123', name: 'Sarah Williams', role: 'Administrator', initials: 'SW' },
];

const AuthContext = createContext(null);

function readSession() {
  try { return JSON.parse(localStorage.getItem(KEY) || sessionStorage.getItem(KEY)) || null; } catch { return null; }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readSession);

  async function signIn(email, password, remember) {
    await new Promise((r) => setTimeout(r, 400));
    const match = USERS.find((u) => u.email === email.trim().toLowerCase() && u.password === password);
    if (!match) throw new Error('Incorrect email or password.');
    const { password: _, ...session } = match;
    (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(session));
    setUser(session);
    return session;
  }

  function signOut() {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export function RequireAuth({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}
