"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuthStore } from "../stores/authStore";
import { API_URL } from "../services/api";

type LoginResponse = {
  access_token: string;
  token_type: string;
  user: { id: number; email: string; full_name: string | null };
};

const grain = (
  <div aria-hidden style={{
    position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E")`,
    backgroundRepeat: "repeat",
  }} />
);

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Register
      const registerRes = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          full_name: fullName.trim() || null,
        }),
      });

      if (!registerRes.ok) {
        const payload = (await registerRes.json().catch(() => ({}))) as { detail?: string };
        throw new Error(payload.detail ?? `Registration failed (${registerRes.status})`);
      }

      // 2. Auto-login
      const loginBody = new URLSearchParams();
      loginBody.set("username", email.trim().toLowerCase());
      loginBody.set("password", password);

      const loginRes = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: loginBody.toString(),
      });

      if (!loginRes.ok) {
        // Registration succeeded but login failed — send to login page
        router.push("/login");
        return;
      }

      const data = (await loginRes.json()) as LoginResponse;
      setAuth(data.access_token, data.user);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = (name: string): React.CSSProperties => ({
    borderTop: "none",
    borderLeft: "none",
    borderRight: "none",
    borderBottom: `1px solid ${focused === name ? "#082012" : "rgba(194,200,193,0.6)"}`,
    borderRadius: 0,
    background: "transparent",
    padding: "0.5rem 0",
    fontSize: "0.9375rem",
    outline: "none",
    width: "100%",
    color: "#1c1c17",
    fontFamily: "Inter, sans-serif",
    transition: "border-color 0.15s",
  });

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontFamily: "Inter, sans-serif",
    fontSize: "0.7rem",
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#082012",
    opacity: 0.6,
    marginBottom: "0.5rem",
  };

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; }
        .auth-layout { display: flex; min-height: 100vh; }
        .auth-left  { width: 40%; position: relative; overflow: hidden; }
        .auth-right { width: 60%; }
        @media (max-width: 768px) {
          .auth-layout { flex-direction: column; }
          .auth-left  { width: 100%; height: 80px; flex-shrink: 0; }
          .auth-left-content { display: none !important; }
          .auth-right { width: 100%; flex: 1; }
        }
      `}</style>

      <div className="auth-layout">

        {/* ── Left panel ── */}
        <div className="auth-left" style={{ backgroundColor: "#082012" }}>
          {grain}
          <div
            className="auth-left-content"
            style={{
              position: "relative",
              zIndex: 1,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "3rem",
            }}
          >
            {/* Logo */}
            <Link
              href="/"
              style={{
                fontFamily: "'Newsreader', Georgia, serif",
                fontSize: "2rem",
                fontWeight: 600,
                color: "rgba(232,245,226,0.9)",
                textDecoration: "none",
                letterSpacing: "-0.02em",
              }}
            >
              Helvara
            </Link>

            {/* Headline */}
            <div>
              <h2 style={{
                fontFamily: "'Newsreader', Georgia, serif",
                fontSize: "clamp(2rem, 3.5vw, 3rem)",
                fontWeight: 700,
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                color: "rgba(232,245,226,0.9)",
                marginBottom: "1.25rem",
              }}>
                Join Helvara.
              </h2>
              <p style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "0.8rem",
                fontWeight: 500,
                color: "rgba(232,245,226,0.55)",
              }}>
                Your translation workflow starts here.
              </p>
            </div>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div
          className="auth-right"
          style={{
            backgroundColor: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "3rem 2rem",
          }}
        >
          <div style={{ width: "100%", maxWidth: "380px" }}>

            {/* Eyebrow + heading */}
            <p style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "0.7rem",
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#0D7B6E",
              marginBottom: "0.5rem",
            }}>
              New account
            </p>
            <h1 style={{
              fontFamily: "'Newsreader', Georgia, serif",
              fontSize: "2rem",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "#082012",
              marginBottom: "2rem",
            }}>
              Create account
            </h1>

            <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <div>
                <label htmlFor="fullName" style={labelStyle}>
                  Full name <span style={{ opacity: 0.5, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
                </label>
                <input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  onFocus={() => setFocused("fullName")}
                  onBlur={() => setFocused(null)}
                  placeholder="Jane Smith"
                  style={inputStyle("fullName")}
                />
              </div>

              <div>
                <label htmlFor="email" style={labelStyle}>Email</label>
                <input
                  id="email"
                  type="text"
                  inputMode="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocused("email")}
                  onBlur={() => setFocused(null)}
                  placeholder="you@company.com"
                  style={inputStyle("email")}
                />
              </div>

              <div>
                <label htmlFor="password" style={labelStyle}>Password</label>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocused("password")}
                  onBlur={() => setFocused(null)}
                  placeholder="••••••••"
                  style={inputStyle("password")}
                />
              </div>

              {error && (
                <div style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "6px",
                  border: "1px solid #fecaca",
                  backgroundColor: "#fef2f2",
                  fontFamily: "Inter, sans-serif",
                  fontSize: "0.875rem",
                  color: "#b91c1c",
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  borderRadius: "9999px",
                  backgroundColor: "#082012",
                  color: "#ffffff",
                  border: "none",
                  padding: "0.8rem 1.5rem",
                  fontFamily: "Inter, sans-serif",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1,
                  transition: "opacity 0.15s",
                  marginTop: "0.5rem",
                }}
              >
                {loading ? "Creating account…" : "Create account"}
              </button>
            </form>

            <p style={{
              marginTop: "2rem",
              textAlign: "center",
              fontFamily: "Inter, sans-serif",
              fontSize: "0.875rem",
              color: "#78716c",
            }}>
              Already have an account?{" "}
              <Link
                href="/login"
                style={{ color: "#0D7B6E", fontWeight: 500, textDecoration: "none" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "underline"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "none"; }}
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>

      </div>
    </>
  );
}
