"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { documentsApi, translationJobsApi } from "../../services/api";

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
  blocks_completed: number;
  blocks_total: number;
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
  const [introPhase, setIntroPhase] = useState<"idle" | "upload" | "parse" | "translate" | "review" | "done">("upload");
  const [hasPlayedIntro, setHasPlayedIntro] = useState(false);

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
  // Play through all four steps (600 ms each) on every mount, regardless of
  // the actual job status. Real state is only revealed after the sequence ends.
  useEffect(() => {
    const t1 = window.setTimeout(() => setIntroPhase("parse"), 600);
    const t2 = window.setTimeout(() => setIntroPhase("translate"), 1200);
    const t3 = window.setTimeout(() => setIntroPhase("review"), 1800);
    const t4 = window.setTimeout(() => {
      setIntroPhase("done");
      setHasPlayedIntro(true);
    }, 2400);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If a failure is confirmed before the intro ends, skip immediately to real state.
  useEffect(() => {
    if (hasFailure && !hasPlayedIntro) {
      setHasPlayedIntro(true);
      setIntroPhase("done");
    }
  }, [hasFailure, hasPlayedIntro]);

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

  const introPhaseIndex = { upload: 0, parse: 1, translate: 2, review: 3, idle: -1, done: -1 }[introPhase];
  const introActive = !hasPlayedIntro;
  const introSteps: { title: string; subtitle: string; status: PipelineStepStatus }[] = [
    {
      title: "Upload",
      subtitle: introPhaseIndex === 0 ? "In progress" : "Done",
      status: introPhaseIndex === 0 ? "current" : "complete",
    },
    {
      title: "Parse",
      subtitle: introPhaseIndex === 1 ? "In progress" : introPhaseIndex > 1 ? "Done" : "Waiting",
      status: introPhaseIndex === 1 ? "current" : introPhaseIndex > 1 ? "complete" : "upcoming",
    },
    {
      title: "Translate",
      subtitle: introPhaseIndex === 2 ? "In progress" : introPhaseIndex > 2 ? "Done" : "Waiting",
      status: introPhaseIndex === 2 ? "current" : introPhaseIndex > 2 ? "complete" : "upcoming",
    },
    {
      title: "Review ready",
      subtitle: introPhaseIndex === 3 ? "In progress" : "Waiting",
      status: introPhaseIndex === 3 ? "current" : "upcoming",
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

  const currentStatusHeading = introActive
    ? introPhase === "upload" ? "Uploading your document"
      : introPhase === "parse" ? "Parsing your document"
      : introPhase === "translate" ? "Translating your document"
      : "Preparing review"
    : hasFailure
      ? parseFailed ? "Parsing needs attention" : "Translation needs attention"
      : translationDone
        ? "Review ready"
        : translationProgress
          ? "Translating your document"
          : docProgress?.is_active
            ? "Parsing your document"
            : "Uploading your document";

  const currentStatusSupport = introActive
    ? introPhase === "upload" ? "Preparing your file for translation."
      : introPhase === "parse" ? "Extracting content so translation can begin."
      : introPhase === "translate" ? "Applying AI translation to each block."
      : "Your document is almost ready."
    : hasFailure
      ? "Please retry the failed step to continue."
      : translationDone
        ? "Your document is ready for review."
        : translationProgress
          ? translationProgress.blocks_completed < 10
            ? `Preparing your first page… • ${isTranslationEtaReliable(translationProgress) ? formatEta(translationProgress.eta_seconds) : "Calculating remaining time…"}`
            : `Translating document… • ${isTranslationEtaReliable(translationProgress) ? formatEta(translationProgress.eta_seconds) : "Calculating remaining time…"}`
          : docProgress?.is_active
            ? `${docProgress.stage_label} • ${docProgress.eta_seconds == null ? "Calculating remaining time" : formatEta(docProgress.eta_seconds)}`
            : "This usually takes a minute or two. You can stay on this page.";

  const displayProgress = introActive
    ? introPhase === "upload" ? 0
      : introPhase === "parse" ? 25
      : introPhase === "translate" ? 60
      : 90
    : overallProgress;

  // Early redirect: as soon as 10 blocks are ready the user can start reviewing,
  // even if translation is still running for the rest of the document.
  useEffect(() => {
    if (!latestJob || translationDone) return;
    if (!translationProgress || translationProgress.blocks_completed < 10) return;
    router.replace(`/translation-jobs/${latestJob.id}?page=1`);
  }, [latestJob, translationDone, translationProgress, router]);

  useEffect(() => {
    if (!translationDone || !latestJob) return;
    const timer = window.setTimeout(() => {
      router.replace(`/translation-jobs/${latestJob.id}?page=1`);
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [latestJob, router, translationDone]);

  if (loading) return <div className="min-h-screen p-6" style={{ backgroundColor: "#F5F2EC" }}>Preparing translation pipeline...</div>;
  if (!doc) return <div className="min-h-screen p-6 text-red-600" style={{ backgroundColor: "#F5F2EC" }}>Document not found.</div>;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5F2EC" }}>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1
          className="text-2xl font-semibold"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1A110A" }}
        >
          Preparing your translation review
        </h1>
        <p className="mt-1 text-sm text-stone-500">{doc.filename}</p>

        <section className="mt-6 border border-stone-200 bg-white p-6">
          <p className="text-lg font-semibold" style={{ color: "#1A110A" }}>{currentStatusHeading}</p>
          <p className="mt-1 text-sm text-stone-500">{currentStatusSupport}</p>

          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden bg-stone-100">
              <div
                className={`h-full transition-all ${hasFailure ? "bg-amber-500" : "bg-[#0D7B6E]"}`}
                style={{ width: `${Math.max(0, Math.min(100, displayProgress))}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-stone-400">{displayProgress}% complete</p>
          </div>

          <ol className="mt-5 space-y-3">
            {steps.map((step, index) => (
              <li key={step.title} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    step.status === "complete"
                      ? "text-white"
                      : step.status === "current"
                        ? "bg-stone-200 text-stone-700"
                        : step.status === "failed"
                          ? "bg-red-100 text-red-700"
                          : "bg-stone-100 text-stone-400"
                  }`}
                  style={step.status === "complete" ? { backgroundColor: "#0D7B6E" } : undefined}
                >
                  {step.status === "complete" ? "✓" : index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-sm font-medium"
                    style={step.status === "upcoming" ? { color: "#78716c" } : { color: "#1A110A" }}
                  >
                    {step.title}
                  </p>
                  <p className={`text-xs ${step.status === "upcoming" ? "text-stone-400" : "text-stone-500"}`}>{step.subtitle}</p>
                </div>
              </li>
            ))}
          </ol>

          {translationDone && latestJob && (
            <div className="mt-5 border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium" style={{ color: "#1A110A" }}>Your document is ready for review.</p>
              <p className="mt-1 text-xs text-stone-500">Opening review automatically…</p>
              <button
                type="button"
                onClick={() => router.replace(`/translation-jobs/${latestJob.id}`)}
                className="mt-3 rounded-full px-3 py-2 text-xs font-medium text-white"
                style={{ backgroundColor: "#0D7B6E" }}
              >
                Open review now
              </button>
            </div>
          )}

          {hasFailure && (
            <div className="mt-5 border border-red-200 bg-red-50 p-4">
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
                    className="rounded-full px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
                    style={{ backgroundColor: "#0D7B6E" }}
                  >
                    Retry this step
                  </button>
                )}
                {translationFailed && (
                  <button
                    type="button"
                    onClick={handleRetryTranslation}
                    disabled={actionLoading}
                    className="rounded-full px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
                    style={{ backgroundColor: "#0D7B6E" }}
                  >
                    Retry this step
                  </button>
                )}
              </div>
            </div>
          )}

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </section>

      </main>
    </div>
  );
}

