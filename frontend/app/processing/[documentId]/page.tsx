"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type DocumentRecord = {
  id: number;
  filename: string;
  status: string;
  error_message?: string | null;
};

type TranslationJob = {
  id: number;
  status: string;
  error_message?: string | null;
};

type DocumentProgress = {
  stage_label: string;
  percentage: number;
  eta_seconds: number | null;
  is_complete: boolean;
  is_active: boolean;
};

type TranslationProgress = {
  stage_label: string;
  percentage: number;
  total_segments: number;
  completed_segments: number;
  eta_seconds: number | null;
  is_complete: boolean;
};

function formatEta(seconds: number | null) {
  if (seconds == null) return "Calculating…";
  if (seconds <= 0) return "Almost done";
  if (seconds < 60) return `~${seconds}s remaining`;
  return `~${Math.ceil(seconds / 60)}m remaining`;
}

export default function ProcessingPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = Number(params.documentId);

  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [jobs, setJobs] = useState<TranslationJob[]>([]);
  const [docProgress, setDocProgress] = useState<DocumentProgress | null>(null);
  const [translationProgress, setTranslationProgress] = useState<TranslationProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const latestJob = jobs[0] ?? null;
  const reviewReadyStatuses = new Set(["in_review", "draft_saved", "ready_for_export", "exported"]);

  const loadState = useCallback(async () => {
    if (Number.isNaN(documentId)) {
      setError("Invalid document ID");
      setLoading(false);
      return;
    }

    try {
      const [docRes, jobsRes, docProgressRes] = await Promise.all([
        fetch(`${API_URL}/api/documents/${documentId}`),
        fetch(`${API_URL}/api/documents/${documentId}/translation-jobs`),
        fetch(`${API_URL}/api/documents/${documentId}/progress`),
      ]);

      if (!docRes.ok) throw new Error(`Failed to load document (${docRes.status})`);
      const nextDoc = (await docRes.json()) as DocumentRecord;
      const nextJobs = jobsRes.ok ? ((await jobsRes.json()) as TranslationJob[]) : [];
      const nextDocProgress = docProgressRes.ok ? ((await docProgressRes.json()) as DocumentProgress) : null;

      setDoc(nextDoc);
      setJobs(nextJobs);
      setDocProgress(nextDocProgress);

      if (nextJobs.length > 0) {
        const progressRes = await fetch(`${API_URL}/api/translation-jobs/${nextJobs[0].id}/progress`);
        setTranslationProgress(progressRes.ok ? ((await progressRes.json()) as TranslationProgress) : null);
      } else {
        setTranslationProgress(null);
      }

      if (nextJobs.length > 0 && reviewReadyStatuses.has(nextJobs[0].status)) {
        router.replace(`/translation-jobs/${nextJobs[0].id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load processing state");
    } finally {
      setLoading(false);
    }
  }, [documentId, router]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const shouldPoll = useMemo(() => {
    if (!doc) return true;
    if (doc.status === "failed") return false;
    if (latestJob?.status === "failed") return false;
    if (latestJob && reviewReadyStatuses.has(latestJob.status)) return false;
    return true;
  }, [doc, latestJob]);

  useEffect(() => {
    if (!shouldPoll) return;
    const timer = window.setInterval(() => {
      loadState();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [loadState, shouldPoll]);

  const handleRetryDocument = async () => {
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/documents/${documentId}/retry`, { method: "POST" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.detail || "Failed to retry document processing");
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to retry document processing");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetryTranslation = async () => {
    if (!latestJob) return;
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/translation-jobs/${latestJob.id}/retry`, { method: "POST" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.detail || "Failed to retry translation");
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to retry translation");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-50 p-6">Preparing translation pipeline…</div>;
  if (!doc) return <div className="min-h-screen bg-slate-50 p-6 text-red-600">Document not found.</div>;

  const uploadDone = true;
  const parsingDone = ["parsed", "segmented", "translation_queued", "translating", "translated", "in_review", "draft_saved", "ready_for_export", "exported"].includes(doc.status);
  const translationStarted = Boolean(latestJob);
  const translationDone = Boolean(latestJob && reviewReadyStatuses.has(latestJob.status));

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-bold text-slate-900">Preparing your review workspace</h1>
        <p className="mt-1 text-sm text-slate-600">
          {doc.filename} - We are running upload, parsing, translation, and review preparation automatically.
        </p>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <ol className="space-y-4">
            <li className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-900">Uploading</p>
                <p className="text-xs text-slate-600">File is received and validated.</p>
              </div>
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${uploadDone ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{uploadDone ? "Done" : "Pending"}</span>
            </li>
            <li className="flex items-start justify-between gap-3">
              <div className="w-full">
                <p className="text-sm font-medium text-slate-900">Parsing document</p>
                <p className="text-xs text-slate-600">{docProgress?.stage_label ?? "Waiting to start parsing"}</p>
                {docProgress?.is_active && (
                  <div className="mt-2">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-indigo-100">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(0, Math.min(100, docProgress.percentage))}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {docProgress.percentage.toFixed(0)}% - {formatEta(docProgress.eta_seconds)}
                    </p>
                  </div>
                )}
              </div>
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${parsingDone ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{parsingDone ? "Done" : "Running"}</span>
            </li>
            <li className="flex items-start justify-between gap-3">
              <div className="w-full">
                <p className="text-sm font-medium text-slate-900">Translating document</p>
                <p className="text-xs text-slate-600">
                  {translationProgress
                    ? `${translationProgress.stage_label} (${translationProgress.completed_segments}/${translationProgress.total_segments})`
                    : translationStarted
                      ? "Translation is starting"
                      : "Waiting for parsing to finish"}
                </p>
                {translationProgress && !translationProgress.is_complete && (
                  <div className="mt-2">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-100">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${Math.max(0, Math.min(100, translationProgress.percentage))}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {translationProgress.percentage.toFixed(0)}% - {formatEta(translationProgress.eta_seconds)}
                    </p>
                  </div>
                )}
              </div>
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  translationDone ? "bg-emerald-100 text-emerald-700" : translationStarted ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"
                }`}
              >
                {translationDone ? "Done" : translationStarted ? "Running" : "Pending"}
              </span>
            </li>
            <li className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-900">Preparing review</p>
                <p className="text-xs text-slate-600">You will be redirected automatically when review is ready.</p>
              </div>
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${translationDone ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{translationDone ? "Done" : "Waiting"}</span>
            </li>
          </ol>

          {(doc.status === "failed" || latestJob?.status === "failed") && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-700">Processing failed</p>
              <p className="mt-1 text-xs text-red-600">{latestJob?.error_message || doc.error_message || "An error occurred while processing this document."}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {doc.status === "failed" && (
                  <button
                    type="button"
                    onClick={handleRetryDocument}
                    disabled={actionLoading}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    Retry parsing
                  </button>
                )}
                {latestJob?.status === "failed" && (
                  <button
                    type="button"
                    onClick={handleRetryTranslation}
                    disabled={actionLoading}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    Retry translation
                  </button>
                )}
              </div>
            </div>
          )}

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </section>

        <div className="mt-4">
          <Link href={`/documents/${documentId}`} className="text-sm text-slate-600 underline hover:text-slate-900">
            Open advanced document controls
          </Link>
        </div>
      </main>
    </div>
  );
}

