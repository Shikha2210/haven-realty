import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { setUnauthorizedHandler, tokenStore } from './api.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

/** Holds who is signed in. The server is the source of truth; the UI only mirrors /account/me. */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) { setUser(null); return null; }
    try {
      const { data } = await api.get('/account/me');
      setUser(data);
      return data;
    } catch {
      tokenStore.clear();
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => { refresh().finally(() => setReady(true)); }, [refresh]);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    navigate('/login');
  }, [navigate]);

  useEffect(() => { setUnauthorizedHandler(() => { tokenStore.clear(); setUser(null); navigate('/login'); }); }, [navigate]);

  const login = useCallback(async (email, password, portal, remember) => {
    const { data } = await api.post('/auth/login', { email, password, portal });
    tokenStore.set(data.token, remember);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    tokenStore.set(data.token, true);
    setUser(data.user);
    return data;
  }, []);

  const value = useMemo(() => ({ user, ready, login, register, logout, refresh }), [user, ready, login, register, logout, refresh]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
