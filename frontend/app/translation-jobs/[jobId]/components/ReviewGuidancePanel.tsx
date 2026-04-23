"use client";

/**
 * ReviewGuidancePanel — direction/status/next-step guidance at the top
 * of the review sidebar. Shows review status, progress, and recommended action.
 */

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
  return (
    <section ref={reviewGuidanceRef} className="mb-6 rounded-2xl border border-brand-border bg-brand-surface p-5 shadow-card">
      <p className="m-0 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-brand-accent">Review Guidance</p>

      <div className="mt-3 rounded-xl border border-brand-borderSoft bg-brand-sunken/30 px-4 py-3">
        <p className="m-0 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-brand-subtle">Status</p>
        <p className="m-0 mt-1 font-display text-[1.5rem] font-semibold leading-none tracking-display text-brand-text">{statusLabel}</p>
      </div>

      <div className="mt-3 rounded-xl border border-brand-borderSoft bg-brand-sunken/30 px-4 py-3">
        <p className="m-0 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-brand-subtle">Progress</p>
        <p className="m-0 mt-1 text-sm text-brand-muted">
          <span className="font-semibold text-brand-text">{completedBlocks}</span> of{" "}
          <span className="font-semibold text-brand-text">{totalBlocks}</span> blocks reviewed
        </p>
        <p className="m-0 mt-1 text-sm text-brand-muted">
          Remaining: <span className="font-semibold text-brand-text">{unresolvedBlocks}</span>
        </p>
        {unresolvedAmbiguities > 0 && (
          <p className="m-0 mt-1 text-sm text-brand-muted">
            Ambiguities: <span className="font-semibold text-brand-text">{unresolvedAmbiguities}</span>
          </p>
        )}
      </div>

      <div className="mt-3 rounded-xl border border-brand-borderSoft bg-brand-sunken/30 px-4 py-3">
        <p className="m-0 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-brand-subtle">Next step</p>
        <p className="m-0 mt-1 text-sm text-brand-muted">{recommendedNextStep}</p>
      </div>

      <p className="m-0 mt-3 text-xs text-brand-subtle">
        Style: <span className="font-medium text-brand-muted">{translationStyle === "literal" ? "Literal" : "Natural"}</span>
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onPrimaryAction}
          disabled={actionLoading || isPrimaryActionDisabled}
          className="rounded-full bg-brand-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-accentHov disabled:cursor-not-allowed disabled:opacity-50"
        >
          {primaryActionLabel}
        </button>
        {secondaryActionLabel && onSecondaryAction ? (
          <button
            type="button"
            onClick={onSecondaryAction}
            className="rounded-full border border-brand-border bg-brand-surface px-4 py-2 text-sm font-medium text-brand-muted transition-colors hover:bg-brand-sunken hover:text-brand-text"
          >
            {secondaryActionLabel}
          </button>
        ) : null}
      </div>
      {message && <p className="mt-3 text-sm text-brand-accent">{message}</p>}
      {error && <p className="mt-3 text-sm text-status-error">{error}</p>}
    </section>
  );
}
