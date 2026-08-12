import React, { createContext, useContext, useEffect, useState } from "react";
import { api, getToken, setToken, clearToken } from "../api/client";

type User = { id: number; name: string; email: string; emailVerified: boolean };

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  signup: (name: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // On app start, check if we already have a token and, if so, fetch the
    // real profile via /me. If the token is invalid or expired, the request
    // fails and we clear it so the user is dropped back to the auth flow.
    (async () => {
      const token = await getToken();
      if (token) {
        try {
          const res = await api.getMe();
          setUser(res.user);
        } catch {
          await clearToken();
          setUser(null);
        }
      }
      setIsLoading(false);
    })();
  }, []);

  async function signup(name: string, email: string, password: string) {
    const res = await api.signup(name, email, password);
    await setToken(res.token);
    setUser(res.user);
  }

  async function login(email: string, password: string) {
    const res = await api.login(email, password);
    await setToken(res.token);
    setUser(res.user);
  }

  async function logout() {
    await clearToken();
    setUser(null);
  }

  async function refreshUser() {
    try {
      const res = await api.getMe();
      setUser(res.user);
    } catch {
      // token might have expired between screens — leave state as-is,
      // the next protected request will trigger a proper logout
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, signup, login, logout, refreshUser, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
