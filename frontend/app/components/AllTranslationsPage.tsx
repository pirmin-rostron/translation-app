"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getLanguageDisplayName } from "../utils/language";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Document = {
  id: number;
  filename: string;
  file_type: string;
  source_language: string | null;
  target_language: string;
  industry: string | null;
  domain: string | null;
  status: string;
  error_message?: string | null;
  created_at: string;
};

type TranslationJobOverview = {
  id: number;
  status: string;
  error_message?: string | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

const PARSE_READY_STATUSES = new Set(["uploaded", "failed", "parse_failed"]);
const PARSE_IN_PROGRESS_STATUSES = new Set(["parsing"]);
const TRANSLATION_IN_PROGRESS_STATUSES = new Set(["translation_queued", "translating", "failed"]);
const REVIEW_STATUSES = new Set(["in_review", "draft_saved", "review_complete", "ready_for_export", "exported"]);

export default function AllTranslationsPage() {
  const router = useRouter();
  const [docs, setDocs] = useState<Document[]>([]);
  const [latestJobsByDocumentId, setLatestJobsByDocumentId] = useState<Record<number, TranslationJobOverview | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [parsingId, setParsingId] = useState<number | null>(null);
  const [openingDocId, setOpeningDocId] = useState<number | null>(null);

  const fetchDocs = async () => {
    const res = await fetch(`${API_URL}/api/documents`);
    if (!res.ok) throw new Error(`Failed to load (${res.status})`);
    const payload = (await res.json()) as Document[];
    setDocs(payload);
    const jobsByDocEntries = await Promise.all(
      payload.map(async (doc) => {
        try {
          const jobsRes = await fetch(`${API_URL}/api/documents/${doc.id}/translation-jobs`);
          if (!jobsRes.ok) return [doc.id, null] as const;
          const jobs = (await jobsRes.json()) as TranslationJobOverview[];
          return [doc.id, jobs[0] ?? null] as const;
        } catch {
          return [doc.id, null] as const;
        }
      })
    );
    setLatestJobsByDocumentId(Object.fromEntries(jobsByDocEntries));
  };

  const handleParse = async (docId: number) => {
    setError("");
    setParsingId(docId);
    try {
      const res = await fetch(`${API_URL}/api/documents/${docId}/parse`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Parse failed (${res.status})`);
      }
      await fetchDocs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Parse failed");
    } finally {
      setParsingId(null);
    }
  };

  const handleOpenWorkflow = async (doc: Document) => {
    setError("");
    setOpeningDocId(doc.id);
    try {
      const latestJob = latestJobsByDocumentId[doc.id];
      const workflowStatus = latestJob?.status ?? doc.status;
      if (latestJob && REVIEW_STATUSES.has(workflowStatus)) {
        router.push(`/translation-jobs/${latestJob.id}`);
        return;
      }
      if (TRANSLATION_IN_PROGRESS_STATUSES.has(workflowStatus) || PARSE_IN_PROGRESS_STATUSES.has(workflowStatus)) {
        router.push(`/processing/${doc.id}`);
        return;
      }
      router.push(`/documents/${doc.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open workflow");
    } finally {
      setOpeningDocId(null);
    }
  };

  useEffect(() => {
    fetchDocs()
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load documents"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">All Translations</h1>
            <p className="mt-1 text-sm text-slate-500">
              Your main workspace for imported documents, translation jobs, and review.
            </p>
          </div>
          <Link
            href="/upload"
            className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            New translation
          </Link>
        </div>

        {loading && <p className="text-slate-600">Loading…</p>}
        {error && <p className="mb-4 text-red-600">{error}</p>}
        {!loading && !error && docs.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
            No translations yet. Import a document to get started.
          </div>
        )}
        {!loading && docs.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">
                    Filename
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">
                    Target
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">
                    Industry
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">
                    Domain
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {docs.map((doc) => {
                  const latestJob = latestJobsByDocumentId[doc.id];
                  const workflowStatus = latestJob?.status ?? doc.status;
                  const workflowError = latestJob?.error_message ?? doc.error_message;
                  return (
                  <tr key={doc.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      <Link href={`/documents/${doc.id}`} className="text-slate-900 hover:underline">
                        {doc.filename}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{doc.file_type}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {getLanguageDisplayName(doc.source_language)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {getLanguageDisplayName(doc.target_language)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{doc.industry ?? "—"}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{doc.domain ?? "—"}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex rounded px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-800">
                        {workflowStatus}
                      </span>
                      {workflowError && <p className="mt-1 text-xs text-red-600">{workflowError}</p>}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{formatDate(doc.created_at)}</td>
                    <td className="px-6 py-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleOpenWorkflow(doc)}
                        disabled={openingDocId === doc.id}
                        className="text-sm text-slate-600 hover:text-slate-900"
                      >
                        {openingDocId === doc.id
                          ? "Opening…"
                          : TRANSLATION_IN_PROGRESS_STATUSES.has(workflowStatus) || PARSE_IN_PROGRESS_STATUSES.has(workflowStatus)
                          ? "View progress"
                          : REVIEW_STATUSES.has(workflowStatus)
                            ? "Open review/export"
                            : "Open details"}
                      </button>
                      {PARSE_READY_STATUSES.has(doc.status) && (
                        <button
                          onClick={() => handleParse(doc.id)}
                          disabled={parsingId === doc.id}
                          className="text-sm text-slate-600 hover:text-slate-900 disabled:opacity-50"
                        >
                          {parsingId === doc.id ? "Processing…" : doc.status === "uploaded" ? "Parse" : "Retry parse"}
                        </button>
                      )}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
