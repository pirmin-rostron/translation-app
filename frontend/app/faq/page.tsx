"use client";

/**
 * FAQ page — public, no auth required. Accordion layout with one-at-a-time
 * expand behaviour. Answers link to /data-faq and /privacy for deep detail.
 */

import { useState } from "react";
import Link from "next/link";

// ─── Design tokens (same as landing page, aligned with DESIGN.md) ────────────

const T = {
  surface:          "#F5F2EC",
  onSurface:        "#1A110A",
  onSurfaceVariant: "#6B6158",
  accent:           "#0D7B6E",
  border:           "#E5E0D8",
} as const;

const display: React.CSSProperties = { fontFamily: "'Playfair Display', Georgia, serif" };
const inter: React.CSSProperties = { fontFamily: "Inter, sans-serif" };

// ─── FAQ data ────────────────────────────────────────────────────────────────

type FaqItem = { q: string; a: React.ReactNode };
type FaqSection = { title: string; items: FaqItem[] };

const sections: FaqSection[] = [
  {
    title: "Data & Security",
    items: [
      {
        q: "Where is my data stored?",
        a: <>All data is stored in Sydney, Australia on AWS. See our <Link href="/data-faq" className="text-brand-accent hover:underline">Data &amp; Security FAQ</Link> for full details on storage, transfers, and sub-processors.</>,
      },
      {
        q: "Does Anthropic train on my documents?",
        a: <>No. See <Link href="/data-faq" className="text-brand-accent hover:underline">Does Helvara read my documents?</Link> for the full answer.</>,
      },
      {
        q: "Is Helvara GDPR compliant?",
        a: <>Yes — GDPR and Australian Privacy Act 1988. See our <Link href="/privacy" className="text-brand-accent hover:underline">Privacy Policy</Link> and <Link href="/data-faq" className="text-brand-accent hover:underline">Data &amp; Security FAQ</Link>.</>,
      },
      {
        q: "Can I delete my data?",
        a: <>Yes. Account deletion permanently removes all your documents, translations, and personal data. See our <Link href="/data-faq" className="text-brand-accent hover:underline">Data &amp; Security FAQ</Link>.</>,
      },
    ],
  },
  {
    title: "The Product",
    items: [
      {
        q: "What file formats are supported?",
        a: "DOCX, RTF, and TXT. PDF support is coming soon.",
      },
      {
        q: "What languages can you translate to?",
        a: "German, French, Spanish, Italian, Japanese, Korean, Dutch, Portuguese, Chinese (Simplified), Arabic, Portuguese (BR), Swedish, Polish, and Turkish. More languages are added regularly.",
      },
      {
        q: "How accurate are the translations?",
        a: "Helvara uses Claude (Anthropic's AI) to produce translations, then surfaces ambiguous phrases and terminology conflicts for your review. You approve each block before exporting — the final document reflects your decisions, not just the AI's.",
      },
      {
        q: "What is the glossary?",
        a: "Define key terms and how they should be translated. Helvara applies them consistently across every document — useful for legal terminology, brand names, and industry-specific vocabulary.",
      },
      {
        q: "Can I use Helvara for certified or legal translations?",
        a: "Helvara is a translation workflow tool that assists professional translators and teams who need consistency and control. For legally certified translations, a qualified human translator should review and certify the final output. Helvara's block-by-block review workflow is designed to support that process.",
      },
    ],
  },
  {
    title: "Pricing & Access",
    items: [
      {
        q: "Is it free to try?",
        a: "Yes. Helvara has a free tier — no credit card required.",
      },
      {
        q: "Can my whole team use it?",
        a: "Helvara is built for teams. Organisation accounts support multiple users. Team invites are coming soon.",
      },
    ],
  },
  {
    title: "Getting Started",
    items: [
      {
        q: "How long does a translation take?",
        a: "Most documents translate in 2\u20135 minutes. Longer documents (10+ pages) may take up to 10 minutes.",
      },
      {
        q: "What happens after I upload a document?",
        a: "Helvara parses your document into blocks, translates each block, checks for ambiguity and glossary conflicts, then opens the review page. You review and approve each block before exporting.",
      },
      {
        q: "Can I fix mistakes in the source text?",
        a: "Yes. On the review page, edit any source block and Helvara re-translates it automatically.",
      },
      {
        q: "What if I'm not happy with a translation?",
        a: "Edit the translated text directly, or edit the source to trigger a re-translation. You can also re-translate the entire document from the Documents page.",
      },
    ],
  },
];

// ─── Accordion item ──────────────────────────────────────────────────────────

