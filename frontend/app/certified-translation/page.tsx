import Link from "next/link";

export default function CertifiedTranslationPage() {
  return (
    <main className="min-h-screen bg-brand-bg">
      <div className="mx-auto max-w-4xl px-8 py-10">
        <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-widest text-brand-accent">
          Coming soon
        </p>
        <h1 className="font-display text-2xl font-bold text-brand-text">Certified Translation</h1>
        <p className="mt-2 text-sm text-brand-muted">
          This area is reserved for human-assisted and NAATI-certified translation workflows.
        </p>
        <div className="mt-6 rounded-xl border border-brand-border bg-brand-surface p-6">
          <p className="text-sm text-brand-muted">
            The certified workflow will include request intake, assignment, and tracked handoff from machine draft to
            certified review.
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-flex rounded-full border border-brand-border bg-brand-surface px-5 py-2.5 text-sm font-medium text-brand-muted hover:bg-brand-bg transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
