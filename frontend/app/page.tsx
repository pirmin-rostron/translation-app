"use client";

/**
 * Homepage — Helvara marketing landing page.
 * Matches the prototype from Helvara Marketing.html.
 * Sections: Nav, Hero, Value Props,
 * Product Features (bento), Workflow, Pricing, FAQ, CTA, Footer.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "./stores/authStore";
import { Icons } from "./components/Icons";

// ── Nav ─────────────────────────────────────────────────────────────────────

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <header className={`fixed inset-x-0 top-0 z-50 flex h-[64px] items-center justify-between px-8 transition-all ${
      scrolled ? "border-b border-brand-border bg-brand-bg/85 backdrop-blur-md" : ""
    }`}>
      <Link href="/" className="flex items-center gap-2 no-underline">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-text text-white">
          <Icons.HLogo className="h-4 w-4" />
        </span>
        <span className="font-display text-[1.125rem] font-semibold tracking-display text-brand-text">Helvara</span>
      </Link>
      <nav className="flex items-center gap-1">
        <a href="#features" className="rounded-full px-3 py-1.5 text-[0.875rem] font-medium text-brand-muted transition-colors hover:bg-brand-sunken hover:text-brand-text">Features</a>
        <a href="#pricing" className="rounded-full px-3 py-1.5 text-[0.875rem] font-medium text-brand-muted transition-colors hover:bg-brand-sunken hover:text-brand-text">Pricing</a>
        <a href="#faq" className="rounded-full px-3 py-1.5 text-[0.875rem] font-medium text-brand-muted transition-colors hover:bg-brand-sunken hover:text-brand-text">FAQ</a>
      </nav>
      <div className="flex items-center gap-2">
        <Link href="/login" className="rounded-full px-3 py-1.5 text-[0.875rem] font-medium text-brand-muted no-underline transition-colors hover:text-brand-text">Sign in</Link>
        <Link href="/register" className="rounded-full border border-brand-border bg-brand-surface px-4 py-1.5 text-[0.875rem] font-medium text-brand-text no-underline shadow-card transition-all hover:shadow-raised">Book a demo</Link>
        <Link href="/register" className="rounded-full bg-brand-text px-4 py-1.5 text-[0.875rem] font-medium text-white no-underline transition-colors hover:bg-brand-accent">Start free</Link>
      </div>
    </header>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="mx-auto max-w-[1200px] px-8 pb-20 pt-32 text-center">
      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-border bg-brand-surface px-3 py-1 text-[0.8125rem] font-medium text-brand-muted shadow-card">
        <Icons.Sparkle className="h-3 w-3 text-brand-accent" />
        New · Autopilot 1.2
      </div>
      <h1 className="mx-auto max-w-4xl font-display text-[3.25rem] font-semibold leading-[1.02] tracking-display text-brand-text md:text-[4.25rem]">
        Translation that reads{" "}
        <br className="hidden md:block" />
        like <span className="italic text-brand-accent">you wrote it.</span>
      </h1>
      <p className="mx-auto mt-6 max-w-2xl text-[1.0625rem] leading-relaxed text-brand-muted">
        Helvara translates your documents with the editorial judgment of an in-house linguist — flagging only the genuine ambiguities, and handling the rest. You keep control; you lose the grind.
      </p>
      <div className="mt-8 flex items-center justify-center gap-3">
        <Link href="/register" className="rounded-full bg-brand-text px-6 py-3 text-base font-medium text-white no-underline transition-colors hover:bg-brand-accent">Start free — no card</Link>
        <Link href="/register" className="rounded-full border border-brand-border bg-brand-surface px-6 py-3 text-base font-medium text-brand-text no-underline shadow-card transition-all hover:shadow-raised">Book a demo</Link>
      </div>
      <div className="mt-6 flex items-center justify-center gap-6 text-[0.8125rem] text-brand-subtle">
        <span className="flex items-center gap-1.5"><Icons.Check className="h-3.5 w-3.5 text-brand-accent" /> Free for 10,000 words</span>
        <span className="flex items-center gap-1.5"><Icons.Check className="h-3.5 w-3.5 text-brand-accent" /> SOC 2 · GDPR</span>
        <span className="flex items-center gap-1.5"><Icons.Check className="h-3.5 w-3.5 text-brand-accent" /> 38 languages</span>
      </div>
    </section>
  );
}

// ── Logos Strip ──────────────────────────────────────────────────────────────

// ── Value Props ──────────────────────────────────────────────────────────────

const VALUE_PROPS = [
  { n: "01", title: "Handles the obvious.", body: "Style, glossary, tone, register — applied consistently across every document, every language." },
  { n: "02", title: "Asks about the rest.", body: "Genuine ambiguities come to you as discrete, answerable questions. Not a diff of the whole file." },
  { n: "03", title: "Learns your voice.", body: "Decisions roll into your style guide and translation memory. The next document needs less from you." },
];

function ValueProps() {
  return (
    <section className="mx-auto max-w-[1200px] px-8 py-20">
      <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-brand-accent">The work</p>
      <h2 className="max-w-2xl font-display text-[2.5rem] font-semibold leading-[1.05] tracking-display text-brand-text">
        A linguist who handles the <span className="italic">obvious</span> — and asks about the rest.
      </h2>
      <div className="mt-12 space-y-0">
        {VALUE_PROPS.map((p) => (
          <div key={p.n} className="border-t border-brand-border py-8">
            <span className="font-mono text-[0.75rem] font-medium tabular-nums text-brand-accent">{p.n}</span>
            <h3 className="mt-2 font-display text-[1.375rem] font-semibold text-brand-text">{p.title}</h3>
            <p className="mt-2 max-w-xl text-[1rem] leading-relaxed text-brand-muted">{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Product Features (Bento Grid) ───────────────────────────────────────────

function ProductFeatures() {
  return (
    <section id="features" className="mx-auto max-w-[1200px] px-8 py-20">
      <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-brand-accent">Under the hood</p>
      <h2 className="max-w-2xl font-display text-[2.5rem] font-semibold leading-[1.05] tracking-display text-brand-text">
        Built for the work, not the demo.
      </h2>
      <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-6">
        <div className="rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-card md:col-span-4">
          <h3 className="m-0 font-display text-[1.25rem] font-semibold tracking-display text-brand-text">Block-level review</h3>
          <p className="m-0 mt-2 text-[0.9375rem] leading-relaxed text-brand-muted">See source and target side-by-side, with every change traceable to a reason. Accept, edit, or reject at the block level — never the whole file.</p>
        </div>
        <div className="rounded-2xl border border-brand-accent/20 bg-brand-accentSoft p-6 shadow-card md:col-span-2">
          <h3 className="m-0 font-display text-[1.25rem] font-semibold tracking-display text-brand-text">Translation memory</h3>
          <p className="m-0 mt-2 text-[0.9375rem] leading-relaxed text-brand-muted">Every approved segment becomes memory. High-confidence matches auto-fill; fuzzy matches get a second look.</p>
        </div>
        <div className="rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-card md:col-span-2">
          <h3 className="m-0 font-display text-[1.25rem] font-semibold tracking-display text-brand-text">Glossary, enforced</h3>
          <p className="m-0 mt-2 text-[0.9375rem] leading-relaxed text-brand-muted">Your term list isn&apos;t a suggestion. Helvara flags every conflict before you read it.</p>
        </div>
        <div className="rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-card md:col-span-2">
          <h3 className="m-0 font-display text-[1.25rem] font-semibold tracking-display text-brand-text">38 languages</h3>
          <p className="m-0 mt-2 text-[0.9375rem] leading-relaxed text-brand-muted">From Spanish to Swahili, with native-speaker calibration on every pair.</p>
        </div>
        <div className="rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-card md:col-span-2">
          <h3 className="m-0 font-display text-[1.25rem] font-semibold tracking-display text-brand-text">Exports anywhere</h3>
          <p className="m-0 mt-2 text-[0.9375rem] leading-relaxed text-brand-muted">Back to .docx, .rtf, .xliff, or straight into your CMS via API.</p>
        </div>
      </div>
    </section>
  );
}

// ── Workflow Steps ───────────────────────────────────────────────────────────

const STEPS = [
  { n: "01", title: "Upload", body: "Drop a .docx, .rtf, or .txt. Pick target languages. Helvara routes it to Autopilot or Manual." },
  { n: "02", title: "Autopilot translates", body: "Rumi reads your glossary, memory, and style guide. Handles routine blocks; flags ambiguities." },
  { n: "03", title: "You review ambiguities", body: "Questions arrive as discrete cards with context. Answer, don't edit." },
  { n: "04", title: "Export anywhere", body: "Back to the original format or into your CMS. Every choice is tracked and reusable." },
];

function Workflow() {
  return (
    <section className="mx-auto max-w-[1200px] px-8 py-20">
      <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-brand-accent">How it flows</p>
      <h2 className="max-w-2xl font-display text-[2.5rem] font-semibold leading-[1.05] tracking-display text-brand-text">
        From draft to shipped, without the handoffs.
      </h2>
      <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-4">
        {STEPS.map((s) => (
          <div key={s.n} className="rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-card">
            <span className="font-mono text-[0.75rem] font-medium tabular-nums text-brand-accent">{s.n}</span>
            <h3 className="mt-3 font-display text-[1.125rem] font-semibold text-brand-text">{s.title}</h3>
            <p className="mt-2 text-[0.875rem] leading-relaxed text-brand-muted">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Pricing ─────────────────────────────────────────────────────────────────

function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-[1200px] px-8 py-20">
      <div className="mb-10 text-center">
        <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-brand-accent">Pricing</p>
        <h2 className="font-display text-[2.5rem] font-semibold tracking-display text-brand-text">Pay per word, not per seat.</h2>
        <p className="mt-3 text-[1.0625rem] text-brand-muted">Translate your first 10,000 words free. No card. No tedium.</p>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* Starter */}
        <div className="rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-card">
          <h3 className="m-0 font-display text-[1.25rem] font-semibold text-brand-text">Starter</h3>
          <p className="m-0 mt-3 font-display text-[2.5rem] font-semibold leading-none tracking-display text-brand-text">Free</p>
          <p className="m-0 mt-1 text-xs text-brand-subtle">up to 10,000 words/mo</p>
          <ul className="m-0 mt-5 list-none space-y-2 p-0 text-sm text-brand-muted">
            <li className="flex items-center gap-2"><Icons.Check className="h-3.5 w-3.5 text-brand-accent" /> 1 user</li>
            <li className="flex items-center gap-2"><Icons.Check className="h-3.5 w-3.5 text-brand-accent" /> 3 languages</li>
            <li className="flex items-center gap-2"><Icons.Check className="h-3.5 w-3.5 text-brand-accent" /> Email support</li>
            <li className="flex items-center gap-2"><Icons.Check className="h-3.5 w-3.5 text-brand-accent" /> Community glossary</li>
          </ul>
          <Link href="/register" className="mt-6 block rounded-full border border-brand-border bg-brand-surface px-5 py-2.5 text-center text-sm font-medium text-brand-text no-underline shadow-card transition-all hover:shadow-raised">Start free</Link>
        </div>
        {/* Team — highlighted */}
        <div className="rounded-2xl bg-brand-text p-6 shadow-card">
          <div className="flex items-center justify-between">
            <h3 className="m-0 font-display text-[1.25rem] font-semibold text-white">Team</h3>
            <span className="rounded-full bg-brand-accent px-2.5 py-0.5 text-[0.6875rem] font-medium text-white">Popular</span>
          </div>
          <p className="m-0 mt-3 font-display text-[2.5rem] font-semibold leading-none tracking-display text-white">$49</p>
          <p className="m-0 mt-1 text-xs text-white/60">per user / month</p>
          <ul className="m-0 mt-5 list-none space-y-2 p-0 text-sm text-white/80">
            <li className="flex items-center gap-2"><Icons.Check className="h-3.5 w-3.5 text-brand-accent" /> Unlimited words</li>
            <li className="flex items-center gap-2"><Icons.Check className="h-3.5 w-3.5 text-brand-accent" /> 38 languages</li>
            <li className="flex items-center gap-2"><Icons.Check className="h-3.5 w-3.5 text-brand-accent" /> Glossary + memory</li>
            <li className="flex items-center gap-2"><Icons.Check className="h-3.5 w-3.5 text-brand-accent" /> Priority support</li>
          </ul>
          <Link href="/register" className="mt-6 block rounded-full bg-white px-5 py-2.5 text-center text-sm font-medium text-brand-text no-underline transition-colors hover:bg-brand-accentSoft">Start 14-day trial</Link>
        </div>
        {/* Enterprise */}
        <div className="rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-card">
          <h3 className="m-0 font-display text-[1.25rem] font-semibold text-brand-text">Enterprise</h3>
          <p className="m-0 mt-3 font-display text-[2.5rem] font-semibold leading-none tracking-display text-brand-text">Talk to us</p>
          <p className="m-0 mt-1 text-xs text-brand-subtle">custom</p>
          <ul className="m-0 mt-5 list-none space-y-2 p-0 text-sm text-brand-muted">
            <li className="flex items-center gap-2"><Icons.Check className="h-3.5 w-3.5 text-brand-accent" /> SSO / SCIM</li>
            <li className="flex items-center gap-2"><Icons.Check className="h-3.5 w-3.5 text-brand-accent" /> Dedicated instance</li>
            <li className="flex items-center gap-2"><Icons.Check className="h-3.5 w-3.5 text-brand-accent" /> Custom MT routing</li>
            <li className="flex items-center gap-2"><Icons.Check className="h-3.5 w-3.5 text-brand-accent" /> SLA</li>
          </ul>
          <Link href="/register" className="mt-6 block rounded-full border border-brand-border bg-brand-surface px-5 py-2.5 text-center text-sm font-medium text-brand-text no-underline shadow-card transition-all hover:shadow-raised">Book a demo</Link>
        </div>
      </div>
    </section>
  );
}

