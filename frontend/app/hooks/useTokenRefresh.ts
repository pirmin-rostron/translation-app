"use client";

import { useEffect } from "react";
import { useAuthStore, type AuthUser } from "../stores/authStore";
import { API_URL } from "../services/api";

const ONE_DAY_S = 24 * 60 * 60;
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 60 minutes

function getTokenExpiry(token: string): number | null {
  try {
    const segment = token.split(".")[1];
    if (!segment) return null;
    // JWT uses base64url encoding — convert to standard base64 before decoding.
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    const parsed = JSON.parse(json) as { exp?: unknown };
    return typeof parsed.exp === "number" ? parsed.exp : null;
  } catch {
    return null;
  }
}

export function useTokenRefresh() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    if (!token || !user) return;

    // Capture stable references for use inside the async callback.
    const currentToken = token;
    const currentUser: AuthUser = user;

    async function maybeRefresh() {
      const exp = getTokenExpiry(currentToken);
      if (exp === null) return;
      const nowS = Math.floor(Date.now() / 1000);
      if (exp - nowS > ONE_DAY_S) return;

      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { Authorization: `Bearer ${currentToken}` },
        });
        if (!res.ok) return;
        const data = (await res.json()) as { access_token: string; token_type: string };
        setAuth(data.access_token, currentUser);
      } catch (err) {
        console.error("Token refresh failed:", err);
      }
    }

    maybeRefresh();
    const id = setInterval(maybeRefresh, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [token, user, setAuth]);
}
