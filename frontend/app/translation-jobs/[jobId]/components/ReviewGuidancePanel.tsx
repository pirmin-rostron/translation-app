"use client";

import type { RefObject } from "react";

type GuidanceStatus = "In Review" | "Review Complete" | "Exported";

type ReviewGuidancePanelProps = {
  reviewGuidanceRef: RefObject<HTMLElement | null>;
  statusLabel: GuidanceStatus;
  completedBlocks: number;
  totalBlocks: number;
  unresolvedBlocks: number;
  unresolvedAmbiguities: number;
  recommendedNextStep: string;
  translationStyle: "natural" | "literal";
  primaryActionLabel: string;
  isPrimaryActionDisabled: boolean;
  actionLoading: boolean;
  onPrimaryAction: () => void;
  onPreviewDocument: () => void;
};

export function ReviewGuidancePanel({
  reviewGuidanceRef,
  statusLabel,
  completedBlocks,
  totalBlocks,
  unresolvedBlocks,
  unresolvedAmbiguities,
  recommendedNextStep,
  translationStyle,
  primaryActionLabel,
  isPrimaryActionDisabled,
  actionLoading,
  onPrimaryAction,
  onPreviewDocument,
}: ReviewGuidancePanelProps) {
  const showAmbiguityRow = unresolvedAmbiguities > 0;

  return (
    <section ref={reviewGuidanceRef} className="mb-6 rounded-2xl border-2 border-indigo-200 bg-indigo-50/40 p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Review Guidance</p>

      <div className="mt-3 rounded-lg border border-indigo-200 bg-white px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Status overview</p>
        <p className="mt-1 text-xl font-semibold text-slate-900">{statusLabel}</p>
      </div>

      <div className="mt-3 rounded-lg border border-indigo-200 bg-white px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Progress summary</p>
        <p className="mt-1 text-sm text-slate-700">
          <span className="font-semibold text-slate-900">{completedBlocks}</span> of{" "}
          <span className="font-semibold text-slate-900">{totalBlocks}</span> blocks reviewed
        </p>
        <p className="mt-1 text-sm text-slate-700">
          Remaining blocks: <span className="font-semibold text-slate-900">{unresolvedBlocks}</span>
        </p>
        {showAmbiguityRow && (
          <p className="mt-1 text-sm text-slate-700">
            Ambiguities: <span className="font-semibold text-slate-900">{unresolvedAmbiguities}</span>
          </p>
        )}
      </div>

      <div className="mt-3 rounded-lg border border-indigo-200 bg-white px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Recommended next step</p>
        <p className="mt-1 text-sm text-slate-700">{recommendedNextStep}</p>
      </div>

      <p className="mt-3 text-sm text-slate-600">
        Style: <span className="font-medium text-slate-900">{translationStyle === "literal" ? "Literal" : "Natural"}</span>
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onPrimaryAction}
          disabled={actionLoading || isPrimaryActionDisabled}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {primaryActionLabel}
        </button>
        <button
          type="button"
          onClick={onPreviewDocument}
          className="rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
        >
          Preview Document
        </button>
      </div>
    </section>
  );
}
