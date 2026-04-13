"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthStore } from "../../../stores/authStore";
import { API_URL, overviewApi, translationJobsApi } from "../../../services/api";
import type { OverviewResponse } from "../../../services/api";
import { getLanguageDisplayName } from "../../../utils/language";
import { trackEvent } from "../../../utils/analytics";

type ExportResult = {
  job_id: number;
  status: string;
  export_format: string;
  export_mode: string;
  filename: string;
  download_url: string;
  generated_at: string;
  version: number;
};

function ScoreRing({ score }: { score: number }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 90 ? "#15803D" : score >= 70 ? "#B45309" : "#B91C1C";
  return (
    <svg width="140" height="140" viewBox="0 0 120 120" className="mx-auto">
      <circle cx="60" cy="60" r={r} fill="none" stroke="#E5E0D8" strokeWidth="8" />
      <circle
        cx="60" cy="60" r={r} fill="none"
        stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        transform="rotate(-90 60 60)"
        className="transition-all duration-700"
      />
      <text x="60" y="55" textAnchor="middle" className="fill-brand-text font-display text-3xl font-bold">
        {score}%
      </text>
      <text x="60" y="72" textAnchor="middle" className="fill-brand-muted text-[10px]">
        quality
      </text>
    </svg>
  );
}

function VerdictTag({ score }: { score: number }) {
  if (score >= 90) return <span className="rounded-full bg-status-successBg px-3 py-1 text-xs font-medium text-status-success">Excellent — ready to use</span>;
  if (score >= 70) return <span className="rounded-full bg-status-warningBg px-3 py-1 text-xs font-medium text-status-warning">Good — review recommended</span>;
  return <span className="rounded-full bg-status-errorBg px-3 py-1 text-xs font-medium text-status-error">Needs attention</span>;
}

