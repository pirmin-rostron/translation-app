"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { useCountUp } from "./hooks/useCountUp";

// ─── Design tokens ─────────────────────────────────────────────────────────────

const T = {
  surface:             "#fcf9f0",
  surfaceContainerLow: "#f6f3eb",
  surfaceContainer:    "#f1eee5",
  primaryContainer:    "#082012",
  onSurface:           "#1c1c17",
  onSurfaceVariant:    "#424843",
  accent:              "#0D7B6E",
} as const;

// ─── Static data ───────────────────────────────────────────────────────────────

const painPoints = [
  {
    n: "01",
    title: "Siloed Translation Assets",
    body: "You paste into ChatGPT and get output that sounds almost right — until a lawyer reads it.",
  },
  {
    n: "02",
    title: "Fragmented Workflows",
    body: "Your team reviews in email threads, comments in Word, and loses track of what was actually approved.",
  },
  {
    n: "03",
    title: "No Glossary Enforcement",
    body: "The same term gets translated five different ways across five documents because no one enforced the glossary.",
  },
];

const steps = [
  { n: "1", title: "Upload",  body: "Drop your document. Helvara parses and segments it automatically." },
  { n: "2", title: "Review",  body: "AI translates block by block. You review, edit, and approve." },
  { n: "3", title: "Export",  body: "Download your translated document in DOCX, RTF, or TXT." },
];

const features = [
  {
    title: "Linguistic Insights",
    body: "Helvara surfaces glossary matches, translation memory, and semantic context for every block — so reviewers make faster, more confident decisions.",
  },
  {
    title: "Human Review Workflow",
    body: "Block-by-block structured review with approve, edit, and skip controls. Every decision is tracked and auditable from upload to export.",
  },
  {
    title: "Connected Glossary",
    body: "Define terminology once. Helvara enforces it consistently across every document — and lets reviewers add new terms directly from the review workflow.",
  },
  {
    title: "Translation Memory",
    body: "Approved translations are remembered. Similar content in future documents is surfaced automatically, reducing review time with every job.",
  },
];

// ─── Shared style helpers ──────────────────────────────────────────────────────

const display: React.CSSProperties = {
  fontFamily: "'Newsreader', Georgia, serif",
};

const inter: React.CSSProperties = {
  fontFamily: "Inter, sans-serif",
};

const eyebrow: React.CSSProperties = {
  ...inter,
  fontSize: "0.7rem",
  fontWeight: 600,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: T.accent,
  marginBottom: "1rem",
};

// ─── Grain overlay ─────────────────────────────────────────────────────────────

function GrainOverlay() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E\")",
        backgroundRepeat: "repeat",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}

// ─── Feature card (dark hover) ─────────────────────────────────────────────────

function FeatureCard({ title, body }: { title: string; body: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: hovered ? T.primaryContainer : "#ffffff",
        padding: "2rem",
        borderRadius: "4px",
        transition: "background-color 0.25s ease",
        cursor: "default",
      }}
    >
      <h3
        style={{
          ...display,
          fontSize: "1.1rem",
          fontWeight: 600,
          letterSpacing: "-0.01em",
          color: hovered ? "#e8f5e2" : T.onSurface,
          marginBottom: "0.75rem",
          transition: "color 0.25s ease",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          ...inter,
          fontSize: "0.9rem",
          lineHeight: 1.7,
          color: hovered ? "rgba(232,245,226,0.75)" : T.onSurfaceVariant,
          transition: "color 0.25s ease",
        }}
      >
        {body}
      </p>
    </div>
  );
}

// ─── Pain point row (ghost number hover) ──────────────────────────────────────

function PainPoint({ n, title, body }: { n: string; title: string; body: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: "relative", paddingLeft: "4.5rem", paddingBottom: "2.5rem", cursor: "default" }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: "-0.25rem",
          ...display,
          fontSize: "3.5rem",
          fontWeight: 700,
          lineHeight: 1,
          color: hovered ? "rgba(8,32,18,0.18)" : "rgba(8,32,18,0.07)",
          transition: "color 0.2s ease",
          userSelect: "none",
          letterSpacing: "-0.02em",
        }}
      >
        {n}
      </span>
      <p
        style={{
          ...inter,
          fontSize: "0.65rem",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: T.accent,
          marginBottom: "0.4rem",
        }}
      >
        {title}
      </p>
      <p style={{ ...inter, fontSize: "1rem", lineHeight: 1.7, color: T.onSurfaceVariant }}>{body}</p>
    </div>
  );
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type FormState = "idle" | "loading" | "success" | "error";

