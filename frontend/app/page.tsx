"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DM_Sans } from "next/font/google";
import "./landing.css";

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type FormState = "idle" | "loading" | "success" | "error";

const features = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
    title: "AI-powered translation",
    body: "Anthropic-grade models translate your documents with full contextual awareness — not word-by-word.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    title: "Human review workflow",
    body: "Every translation passes through a structured review stage. Approve, edit, or flag segments before export.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
    title: "Team glossaries",
    body: "Define terminology once. Helvara enforces your glossary across every document, every language pair.",
  },
];

export default function LandingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  // Redirect logged-in users to the app.
  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)auth_token=([^;]+)/);
    if (match) {
      router.replace("/upload");
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormState("loading");
    setMessage("");

    try {
      const res = await fetch(`${API_URL}/api/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });

      const data = (await res.json()) as { message?: string };

      if (!res.ok) {
        throw new Error("request_failed");
      }

      setFormState("success");
      setMessage(data.message ?? "You're on the list!");
      setName("");
      setEmail("");
    } catch {
      setFormState("error");
      setMessage("Something went wrong. Please try again in a moment.");
    }
  }

  const isLoading = formState === "loading";

  return (
    <>

      <main className={`${dmSans.className} min-h-screen bg-[#FAFAFA] text-gray-900`}>

        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="grain-hero relative flex min-h-screen flex-col px-6 pt-10 pb-24">

          {/* Brand */}
          <header className="relative z-10 fade-up fade-up-1">
            <span className="text-xl font-semibold tracking-tight text-gray-900">
              Helvara
            </span>
          </header>

          {/* Copy + form */}
          <div className="relative z-10 mx-auto mt-16 w-full max-w-2xl pb-8 pt-10">

            <p className="fade-up fade-up-2 mb-5 text-xs font-semibold uppercase tracking-widest text-teal-600">
              Coming soon
            </p>

            <h1 className="fade-up fade-up-2 mb-6 text-[clamp(2.6rem,7vw,4.75rem)] font-bold leading-[1.08] tracking-tight text-gray-900">
              Intelligent document{" "}
              <span className="text-teal-600">translation.</span>
            </h1>

            <p className="fade-up fade-up-3 mb-12 max-w-lg text-lg font-normal leading-relaxed text-gray-500">
              AI-powered translation with human review. Built for teams that care
              about precision.
            </p>

            {/* Waitlist form */}
            {formState === "success" ? (
              <div className="fade-up fade-up-3 flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50 px-6 py-5">
                <svg className="mt-0.5 shrink-0 text-teal-600" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <p className="text-sm font-medium text-teal-800">{message}</p>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="fade-up fade-up-3"
                noValidate
              >
                <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label className="mb-1.5 block text-xs font-medium text-gray-400">
                      Your name
                    </label>
                    <input
                      ref={nameRef}
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ada Lovelace"
                      required
                      disabled={isLoading}
                      className="input-underline w-full py-2 text-sm text-gray-900 disabled:opacity-50"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1.5 block text-xs font-medium text-gray-400">
                      Work email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ada@company.com"
                      required
                      disabled={isLoading}
                      className="input-underline w-full py-2 text-sm text-gray-900 disabled:opacity-50"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading || !name.trim() || !email.trim()}
                    className="shrink-0 rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? "Joining…" : "Join the waitlist"}
                  </button>
                </div>

                {formState === "error" && (
                  <p className="mt-3 text-xs text-red-500">{message}</p>
                )}
              </form>
            )}
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────── */}
        <section className="border-t border-gray-100 px-6 py-24">
          <div className="mx-auto max-w-4xl">
            <div className="grid gap-10 sm:grid-cols-3">
              {features.map((f) => (
                <div key={f.title} className="flex flex-col gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                    {f.icon}
                  </div>
                  <div>
                    <h3 className="mb-1.5 text-sm font-semibold text-gray-900">
                      {f.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-gray-500">{f.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────────── */}
        <footer className="border-t border-gray-100 px-6 py-8">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
            <span className="text-xs text-gray-400">© 2026 Helvara</span>
            <span className="text-xs text-gray-400">Built for precision.</span>
          </div>
        </footer>

      </main>
    </>
  );
}
