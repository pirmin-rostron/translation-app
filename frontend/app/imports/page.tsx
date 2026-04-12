import Link from "next/link";

export default function ImportsPage() {
  return (
    <main className="min-h-screen bg-brand-bg">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-2xl font-bold text-brand-text">Glossary CSV Import</h1>
        <p className="mt-2 text-brand-muted">
          Bulk-import glossary terms for consistent terminology across translation jobs.
        </p>
        <div className="mt-6 rounded-xl border border-brand-border bg-brand-surface p-6 ">
          <p className="text-sm text-brand-muted">
            CSV import tooling will live on this page. For now, use the Glossary page to add and manage terms.
          </p>
          <Link
            href="/glossary"
            className="mt-4 inline-flex rounded-xl border border-brand-border px-4 py-2 text-sm font-medium text-brand-text hover:bg-brand-bg"
          >
            Back to Glossary
          </Link>
        </div>
      </div>
    </main>
  );
}