type PublicStats = {
  words_translated: number;
  documents_processed: number;
  reviewer_approvals: number;
  glossary_terms: number;
};

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");
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

  const wordsTarget    = publicStats?.words_translated    ?? 0;
  const docsTarget     = publicStats?.documents_processed ?? 0;
  const glossaryTarget = publicStats?.glossary_terms      ?? 0;

  const { ref: langsRef,    displayValue: langsValue    } = useCountUp({ target: 10 });
  const { ref: wordsRef,    displayValue: wordsValue    } = useCountUp({ target: wordsTarget });
  const { ref: docsRef,     displayValue: docsValue     } = useCountUp({ target: docsTarget });
  const { ref: glossaryRef, displayValue: glossaryValue } = useCountUp({ target: glossaryTarget });

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormState("loading");
    setMessage("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "", email: email.trim() }),
      });

      const data = (await res.json()) as { message?: string };

      if (!res.ok) {
        throw new Error("request_failed");
      }

      setFormState("success");
      setMessage(data.message ?? "You're on the list!");
      posthog.capture("waitlist_signup", { email: email.trim() });
      setEmail("");
    } catch {
      setFormState("error");
      setMessage("Something went wrong. Please try again in a moment.");
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&family=Inter:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { margin: 0; background: ${T.surface}; }
        ::selection { background: ${T.primaryContainer}; color: #fff; }
      `}</style>

      <div style={{ ...inter, background: T.surface, color: T.onSurface }}>

        {/* ── Nav ── */}
        <header style={{
          position: "fixed",
          inset: "0 0 auto 0",
          zIndex: 50,
          background: "rgba(252,249,240,0.8)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}>
          <div style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "1.25rem 1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <span style={{ ...display, fontSize: "1.25rem", fontWeight: 600, letterSpacing: "-0.01em", color: T.onSurface }}>
              Helvara
            </span>
            <a
              href="/login"
              style={{
                ...inter,
                fontSize: "0.875rem",
                fontWeight: 500,
                color: T.accent,
                textDecoration: "none",
                padding: "0.375rem 1rem",
                borderRadius: "9999px",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(13,123,110,0.08)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
            >
              Log in
            </a>
          </div>
        </header>

        {/* ── Hero ── */}
        <section style={{
          backgroundColor: T.surface,
          padding: "10rem 1.5rem 8rem",
          position: "relative",
          overflow: "hidden",
        }}>
          <GrainOverlay />
          <div style={{ maxWidth: "1200px", margin: "0 auto", position: "relative", zIndex: 1 }}>
            <p style={eyebrow}>Translation Workflow Platform</p>
            <h1 style={{
              ...display,
              fontSize: "clamp(3rem, 7vw, 5.5rem)",
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              color: T.onSurface,
              maxWidth: "800px",
              marginBottom: 0,
            }}>
              Manage all your{" "}
              <em style={{ fontStyle: "italic" }}>translations</em>{" "}
              in one place.
            </h1>
            <p style={{
              ...inter,
              marginLeft: "16.666%",
              marginTop: "2rem",
              maxWidth: "520px",
              fontSize: "1.1rem",
              lineHeight: 1.65,
              color: T.onSurfaceVariant,
            }}>
              Upload your documents, review AI translations block by block, and export with confidence. Built for legal, compliance, and enterprise teams who need consistency and control.
            </p>
            <div style={{ marginLeft: "16.666%", marginTop: "2.5rem", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "0.75rem" }}>
              <a
                href="#waitlist"
                style={{
                  background: T.primaryContainer,
                  color: "#ffffff",
                  ...inter,
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  textDecoration: "none",
                  padding: "0.8rem 2rem",
                  borderRadius: "9999px",
                  display: "inline-block",
                  transition: "opacity 0.15s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "0.85"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "1"; }}
              >
                Request early access
              </a>
              <p style={{ ...inter, fontSize: "0.75rem", color: T.onSurfaceVariant, margin: 0 }}>
                No commitment. We&apos;ll be in touch.
              </p>
            </div>
          </div>
        </section>

        {/* ── Sound Familiar ── */}
        <section style={{ backgroundColor: T.surfaceContainerLow, padding: "7rem 1.5rem" }}>
          <div style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "1fr 2fr",
            gap: "4rem",
            alignItems: "start",
          }}>
            <div>
              <p style={eyebrow}>Why Helvara</p>
              <h2 style={{
                ...display,
                fontSize: "clamp(2rem, 4vw, 3rem)",
                fontWeight: 700,
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                color: T.onSurface,
                marginBottom: "1.5rem",
              }}>
                Sound familiar?
              </h2>
              <div style={{ width: "48px", height: "4px", background: T.accent, borderRadius: "2px" }} />
            </div>
            <div>
              {painPoints.map((p) => (
                <PainPoint key={p.n} {...p} />
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section style={{ backgroundColor: T.surface, padding: "7rem 1.5rem" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "4rem" }}>
              <p style={eyebrow}>The Helvara Workflow</p>
              <h2 style={{
                ...display,
                fontSize: "clamp(2rem, 4vw, 3rem)",
                fontWeight: 700,
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                color: T.onSurface,
              }}>
                From document to delivery in three steps.
              </h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.5rem" }}>
              {steps.map((step) => (
                <div
                  key={step.n}
                  style={{
                    background: "#ffffff",
                    borderTop: `3px solid ${T.accent}`,
                    padding: "2rem",
                    borderRadius: "4px",
                  }}
                >
                  <div style={{
                    width: "2.25rem",
                    height: "2.25rem",
                    borderRadius: "9999px",
                    background: "rgba(13,123,110,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    ...inter,
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    color: T.accent,
                    marginBottom: "1.25rem",
                  }}>
                    {step.n}
                  </div>
                  <h3 style={{
                    ...display,
                    fontSize: "1.1rem",
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                    color: T.onSurface,
                    marginBottom: "0.6rem",
                  }}>
                    {step.title}
                  </h3>
                  <p style={{ ...inter, fontSize: "0.9rem", lineHeight: 1.7, color: T.onSurfaceVariant }}>{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section style={{ backgroundColor: T.surfaceContainer, padding: "7rem 1.5rem" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "4rem" }}>
              <h2 style={{
                ...display,
                fontSize: "clamp(2rem, 4vw, 3rem)",
                fontWeight: 700,
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                color: T.onSurface,
              }}>
                Built for the way teams actually work.
              </h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
              {features.map((f) => (
                <FeatureCard key={f.title} {...f} />
              ))}
            </div>
          </div>
        </section>

        {/* ── Stats ── */}
        <section style={{ backgroundColor: "#ede9e1", padding: "5rem 1.5rem" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <div style={{ marginBottom: "3rem", textAlign: "center" }}>
              <p style={eyebrow}>Built for accuracy</p>
              <h2 style={{
                ...display,
                fontSize: "1.6rem",
                fontWeight: 600,
                color: T.onSurface,
                letterSpacing: "-0.01em",
              }}>
                Trusted by teams who can&apos;t afford mistranslations.
              </h2>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "3rem", textAlign: "center" }}>
              {/* Languages — static, always shown */}
              <div ref={langsRef} style={{ minWidth: "120px" }}>
                <p style={{ ...display, fontSize: "2.5rem", fontWeight: 700, color: T.onSurface, margin: 0 }}>{langsValue}</p>
                <p style={{ ...inter, marginTop: "0.25rem", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.accent }}>Languages</p>
                <p style={{ ...inter, marginTop: "0.25rem", fontSize: "0.85rem", color: "#78716c" }}>Supported</p>
              </div>

              {/* Words translated — dynamic, hidden if zero */}
              {wordsTarget > 0 && (
                <div ref={wordsRef} style={{ minWidth: "120px" }}>
                  <p style={{ ...display, fontSize: "2.5rem", fontWeight: 700, color: T.onSurface, margin: 0 }}>{wordsValue.toLocaleString()}+</p>
                  <p style={{ ...inter, marginTop: "0.25rem", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.accent }}>Words</p>
                  <p style={{ ...inter, marginTop: "0.25rem", fontSize: "0.85rem", color: "#78716c" }}>Translated</p>
                </div>
              )}

              {/* Documents — dynamic, hidden if zero */}
              {docsTarget > 0 && (
                <div ref={docsRef} style={{ minWidth: "120px" }}>
                  <p style={{ ...display, fontSize: "2.5rem", fontWeight: 700, color: T.onSurface, margin: 0 }}>{docsValue}+</p>
                  <p style={{ ...inter, marginTop: "0.25rem", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.accent }}>Documents</p>
                  <p style={{ ...inter, marginTop: "0.25rem", fontSize: "0.85rem", color: "#78716c" }}>Processed</p>
                </div>
              )}

              {/* Glossary terms — dynamic, hidden if zero */}
              {glossaryTarget > 0 && (
                <div ref={glossaryRef} style={{ minWidth: "120px" }}>
                  <p style={{ ...display, fontSize: "2.5rem", fontWeight: 700, color: T.onSurface, margin: 0 }}>{glossaryValue}+</p>
                  <p style={{ ...inter, marginTop: "0.25rem", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.accent }}>Glossary terms</p>
                  <p style={{ ...inter, marginTop: "0.25rem", fontSize: "0.85rem", color: "#78716c" }}>Enforced consistently</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section
          id="waitlist"
          style={{
            backgroundColor: T.primaryContainer,
            padding: "7rem 1.5rem",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <GrainOverlay />
          <div style={{ maxWidth: "700px", margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
            <h2 style={{
              ...display,
              fontSize: "clamp(2rem, 5vw, 3rem)",
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              color: "#e8f5e2",
              marginBottom: "1rem",
            }}>
              Translation your legal team will{" "}
              <em style={{ fontStyle: "italic" }}>actually sign off on.</em>
            </h2>
            <p style={{ ...inter, fontSize: "1.05rem", lineHeight: 1.7, color: "rgba(232,245,226,0.7)", marginBottom: "2.5rem" }}>
              Built for teams who can&apos;t afford mistranslations. Request early access.
            </p>

            {formState === "success" ? (
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.75rem",
                background: "rgba(13,123,110,0.15)",
                border: "1px solid rgba(13,123,110,0.3)",
                borderRadius: "9999px",
                padding: "0.75rem 1.5rem",
                color: "#7ecfc7",
                ...inter,
                fontSize: "0.9rem",
                fontWeight: 500,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {message}
              </div>
            ) : (
              <form onSubmit={(e) => { void handleSubmit(e); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
                <div style={{ display: "flex", gap: "0.5rem", width: "100%", maxWidth: "480px" }}>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@company.com"
                    disabled={formState === "loading"}
                    style={{
                      flex: 1,
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: "9999px",
                      padding: "0.75rem 1.25rem",
                      color: "#fff",
                      ...inter,
                      fontSize: "0.9rem",
                      outline: "none",
                    }}
                  />
                  <button
                    type="submit"
                    disabled={formState === "loading" || !email.trim()}
                    style={{
                      background: T.surface,
                      color: T.primaryContainer,
                      border: "none",
                      borderRadius: "9999px",
                      padding: "0.75rem 1.5rem",
                      ...inter,
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      opacity: formState === "loading" || !email.trim() ? 0.6 : 1,
                      transition: "opacity 0.15s",
                    }}
                  >
                    {formState === "loading" ? "Joining…" : "Request access"}
                  </button>
                </div>
                {formState === "error" && (
                  <p style={{ ...inter, fontSize: "0.8rem", color: "#f87171", margin: 0 }}>{message}</p>
                )}
              </form>
            )}
          </div>
        </section>

        {/* ── Footer ── */}
        <footer style={{ background: "#051d0f", padding: "2rem 1.5rem" }}>
          <div style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingTop: "2rem",
          }}>
            <span style={{ ...display, fontSize: "1.1rem", fontWeight: 600, color: "rgba(232,245,226,0.6)", letterSpacing: "-0.01em" }}>
              Helvara
            </span>
            <span style={{ ...inter, fontSize: "0.75rem", color: "rgba(232,245,226,0.35)" }}>
              © 2026 Helvara
            </span>
          </div>
        </footer>

      </div>
    </>
  );
}
