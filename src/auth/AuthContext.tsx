import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { authApi } from "../api";
import { setToken, setUnauthorizedHandler, getToken } from "../api/client";
import { useToast } from "../components/Toast";
import type { Domain, Role } from "../types";

// What the frontend actually knows about who's logged in — deliberately not
// called "CurrentUser" (that's the backend's richer type, which also has
// user_id/vendor_id/approval_level resolved server-side from the in-memory
// token store). LoginResponse doesn't return those, so neither do we.
export interface AuthUser {
  username: string;
  role: Role;
  domain: Domain;
  expiresAt: string;
}

const AUTH_USER_STORAGE_KEY = "procurement_auth_user";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function loadStoredUser(): AuthUser | null {
  const token = getToken();
  const raw = localStorage.getItem(AUTH_USER_STORAGE_KEY);
  if (!token || !raw) return null;
  try {
    const stored = JSON.parse(raw) as AuthUser;
    if (new Date(stored.expiresAt).getTime() <= Date.now()) return null;
    return stored;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => loadStoredUser());
  const [isLoading, setIsLoading] = useState(false);
  const { showToast } = useToast();

  // Clears local session state only — no backend call. Used both by manual
  // logout (after the backend call below) and by the forced-401 path, where
  // the token is already known-invalid, so calling the (authenticated)
  // /auth/logout endpoint would itself 401 and re-trigger the unauthorized
  // handler in a loop.
  const clearSession = useCallback(() => {
    setToken(null);
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    setUser(null);
  }, []);

  const logout = useCallback(() => {
    // Best-effort — the in-memory TOKENS store on the backend is what
    // actually matters, and a restart already invalidates it regardless
    // (see AGENTS.md §7). Don't block logout on this call succeeding.
    authApi.logout().catch(() => {});
    clearSession();
  }, [clearSession]);

  useEffect(() => {
    // Any 401 from any api call (expired/revoked token, server restart —
    // which empties the backend's in-memory TOKENS store) drops us back to
    // the login screen instead of silently failing requests forever.
    setUnauthorizedHandler(() => {
      clearSession();
      showToast("Your session has expired. Please sign in again.", "error");
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSession, showToast]);

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await authApi.login(username, password);
      setToken(response.access_token);
      const authUser: AuthUser = {
        username,
        role: response.role,
        domain: response.domain,
        expiresAt: response.expires_at,
      };
      localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(authUser));
      setUser(authUser);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = useMemo(() => ({ user, isLoading, login, logout }), [user, isLoading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
