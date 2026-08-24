import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type AuthContextValue = {
  user: Auth.User | null;
  loading: boolean;
  error: Error | null;
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
  completeSignIn: (token: string, user: Auth.User) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeUser(user: Auth.User): Auth.User {
  return {
    ...user,
    avatarUrl: user.avatarUrl ?? null,
    email: user.email ?? null,
    loginMethod: user.loginMethod ?? "local",
    role: user.role === "admin" ? "admin" : "user",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Auth.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [token, cachedUser] = await Promise.all([Auth.getSessionToken(), Auth.getUserInfo()]);
      if (!token || !cachedUser) {
        setUser(null);
        return;
      }
      setUser(normalizeUser(cachedUser));
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error("Không thể khôi phục phiên đăng nhập"));
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const completeSignIn = useCallback(async (token: string, nextUser: Auth.User) => {
    const normalizedUser = normalizeUser(nextUser);
    await Auth.setSessionToken(token);
    await Auth.setUserInfo(normalizedUser);
    setError(null);
    setUser(normalizedUser);
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      await Api.logout();
    } catch {
      // Always clear this device even if the remote logout request cannot complete.
    } finally {
      await Promise.all([Auth.removeSessionToken(), Auth.clearUserInfo()]);
      setError(null);
      setUser(null);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    error,
    isAuthenticated: Boolean(user),
    refresh,
    completeSignIn,
    logout,
  }), [user, loading, error, refresh, completeSignIn, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth phải được dùng bên trong AuthProvider");
  return context;
}
