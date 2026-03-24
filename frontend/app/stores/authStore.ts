"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AuthUser = {
  id: number;
  email: string;
  full_name: string | null;
};

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  clearAuth: () => void;
}

const COOKIE_NAME = "auth_token";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

function setAuthCookie(token: string) {
  const isLocalhost = typeof window !== "undefined" && window.location.hostname === "localhost";
  const secureFlag = isLocalhost ? "" : "; Secure";
  document.cookie = `${COOKIE_NAME}=${token}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Strict${secureFlag}`;
}

function clearAuthCookie() {
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => {
        if (typeof document !== "undefined") setAuthCookie(token);
        set({ token, user });
      },
      clearAuth: () => {
        if (typeof document !== "undefined") clearAuthCookie();
        set({ token: null, user: null });
      },
    }),
    {
      name: "helvara-auth",
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);
