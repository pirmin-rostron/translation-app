"use client";

import { useEffect, useRef, useState } from "react";
import type { RefObject, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import "./landing.css";
import { Card } from "./components/ui/Card";
import { useCountUp } from "./hooks/useCountUp";

type FormState = "idle" | "loading" | "success" | "error";

// ─── Static data ──────────────────────────────────────────────────────────────

const features = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
    title: "AI Translation",
    body: "Claude-powered models translate with full contextual awareness — not word by word.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    title: "Human Review",
    body: "Every translation passes through structured block-by-block review before export.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
    title: "Team Glossaries",
    body: "Define terminology once. Helvara enforces it consistently across every document.",
  },
];


const steps = [
  { n: "1", title: "Upload", body: "Drop your document. Helvara parses and segments it automatically." },
  { n: "2", title: "Review", body: "AI translates block by block. You review, edit, and approve." },
  { n: "3", title: "Export", body: "Download your translated document in DOCX, RTF, or TXT." },
];

// ─── WaitlistForm ─────────────────────────────────────────────────────────────

type WaitlistFormProps = {
  name: string;
  email: string;
  formState: FormState;
  message: string;
  nameRef?: RefObject<HTMLInputElement>;
  onNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  dark?: boolean;
};

function WaitlistForm({
  name,
  email,
  formState,
  message,
  nameRef,
  onNameChange,
  onEmailChange,
  onSubmit,
  dark = false,
}: WaitlistFormProps) {
  const isLoading = formState === "loading";
  const labelClass = `mb-1.5 block text-xs font-medium ${dark ? "text-[#9E9189]" : "text-[#6B6158]"}`;
  const inputClass = `w-full py-2 text-sm disabled:opacity-50 ${dark ? "input-underline-dark" : "input-underline"}`;

  if (formState === "success") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-[#0D7B6E]/30 bg-[#E6F4F2] px-6 py-5">
        <svg className="mt-0.5 shrink-0 text-[#0D7B6E]" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <p className="text-sm font-medium text-[#0D7B6E]">{message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className={labelClass}>Your name</label>
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Ada Lovelace"
            required
            disabled={isLoading}
            className={inputClass}
          />
        </div>
        <div className="flex-1">
          <label className={labelClass}>Work email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="ada@company.com"
            required
            disabled={isLoading}
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !name.trim() || !email.trim()}
          className="shrink-0 rounded-full bg-[#0D7B6E] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0A6459] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Joining…" : "Join the waitlist"}
        </button>
      </div>
      {formState === "error" && (
        <p className="mt-3 text-xs text-[#B91C1C]">{message}</p>
      )}
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type PublicStats = {
  words_translated: number;
  documents_processed: number;
  reviewer_approvals: number;
  glossary_terms: number;
};

export default function LandingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const [publicStats, setPublicStats] = useState<PublicStats | null>(null);

  // Redirect logged-in users to the app.
  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)auth_token=([^;]+)/);
    if (match) {
      router.replace("/upload");
    }
  }, [router]);

  useEffect(() => {
    fetch("/api/stats/public")
      .then((r) => r.ok ? r.json() as Promise<PublicStats> : Promise.reject())
      .then(setPublicStats)
      .catch(() => { /* graceful degradation — show static stats only */ });
  }, []);

  const wordsTarget = publicStats
    ? Math.floor(publicStats.words_translated / 1000) * 1000
    : 0;
  const docsTarget = publicStats?.documents_processed ?? 0;
  const approvalsTarget = publicStats?.reviewer_approvals ?? 0;
  const glossaryTarget = publicStats?.glossary_terms ?? 0;

  const { ref: langsRef, displayValue: langsValue } = useCountUp({ target: 10 });
  const { ref: wordsRef, displayValue: wordsValue } = useCountUp({ target: wordsTarget });
  const { ref: docsRef, displayValue: docsValue } = useCountUp({ target: docsTarget });
  const { ref: approvalsRef, displayValue: approvalsValue } = useCountUp({ target: approvalsTarget });
  const { ref: glossaryRef, displayValue: glossaryValue } = useCountUp({ target: glossaryTarget });

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormState("loading");
    setMessage("");

    try {
      const res = await fetch(`/api/waitlist`, {
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

  return (
    <div className="font-sans bg-[#F5F2EC] text-[#1A110A]">

      {/* ── Nav ───────────────────────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#E5E0D8] bg-[#F5F2EC]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="font-display text-xl font-semibold text-[#1A110A]">Helvara</span>
          <Link
            href="/login"
            className="rounded-full px-4 py-1.5 text-sm font-medium text-[#0D7B6E] transition-colors hover:bg-[#E6F4F2]"
          >
            Log in
          </Link>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="grain-hero relative flex min-h-[50vh] items-center justify-center px-6 pt-16">
        <div className="relative z-10 mx-auto w-full max-w-2xl py-12 text-center">
          <p className="fade-up fade-up-1 mb-5 text-xs font-semibold uppercase tracking-widest text-[#0D7B6E]">
            AI-powered document translation
          </p>
          <h1 className="fade-up fade-up-2 mb-6 font-display text-[clamp(2.8rem,7vw,4.5rem)] font-bold leading-[1.1] tracking-tight text-[#1A110A]">
            Precision in every translation.
          </h1>
          <p className="fade-up fade-up-3 mb-12 text-lg leading-relaxed text-[#6B6158]">
            AI-powered translation with human review. Built for teams that care about accuracy.
          </p>
          <div className="fade-up fade-up-4">
            <WaitlistForm
              name={name}
              email={email}
              formState={formState}
              message={message}
              nameRef={nameRef}
              onNameChange={setName}
              onEmailChange={setEmail}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────────────────── */}
      <section className="border-t border-stone-200 px-6 py-16">
        <div className="mx-auto flex max-w-3xl flex-wrap justify-center gap-12 text-center">
          {/* Languages — static, always shown */}
          <div ref={langsRef} className="min-w-[120px]">
            <p className="font-display text-4xl font-bold text-[#1A110A]">{langsValue}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-[#0D7B6E]">Languages</p>
            <p className="mt-0.5 text-sm text-stone-500">Supported</p>
          </div>

          {/* Words translated — dynamic, hidden if zero */}
          {wordsTarget > 0 && (
            <div ref={wordsRef} className="min-w-[120px]">
              <p className="font-display text-4xl font-bold text-[#1A110A]">
                {(wordsValue / 1000).toFixed(0)},000+
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-[#0D7B6E]">Words</p>
              <p className="mt-0.5 text-sm text-stone-500">Translated</p>
            </div>
          )}

          {/* Documents — dynamic, hidden if zero */}
          {docsTarget > 0 && (
            <div ref={docsRef} className="min-w-[120px]">
              <p className="font-display text-4xl font-bold text-[#1A110A]">{docsValue}+</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-[#0D7B6E]">Documents</p>
              <p className="mt-0.5 text-sm text-stone-500">Processed</p>
            </div>
          )}

          {/* Reviewer approvals — dynamic, hidden if zero */}
          {approvalsTarget > 0 && (
            <div ref={approvalsRef} className="min-w-[120px]">
              <p className="font-display text-4xl font-bold text-[#1A110A]">{approvalsValue}+</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-[#0D7B6E]">Approvals</p>
              <p className="mt-0.5 text-sm text-stone-500">Human reviewed</p>
            </div>
          )}

          {/* Glossary terms — dynamic, hidden if zero */}
          {glossaryTarget > 0 && (
            <div ref={glossaryRef} className="min-w-[120px]">
              <p className="font-display text-4xl font-bold text-[#1A110A]">{glossaryValue}+</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-[#0D7B6E]">Glossary terms</p>
              <p className="mt-0.5 text-sm text-stone-500">Enforced</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Feature cards ─────────────────────────────────────────── */}
      <section className="px-6 py-24">
        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="flex flex-col gap-5 p-7">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#E6F4F2] text-[#0D7B6E]">
                {f.icon}
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-[#1A110A]">{f.title}</h3>
                <p className="text-sm leading-relaxed text-[#6B6158]">{f.body}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────── */}
      <section className="border-t border-[#E5E0D8] bg-white px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-16 text-center font-display text-[clamp(1.8rem,4vw,2.5rem)] font-bold text-[#1A110A]">
            From document to delivery in three steps.
          </h2>
          <div className="grid gap-10 sm:grid-cols-3">
            {steps.map((step) => (
              <div key={step.n} className="flex flex-col gap-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E6F4F2] text-sm font-bold text-[#0D7B6E]">
                  {step.n}
                </span>
                <div>
                  <h3 className="mb-1.5 text-sm font-semibold text-[#1A110A]">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-[#6B6158]">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────── */}
      <section className="bg-[#1A110A] px-6 py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 font-display text-[clamp(2rem,5vw,3rem)] font-bold text-white">
            Ready to translate with confidence?
          </h2>
          <p className="mb-10 text-lg text-[#9E9189]">Join the waitlist for early access.</p>
          <WaitlistForm
            name={name}
            email={email}
            formState={formState}
            message={message}
            onNameChange={setName}
            onEmailChange={setEmail}
            onSubmit={handleSubmit}
            dark
          />
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="bg-[#1A110A] px-6 pb-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 border-t border-white/10 pt-8">
          <span className="text-xs text-[#9E9189]">© 2026 Helvara</span>
          <span className="text-xs text-[#9E9189]">Built for precision.</span>
        </div>
      </footer>

    </div>
  );
}
