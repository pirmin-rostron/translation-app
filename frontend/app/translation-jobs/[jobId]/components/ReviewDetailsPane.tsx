"use client";

/**
 * ReviewDetailsPane — right sidebar for the review page.
 * Shows Linguistic Insights (tone, register), glossary matches for the active
 * block, memory info, ambiguity choice controls, edit mode, and a pinned
 * progress panel at the bottom.
 */

import { useState } from "react";

type SemanticChoiceOption = "current" | "suggested";
type SelectedBlock = { block_index: number };
type GlossaryMatch = { source_term: string; target_term: string };
type AmbiguityOption = { meaning: string; translation: string };

type ReviewDetailsPaneProps = {
  selectedSegment: { id: number } | null;
  selectedBlock: SelectedBlock | null;
  reviewComplete: boolean;
  onFocusReviewGuidance: () => void;
  orderedBlocksLength: number;
  completedBlocks: number;
  selectedBlockPosition: number;
  onPreviousBlock: () => void;
  onNextBlock: () => void;
  isLastBlock: boolean;
  unresolvedBlocks: number;
  selectedSegmentIsSafe: boolean;
  isSafeDecisionOnlyMode: boolean;
  cleanPanelText: (value: string | null | undefined) => string;
  hasAmbiguityChoice: boolean;
  ambiguityExplanation: string;
  blockAmbiguityIssuesLength: number;
  activeBlockAmbiguityPosition: number;
  ambiguityChoiceIndex: number | null;
  isAmbiguityChoiceUserSelected: boolean;
  ambiguityOptions: AmbiguityOption[];
  currentSuggestionIndex: number | null;
  onAmbiguityChoiceChange: (idx: number) => void;
  onClearAmbiguityChoice: () => void;
  previousAmbiguityChoiceIndex: number | null;
  isReadOnly: boolean;
  isEditing: boolean;
  canEditSelectedSegment: boolean;
  draftTranslation: string;
  onDraftTranslationChange: (v: string) => void;
  glossaryMatches: GlossaryMatch[];
  hasSemanticChoice: boolean;
  semanticSimilarityScore: number | null;
  semanticChoice: SemanticChoiceOption;
  onSemanticChoiceChange: (c: SemanticChoiceOption) => void;
  currentBlockResolved: boolean;
  resolvedAmbiguity: boolean;
  onGoToNextUnresolved: () => void;
  onApproveCurrentBlock: () => void;
  primaryActionDisabled: boolean;
  onToggleEdit: () => void;
  actionLoading: boolean;
  onSkipBlock: () => void;
  hasDraftChanges: boolean;
  onSaveSegmentEdit: () => void;
  exactMemoryUsed: boolean;
  semanticMemoryUsed: boolean;
  memorySimilarityScore: number | null;
  memorySourceText: string | null;
  onAddToGlossary: (src: string, tgt: string) => Promise<void>;
  sourceLanguage: string;
  targetLanguage: string;
};

