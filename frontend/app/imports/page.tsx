import Link from "next/link";

export default function ImportsPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-2xl font-bold text-slate-900">Imports</h1>
        <p className="mt-2 text-slate-600">
          Import new source documents to start translation and review workflows.
        </p>
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">
            Use the import flow to upload a document and create a new translation job.
          </p>
          <Link
            href="/upload"
            className="mt-4 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Open import flow
          </Link>
        </div>
      </div>
    </main>
  );
}
