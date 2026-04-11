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

// ─── Step indicator ────────────────────────────────────────────────────────────

const STEP_CIRCLE: Record<PipelineStepStatus, React.CSSProperties> = {
  complete:  { background: "#082012", color: "#ffffff", width: 24, height: 24, borderRadius: "9999px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", flexShrink: 0 },
  current:   { background: "#f1eee5", color: "#082012", width: 24, height: 24, borderRadius: "9999px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", flexShrink: 0 },
  failed:    { background: "#fde8e8", color: "#ba1a1a", width: 24, height: 24, borderRadius: "9999px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", flexShrink: 0 },
  upcoming:  { background: "#f6f3eb", color: "#424843", opacity: 0.5, width: 24, height: 24, borderRadius: "9999px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", flexShrink: 0 },
};

const wrapper: React.CSSProperties = { minHeight: "100vh", background: "#fcf9f0", paddingTop: "5.5rem" };

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
    router.replace(`/translation-jobs/${latestJob.id}/overview`);
  }, [latestJob, translationDone, translationProgress, router]);

  useEffect(() => {
    if (!translationDone || !latestJob) return;
    const timer = window.setTimeout(() => {
      router.replace(`/translation-jobs/${latestJob.id}/overview`);
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [latestJob, router, translationDone]);

  if (loading) return (
    <div style={wrapper}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "3rem 2rem", fontFamily: "Inter, sans-serif", color: "#424843", opacity: 0.6 }}>
        Preparing translation pipeline...
      </div>
    </div>
  );
  if (!doc) return (
    <div style={wrapper}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "3rem 2rem", fontFamily: "Inter, sans-serif", color: "#ba1a1a" }}>
        Document not found.
      </div>
    </div>
  );

  const pillButton: React.CSSProperties = {
    backgroundColor: "#082012",
    color: "#ffffff",
    border: "none",
    borderRadius: "9999px",
    padding: "0.5rem 1.25rem",
    fontSize: "0.8125rem",
    fontWeight: 600,
    fontFamily: "Inter, sans-serif",
    cursor: "pointer",
    opacity: actionLoading ? 0.6 : 1,
    transition: "opacity 0.15s",
  };

  return (
    <div style={wrapper}>
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "3rem 2rem" }}>

        {/* ── Page header ── */}
        <div style={{ marginBottom: "0.25rem" }}>
          <p style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "0.6875rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            color: "#0D7B6E",
            opacity: 0.7,
            marginBottom: "0.5rem",
          }}>
            Processing
          </p>
          <h1 style={{
            fontFamily: "'Newsreader', Georgia, serif",
            fontSize: "clamp(2rem, 4vw, 2.75rem)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "#082012",
            margin: 0,
          }}>
            Preparing your translation review
          </h1>
          <p style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "0.875rem",
            color: "#424843",
            opacity: 0.65,
            marginTop: "0.25rem",
          }}>
            {doc.filename}
          </p>
        </div>

        {/* ── Status card ── */}
        <div style={{ backgroundColor: "#ffffff", borderRadius: "4px", padding: "2rem", marginTop: "2rem" }}>

          <p style={{
            fontFamily: "'Newsreader', Georgia, serif",
            fontSize: "1.25rem",
            fontWeight: 600,
            color: "#082012",
            margin: 0,
          }}>
            {currentStatusHeading}
          </p>
          <p style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "0.875rem",
            color: "#424843",
            opacity: 0.7,
            marginTop: "0.25rem",
          }}>
            {currentStatusSupport}
          </p>

          {/* ── Progress bar ── */}
          <div style={{ marginTop: "1.5rem" }}>
            <div style={{ background: "#f1eee5", height: 3, borderRadius: "9999px" }}>
              <div
                className="transition-all"
                style={{
                  width: `${Math.max(0, Math.min(100, displayProgress))}%`,
                  height: 3,
                  borderRadius: "9999px",
                  background: hasFailure ? "#d97706" : "#082012",
                }}
              />
            </div>
            <p style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "0.75rem",
              color: "#424843",
              opacity: 0.5,
              marginTop: "0.5rem",
            }}>
              {displayProgress}% complete
            </p>
          </div>

          {/* ── Step list ── */}
          <ol style={{ marginTop: "1.5rem", listStyle: "none", padding: 0, margin: "1.5rem 0 0" }}>
            {steps.map((step, index) => (
              <li key={step.title} style={{ display: "flex", gap: "0.875rem", alignItems: "flex-start", paddingBottom: "1rem" }}>
                <span style={STEP_CIRCLE[step.status]}>
                  {step.status === "complete" ? "✓" : index + 1}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "#1c1c17",
                    opacity: step.status === "upcoming" ? 0.45 : 1,
                    margin: 0,
                  }}>
                    {step.title}
                  </p>
                  <p style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: "0.75rem",
                    color: "#424843",
                    opacity: 0.55,
                    marginTop: "2px",
                    margin: "2px 0 0",
                  }}>
                    {step.subtitle}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          {/* ── Success state ── */}
          {translationDone && latestJob && (
            <div style={{ background: "#f0faf8", borderRadius: "4px", padding: "1.5rem", marginTop: "1.5rem" }}>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.9rem", fontWeight: 600, color: "#082012", margin: 0 }}>
                Your document is ready for review.
              </p>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "#424843", opacity: 0.6, marginTop: "0.25rem" }}>
                Opening review automatically…
              </p>
              <button
                type="button"
                onClick={() => router.replace(`/translation-jobs/${latestJob.id}/overview`)}
                style={{ ...pillButton, marginTop: "0.75rem" }}
              >
                Open review now
              </button>
            </div>
          )}

          {/* ── Failure state ── */}
          {hasFailure && (
            <div style={{ background: "#fff5f5", borderRadius: "4px", padding: "1.5rem", marginTop: "1.5rem" }}>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.9rem", fontWeight: 600, color: "#ba1a1a", margin: 0 }}>
                {parseFailed ? "Parsing could not be completed" : "Translation could not be completed"}
              </p>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.75rem", color: "#ba1a1a", opacity: 0.75, marginTop: "0.25rem" }}>
                {latestJob?.error_message || doc.error_message || "Please retry to continue your workflow."}
              </p>
              <div style={{ marginTop: "0.75rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {parseFailed && (
                  <button
                    type="button"
                    onClick={handleRetryDocument}
                    disabled={actionLoading}
                    style={pillButton}
                  >
                    Retry this step
                  </button>
                )}
                {translationFailed && (
                  <button
                    type="button"
                    onClick={handleRetryTranslation}
                    disabled={actionLoading}
                    style={pillButton}
                  >
                    Retry this step
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Inline error ── */}
          {error && (
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", color: "#ba1a1a", marginTop: "1rem" }}>
              {error}
            </p>
          )}

        </div>
      </main>
    </div>
  );
}
