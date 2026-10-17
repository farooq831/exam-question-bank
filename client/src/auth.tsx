import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SessionUser } from '@skans/shared';
import { api, refreshCsrf, setCsrfToken } from './api';

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  login(username: string, password: string): Promise<void>;
  logout(): Promise<void>;
  changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ user: SessionUser | null; csrfToken: string }>('/auth/me')
      .then((result) => {
        setCsrfToken(result.csrfToken);
        setUser(result.user);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    async login(username, password) {
      const result = await api<{ user: SessionUser; csrfToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      setCsrfToken(result.csrfToken);
      setUser(result.user);
    },
    async logout() {
      await api('/auth/logout', { method: 'POST' });
      setUser(null);
      await refreshCsrf();
    },
    async changePassword(currentPassword, newPassword, confirmPassword) {
      const result = await api<{ csrfToken: string }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      setCsrfToken(result.csrfToken);
      if (user) setUser({ ...user, mustChangePassword: false });
    },
  }), [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
