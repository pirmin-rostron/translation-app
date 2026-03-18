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

type PipelineStepStatus = "complete" | "current" | "upcoming" | "failed";

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
  const reviewReadyStatuses = new Set(["in_review", "draft_saved", "review_complete", "ready_for_export", "exported"]);

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
    if (doc.status === "parse_failed") return false;
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

  const docStatus = doc?.status ?? "uploaded";
  const uploadDone = true;
  const parsingDone = docStatus === "parsed";
  const translationStarted = Boolean(latestJob);
  const translationDone = Boolean(latestJob && reviewReadyStatuses.has(latestJob.status));
  const parseFailed = docStatus === "parse_failed";
  const translationFailed = latestJob?.status === "failed";
  const hasFailure = parseFailed || translationFailed;

  const parseProgressValue = parsingDone ? 100 : docProgress?.is_active ? Math.max(0, Math.min(100, docProgress.percentage)) : 0;
  const translationProgressValue = translationDone
    ? 100
    : translationProgress
      ? Math.max(0, Math.min(100, translationProgress.percentage))
      : translationStarted
        ? 10
        : 0;
  const reviewProgressValue = translationDone ? 100 : 0;
  const overallProgress = Math.round((100 * 10 + parseProgressValue * 30 + translationProgressValue * 50 + reviewProgressValue * 10) / 100);

  let currentStep = 0;
  if (hasFailure) currentStep = parseFailed ? 1 : 2;
  else if (translationDone) currentStep = 3;
  else if (translationStarted) currentStep = 2;
  else if (docProgress?.is_active || parsingDone) currentStep = 1;

  const steps: { title: string; subtitle: string; status: PipelineStepStatus }[] = [
    {
      title: "Upload",
      subtitle: "Uploading document",
      status: "complete",
    },
    {
      title: "Parse",
      subtitle: parseFailed ? "Could not extract content" : parsingDone ? "Content extracted" : "Extracting content",
      status: parseFailed ? "failed" : parsingDone ? "complete" : currentStep === 1 ? "current" : "upcoming",
    },
    {
      title: "Translate",
      subtitle: translationFailed
        ? "Could not finish translation"
        : translationDone
          ? "Translation completed"
          : translationProgress
            ? `Translating ${translationProgress.completed_segments} of ${translationProgress.total_segments} segments`
            : translationStarted
              ? "Starting translation"
              : "Waiting for parsing to finish",
      status: translationFailed ? "failed" : translationDone ? "complete" : currentStep === 2 ? "current" : "upcoming",
    },
    {
      title: "Review ready",
      subtitle: translationDone ? "Your document is ready for review" : "Preparing review",
      status: translationDone ? "complete" : currentStep === 3 ? "current" : "upcoming",
    },
  ];

  const currentStatusText = hasFailure
    ? parseFailed
      ? "We could not finish extracting content."
      : "We could not finish translating your document."
    : translationDone
      ? "Review ready"
      : translationProgress
        ? `Translating ${translationProgress.completed_segments} of ${translationProgress.total_segments} segments`
        : docProgress?.is_active
          ? "Extracting content"
          : "Uploading document";

  useEffect(() => {
    if (!translationDone || !latestJob) return;
    const timer = window.setTimeout(() => {
      router.replace(`/translation-jobs/${latestJob.id}`);
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [latestJob, router, translationDone]);

  if (loading) return <div className="min-h-screen bg-slate-50 p-6">Preparing translation pipeline...</div>;
  if (!doc) return <div className="min-h-screen bg-slate-50 p-6 text-red-600">Document not found.</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-bold text-slate-900">Preparing your translation review</h1>
        <p className="mt-1 text-sm text-slate-600">{doc.filename}</p>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-900">{currentStatusText}</p>
          <p className="mt-1 text-xs text-slate-600">
            {hasFailure
              ? "Please retry the failed step to continue."
              : translationDone
                ? "Your document is ready for review."
                : "This usually takes a minute or two. You can stay on this page."}
          </p>

          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full transition-all ${hasFailure ? "bg-amber-500" : "bg-indigo-600"}`}
                style={{ width: `${Math.max(0, Math.min(100, overallProgress))}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-600">{overallProgress}% complete</p>
            {!hasFailure && translationProgress && !translationDone && (
              <p className="mt-1 text-xs text-slate-600">
                {translationProgress.stage_label} • {translationProgress.completed_segments}/
                {translationProgress.total_segments} segments • {formatEta(translationProgress.eta_seconds)}
              </p>
            )}
          </div>

          <ol className="mt-5 space-y-3">
            {steps.map((step, index) => (
              <li key={step.title} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    step.status === "complete"
                      ? "bg-emerald-100 text-emerald-700"
                      : step.status === "current"
                        ? "bg-indigo-100 text-indigo-700"
                        : step.status === "failed"
                          ? "bg-red-100 text-red-700"
                          : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {step.status === "complete" ? "✓" : index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${step.status === "upcoming" ? "text-slate-500" : "text-slate-900"}`}>
                    {step.title}
                  </p>
                  <p className={`text-xs ${step.status === "upcoming" ? "text-slate-400" : "text-slate-600"}`}>{step.subtitle}</p>
                </div>
              </li>
            ))}
          </ol>

          {translationDone && latestJob && (
            <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-medium text-emerald-800">Your document is ready for review.</p>
              <p className="mt-1 text-xs text-emerald-700">Opening review automatically…</p>
              <button
                type="button"
                onClick={() => router.replace(`/translation-jobs/${latestJob.id}`)}
                className="mt-3 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500"
              >
                Open review now
              </button>
            </div>
          )}

          {hasFailure && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-700">
                {parseFailed ? "Parsing could not be completed" : "Translation could not be completed"}
              </p>
              <p className="mt-1 text-xs text-red-600">
                {latestJob?.error_message || doc.error_message || "Please retry to continue your workflow."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {parseFailed && (
                  <button
                    type="button"
                    onClick={handleRetryDocument}
                    disabled={actionLoading}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    Retry this step
                  </button>
                )}
                {translationFailed && (
                  <button
                    type="button"
                    onClick={handleRetryTranslation}
                    disabled={actionLoading}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    Retry this step
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

