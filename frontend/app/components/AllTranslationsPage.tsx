"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

const IN_PROGRESS_STATUSES = new Set(["parsing", "parsed", "segmented", "translation_queued", "translating", "translated"]);
const REVIEW_STATUSES = new Set(["in_review", "draft_saved", "ready_for_export", "exported"]);

export default function AllTranslationsPage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [parsingId, setParsingId] = useState<number | null>(null);

  const fetchDocs = () => {
    fetch(`${API_URL}/api/documents`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        return res.json();
      })
      .then(setDocs)
      .catch((err) => setError(err.message));
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
      fetchDocs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Parse failed");
    } finally {
      setParsingId(null);
    }
  };

  useEffect(() => {
    fetch(`${API_URL}/api/documents`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        return res.json();
      })
      .then(setDocs)
      .catch((err) => setError(err.message))
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
            Import document
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
                {docs.map((doc) => (
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
                        {doc.status}
                      </span>
                      {doc.error_message && <p className="mt-1 text-xs text-red-600">{doc.error_message}</p>}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{formatDate(doc.created_at)}</td>
                    <td className="px-6 py-4 flex gap-2">
                      <Link
                        href={
                          IN_PROGRESS_STATUSES.has(doc.status)
                            ? `/processing/${doc.id}`
                            : `/documents/${doc.id}`
                        }
                        className="text-sm text-slate-600 hover:text-slate-900"
                      >
                        {IN_PROGRESS_STATUSES.has(doc.status)
                          ? "View progress"
                          : REVIEW_STATUSES.has(doc.status)
                            ? "Open review/export"
                            : "Open details"}
                      </Link>
                      {(doc.status === "uploaded" || doc.status === "failed") && (
                        <button
                          onClick={() => handleParse(doc.id)}
                          disabled={parsingId === doc.id}
                          className="text-sm text-slate-600 hover:text-slate-900 disabled:opacity-50"
                        >
                          {parsingId === doc.id ? "Processing…" : doc.status === "failed" ? "Retry" : "Parse"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