// ── FAQ ──────────────────────────────────────────────────────────────────────

const FAQS = [
  { q: "Does Helvara replace my translators?", a: "No. Helvara handles the routine work — applying your glossary, leveraging translation memory, maintaining tone and register. Your linguists focus on the genuinely difficult decisions." },
  { q: "Which languages are supported?", a: "38 languages with native-speaker calibration on every pair. We add two new languages every quarter based on customer demand." },
  { q: "How does pricing work?", a: "Free for your first 10,000 words per month. After that, pay per word on the Team plan ($49/user/month for unlimited). Enterprise pricing is custom." },
  { q: "Is my data secure?", a: "SOC 2 Type II and GDPR compliant. Your documents are encrypted at rest and in transit, never used for model training, and you can choose data residency." },
];

function Faq() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <section id="faq" className="mx-auto max-w-[1200px] px-8 py-20">
      <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-brand-accent">Common questions</p>
      <h2 className="font-display text-[2.5rem] font-semibold tracking-display text-brand-text">Fair asks.</h2>
      <p className="mt-3 max-w-xl text-[1.0625rem] text-brand-muted">A few more below. If you don&apos;t see yours, we&apos;d love to hear it.</p>
      <div className="mt-10 space-y-0">
        {FAQS.map((f, i) => (
          <div key={i} className="border-t border-brand-border">
            <button
              type="button"
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
              className="flex w-full items-center justify-between py-5 text-left"
            >
              <span className="text-[1.0625rem] font-medium text-brand-text">{f.q}</span>
              <Icons.Plus className={`h-4 w-4 shrink-0 text-brand-subtle transition-transform ${openIdx === i ? "rotate-45" : ""}`} />
            </button>
            {openIdx === i && (
              <p className="m-0 pb-5 text-[0.9375rem] leading-relaxed text-brand-muted animate-fadein">{f.a}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ── CTA Banner ──────────────────────────────────────────────────────────────

function CtaBanner() {
  return (
    <section className="mx-auto max-w-[1200px] px-8 py-10">
      <div className="relative overflow-hidden rounded-[32px] bg-brand-text p-14 text-center md:p-20">
        {/* Accent glow */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-accent/20 blur-3xl" />
        <p className="mb-4 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-white/50">Ready?</p>
        <h2 className="mx-auto max-w-3xl font-display text-[2.5rem] font-semibold leading-[1.05] tracking-display text-white md:text-[3.5rem]">
          Ship in a language you don&apos;t speak <em className="italic text-brand-accent">— confidently.</em>
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-[1.0625rem] text-white/70">Start with 10,000 free words. No card. No 90-day procurement dance.</p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/register" className="rounded-full bg-white px-6 py-3 text-base font-medium text-brand-text no-underline transition-colors hover:bg-brand-accentSoft">Start free</Link>
          <Link href="/register" className="rounded-full border border-white/30 px-6 py-3 text-base font-medium text-white no-underline transition-colors hover:border-white/60">Book a demo</Link>
        </div>
      </div>
    </section>
  );
}

// ── Footer ──────────────────────────────────────────────────────────────────

const FOOTER_COLS = [
  { title: "Product", links: ["Features", "Pricing", "Changelog", "Roadmap"] },
  { title: "Solutions", links: ["Marketing teams", "Localization managers", "Agencies", "Developers"] },
  { title: "Resources", links: ["FAQ", "Help center", "API docs", "Style guides"] },
  { title: "Company", links: ["About", "Customers", "Careers", "Press kit"] },
];

function Footer() {
  return (
    <footer className="bg-brand-text">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-12 px-8 py-16 md:grid-cols-[1.4fr_2fr_1fr]">
        {/* Brand */}
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white">
              <Icons.HLogo className="h-4 w-4" />
            </span>
            <span className="font-display text-[1.125rem] font-semibold tracking-display text-white">Helvara</span>
          </div>
          <p className="mt-4 text-[0.875rem] leading-relaxed text-white/60">Translation that reads like you wrote it. For teams shipping in more than one language.</p>
          <div className="mt-6 flex items-center gap-2">
            <Link href="/register" className="rounded-full bg-white px-4 py-2 text-sm font-medium text-brand-text no-underline transition-colors hover:bg-brand-accentSoft">Start free</Link>
            <Link href="/register" className="rounded-full border border-white/30 px-4 py-2 text-sm font-medium text-white no-underline transition-colors hover:border-white/60">Book a demo</Link>
          </div>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {FOOTER_COLS.map((col) => (
            <div key={col.title}>
              <p className="m-0 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-white/50">{col.title}</p>
              <ul className="m-0 mt-3 list-none space-y-2 p-0">
                {col.links.map((link) => (
                  <li key={link}><a href="#" className="text-[0.875rem] text-white/75 no-underline transition-colors hover:text-white">{link}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Newsletter */}
        <div>
          <p className="m-0 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-white/50">On the record</p>
          <p className="m-0 mt-3 text-[0.875rem] leading-relaxed text-white/60">We&apos;ll send a monthly dispatch on the craft of translation — no marketing fluff. Unsubscribe anytime.</p>
          <div className="mt-4 flex items-center rounded-full border border-white/20 bg-white/5 p-1">
            <input type="email" placeholder="you@company.com" className="flex-1 bg-transparent px-3 py-1.5 text-sm text-white outline-none placeholder:text-white/40" />
            <button type="button" className="rounded-full bg-white px-4 py-1.5 text-sm font-medium text-brand-text transition-colors hover:bg-brand-accentSoft">Subscribe</button>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-8 py-4 text-xs text-white/40">
          <span>&copy; 2026 Helvara Inc. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="text-white/40 no-underline hover:text-white/70">Terms</Link>
            <Link href="/privacy" className="text-white/40 no-underline hover:text-white/70">Privacy</Link>
            <a href="#" className="text-white/40 no-underline hover:text-white/70">Security</a>
            <a href="#" className="text-white/40 no-underline hover:text-white/70">Status</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (hasHydrated && token) router.replace("/dashboard");
  }, [hasHydrated, token, router]);

  return (
    <div className="min-h-screen app-bg">
      <Nav />
      <Hero />
      <ValueProps />
      <ProductFeatures />
      <Workflow />
      <Pricing />
      <Faq />
      <CtaBanner />
      <Footer />
    </div>
  );
}
