import Link from "next/link";

export default function CertifiedTranslationPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-2xl font-bold text-slate-900">Certified Translation</h1>
        <p className="mt-2 text-slate-600">
          This area is reserved for human-assisted and NAATI-certified translation workflows.
        </p>
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">
            The certified workflow will include request intake, assignment, and tracked handoff from machine draft to
            certified review.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to All Translations
          </Link>
        </div>
      </div>
    </main>
  );
}
