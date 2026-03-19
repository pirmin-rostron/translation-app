"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { documentsApi, translationJobsApi } from "../../services/api";
const INTRO_UPLOAD_MS = 1500;
const INTRO_PARSE_MS = 1500;
const INTRO_TOTAL_MS = INTRO_UPLOAD_MS + INTRO_PARSE_MS;

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

function isTranslationEtaReliable(progress: TranslationProgress | null) {
  if (!progress || progress.eta_seconds == null) return false;
  if (progress.eta_seconds <= 0) return false;
  if (progress.total_segments <= 0) return false;
  // Gate ETA until translation has enough signal to avoid misleading early estimates.
  const completionRatio = progress.completed_segments / progress.total_segments;
  if (progress.completed_segments < 2) return false;
  if (completionRatio < 0.12) return false;
  if (progress.percentage < 15) return false;
  return true;
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
  const [introPhase, setIntroPhase] = useState<"idle" | "upload" | "parse" | "done">("idle");
  const [introStartTime, setIntroStartTime] = useState<number | null>(null);
  const introPlayedRef = useRef(false);

  const latestJob = jobs[0] ?? null;
  const reviewReadyStatuses = new Set(["in_review", "draft_saved", "review_complete", "ready_for_export", "exported"]);

  const loadState = useCallback(async () => {
    if (Number.isNaN(documentId)) {
      setError("Invalid document ID");
      setLoading(false);
      return;
    }

    try {
      const [nextDoc, nextJobs, nextDocProgress] = await Promise.all([
        documentsApi.getById<DocumentRecord>(documentId),
        documentsApi.getTranslationJobs<TranslationJob[]>(documentId).catch(() => [] as TranslationJob[]),
        documentsApi.getProgress<DocumentProgress>(documentId).catch(() => null),
      ]);

      setDoc(nextDoc);
      setJobs(nextJobs);
      setDocProgress(nextDocProgress);

      if (nextJobs.length > 0) {
        const progress = await translationJobsApi.getProgress<TranslationProgress>(nextJobs[0].id).catch(() => null);
        setTranslationProgress(progress);
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
      await documentsApi.retry<unknown>(documentId);
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
      await translationJobsApi.retry<unknown>(latestJob.id);
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
  const translationMeaningfulProgress = Boolean(
    translationProgress &&
      (translationProgress.completed_segments > 0 || translationProgress.percentage >= 12)
  );
  const shouldRunIntro =
    !introPlayedRef.current &&
    !hasFailure &&
    !translationDone &&
    docStatus === "parsed" &&
    !docProgress?.is_active &&
    !translationMeaningfulProgress;

  useEffect(() => {
    introPlayedRef.current = false;
    setIntroPhase("idle");
    setIntroStartTime(null);
  }, [documentId]);

  useEffect(() => {
    if (hasFailure && introStartTime !== null) {
      // Failures always break out of intro immediately.
      setIntroStartTime(null);
      setIntroPhase("done");
      return;
    }
    if (shouldRunIntro && introStartTime === null && introPhase === "idle") {
      introPlayedRef.current = true;
      setIntroStartTime(Date.now());
      setIntroPhase("upload");
    }
  }, [hasFailure, introPhase, introStartTime, shouldRunIntro]);

  useEffect(() => {
    if (introStartTime === null) return;
    const parseTimer = window.setTimeout(() => setIntroPhase("parse"), INTRO_UPLOAD_MS);
    const doneTimer = window.setTimeout(() => {
      setIntroPhase("done");
      setIntroStartTime(null);
    }, INTRO_TOTAL_MS);
    return () => {
      window.clearTimeout(parseTimer);
      window.clearTimeout(doneTimer);
    };
  }, [introStartTime]);

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

  const introActive = introStartTime !== null && (introPhase === "upload" || introPhase === "parse");
  const introSteps: { title: string; subtitle: string; status: PipelineStepStatus }[] = [
    {
      title: "Upload",
      subtitle: introPhase === "upload" ? "In progress" : "Done",
      status: introPhase === "upload" ? "current" : "complete",
    },
    {
      title: "Parse",
      subtitle: introPhase === "parse" ? "In progress" : "Waiting",
      status: introPhase === "parse" ? "current" : "upcoming",
    },
    {
      title: "Translate",
      subtitle: "Waiting",
      status: "upcoming",
    },
    {
      title: "Review ready",
      subtitle: "Waiting",
      status: "upcoming",
    },
  ];

  const realSteps: { title: string; subtitle: string; status: PipelineStepStatus }[] = [
    {
      title: "Upload",
      subtitle: "Done",
      status: "complete",
    },
    {
      title: "Parse",
      subtitle: parseFailed ? "Failed" : parsingDone ? "Done" : "In progress",
      status: parseFailed ? "failed" : parsingDone ? "complete" : currentStep === 1 ? "current" : "upcoming",
    },
    {
      title: "Translate",
      subtitle: translationFailed
        ? "Failed"
        : translationDone
          ? "Done"
          : translationStarted
            ? "In progress"
            : "Waiting",
      status: translationFailed ? "failed" : translationDone ? "complete" : currentStep === 2 ? "current" : "upcoming",
    },
    {
      title: "Review ready",
      subtitle: translationDone ? "Ready" : "Waiting",
      status: translationDone ? "complete" : currentStep === 3 ? "current" : "upcoming",
    },
  ];
  const steps = introActive ? introSteps : realSteps;

  const currentStatusHeading = introPhase === "upload"
    ? "Uploading your document"
    : introPhase === "parse"
      ? "Parsing your document"
      : hasFailure
    ? parseFailed
      ? "Parsing needs attention"
      : "Translation needs attention"
    : translationDone
      ? "Review ready"
      : translationProgress
        ? "Translating your document"
        : docProgress?.is_active
          ? "Parsing your document"
          : "Uploading your document";

  const currentStatusSupport = introPhase === "upload"
    ? "Preparing your file for translation."
    : introPhase === "parse"
      ? "Extracting content so translation can begin."
      : hasFailure
    ? "Please retry the failed step to continue."
    : translationDone
      ? "Your document is ready for review."
      : translationProgress
        ? `Translating document… • ${
            isTranslationEtaReliable(translationProgress)
              ? formatEta(translationProgress.eta_seconds)
              : "Calculating remaining time…"
          }`
        : docProgress?.is_active
          ? `${docProgress.stage_label} • ${
              docProgress.eta_seconds == null ? "Calculating remaining time" : formatEta(docProgress.eta_seconds)
            }`
          : "This usually takes a minute or two. You can stay on this page.";
  const displayProgress = introPhase === "upload" ? 0 : introPhase === "parse" ? 16 : overallProgress;

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
          <p className="text-lg font-semibold text-slate-900">{currentStatusHeading}</p>
          <p className="mt-1 text-sm text-slate-600">{currentStatusSupport}</p>

          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full transition-all ${hasFailure ? "bg-amber-500" : "bg-indigo-600"}`}
                style={{ width: `${Math.max(0, Math.min(100, displayProgress))}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-600">{displayProgress}% complete</p>
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

