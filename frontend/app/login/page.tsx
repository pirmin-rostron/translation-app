"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthStore } from "../stores/authStore";
import { API_URL } from "../services/api";

type LoginResponse = {
  access_token: string;
  token_type: string;
  user: { id: number; email: string; full_name: string | null };
};

function LoginPageContent() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get("reason") === "session_expired";
  const from = searchParams.get("from");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const body = new URLSearchParams();
      body.set("username", email.trim().toLowerCase());
      body.set("password", password);

      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { detail?: string };
        throw new Error(payload.detail ?? `Login failed (${res.status})`);
      }

      const data = (await res.json()) as LoginResponse;
      setAuth(data.access_token, data.user);

      // Respect ?from= redirect, else go to personal dashboard
      router.push(from ?? "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ backgroundColor: "#F5F2EC" }}
    >
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="text-2xl font-semibold"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              color: "#1A110A",
            }}
          >
            Helvara
          </Link>
        </div>

        <div className="rounded-sm border border-stone-200 bg-white px-8 py-8">
          <h1
            className="text-xl font-semibold"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              color: "#1A110A",
            }}
          >
            Sign in
          </h1>
          <p className="mt-1 text-sm" style={{ color: "#0D7B6E" }}>
            Welcome back
          </p>

          {sessionExpired && (
            <p className="mt-4 rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Your session has expired. Please sign in again.
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium uppercase tracking-wider"
                style={{ color: "#1A110A" }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder-stone-300 focus:border-stone-900 focus:outline-none"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium uppercase tracking-wider"
                style={{ color: "#1A110A" }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder-stone-300 focus:border-stone-900 focus:outline-none"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-full px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: "#0D7B6E" }}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-stone-400">
            No account?{" "}
            <Link
              href="/register"
              className="font-medium transition-colors hover:underline"
              style={{ color: "#0D7B6E" }}
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  );
}
