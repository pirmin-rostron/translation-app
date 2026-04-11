"use client";

import { useState } from "react";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────

type Category = "All" | "Upload" | "Translation" | "Review" | "Export" | "Infrastructure";

type Feature = {
  category: Exclude<Category, "All">;
  name: string;
  description: string;
  shippedDate?: string;
  isNew?: boolean;
};

// ── Feature data ───────────────────────────────────────────────────────────

const FEATURES: Feature[] = [
  // Upload
  {
    category: "Upload",
    name: "Drag and drop upload",
    description: "Drop files directly into the app, no file picker required. Supports single and batch uploads.",
    shippedDate: "Mar 2026",
    isNew: true,
  },
  {
    category: "Upload",
    name: "ZIP batch upload",
    description: "Upload a ZIP archive and each document inside becomes its own translation job automatically.",
    shippedDate: "Mar 2026",
    isNew: true,
  },
  {
    category: "Upload",
    name: "DOCX, TXT, RTF support",
    description: "Upload documents in the most common formats. More formats coming soon.",
    shippedDate: "Mar 2026",
  },
  // Translation
  {
    category: "Translation",
    name: "AI-powered translation",
    description:
      "Each document is translated automatically using Claude, with full context awareness across blocks.",
  },
  {
    category: "Translation",
    name: "Translation memory",
    description:
      "Exact and semantic matches are detected across your job history to ensure consistency.",
  },
  {
    category: "Translation",
    name: "Glossary enforcement",
    description: "Define key terms once and they're applied consistently across every job.",
  },
  {
    category: "Translation",
    name: "Ambiguity resolution",
    description:
      "When a phrase has multiple valid translations, you choose the right one during review.",
  },
  {
    category: "Translation",
    name: "Translation style control",
    description: "Choose between Natural, Formal, and Literal translation styles per document.",
  },
  // Review
  {
    category: "Review",
    name: "Block-by-block review",
    description:
      "Review each paragraph or section individually with source and translated text side by side.",
  },
  {
    category: "Review",
    name: "Diff view",
    description: "See exactly what changed between source and translated text at the block level.",
  },
  {
    category: "Review",
    name: "Ambiguity flags",
    description: "Ambiguous blocks are highlighted automatically so nothing slips through.",
  },
  // Export
  {
    category: "Export",
    name: "DOCX, RTF, TXT export",
    description: "Export your reviewed translation in the format you need.",
  },
  {
    category: "Export",
    name: "Formatting preservation",
    description:
      "Original document structure, headings, and spacing are preserved in the export.",
  },
  {
    category: "Export",
    name: "Certified translation",
    description: "Generate a certified translation certificate alongside your export.",
  },
  // Infrastructure
  {
    category: "Infrastructure",
    name: "Per-organisation workspaces",
    description:
      "Each organisation has its own isolated workspace, users, and glossary.",
  },
  {
    category: "Infrastructure",
    name: "Role-based access",
    description: "Admin and member roles with appropriate permissions per org.",
  },
];

const CATEGORIES: Category[] = [
  "All",
  "Upload",
  "Translation",
  "Review",
  "Export",
  "Infrastructure",
];

// ── Page ───────────────────────────────────────────────────────────────────

export default function FeaturesPage() {
  const [activeCategory, setActiveCategory] = useState<Category>("All");

  const displayed =
    activeCategory === "All"
      ? FEATURES
      : FEATURES.filter((f) => f.category === activeCategory);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5F2EC" }}>
      {/* ── Header ── */}
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="text-lg font-semibold"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1A110A" }}
          >
            Helvara
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-stone-500 hover:text-stone-900 transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="rounded-full px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#0D7B6E" }}
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16">
        {/* ── Hero ── */}
        <div className="mb-12">
          <p
            className="mb-3 text-xs font-medium uppercase tracking-widest"
            style={{ color: "#0D7B6E" }}
          >
            What we&rsquo;ve built
          </p>
          <h1
            className="text-4xl font-semibold"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1A110A" }}
          >
            Features
          </h1>
          <p className="mt-3 text-base text-stone-500">
            A complete AI-powered translation workflow
          </p>
        </div>

        {/* ── Category filter pills ── */}
        <div className="mb-10 flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? "bg-[#1A110A] text-white"
                  : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* ── Feature grid ── */}
        <div className="grid gap-4 sm:grid-cols-2">
          {displayed.map((feature) => (
            <div
              key={feature.name}
              className="border border-stone-200 bg-white px-6 py-5"
            >
              <div className="flex items-start justify-between gap-3">
                <p
                  className="text-xs font-medium uppercase tracking-widest"
                  style={{ color: "#0D7B6E" }}
                >
                  {feature.category}
                </p>
                {feature.isNew && (
                  <span className="shrink-0 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-[#0D7B6E]">
                    New
                  </span>
                )}
              </div>
              <p
                className="mt-2 text-base font-semibold"
                style={{ color: "#1A110A" }}
              >
                {feature.name}
              </p>
              <p className="mt-1 text-sm text-stone-500">{feature.description}</p>
              {feature.shippedDate && (
                <p className="mt-2 text-xs text-stone-400">Shipped {feature.shippedDate}</p>
              )}
            </div>
          ))}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-stone-200 px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-stone-400">© 2026 Helvara</p>
          <Link
            href="/"
            className="text-sm text-stone-400 hover:text-stone-700 transition-colors"
          >
            Back to helvara.io
          </Link>
        </div>
      </footer>
    </div>
  );
}