function AccordionItem({
  item,
  isOpen,
  onToggle,
  isLast,
}: {
  item: FaqItem;
  isOpen: boolean;
  onToggle: () => void;
  isLast: boolean;
}) {
  return (
    <div style={{ borderBottom: isLast ? "none" : `1px solid ${T.border}` }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          ...inter,
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 0",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          fontSize: "0.875rem",
          fontWeight: 600,
          color: T.onSurface,
        }}
      >
        {item.q}
        <span
          style={{
            display: "inline-block",
            transition: "transform 0.2s ease",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            fontSize: "0.875rem",
            color: T.onSurfaceVariant,
            flexShrink: 0,
            marginLeft: "1rem",
          }}
        >
          &#9662;
        </span>
      </button>
      <div
        style={{
          overflow: "hidden",
          maxHeight: isOpen ? "500px" : "0",
          transition: "max-height 0.3s ease",
        }}
      >
        <div style={{ ...inter, fontSize: "0.875rem", lineHeight: 1.7, color: T.onSurfaceVariant, paddingBottom: "1rem" }}>
          {item.a}
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function FaqPage() {
  // Track which item is open as "sectionIndex-itemIndex", or null if all closed
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=Inter:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { margin: 0; background: ${T.surface}; }
      `}</style>

      <div style={{ ...inter, background: T.surface, color: T.onSurface, minHeight: "100vh" }}>

        {/* ── Nav (matches landing page) ── */}
        <header style={{
          position: "fixed",
          inset: "0 0 auto 0",
          zIndex: 50,
          background: "rgba(245,242,236,0.8)",
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
            <Link href="/" style={{ ...display, fontSize: "1.25rem", fontWeight: 600, letterSpacing: "-0.01em", color: T.onSurface, textDecoration: "none" }}>
              Helvara
            </Link>

            <nav style={{ display: "flex", alignItems: "center", gap: "1.5rem", ...inter, fontSize: "0.875rem" }}>
              <Link href="/features" style={{ color: T.onSurfaceVariant, textDecoration: "none", fontWeight: 500 }}>Features</Link>
              <Link href="/#how-it-works" style={{ color: T.onSurfaceVariant, textDecoration: "none", fontWeight: 500 }}>How it works</Link>
              <Link href="/faq" style={{ color: T.onSurface, textDecoration: "none", fontWeight: 600 }}>FAQ</Link>
            </nav>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <Link href="/login" style={{ ...inter, fontSize: "0.875rem", fontWeight: 500, color: T.onSurfaceVariant, textDecoration: "none" }}>Log in</Link>
              <Link
                href="/register"
                style={{
                  ...inter,
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#ffffff",
                  textDecoration: "none",
                  background: T.accent,
                  padding: "0.375rem 1.125rem",
                  borderRadius: "9999px",
                }}
              >
                Start free
              </Link>
            </div>
          </div>
        </header>

        {/* ── Content ── */}
        <main style={{ maxWidth: "42rem", margin: "0 auto", padding: "8rem 1.5rem 6rem" }}>
          <h1 style={{ ...display, fontSize: "clamp(2rem, 4vw, 2.75rem)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1, color: T.onSurface, marginBottom: "0.75rem" }}>
            Frequently asked questions
          </h1>
          <p style={{ ...inter, fontSize: "1.05rem", lineHeight: 1.65, color: T.onSurfaceVariant, marginBottom: "3rem" }}>
            Everything you need to know before getting started.
          </p>

          {sections.map((section, si) => (
            <div key={section.title} style={{ marginBottom: "2.5rem" }}>
              <h2 style={{
                ...display,
                fontSize: "1.25rem",
                fontWeight: 600,
                color: T.onSurface,
                marginBottom: "0.5rem",
                paddingBottom: "0.5rem",
              }}>
                {section.title}
              </h2>
              {section.items.map((item, ii) => {
                const key = `${si}-${ii}`;
                return (
                  <AccordionItem
                    key={key}
                    item={item}
                    isOpen={openKey === key}
                    onToggle={() => setOpenKey(openKey === key ? null : key)}
                    isLast={ii === section.items.length - 1}
                  />
                );
              })}
            </div>
          ))}
        </main>

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
            <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", ...inter, fontSize: "0.75rem", color: "rgba(232,245,226,0.35)" }}>
              <Link href="/privacy" style={{ color: "inherit", textDecoration: "none" }}>Privacy</Link>
              <Link href="/terms" style={{ color: "inherit", textDecoration: "none" }}>Terms</Link>
              <Link href="/data-faq" style={{ color: "inherit", textDecoration: "none" }}>Data &amp; Security</Link>
              <span>&copy; 2026 Helvara</span>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
