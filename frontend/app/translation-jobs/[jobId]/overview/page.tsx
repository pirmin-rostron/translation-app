"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthStore } from "../../../stores/authStore";
import { overviewApi } from "../../../services/api";
import type { OverviewResponse } from "../../../services/api";
import { TierGate } from "../../../components/TierGate";
import { getLanguageDisplayName } from "../../../utils/language";

export default function OverviewPage() {
  const params = useParams();
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const jobId = Number(params.jobId);

  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMode, setSelectedMode] = useState<"autopilot" | "manual">("autopilot");
  const [modeLoading, setModeLoading] = useState(false);

  useEffect(() => {
    if (hasHydrated && !token) router.replace("/login");
  }, [hasHydrated, token, router]);

  useEffect(() => {
    if (!token || Number.isNaN(jobId)) return;
    overviewApi
      .get(jobId)
      .then((res) => {
        setData(res);
        setSelectedMode((res.review_mode as "autopilot" | "manual") ?? "autopilot");
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
      // Revert on failure
      setSelectedMode(selectedMode);
    } finally {
      setModeLoading(false);
    }
  }

  if (!hasHydrated || !token) return null;
  if (loading) return <div className="min-h-screen bg-brand-bg pt-20 px-6">Loading…</div>;
  if (error) return <div className="min-h-screen bg-brand-bg pt-20 px-6 text-status-error">{error}</div>;
  if (!data) return <div className="min-h-screen bg-brand-bg pt-20 px-6 text-status-error">Not found</div>;

  const { summary } = data;
  const hasIssues = summary.issue_count > 0;

  return (
    <div className="min-h-screen bg-brand-bg">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-14 items-center border-b border-brand-border bg-brand-surface px-6">
        <Link href="/dashboard" className="text-brand-subtle hover:text-brand-text no-underline">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 12L6 8l4-4" /></svg>
        </Link>
        <span className="ml-3 max-w-[240px] truncate text-sm font-medium text-brand-text">
          {data.document_name}
        </span>
        <span className="ml-4 rounded-full bg-brand-accentMid px-3 py-1 text-xs font-medium text-brand-accent">
          {getLanguageDisplayName(data.source_language)} → {getLanguageDisplayName(data.target_language)}
        </span>
      </header>

      <div className="mx-auto flex max-w-[1200px] gap-8 px-8 py-10">
        {/* Left column — document preview */}
        <div className="flex-[3] min-w-0">
          <h2 className="mb-6 font-display text-2xl font-bold text-brand-text">Translation Overview</h2>

          <div className="space-y-4">
            {data.blocks_preview.map((block, i) => (
              <div
                key={i}
                className={`rounded-lg border p-5 ${
                  block.has_issue
                    ? "border-status-warning/30 bg-status-warningBg"
                    : "border-brand-border bg-brand-surface"
                }`}
              >
                <p className="text-xs font-bold uppercase tracking-widest text-brand-subtle">Block {i + 1}</p>
                <p className="mt-2 text-sm leading-relaxed text-brand-text">{block.translated_text || "—"}</p>
                {block.has_issue && (
                  <span className="mt-2 inline-block rounded-full bg-status-warning/10 px-2.5 py-0.5 text-xs font-medium text-status-warning">
                    Needs review
                  </span>
                )}
              </div>
            ))}
            {summary.total_blocks > 3 && (
              <p className="text-center text-xs text-brand-subtle">
                + {summary.total_blocks - 3} more blocks
              </p>
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
                onClick={() => router.push(`/translation-jobs/${jobId}`)}
                className="w-full rounded-full bg-brand-accent py-3 text-center text-sm font-medium text-white hover:bg-brand-accentHov"
              >
                Download Translation
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
                  onClick={() => router.push(`/translation-jobs/${jobId}`)}
                  className="w-full rounded-full border border-brand-border bg-brand-surface py-3 text-center text-sm font-medium text-brand-muted hover:bg-brand-bg"
                >
                  Download anyway
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
        </div>
      </div>
    </div>
  );
}