export default function OverviewPage() {
  const params = useParams();
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const jobId = Number(params.jobId);

  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    if (hasHydrated && !token) router.replace("/login");
  }, [hasHydrated, token, router]);

  useEffect(() => {
    if (!token || Number.isNaN(jobId)) return;
    overviewApi
      .get(jobId)
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load overview"))
      .finally(() => setLoading(false));
  }, [jobId, token]);

  async function triggerExport(approveAll: boolean) {
    setExporting(true);
    setError("");
    try {
      // Skip approve+markReady if already exported — go straight to re-export
      const isAlreadyExported = data?.status === "exported" || data?.status === "ready_for_export";
      if (!isAlreadyExported) {
        if (approveAll) {
          await translationJobsApi.approveAllSegments<unknown>(jobId);
        } else {
          await translationJobsApi.approveSafeSegments<unknown>(jobId);
        }
        await translationJobsApi.markReady<unknown>(jobId);
      }
      const result = await translationJobsApi.export<ExportResult>(jobId, "docx", "preserve_formatting");
      if (result.download_url) {
        const { useAuthStore } = await import("../../../stores/authStore");
        const authToken = useAuthStore.getState().token;
        const headers: Record<string, string> = authToken ? { Authorization: `Bearer ${authToken}` } : {};
        const res = await fetch(`${API_URL}${result.download_url}`, { headers });
        if (!res.ok) throw new Error(`Download failed (${res.status})`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.filename ?? "export.docx";
        a.click();
        URL.revokeObjectURL(url);
      }
      setDownloaded(true);
      trackEvent("flow.download_complete", { quality_score: data?.summary.quality_score, has_issues: (data?.summary.issue_count ?? 0) > 0, review_mode: data?.review_mode });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  if (!hasHydrated || !token) return null;
  if (loading) return <div className="min-h-screen bg-brand-bg pt-20 px-6 text-brand-muted">Loading…</div>;
  if (error && !data) return <div className="min-h-screen bg-brand-bg pt-20 px-6 text-status-error">{error}</div>;
  if (!data) return <div className="min-h-screen bg-brand-bg pt-20 px-6 text-status-error">Not found</div>;

  const { summary } = data;
  const hasIssues = summary.issue_count > 0;
  const isExported = data.status === "exported";
  const reviewMode = data.review_mode ?? "autopilot";
  const toneLabel = (data.tone_applied ?? "natural").charAt(0).toUpperCase() + (data.tone_applied ?? "natural").slice(1);
  const memoryPercent = summary.total_blocks > 0
    ? Math.round((summary.memory_reuse_count / summary.total_blocks) * 100)
    : 0;
  const formattedDate = data.created_at
    ? new Date(data.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div>
      {/* Job Context Sub-header */}
      <header className="flex items-center border-b border-brand-border bg-brand-surface px-6 py-2">
        <div className="flex items-center gap-2">
          <span className="max-w-[240px] truncate font-display font-semibold text-brand-text">
            {data.document_name}
          </span>
          <span className="rounded-full bg-brand-accentMid px-2.5 py-0.5 text-[0.6875rem] font-medium text-brand-accent">
            {getLanguageDisplayName(data.source_language)} → {getLanguageDisplayName(data.target_language)}
          </span>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1100px] flex-col gap-8 px-8 py-10 lg:flex-row">
        {/* ── Left column ── */}
        <div className="min-w-0 flex-[3] space-y-6">
          {/* Score hero */}
          <div className="rounded-xl border border-brand-border bg-brand-surface p-8 text-center">
            <ScoreRing score={summary.quality_score} />
            <div className="mt-4">
              <VerdictTag score={summary.quality_score} />
              <p className="mt-1 text-xs italic text-brand-muted">
                {summary.quality_score >= 90
                  ? "Above average for this document type"
                  : summary.quality_score >= 70
                    ? "Good result — a few blocks need attention"
                    : "Review recommended before exporting"}
              </p>
            </div>
          </div>

          {/* Here's what Helvara did */}
          <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
            <h3 className="font-display text-xl font-semibold text-brand-text">
              Here&apos;s what Helvara did
            </h3>
            <p className="mb-6 mt-1 text-sm text-brand-muted">
              Your document was translated, verified against your glossary, and checked for ambiguity — automatically.
            </p>
            <div className="space-y-3">
              {summary.memory_reuse_count > 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-brand-accent/30 bg-brand-accentMid/30 p-3 border-l-4 border-l-brand-accent">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-brand-border bg-brand-bg text-base">
                    🧠
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-brand-text">Translation memory applied</p>
                    <p className="text-xs text-brand-muted">{memoryPercent}% of blocks matched previous approved translations</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-brand-accentMid px-2.5 py-0.5 text-xs font-medium text-brand-accent">
                    {memoryPercent}%
                  </span>
                </div>
              )}
              {summary.glossary_match_count > 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-brand-border bg-brand-surface p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-brand-border bg-brand-bg text-base">
                    📖
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-brand-text">{summary.glossary_match_count} glossary terms enforced</p>
                    <p className="text-xs text-brand-muted">Your glossary was applied consistently across all blocks</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-brand-bg px-2.5 py-0.5 text-xs font-medium text-brand-muted">
                    {summary.glossary_match_count} terms
                  </span>
                </div>
              )}
              {summary.issue_count === 0 ? (
                <div className="flex items-center gap-3 rounded-lg border border-brand-border bg-brand-surface p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-brand-border bg-brand-bg text-sm font-bold text-status-success">
                    ✓
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-brand-text">No ambiguities detected</p>
                    <p className="text-xs text-brand-muted">All blocks translated cleanly</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border border-status-warning/30 bg-status-warningBg p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-status-warning/30 bg-status-warningBg text-base">
                    ⚠
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-status-warning">{summary.issue_count} blocks need attention</p>
                    <p className="text-xs text-brand-muted">Some terms have multiple valid translations — review recommended</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-status-warningBg px-2.5 py-0.5 text-xs font-medium text-status-warning">
                    {summary.issue_count}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3 rounded-lg border border-brand-border bg-brand-surface p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-brand-border bg-brand-bg text-sm font-medium text-brand-muted">
                  Aa
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-brand-text">{toneLabel} register maintained</p>
                  <p className="text-xs text-brand-muted">Tone and formality consistent throughout</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="w-full space-y-6 lg:w-80 lg:shrink-0">
          {/* Action hub / Post-download confirmation */}
          {(downloaded || isExported) ? (
            <div className="rounded-xl border border-status-success/30 bg-status-successBg p-6">
              <div className="mb-3 text-center text-3xl">✅</div>
              <h3 className="text-center font-display text-lg font-semibold text-brand-text">
                Your translation is ready
              </h3>
              <p className="mt-2 text-center text-xs text-brand-muted">
                {data.document_name} has been downloaded. {summary.total_blocks} blocks translated with {summary.quality_score}% quality score.
              </p>
              <div className="mt-5 space-y-2.5">
                <button
                  type="button"
                  onClick={() => triggerExport(false)}
                  disabled={exporting}
                  className="w-full rounded-full border border-brand-border bg-brand-surface py-2.5 text-center text-sm font-medium text-brand-text hover:bg-brand-bg disabled:opacity-50"
                >
                  {exporting ? "Exporting…" : "Download again"}
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/translation-jobs/${jobId}`)}
                  className="w-full rounded-full bg-brand-accent py-2.5 text-center text-sm font-medium text-white hover:bg-brand-accentHov"
                >
                  Review translation
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
              <h3 className="text-sm font-semibold text-brand-text">
                {hasIssues ? "Review Required" : reviewMode === "manual" ? "Manual Review" : "Ready to Export"}
              </h3>
              <p className="mt-1 text-xs text-brand-muted">
                {hasIssues
                  ? `${summary.issue_count} ${summary.issue_count === 1 ? "block needs" : "blocks need"} attention before export.`
                  : reviewMode === "manual"
                    ? "Review each block before exporting."
                    : "Your translation is ready. Download or review."}
              </p>
              <div className="mt-5 space-y-2.5">
                {reviewMode === "autopilot" && !hasIssues && (
                  <>
                    <button
                      type="button"
                      onClick={() => triggerExport(false)}
                      disabled={exporting}
                      className="w-full rounded-full bg-brand-accent py-2.5 text-center text-sm font-medium text-white hover:bg-brand-accentHov disabled:opacity-50"
                    >
                      {exporting ? "Exporting…" : "Download Translation"}
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push(`/translation-jobs/${jobId}`)}
                      className="w-full rounded-full py-2.5 text-center text-sm font-medium text-brand-muted hover:text-brand-text"
                    >
                      Switch to full review
                    </button>
                  </>
                )}
                {reviewMode === "autopilot" && hasIssues && (
                  <>
                    <button
                      type="button"
                      onClick={() => router.push(`/translation-jobs/${jobId}`)}
                      className="w-full rounded-full bg-brand-accent py-2.5 text-center text-sm font-medium text-white hover:bg-brand-accentHov"
                    >
                      Review {summary.issue_count} {summary.issue_count === 1 ? "issue" : "issues"}
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerExport(true)}
                      disabled={exporting}
                      className="w-full rounded-full border border-brand-border bg-brand-surface py-2.5 text-center text-sm font-medium text-brand-muted hover:bg-brand-bg disabled:opacity-50"
                    >
                      {exporting ? "Exporting…" : "Download anyway"}
                    </button>
                  </>
                )}
                {reviewMode === "manual" && (
                  <button
                    type="button"
                    onClick={() => router.push(`/translation-jobs/${jobId}`)}
                    className="w-full rounded-full bg-brand-accent py-2.5 text-center text-sm font-medium text-white hover:bg-brand-accentHov"
                  >
                    Start Review
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-subtle">Details</h3>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-brand-muted">Tone applied</dt>
                <dd className="font-medium text-brand-text">{toneLabel}</dd>
              </div>
              {memoryPercent > 0 && (
                <div className="flex justify-between">
                  <dt className="text-brand-muted">Memory match</dt>
                  <dd className="font-medium text-brand-text">{memoryPercent}%</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-brand-muted">Review priority</dt>
                <dd className="font-medium text-brand-text">
                  {summary.issue_count === 0 ? "None" : summary.issue_count <= 2 ? "Low" : summary.issue_count <= 5 ? "Medium" : "High"}
                </dd>
              </div>
              {summary.glossary_match_count > 0 && (
                <div className="flex justify-between">
                  <dt className="text-brand-muted">Glossary terms</dt>
                  <dd className="font-medium text-brand-text">{summary.glossary_match_count}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2 px-1 text-xs text-brand-subtle">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-accent opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-accent" />
            </span>
            <span>Translated by Helvara{formattedDate ? ` · ${formattedDate}` : ""}</span>
          </div>

          {error && <p className="text-sm text-status-error">{error}</p>}
        </div>
      </div>
    </div>
  );
}