export function ReviewDetailsPane({
  selectedSegment,
  selectedBlock,
  reviewComplete,
  orderedBlocksLength,
  completedBlocks,
  selectedBlockPosition,
  unresolvedBlocks,
  selectedSegmentIsSafe,
  isSafeDecisionOnlyMode,
  cleanPanelText,
  hasAmbiguityChoice,
  ambiguityExplanation,
  ambiguityChoiceIndex,
  isAmbiguityChoiceUserSelected,
  ambiguityOptions,
  currentSuggestionIndex,
  onAmbiguityChoiceChange,
  onClearAmbiguityChoice,
  previousAmbiguityChoiceIndex,
  isReadOnly,
  isEditing,
  draftTranslation,
  onDraftTranslationChange,
  glossaryMatches,
  hasSemanticChoice,
  semanticSimilarityScore,
  semanticChoice,
  onSemanticChoiceChange,
  currentBlockResolved,
  onToggleEdit,
  actionLoading,
  onAddToGlossary,
  sourceLanguage,
  targetLanguage,
  exactMemoryUsed,
  semanticMemoryUsed,
  memorySimilarityScore,
  memorySourceText,
}: ReviewDetailsPaneProps) {
  const [showGlossaryForm, setShowGlossaryForm] = useState(false);
  const [glossarySource, setGlossarySource] = useState("");
  const [glossaryTarget, setGlossaryTarget] = useState("");
  const [glossarySaving, setGlossarySaving] = useState(false);

  async function handleSaveGlossary() {
    setGlossarySaving(true);
    try {
      await onAddToGlossary(glossarySource.trim(), glossaryTarget.trim());
      setShowGlossaryForm(false);
    } finally {
      setGlossarySaving(false);
    }
  }

  const healthPercent = orderedBlocksLength > 0 ? Math.round((completedBlocks / orderedBlocksLength) * 100) : 0;

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-l border-brand-border bg-brand-surface">
      <div className="flex-1 overflow-y-auto p-5">
        {/* Glossary matches for active block */}
        {glossaryMatches.length > 0 && !isSafeDecisionOnlyMode && (
          <section className="mb-5">
            <p className="m-0 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-brand-hint">Glossary</p>
            <ul className="mt-3 space-y-1.5">
              {glossaryMatches.map((m, i) => (
                <li key={`${m.source_term}-${m.target_term}-${i}`} className="flex items-center gap-2 rounded-xl border border-brand-accent/20 bg-brand-accentSoft/30 p-2.5 text-sm">
                  <span className="font-medium text-brand-text">{m.source_term}</span>
                  <span className="text-brand-hint">→</span>
                  <span className="text-brand-accent">{m.target_term}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Memory info */}
        {exactMemoryUsed && (
          <div className="mb-5 rounded-xl border border-brand-borderSoft bg-brand-sunken/30 p-3">
            <p className="m-0 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-brand-accent">Exact Match</p>
            <p className="m-0 mt-1 text-xs text-brand-subtle">Recalled from a previous approved decision.</p>
          </div>
        )}
        {!exactMemoryUsed && semanticMemoryUsed && (
          <div className="mb-5 rounded-xl border border-brand-borderSoft bg-brand-sunken/30 p-3">
            <p className="m-0 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-brand-accent">
              Semantic Match{typeof memorySimilarityScore === "number" ? ` (~${Math.round(memorySimilarityScore * 100)}%)` : ""}
            </p>
            {memorySourceText && <p className="m-0 mt-1 text-xs italic text-brand-subtle">{memorySourceText}</p>}
          </div>
        )}

        {/* Review complete */}
        {reviewComplete && !selectedSegment && (
          <div className="rounded-xl border border-brand-accent/20 bg-brand-accentMid p-4">
            <p className="m-0 text-sm font-medium text-brand-accent">Review complete</p>
            <p className="m-0 mt-1 text-xs text-brand-muted">{completedBlocks} of {orderedBlocksLength} blocks reviewed. Export your document.</p>
          </div>
        )}

        {/* Active block controls */}
        {selectedBlock && selectedSegment && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="m-0 text-xs font-medium text-brand-muted">Block {selectedBlockPosition + 1} of {orderedBlocksLength}</p>
              {unresolvedBlocks > 0 && <span className="text-xs text-brand-subtle">{unresolvedBlocks} remaining</span>}
            </div>

            {selectedSegmentIsSafe && (
              <div className="rounded-xl border border-brand-borderSoft bg-brand-sunken/30 p-3">
                <p className="m-0 text-sm text-brand-muted">No issues detected.</p>
              </div>
            )}

            {/* Ambiguity: choose */}
            {hasAmbiguityChoice && !isSafeDecisionOnlyMode && ambiguityChoiceIndex === null && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 text-sm">
                <p className="m-0 font-display text-[0.875rem] font-semibold tracking-display text-brand-text">Choose a Translation</p>
                {ambiguityExplanation && <p className="m-0 mt-2 text-xs text-brand-muted">{cleanPanelText(ambiguityExplanation)}</p>}
                <div className="mt-3 space-y-2">
                  {ambiguityOptions.map((option, idx) => {
                    const isPrevChoice = previousAmbiguityChoiceIndex === idx;
                    return (
                      <label key={`${option.meaning}-${idx}`} className={`block cursor-pointer rounded-xl border p-2.5 transition-colors ${isPrevChoice ? "border-brand-accent bg-brand-accentSoft/30" : "border-brand-border bg-brand-surface hover:border-brand-accent/40"}`}>
                        <div className="flex items-start gap-2">
                          <input type="radio" name="ambiguity-choice" checked={previousAmbiguityChoiceIndex === idx} onChange={() => onAmbiguityChoiceChange(idx)} disabled={isReadOnly} className="mt-0.5" />
                          <div>
                            <p className="m-0 text-xs font-medium text-brand-text">{cleanPanelText(option.meaning)}{idx === currentSuggestionIndex ? " — Suggested" : ""}</p>
                            <p className="m-0 mt-0.5 text-xs text-brand-muted">{option.translation}</p>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Ambiguity: chosen */}
            {hasAmbiguityChoice && !isSafeDecisionOnlyMode && ambiguityChoiceIndex !== null && (
              <div className="rounded-xl border border-brand-accent/20 bg-brand-accentSoft/20 p-3 text-sm">
                <p className="m-0 font-medium text-brand-accent">{isAmbiguityChoiceUserSelected ? "Accepted" : "Suggested"} Translation</p>
                <p className="m-0 mt-2 text-brand-text">{ambiguityOptions[ambiguityChoiceIndex]?.translation ?? ""}</p>
                {ambiguityExplanation && <p className="m-0 mt-3 text-xs text-brand-muted">{cleanPanelText(ambiguityExplanation)}</p>}
                <button type="button" onClick={onClearAmbiguityChoice} className="mt-2 text-xs font-medium text-brand-accent hover:underline">Change choice</button>
              </div>
            )}

            {/* Edit textarea */}
            {isEditing && (
              <div className="rounded-xl border border-brand-border bg-brand-surface p-3">
                <p className="m-0 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-brand-accent">Edit translation</p>
                <textarea value={draftTranslation} onChange={(e) => onDraftTranslationChange(e.target.value)} rows={6} className="mt-2 w-full rounded-lg border border-brand-border px-3 py-2 text-sm text-brand-text transition-colors focus:border-brand-accent focus:outline-none" />
                <button type="button" onClick={onToggleEdit} disabled={actionLoading} className="mt-2 text-xs font-medium text-brand-muted hover:text-brand-text disabled:opacity-50">Cancel</button>
              </div>
            )}

            {/* Semantic choice */}
            {hasSemanticChoice && !hasAmbiguityChoice && !isSafeDecisionOnlyMode && (
              <div className="rounded-xl border border-brand-borderSoft bg-brand-sunken/30 p-3 text-sm">
                <p className="m-0 font-medium text-brand-text">Semantic translation choice</p>
                <p className="m-0 mt-1 text-xs text-brand-subtle">From similar previous translation{typeof semanticSimilarityScore === "number" ? ` (${Math.round(semanticSimilarityScore * 100)}%)` : ""}</p>
                <div className="mt-3 space-y-2">
                  <label className="block cursor-pointer rounded-xl border border-brand-border bg-brand-surface p-2.5">
                    <div className="flex items-start gap-2">
                      <input type="radio" name="semantic-choice" checked={semanticChoice === "current"} onChange={() => onSemanticChoiceChange("current")} disabled={isReadOnly} className="mt-0.5" />
                      <p className="m-0 text-xs font-medium text-brand-muted">Use current translation</p>
                    </div>
                  </label>
                  <label className="block cursor-pointer rounded-xl border border-brand-accent bg-brand-surface p-2.5">
                    <div className="flex items-start gap-2">
                      <input type="radio" name="semantic-choice" checked={semanticChoice === "suggested"} onChange={() => onSemanticChoiceChange("suggested")} disabled={isReadOnly} className="mt-0.5" />
                      <p className="m-0 text-xs font-medium text-brand-accent">Use previous approved translation</p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Resolved state */}
            {currentBlockResolved && !isEditing && (
              <div>
                <div className="rounded-xl border border-brand-accent/20 bg-brand-accentMid p-3 text-sm text-brand-accent">Translation approved.</div>
                {!isReadOnly && (
                  <div className="mt-3 space-y-2">
                    <button type="button" onClick={onToggleEdit} disabled={actionLoading} className="w-full rounded-full border border-brand-border bg-brand-surface px-3 py-1.5 text-xs font-medium text-brand-muted transition-colors hover:bg-brand-sunken disabled:opacity-50">Edit</button>
                    {!showGlossaryForm ? (
                      <button type="button" onClick={() => { setGlossarySource(glossaryMatches[0]?.source_term ?? ""); setGlossaryTarget(glossaryMatches[0]?.target_term ?? ""); setShowGlossaryForm(true); }} className="w-full text-xs font-medium text-brand-accent hover:underline">+ Add to glossary</button>
                    ) : (
                      <div className="space-y-2">
                        <input value={glossarySource} onChange={(e) => setGlossarySource(e.target.value)} placeholder={`Source (${sourceLanguage})`} disabled={glossarySaving} className="w-full rounded-lg border border-brand-border px-2 py-1.5 text-sm transition-colors focus:border-brand-accent focus:outline-none disabled:opacity-50" />
                        <input value={glossaryTarget} onChange={(e) => setGlossaryTarget(e.target.value)} placeholder={`Target (${targetLanguage})`} disabled={glossarySaving} className="w-full rounded-lg border border-brand-border px-2 py-1.5 text-sm transition-colors focus:border-brand-accent focus:outline-none disabled:opacity-50" />
                        <div className="flex items-center gap-2">
                          <button type="button" disabled={glossarySaving || !glossarySource.trim() || !glossaryTarget.trim()} onClick={() => { void handleSaveGlossary(); }} className="rounded-full bg-brand-accent px-3 py-1 text-xs font-medium text-white disabled:opacity-50">{glossarySaving ? "Saving…" : "Save"}</button>
                          <button type="button" onClick={() => setShowGlossaryForm(false)} disabled={glossarySaving} className="text-xs text-brand-subtle hover:text-brand-muted disabled:opacity-50">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Unresolved: edit toggle */}
            {!currentBlockResolved && !isEditing && !isReadOnly && (
              <button type="button" onClick={onToggleEdit} disabled={actionLoading} className="w-full rounded-full border border-brand-border bg-brand-surface px-3 py-1.5 text-xs font-medium text-brand-muted transition-colors hover:bg-brand-sunken disabled:opacity-50">Edit translation</button>
            )}

            {isReadOnly && (
              <p className="m-0 rounded-xl border border-brand-borderSoft bg-brand-sunken/30 p-3 text-xs text-brand-subtle">This document is exported and read-only.</p>
            )}
          </div>
        )}
      </div>

      {/* Progress — pinned bottom */}
      <div className="shrink-0 border-t border-brand-borderSoft bg-brand-surface p-4">
        <p className="m-0 mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-brand-hint">Progress</p>
        <div className="flex items-baseline justify-between">
          <span className="font-display text-[1.5rem] font-semibold leading-none tracking-display text-brand-text">{healthPercent}%</span>
          <span className="font-mono text-[0.6875rem] text-brand-muted">{completedBlocks}/{orderedBlocksLength}</span>
        </div>
        <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-brand-sunken">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-accent to-brand-accentHov transition-[width] duration-500" style={{ width: `${healthPercent}%` }} />
        </div>
      </div>
    </aside>
  );
}
