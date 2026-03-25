"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  surface:                "#fcf9f0",
  surfaceContainerLow:    "#f6f3eb",
  surfaceContainer:       "#f1eee5",
  surfaceContainerLowest: "#ffffff",
  primaryContainer:       "#082012",
  onPrimary:              "#ffffff",
  onSurface:              "#1c1c17",
  onSurfaceVariant:       "#424843",
  outlineVariant:         "#c2c8c1",
  accent:                 "#0D7B6E",
} as const;

// ─── Static data ──────────────────────────────────────────────────────────────

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

// ─── Inline styles (to avoid Tailwind dependency for design system tokens) ────

const S = {
  // layout
  section: (bg: string): React.CSSProperties => ({
    backgroundColor: bg,
    padding: "7rem 1.5rem",
    position: "relative",
  }),
  inner: (maxW = "1200px"): React.CSSProperties => ({
    maxWidth: maxW,
    margin: "0 auto",
  }),
  // typography
  eyebrow: {
    fontSize: "0.7rem",
    fontWeight: 600,
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    color: T.accent,
    marginBottom: "1rem",
    fontFamily: "Inter, sans-serif",
  },
  h1: {
    fontFamily: "'Newsreader', Georgia, serif",
    fontSize: "clamp(3rem, 7vw, 5.5rem)",
    fontWeight: 700,
    lineHeight: 1.05,
    letterSpacing: "-0.02em",
    color: T.onSurface,
    marginBottom: "0",
  },
  h2: (color: string = T.onSurface): React.CSSProperties => ({
    fontFamily: "'Newsreader', Georgia, serif",
    fontSize: "clamp(2rem, 4vw, 3rem)",
    fontWeight: 700,
    lineHeight: 1.1,
    letterSpacing: "-0.02em",
    color,
  }),
  body: (color: string = T.onSurfaceVariant): React.CSSProperties => ({
    fontFamily: "Inter, sans-serif",
    fontSize: "1rem",
    lineHeight: 1.7,
    color,
  }),
};

// ─── Grain overlay component ──────────────────────────────────────────────────

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

// ─── Feature card with dark hover ─────────────────────────────────────────────

function FeatureCard({ title, body }: { title: string; body: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: hovered ? T.primaryContainer : T.surfaceContainerLowest,
        padding: "2rem",
        borderRadius: "4px",
        transition: "background-color 0.25s ease",
        cursor: "default",
      }}
    >
      <h3
        style={{
          fontFamily: "'Newsreader', Georgia, serif",
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
          ...S.body(hovered ? "rgba(232,245,226,0.75)" : T.onSurfaceVariant),
          fontSize: "0.9rem",
          transition: "color 0.25s ease",
        }}
      >
        {body}
      </p>
    </div>
  );
}

// ─── Pain point row with ghost number hover ───────────────────────────────────

function PainPoint({ n, title, body }: { n: string; title: string; body: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: "relative", paddingLeft: "4.5rem", paddingBottom: "2.5rem", cursor: "default" }}
    >
      {/* Ghost number */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: "-0.25rem",
          fontFamily: "'Newsreader', Georgia, serif",
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
          fontFamily: "Inter, sans-serif",
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
      <p style={S.body()}>{body}</p>
    </div>
  );
}

// ─── CTA form ─────────────────────────────────────────────────────────────────

function CtaForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setMsg("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "", email: email.trim() }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) throw new Error("request_failed");
      setStatus("success");
      setMsg(data.message ?? "You're on the list!");
      setEmail("");
    } catch {
      setStatus("error");
      setMsg("Something went wrong. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.75rem",
          background: "rgba(13,123,110,0.15)",
          border: "1px solid rgba(13,123,110,0.3)",
          borderRadius: "9999px",
          padding: "0.75rem 1.5rem",
          color: "#7ecfc7",
          fontFamily: "Inter, sans-serif",
          fontSize: "0.9rem",
          fontWeight: 500,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        {msg}
      </div>
    );
  }

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
      <div style={{ display: "flex", gap: "0.5rem", width: "100%", maxWidth: "480px" }}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@company.com"
          disabled={status === "loading"}
          style={{
            flex: 1,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "9999px",
            padding: "0.75rem 1.25rem",
            color: "#fff",
            fontFamily: "Inter, sans-serif",
            fontSize: "0.9rem",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={status === "loading" || !email.trim()}
          style={{
            background: T.surface,
            color: T.primaryContainer,
            border: "none",
            borderRadius: "9999px",
            padding: "0.75rem 1.5rem",
            fontFamily: "Inter, sans-serif",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
            opacity: status === "loading" || !email.trim() ? 0.6 : 1,
            transition: "opacity 0.15s",
          }}
        >
          {status === "loading" ? "Joining…" : "Request access"}
        </button>
      </div>
      {status === "error" && (
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.8rem", color: "#f87171" }}>{msg}</p>
      )}
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PreviewPage() {
  const router = useRouter();

  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)auth_token=([^;]+)/);
    if (match) router.replace("/dashboard");
  }, [router]);

  return (
    <>
      {/* Font imports */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&family=Inter:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { margin: 0; background: ${T.surface}; }
        ::selection { background: ${T.primaryContainer}; color: ${T.onPrimary}; }
      `}</style>

      <div style={{ fontFamily: "Inter, sans-serif", background: T.surface, color: T.onSurface }}>

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
            <span style={{
              fontFamily: "'Newsreader', Georgia, serif",
              fontSize: "1.25rem",
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: T.onSurface,
            }}>
              Helvara
            </span>
            <a
              href="/login"
              style={{
                fontFamily: "Inter, sans-serif",
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
          ...S.section(T.surface),
          paddingTop: "10rem",
          paddingBottom: "8rem",
          position: "relative",
          overflow: "hidden",
        }}>
          <GrainOverlay />
          <div style={{ ...S.inner("1200px"), position: "relative", zIndex: 1 }}>
            <p style={S.eyebrow}>Translation Workflow Platform</p>
            <h1 style={{ ...S.h1, maxWidth: "800px" }}>
              Manage all your{" "}
              <em style={{ fontStyle: "italic" }}>translations</em>{" "}
              in one place.
            </h1>
            {/* Subhead offset right */}
            <p style={{
              ...S.body(),
              marginLeft: "16.666%",
              marginTop: "2rem",
              maxWidth: "520px",
              fontSize: "1.1rem",
              lineHeight: 1.65,
            }}>
              Upload your documents, review AI translations block by block, and export with confidence. Built for legal, compliance, and enterprise teams who need consistency and control.
            </p>
            <div style={{ marginLeft: "16.666%", marginTop: "2.5rem", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "0.75rem" }}>
              <a
                href="#waitlist"
                style={{
                  background: T.primaryContainer,
                  color: T.onPrimary,
                  fontFamily: "Inter, sans-serif",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  textDecoration: "none",
                  padding: "0.8rem 2rem",
                  borderRadius: "9999px",
                  transition: "opacity 0.15s",
                  display: "inline-block",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "0.85"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "1"; }}
              >
                Request early access
              </a>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: T.onSurfaceVariant, margin: 0 }}>
                No commitment. We&apos;ll be in touch.
              </p>
            </div>
          </div>
        </section>

        {/* ── Sound Familiar ── */}
        <section style={S.section(T.surfaceContainerLow)}>
          <div style={{
            ...S.inner("1200px"),
            display: "grid",
            gridTemplateColumns: "1fr 2fr",
            gap: "4rem",
            alignItems: "start",
          }}>
            {/* Left */}
            <div>
              <p style={S.eyebrow}>Why Helvara</p>
              <h2 style={{ ...S.h2(), marginBottom: "1.5rem" }}>Sound familiar?</h2>
              {/* Green underline bar */}
              <div style={{ width: "48px", height: "4px", background: T.accent, borderRadius: "2px" }} />
            </div>
            {/* Right */}
            <div>
              {painPoints.map((p) => (
                <PainPoint key={p.n} {...p} />
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section style={S.section(T.surface)}>
          <div style={S.inner("1200px")}>
            <div style={{ textAlign: "center", marginBottom: "4rem" }}>
              <p style={S.eyebrow}>The Helvara Workflow</p>
              <h2 style={S.h2()}>From document to delivery in three steps.</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.5rem" }}>
              {steps.map((step) => (
                <div
                  key={step.n}
                  style={{
                    background: T.surfaceContainerLowest,
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
                    fontFamily: "Inter, sans-serif",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    color: T.accent,
                    marginBottom: "1.25rem",
                  }}>
                    {step.n}
                  </div>
                  <h3 style={{
                    fontFamily: "'Newsreader', Georgia, serif",
                    fontSize: "1.1rem",
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                    color: T.onSurface,
                    marginBottom: "0.6rem",
                  }}>
                    {step.title}
                  </h3>
                  <p style={{ ...S.body(), fontSize: "0.9rem" }}>{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section style={S.section(T.surfaceContainer)}>
          <div style={S.inner("1200px")}>
            <div style={{ textAlign: "center", marginBottom: "4rem" }}>
              <h2 style={S.h2()}>Built for the way teams actually work.</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
              {features.map((f) => (
                <FeatureCard key={f.title} {...f} />
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section
          id="waitlist"
          style={{
            ...S.section(T.primaryContainer),
            position: "relative",
            overflow: "hidden",
          }}
        >
          <GrainOverlay />
          <div style={{ ...S.inner("700px"), textAlign: "center", position: "relative", zIndex: 1 }}>
            <h2 style={{
              ...S.h2("#e8f5e2"),
              marginBottom: "1rem",
            }}>
              Translation your legal team will{" "}
              <em style={{ fontStyle: "italic" }}>actually sign off on.</em>
            </h2>
            <p style={{
              ...S.body("rgba(232,245,226,0.7)"),
              marginBottom: "2.5rem",
              fontSize: "1.05rem",
            }}>
              Built for teams who can&apos;t afford mistranslations. Request early access.
            </p>
            <CtaForm />
          </div>
        </section>

        {/* ── Footer ── */}
        <footer style={{
          background: "#051d0f",
          padding: "2rem 1.5rem",
        }}>
          <div style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingTop: "2rem",
          }}>
            <span style={{
              fontFamily: "'Newsreader', Georgia, serif",
              fontSize: "1.1rem",
              fontWeight: 600,
              color: "rgba(232,245,226,0.6)",
              letterSpacing: "-0.01em",
            }}>
              Helvara
            </span>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "rgba(232,245,226,0.35)" }}>
              © 2026 Helvara
            </span>
          </div>
        </footer>

      </div>
    </>
  );
}
