"use client";

import type { Ref } from "react";

type GuidanceStatus = "In Review" | "Review Complete" | "Exported";

type ReviewGuidancePanelProps = {
  reviewGuidanceRef: Ref<HTMLElement>;
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
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  message?: string;
  error?: string;
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
  secondaryActionLabel,
  onSecondaryAction,
  message,
  error,
}: ReviewGuidancePanelProps) {
  const showAmbiguityRow = unresolvedAmbiguities > 0;

  return (
    <section ref={reviewGuidanceRef} className="mb-6 border border-stone-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#0D7B6E" }}>Review Guidance</p>

      <div className="mt-3 border border-stone-100 bg-stone-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">Status overview</p>
        <p className="mt-1 text-2xl font-semibold" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1A110A" }}>{statusLabel}</p>
      </div>

      <div className="mt-3 border border-stone-100 bg-stone-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">Progress summary</p>
        <p className="mt-1 text-sm text-stone-600">
          <span className="font-semibold" style={{ color: "#1A110A" }}>{completedBlocks}</span> of{" "}
          <span className="font-semibold" style={{ color: "#1A110A" }}>{totalBlocks}</span> blocks reviewed
        </p>
        <p className="mt-1 text-sm text-stone-600">
          Remaining blocks: <span className="font-semibold" style={{ color: "#1A110A" }}>{unresolvedBlocks}</span>
        </p>
        {showAmbiguityRow && (
          <p className="mt-1 text-sm text-stone-600">
            Ambiguities: <span className="font-semibold" style={{ color: "#1A110A" }}>{unresolvedAmbiguities}</span>
          </p>
        )}
      </div>

      <div className="mt-3 border border-stone-100 bg-stone-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">Recommended next step</p>
        <p className="mt-1 text-sm text-stone-600">{recommendedNextStep}</p>
      </div>

      <p className="mt-3 text-xs text-stone-400">
        Style: <span className="font-medium">{translationStyle === "literal" ? "Literal" : "Natural"}</span>
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onPrimaryAction}
          disabled={actionLoading || isPrimaryActionDisabled}
          className="rounded-full px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "#0D7B6E" }}
        >
          {primaryActionLabel}
        </button>
        {secondaryActionLabel && onSecondaryAction ? (
          <button
            type="button"
            onClick={onSecondaryAction}
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
          >
            {secondaryActionLabel}
          </button>
        ) : null}
      </div>
      {message && <p className="mt-3 text-sm text-green-700">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}
