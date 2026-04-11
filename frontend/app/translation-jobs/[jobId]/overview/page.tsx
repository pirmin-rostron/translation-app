"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthStore } from "../../../stores/authStore";
import { API_URL, overviewApi, translationJobsApi } from "../../../services/api";
import type { OverviewResponse } from "../../../services/api";
import { TierGate } from "../../../components/TierGate";
import { getLanguageDisplayName } from "../../../utils/language";

type PreviewData = {
  job_id: number;
  document_name: string;
  content_raw: string;
  content_display: string;
};

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

export default function OverviewPage() {
  const params = useParams();
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const jobId = Number(params.jobId);

  const [data, setData] = useState<OverviewResponse | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMode, setSelectedMode] = useState<"autopilot" | "manual">("autopilot");
  const [modeLoading, setModeLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (hasHydrated && !token) router.replace("/login");
  }, [hasHydrated, token, router]);

  useEffect(() => {
    if (!token || Number.isNaN(jobId)) return;
    Promise.all([
      overviewApi.get(jobId),
      translationJobsApi.getPreview<PreviewData>(jobId).catch(() => null),
    ])
      .then(([overviewRes, previewRes]) => {
        setData(overviewRes);
        setPreview(previewRes);
        setSelectedMode((overviewRes.review_mode as "autopilot" | "manual") ?? "autopilot");
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load overview"))
      .finally(() => setLoading(false));
  }, [jobId, token]);

  async function handleModeChange(mode: "autopilot" | "manual") {
    setSelectedMode(mode);
    setModeLoading(true);
    try {
      await overviewApi.setReviewMode(jobId, mode);
    } catch {
      setSelectedMode(selectedMode);
    } finally {
      setModeLoading(false);
    }
  }

  async function triggerExport(approveAll: boolean) {
    setExporting(true);
    setError("");
    try {
      if (approveAll) {
        // "Download anyway" — force-approve ALL segments including ambiguous ones
        await translationJobsApi.approveAllSegments<unknown>(jobId);
      } else {
        // Clean download — only approve safe (non-ambiguous) segments
        await translationJobsApi.approveSafeSegments<unknown>(jobId);
      }
      await translationJobsApi.markReady<unknown>(jobId);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  if (!hasHydrated || !token) return null;
  if (loading) return <div className="min-h-screen bg-brand-bg pt-20 px-6">Loading…</div>;
  if (error && !data) return <div className="min-h-screen bg-brand-bg pt-20 px-6 text-status-error">{error}</div>;
  if (!data) return <div className="min-h-screen bg-brand-bg pt-20 px-6 text-status-error">Not found</div>;

  const { summary } = data;
  const hasIssues = summary.issue_count > 0;

  return (
    <div className="min-h-screen bg-brand-bg">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-14 items-center border-b border-brand-border bg-brand-surface px-6">
        <Link href="/dashboard" className="text-sm text-brand-subtle no-underline hover:text-brand-text">
          ← Dashboard
        </Link>
        <span className="mx-3 text-brand-border">|</span>
        <span className="max-w-[240px] truncate text-sm font-medium text-brand-text">
          {data.document_name}
        </span>
        <span className="ml-4 rounded-full bg-brand-accentMid px-3 py-1 text-xs font-medium text-brand-accent">
          {getLanguageDisplayName(data.source_language)} → {getLanguageDisplayName(data.target_language)}
        </span>
      </header>

      <div className="mx-auto flex max-w-[1200px] gap-8 px-8 py-10">
        {/* Left column — full translated document */}
        <div className="min-w-0 flex-[3]">
          <h2 className="mb-6 font-display text-2xl font-bold text-brand-text">Translation Overview</h2>

          <div className="rounded-xl border border-brand-border bg-brand-surface p-8">
            {preview?.content_display ? (
              <article className="whitespace-pre-wrap text-[15px] leading-7 text-brand-text">
                {preview.content_display}
              </article>
            ) : (
              <p className="text-sm text-brand-muted">Translation preview not available.</p>
            )}
          </div>
        </div>

        {/* Right column — summary + mode + CTA */}
        <div className="w-[340px] shrink-0 space-y-6">
          {/* Quality score */}
          <div className="rounded-xl border border-brand-border bg-brand-surface p-6 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-subtle">Quality Score</p>
            <p className={`mt-2 font-display text-5xl font-bold ${
              summary.quality_score >= 90 ? "text-status-success" : summary.quality_score >= 70 ? "text-status-warning" : "text-status-error"
            }`}>
              {summary.quality_score}%
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-left">
              <div className="rounded-lg bg-brand-bg p-3">
                <p className="text-lg font-semibold text-brand-text">{summary.total_blocks}</p>
                <p className="text-xs text-brand-muted">Blocks</p>
              </div>
              <div className="rounded-lg bg-brand-bg p-3">
                <p className="text-lg font-semibold text-status-warning">{summary.issue_count}</p>
                <p className="text-xs text-brand-muted">Issues</p>
              </div>
              <div className="rounded-lg bg-brand-bg p-3">
                <p className="text-lg font-semibold text-brand-accent">{summary.glossary_match_count}</p>
                <p className="text-xs text-brand-muted">Glossary</p>
              </div>
              <div className="rounded-lg bg-brand-bg p-3">
                <p className="text-lg font-semibold text-status-warning">{summary.ambiguity_count}</p>
                <p className="text-xs text-brand-muted">Ambiguities</p>
              </div>
            </div>
          </div>

          {/* Mode selector */}
          <div className="rounded-xl border border-brand-border bg-brand-surface p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-subtle">Review Mode</p>
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => handleModeChange("autopilot")}
                disabled={modeLoading}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  selectedMode === "autopilot"
                    ? "border-brand-accent bg-brand-accentMid"
                    : "border-brand-border bg-brand-surface hover:bg-brand-bg"
                }`}
              >
                <p className="text-sm font-medium text-brand-text">Autopilot</p>
                <p className="mt-0.5 text-xs text-brand-muted">Export when ready — minimal review</p>
              </button>
              <TierGate
                feature="manual_review"
                tier="pro"
                fallback={
                  <div className="w-full rounded-lg border border-brand-border bg-brand-bg p-3 opacity-60">
                    <p className="text-sm font-medium text-brand-text">Manual review</p>
                    <p className="mt-0.5 text-xs text-brand-muted">Upgrade to Pro to review each block</p>
                  </div>
                }
              >
                <button
                  type="button"
                  onClick={() => handleModeChange("manual")}
                  disabled={modeLoading}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    selectedMode === "manual"
                      ? "border-brand-accent bg-brand-accentMid"
                      : "border-brand-border bg-brand-surface hover:bg-brand-bg"
                  }`}
                >
                  <p className="text-sm font-medium text-brand-text">Manual review</p>
                  <p className="mt-0.5 text-xs text-brand-muted">Review each block before export</p>
                </button>
              </TierGate>
            </div>
          </div>

          {/* CTA */}
          <div className="space-y-3">
            {selectedMode === "autopilot" && !hasIssues && (
              <button
                type="button"
                onClick={() => triggerExport(false)}
                disabled={exporting}
                className="w-full rounded-full bg-brand-accent py-3 text-center text-sm font-medium text-white hover:bg-brand-accentHov disabled:opacity-50"
              >
                {exporting ? "Exporting…" : "Download Translation"}
              </button>
            )}
            {selectedMode === "autopilot" && hasIssues && (
              <>
                <button
                  type="button"
                  onClick={() => router.push(`/translation-jobs/${jobId}`)}
                  className="w-full rounded-full bg-brand-accent py-3 text-center text-sm font-medium text-white hover:bg-brand-accentHov"
                >
                  Review {summary.issue_count} {summary.issue_count === 1 ? "issue" : "issues"}
                </button>
                <button
                  type="button"
                  onClick={() => triggerExport(true)}
                  disabled={exporting}
                  className="w-full rounded-full border border-brand-border bg-brand-surface py-3 text-center text-sm font-medium text-brand-muted hover:bg-brand-bg disabled:opacity-50"
                >
                  {exporting ? "Exporting…" : "Download anyway"}
                </button>
              </>
            )}
            {selectedMode === "manual" && (
              <button
                type="button"
                onClick={() => router.push(`/translation-jobs/${jobId}`)}
                className="w-full rounded-full bg-brand-accent py-3 text-center text-sm font-medium text-white hover:bg-brand-accentHov"
              >
                Start review
              </button>
            )}
          </div>

          {error && (
            <p className="text-sm text-status-error">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
