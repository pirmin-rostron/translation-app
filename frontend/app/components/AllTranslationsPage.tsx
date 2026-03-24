"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { getLanguageDisplayName } from "../utils/language";

import { documentsApi, queryKeys } from "../services/api";
import { useDocuments } from "../hooks/queries";
import type { Document } from "../hooks/queries";

type TranslationJobOverview = {
  id: number;
  status: string;
  error_message?: string | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

const PARSE_READY_STATUSES = new Set(["uploaded", "parse_failed"]);
const PARSE_IN_PROGRESS_STATUSES = new Set(["parsing"]);
const TRANSLATION_IN_PROGRESS_STATUSES = new Set(["translation_queued", "translating", "failed"]);
const REVIEW_STATUSES = new Set(["in_review", "draft_saved", "review_complete", "ready_for_export", "exported"]);

export default function AllTranslationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: docs = [], isLoading: loading, error: docsError } = useDocuments();
  const errorMessage = docsError instanceof Error ? docsError.message : docsError ? "Failed to load documents" : "";

  const [latestJobsByDocumentId, setLatestJobsByDocumentId] = useState<Record<number, TranslationJobOverview | null>>({});
  const [actionError, setActionError] = useState("");
  const [parsingId, setParsingId] = useState<number | null>(null);
  const [openingDocId, setOpeningDocId] = useState<number | null>(null);

  // Fetch the latest job for each document whenever the document list changes.
  useEffect(() => {
    if (docs.length === 0) return;
    let cancelled = false;
    void Promise.all(
      docs.map(async (doc) => {
        try {
          const jobs = await documentsApi.getTranslationJobs<TranslationJobOverview[]>(doc.id);
          return [doc.id, jobs[0] ?? null] as const;
        } catch {
          return [doc.id, null] as const;
        }
      })
    ).then((entries) => {
      if (!cancelled) setLatestJobsByDocumentId(Object.fromEntries(entries));
    });
    return () => { cancelled = true; };
  }, [docs]);

  const handleParse = async (docId: number) => {
    setActionError("");
    setParsingId(docId);
    try {
      await documentsApi.parse<unknown>(docId);
      await queryClient.invalidateQueries({ queryKey: queryKeys.documents.all() });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Parse failed");
    } finally {
      setParsingId(null);
    }
  };

  const handleOpenWorkflow = async (doc: Document) => {
    setActionError("");
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
      setActionError(err instanceof Error ? err.message : "Failed to open workflow");
    } finally {
      setOpeningDocId(null);
    }
  };

  const error = errorMessage || actionError;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5F2EC" }}>
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1
              className="text-2xl font-semibold"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1A110A" }}
            >
              All Translations
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              Your main workspace for imported documents, translation jobs, and review.
            </p>
          </div>
          <Link
            href="/upload"
            className="inline-flex rounded-full px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: "#0D7B6E" }}
          >
            New translation
          </Link>
        </div>

        {loading && <p className="text-stone-600">Loading…</p>}
        {error && <p className="mb-4 text-red-600">{error}</p>}
        {!loading && !errorMessage && docs.length === 0 && (
          <div className="border border-stone-200 bg-white p-8 text-stone-600">
            No translations yet. Import a document to get started.
          </div>
        )}
        {!loading && docs.length > 0 && (
          <div className="overflow-hidden border border-stone-200 bg-white">
            <table className="min-w-full divide-y divide-stone-100">
              <thead>
                <tr className="bg-stone-50">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-widest text-stone-400">
                    Filename
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-widest text-stone-400">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-widest text-stone-400">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-widest text-stone-400">
                    Target
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-widest text-stone-400">
                    Industry
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-widest text-stone-400">
                    Domain
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-widest text-stone-400">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-widest text-stone-400">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-widest text-stone-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {docs.map((doc) => {
                  const latestJob = latestJobsByDocumentId[doc.id];
                  const workflowStatus = latestJob?.status ?? doc.status;
                  const workflowError = latestJob?.error_message ?? doc.error_message;
                  const statusBadgeClass =
                    workflowStatus === "in_review" || workflowStatus === "draft_saved" || workflowStatus === "review_complete" || workflowStatus === "ready_for_export"
                      ? "bg-teal-50 text-[#0D7B6E]"
                      : workflowStatus === "exported"
                        ? "bg-stone-100 text-stone-600"
                        : workflowStatus === "translation_queued" || workflowStatus === "translating" || workflowStatus === "parsing"
                          ? "bg-amber-50 text-amber-700"
                          : workflowStatus === "failed" || workflowStatus === "parse_failed"
                            ? "bg-red-50 text-red-600"
                            : "bg-stone-50 text-stone-500";
                  const statusLabel = workflowStatus
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase());
                  return (
                  <tr key={doc.id} className="hover:bg-stone-50">
                    <td className="px-6 py-4 text-sm font-medium">
                      <Link
                        href={
                          latestJob && REVIEW_STATUSES.has(workflowStatus)
                            ? `/translation-jobs/${latestJob.id}`
                            : TRANSLATION_IN_PROGRESS_STATUSES.has(workflowStatus) || PARSE_IN_PROGRESS_STATUSES.has(workflowStatus)
                              ? `/processing/${doc.id}`
                              : `/documents/${doc.id}`
                        }
                        className="hover:text-[#0D7B6E]"
                        style={{ color: "#1A110A" }}
                      >
                        {doc.filename}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-600">{doc.file_type}</td>
                    <td className="px-6 py-4 text-sm text-stone-600">
                      {getLanguageDisplayName(doc.source_language)}
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-600">
                      {getLanguageDisplayName(doc.target_language)}
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-600">{doc.industry ?? <span className="text-stone-300">—</span>}</td>
                    <td className="px-6 py-4 text-sm text-stone-600">{doc.domain ?? <span className="text-stone-300">—</span>}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium ${statusBadgeClass}`}>
                        {statusLabel}
                      </span>
                      {workflowError && <p className="mt-1 text-xs text-red-600">{workflowError}</p>}
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-600">{formatDate(doc.created_at)}</td>
                    <td className="px-6 py-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleOpenWorkflow(doc)}
                        disabled={openingDocId === doc.id}
                        className={`text-sm hover:underline disabled:opacity-50 ${REVIEW_STATUSES.has(workflowStatus) ? "text-[#0D7B6E]" : "text-stone-600 hover:text-stone-900"}`}
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
                          className="text-sm text-stone-600 hover:text-stone-900 disabled:opacity-50"
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
