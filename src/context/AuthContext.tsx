import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authApi } from '../lib/api';
import type { AuthUser } from '../types/api';

interface AuthContextValue {
  user: AuthUser | null;
  // 初回の /api/auth/me が終わるまでは 'loading'
  status: 'loading' | 'ready';
  refresh: () => Promise<AuthUser | null>;
  login: (email: string, password: string) => Promise<AuthUser>;
  signup: (email: string, password: string, displayName?: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  resendVerification: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');

  const refresh = useCallback(async () => {
    try {
      const { user: me } = await authApi.me();
      setUser(me);
      return me;
    } catch {
      setUser(null);
      return null;
    } finally {
      setStatus('ready');
    }
  }, []);

  useEffect(() => {
    // 起動時にサーバーのセッションを取得する（外部システムとの同期）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const { user: me } = await authApi.login({ email, password });
    setUser(me);
    return me;
  }, []);

  const signup = useCallback(async (email: string, password: string, displayName?: string) => {
    const { user: me } = await authApi.signup({ email, password, display_name: displayName || undefined });
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const resendVerification = useCallback(async () => {
    await authApi.resendVerification();
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, refresh, login, signup, logout, resendVerification }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
