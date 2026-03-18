"use client";

import type { RefObject } from "react";

type ExportMode = "clean_text" | "preserve_formatting";

type ExportHistoryItem = {
  filename: string;
  generated_at: string;
  version: number;
};

type TranslationProgress = {
  stage_label: string;
  total_segments: number;
  completed_segments: number;
  eta_seconds: number | null;
  is_complete: boolean;
};

type ReviewGuidancePanelProps = {
  reviewGuidanceRef: RefObject<HTMLElement | null>;
  translationProgress: TranslationProgress | null;
  formatEta: (seconds: number | null) => string;
  workflowStatusLabel: string;
  guidanceTitle: string;
  guidanceDetail: string;
  completedBlocks: number;
  totalBlocks: number;
  reviewProgressPercent: number;
  unresolvedBlocks: number;
  totalSegments: number;
  safeUnresolvedSegments: number;
  flaggedIssuesCount: number;
  unresolvedSegments: number;
  segmentsRequiringAttention: number;
  unresolvedAmbiguities: number;
  unresolvedSemanticReviews: number;
  startHereActionLabel: string;
  lastSavedAt: string | null;
  lastExportTimestamp: string | null;
  lastExportMode: ExportMode | null;
  lastExportFormat: string;
  showSaveWorkflowDraft: boolean;
  actionLoading: boolean;
  onSaveWorkflowDraft: () => void;
  onPrimaryGuidanceAction: () => void;
  primaryGuidanceLabel: string;
  isReadOnly: boolean;
  onReopenReview: () => void;
  jobFailed: boolean;
  exportHistory: ExportHistoryItem[];
};

export function ReviewGuidancePanel({
  reviewGuidanceRef,
  translationProgress,
  formatEta,
  workflowStatusLabel,
  guidanceTitle,
  guidanceDetail,
  completedBlocks,
  totalBlocks,
  reviewProgressPercent,
  unresolvedBlocks,
  totalSegments,
  safeUnresolvedSegments,
  flaggedIssuesCount,
  unresolvedSegments,
  segmentsRequiringAttention,
  unresolvedAmbiguities,
  unresolvedSemanticReviews,
  startHereActionLabel,
  lastSavedAt,
  lastExportTimestamp,
  lastExportMode,
  lastExportFormat,
  showSaveWorkflowDraft,
  actionLoading,
  onSaveWorkflowDraft,
  onPrimaryGuidanceAction,
  primaryGuidanceLabel,
  isReadOnly,
  onReopenReview,
  jobFailed,
  exportHistory,
}: ReviewGuidancePanelProps) {
  return (
    <>
      {translationProgress && !translationProgress.is_complete && (
        <section className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm">
          <p className="text-sm font-medium text-emerald-900">Translation status</p>
          <p className="mt-1 text-sm text-slate-700">
            {translationProgress.stage_label} • {translationProgress.completed_segments}/
            {translationProgress.total_segments} segments • {formatEta(translationProgress.eta_seconds)}
          </p>
        </section>
      )}

      <section ref={reviewGuidanceRef} className="mb-6 rounded-2xl border-2 border-indigo-200 bg-indigo-50/40 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Review Guidance</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{workflowStatusLabel}</p>
            <p className="mt-2 text-sm font-medium text-slate-800">{guidanceTitle}</p>
            <p className="mt-1 text-sm text-slate-600">{guidanceDetail}</p>
            <div className="mt-3 rounded-lg border border-indigo-200 bg-white px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Review progress</p>
                <p className="text-xs font-medium text-slate-700">
                  {completedBlocks} of {totalBlocks} blocks completed
                </p>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-indigo-100">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all"
                  style={{ width: `${Math.max(0, Math.min(100, reviewProgressPercent))}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-600">
                {reviewProgressPercent}% complete • {unresolvedBlocks} unresolved block
                {unresolvedBlocks === 1 ? "" : "s"} remaining
              </p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Blocks</p>
                <p className="font-semibold text-slate-900">{totalBlocks}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Segments</p>
                <p className="font-semibold text-slate-900">{totalSegments}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Safe</p>
                <p className="font-semibold text-slate-900">{safeUnresolvedSegments}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Flagged issues</p>
                <p className="font-semibold text-slate-900">{flaggedIssuesCount}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Unresolved</p>
                <p className="font-semibold text-slate-900">{unresolvedSegments}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Needs attention</p>
                <p className="font-semibold text-slate-900">{segmentsRequiringAttention}</p>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Ambiguities: <span className="font-semibold text-slate-900">{unresolvedAmbiguities}</span> • Semantic
              memory reviews: <span className="font-semibold text-slate-900">{unresolvedSemanticReviews}</span>
            </p>
            <div className="mt-3 rounded-lg border border-indigo-200 bg-white px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Recommended next step</p>
              <p className="mt-1 text-sm text-slate-700">{startHereActionLabel}</p>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Progress: In Review → Draft Saved → Ready for Export → Exported
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Last saved:{" "}
              <span className="font-medium text-slate-900">
                {lastSavedAt ? new Date(lastSavedAt).toLocaleString() : "Not saved yet"}
              </span>
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Last export:{" "}
              <span className="font-medium text-slate-900">
                {lastExportTimestamp ? new Date(lastExportTimestamp).toLocaleString() : "No export yet"}
              </span>
              {" • "}
              Format: <span className="font-medium text-slate-900">{lastExportFormat.toUpperCase()}</span>
              {" • "}
              Formatting mode:{" "}
              <span className="font-medium text-slate-900">
                {lastExportMode === "preserve_formatting"
                  ? "Preserve original formatting"
                  : lastExportMode === "clean_text"
                    ? "Clean text only"
                    : "Not available"}
              </span>
            </p>
          </div>
          <div className="flex min-w-[220px] flex-col items-end gap-2">
            {showSaveWorkflowDraft && (
              <button
                type="button"
                onClick={onSaveWorkflowDraft}
                disabled={actionLoading}
                className="text-xs font-medium text-slate-600 underline underline-offset-2 hover:text-slate-800 disabled:opacity-60"
              >
                Save draft
              </button>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={onPrimaryGuidanceAction}
                disabled={actionLoading}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
              >
                {primaryGuidanceLabel}
              </button>
              {isReadOnly && (
                <button
                  type="button"
                  onClick={onReopenReview}
                  disabled={actionLoading}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Re-open review
                </button>
              )}
              {jobFailed && (
                <p className="text-xs text-slate-500">Use retry to re-run failed workflow stages.</p>
              )}
            </div>
          </div>
        </div>
        {exportHistory.length > 1 && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Previous exports</p>
            <ul className="mt-2 space-y-1 text-sm">
              {exportHistory.slice(1).map((entry) => (
                <li key={entry.filename} className="flex items-center justify-between gap-3">
                  <span className="text-slate-600">v{entry.version} • {new Date(entry.generated_at).toLocaleString()}</span>
                  <span className="text-xs text-slate-500">Use Export / download again to choose options.</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </>
  );
}
