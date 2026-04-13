"use client";

import { useEffect, useState } from "react";

type SemanticChoiceOption = "current" | "suggested";

type SelectedBlock = {
  block_index: number;
};

type GlossaryMatch = {
  source_term: string;
  target_term: string;
};

type AmbiguityOption = {
  meaning: string;
  translation: string;
};

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
  previousAmbiguityChoiceIndex: number | null;
  ambiguityOptions: AmbiguityOption[];
  currentSuggestionIndex: number | null;
  onAmbiguityChoiceChange: (idx: number) => void;
  onClearAmbiguityChoice: () => void;
  isReadOnly: boolean;
  isEditing: boolean;
  canEditSelectedSegment: boolean;
  draftTranslation: string;
  onDraftTranslationChange: (value: string) => void;
  glossaryMatches: GlossaryMatch[];
  hasSemanticChoice: boolean;
  semanticSimilarityScore: number | null;
  semanticChoice: SemanticChoiceOption;
  onSemanticChoiceChange: (value: SemanticChoiceOption) => void;
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
  onAddToGlossary: (sourceTerm: string, targetTerm: string) => Promise<void>;
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
  selectedSegmentIsSafe,
  isSafeDecisionOnlyMode,
  cleanPanelText,
  hasAmbiguityChoice,
  ambiguityExplanation,
  ambiguityChoiceIndex,
  isAmbiguityChoiceUserSelected,
  previousAmbiguityChoiceIndex,
  ambiguityOptions,
  currentSuggestionIndex,
  onAmbiguityChoiceChange,
  onClearAmbiguityChoice,
  isReadOnly,
  isEditing,
  canEditSelectedSegment,
  draftTranslation,
  onDraftTranslationChange,
  glossaryMatches,
  hasSemanticChoice,
  semanticSimilarityScore,
  semanticChoice,
  onSemanticChoiceChange,
  currentBlockResolved,
  unresolvedBlocks,
  onToggleEdit,
  actionLoading,
  exactMemoryUsed,
  semanticMemoryUsed,
  memorySimilarityScore,
  memorySourceText,
  onAddToGlossary,
  sourceLanguage,
  targetLanguage,
}: ReviewDetailsPaneProps) {
  const [showGlossaryForm, setShowGlossaryForm] = useState(false);
  const [glossarySource, setGlossarySource] = useState("");
  const [glossaryTarget, setGlossaryTarget] = useState("");
  const [glossarySaving, setGlossarySaving] = useState(false);

  useEffect(() => {
    if (!currentBlockResolved) setShowGlossaryForm(false);
  }, [currentBlockResolved]);

  async function handleSaveGlossary() {
    setGlossarySaving(true);
    try {
      await onAddToGlossary(glossarySource, glossaryTarget);
      setShowGlossaryForm(false);
    } finally {
      setGlossarySaving(false);
    }
  }

  const healthPercent = orderedBlocksLength > 0 ? Math.round((completedBlocks / orderedBlocksLength) * 100) : 0;

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-brand-border bg-brand-surface">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* Semantic Insights — placeholder */}
        <section className="mb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-subtle">Linguistic Insights</p>
          <div className="mt-3 space-y-2">
            <div className="rounded-lg border border-brand-border bg-brand-bg p-3">
              <p className="text-[0.6875rem] font-medium text-brand-muted">Tone</p>
              <p className="mt-1 text-sm text-brand-text">Formal — legal register</p>
            </div>
            <div className="rounded-lg border border-brand-border bg-brand-bg p-3">
              <p className="text-[0.6875rem] font-medium text-brand-muted">Register</p>
              <p className="mt-1 text-sm text-brand-text">Technical — domain specific</p>
            </div>
          </div>
        </section>

        {/* Glossary section */}
        {glossaryMatches.length > 0 && !isSafeDecisionOnlyMode && (
          <section className="mb-5">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-subtle">Glossary</p>
            <ul className="mt-3 space-y-1.5">
              {glossaryMatches.map((m, i) => (
                <li
                  key={`${m.source_term}-${m.target_term}-${i}`}
                  className="rounded-lg border border-status-warning/30 bg-status-warningBg p-2.5 text-sm"
                >
                  <span className="font-medium text-status-warning">{m.source_term}</span>
                  <span className="mx-1.5 text-brand-subtle">→</span>
                  <span className="text-brand-text">{m.target_term}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Review complete state */}
        {reviewComplete && !selectedSegment && (
          <div className="rounded-lg border border-brand-accent/20 bg-brand-accentMid p-4">
            <p className="text-sm font-medium text-brand-accent">Review complete</p>
            <p className="mt-1 text-xs text-brand-muted">
              {completedBlocks} of {orderedBlocksLength} blocks reviewed. Export your document.
            </p>
          </div>
        )}

        {/* Active block controls */}
        {selectedBlock && selectedSegment && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-brand-muted">
                Block {selectedBlockPosition + 1} of {orderedBlocksLength}
              </p>
              {unresolvedBlocks > 0 && (
                <span className="text-xs text-brand-subtle">{unresolvedBlocks} remaining</span>
              )}
            </div>

            {selectedSegmentIsSafe && (
              <div className="rounded-lg border border-brand-border bg-brand-bg p-3">
                <p className="text-sm text-brand-muted">No issues detected.</p>
              </div>
            )}

            {/* Ambiguity: choose */}
            {hasAmbiguityChoice && !isSafeDecisionOnlyMode && ambiguityChoiceIndex === null && (
              <div className="rounded-lg border border-status-warning/30 bg-status-warningBg p-3 text-sm">
                <p className="font-medium text-status-warning">Choose a Translation</p>
                {ambiguityExplanation && (
                  <p className="mt-2 text-xs text-brand-muted">{cleanPanelText(ambiguityExplanation)}</p>
                )}
                <div className="mt-3 space-y-2">
                  {ambiguityOptions.map((option, idx) => {
                    const isPrevChoice = previousAmbiguityChoiceIndex === idx;
                    return (
                      <label
                        key={`${option.meaning}-${idx}`}
                        className={`block cursor-pointer rounded-lg border p-2.5 ${
                          isPrevChoice ? "border-status-warning bg-status-warningBg" : "border-brand-border bg-brand-surface"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <input
                            type="radio"
                            name="ambiguity-choice"
                            value={`option-${idx}`}
                            checked={previousAmbiguityChoiceIndex === idx}
                            onChange={() => onAmbiguityChoiceChange(idx)}
                            disabled={isReadOnly}
                            className="mt-0.5"
                          />
                          <p className="text-xs font-semibold uppercase tracking-wide text-status-warning">
                            {cleanPanelText(option.meaning)}
                            {idx === currentSuggestionIndex ? " — Suggested" : ""}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Ambiguity: chosen */}
            {hasAmbiguityChoice && !isSafeDecisionOnlyMode && ambiguityChoiceIndex !== null && (
              <div className="rounded-lg border border-status-warning/30 bg-status-warningBg p-3 text-sm">
                <p className="font-medium text-status-warning">
                  {isAmbiguityChoiceUserSelected ? "Accepted Translation" : "Suggested Translation"}
                </p>
                <p className="mt-2 text-brand-text">{ambiguityOptions[ambiguityChoiceIndex]?.translation ?? ""}</p>
                {ambiguityExplanation && (
                  <p className="mt-3 text-xs text-brand-muted">{cleanPanelText(ambiguityExplanation)}</p>
                )}
                <div className="mt-3 space-y-2">
                  {ambiguityOptions.map((option, idx) => {
                    const isSelected = ambiguityChoiceIndex === idx;
                    return (
                      <label
                        key={`${option.meaning}-${idx}`}
                        className={`block cursor-pointer rounded-lg border p-2.5 ${
                          isSelected ? "border-status-warning bg-status-warningBg" : "border-brand-border bg-brand-surface"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <input
                            type="radio"
                            name="ambiguity-choice-state2"
                            value={`option-${idx}`}
                            checked={isSelected}
                            onChange={() => onAmbiguityChoiceChange(idx)}
                            disabled={isReadOnly}
                            className="mt-0.5"
                          />
                          <p className="text-xs font-semibold uppercase tracking-wide text-status-warning">
                            {cleanPanelText(option.meaning)}
                            {idx === currentSuggestionIndex ? " — Suggested" : ""}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={onClearAmbiguityChoice}
                  className="mt-2 text-xs font-medium text-status-warning hover:underline"
                >
                  Change choice
                </button>
              </div>
            )}

            {/* Edit textarea */}
            {isEditing && canEditSelectedSegment && (
              <div className="rounded-lg border border-brand-border bg-brand-surface p-3">
                <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">Edit translation</p>
                <textarea
                  value={draftTranslation}
                  onChange={(e) => onDraftTranslationChange(e.target.value)}
                  rows={6}
                  className="mt-2 w-full rounded-lg border border-brand-border px-3 py-2 text-sm text-brand-text focus:border-brand-accent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={onToggleEdit}
                  disabled={actionLoading}
                  className="mt-2 text-xs font-medium text-brand-muted hover:text-brand-text disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Semantic choice */}
            {hasSemanticChoice && !hasAmbiguityChoice && !isSafeDecisionOnlyMode && (
              <div className="rounded-lg border border-brand-border bg-brand-bg p-3 text-sm">
                <p className="font-medium text-brand-text">Semantic translation choice</p>
                <p className="mt-1 text-xs text-brand-subtle">
                  From similar previous translation
                  {typeof semanticSimilarityScore === "number" ? ` (${Math.round(semanticSimilarityScore * 100)}%)` : ""}
                </p>
                <div className="mt-3 space-y-2">
                  <label className="block cursor-pointer rounded-lg border border-brand-border bg-brand-surface p-2.5">
                    <div className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="semantic-choice"
                        value="current"
                        checked={semanticChoice === "current"}
                        onChange={() => onSemanticChoiceChange("current")}
                        disabled={isReadOnly}
                        className="mt-0.5"
                      />
                      <p className="text-xs font-medium uppercase tracking-wide text-brand-muted">
                        Use current translation
                      </p>
                    </div>
                  </label>
                  <label className="block cursor-pointer rounded-lg border border-brand-accent bg-brand-surface p-2.5">
                    <div className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="semantic-choice"
                        value="suggested"
                        checked={semanticChoice === "suggested"}
                        onChange={() => onSemanticChoiceChange("suggested")}
                        disabled={isReadOnly}
                        className="mt-0.5"
                      />
                      <p className="text-xs font-medium uppercase tracking-wide text-brand-accent">
                        Use previous approved translation
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Memory info */}
            {exactMemoryUsed && (
              <div className="rounded-lg border border-brand-border bg-brand-bg p-3 text-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">Exact Match</p>
                <p className="mt-1 text-xs text-brand-subtle">
                  Recalled from a previous approved decision.
                </p>
              </div>
            )}
            {!exactMemoryUsed && semanticMemoryUsed && (
              <div className="rounded-lg border border-brand-border bg-brand-bg p-3 text-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">
                  Semantic Match
                  {typeof memorySimilarityScore === "number" ? ` (~${Math.round(memorySimilarityScore * 100)}%)` : ""}
                </p>
                {memorySourceText && (
                  <p className="mt-1 text-xs text-brand-subtle">
                    Source: <span className="italic">{memorySourceText}</span>
                  </p>
                )}
              </div>
            )}

            {/* Resolved state */}
            {currentBlockResolved && !isEditing && (
              <div>
                <div className="rounded-lg border border-brand-accent/20 bg-brand-accentMid p-3 text-sm text-brand-accent">
                  Translation approved.
                </div>
                {!isReadOnly && (
                  <div className="mt-3 space-y-2">
                    <button
                      type="button"
                      onClick={onToggleEdit}
                      disabled={actionLoading}
                      className="w-full rounded-full border border-brand-border bg-brand-surface px-3 py-1.5 text-xs font-medium text-brand-muted hover:bg-brand-bg disabled:opacity-50"
                    >
                      Edit
                    </button>
                    {!showGlossaryForm ? (
                      <button
                        type="button"
                        onClick={() => {
                          setGlossarySource(glossaryMatches[0]?.source_term ?? "");
                          setGlossaryTarget(glossaryMatches[0]?.target_term ?? "");
                          setShowGlossaryForm(true);
                        }}
                        className="w-full text-xs font-medium text-brand-accent hover:underline"
                      >
                        + Add to glossary
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <input
                          value={glossarySource}
                          onChange={(e) => setGlossarySource(e.target.value)}
                          placeholder={`Source (${sourceLanguage})`}
                          disabled={glossarySaving}
                          className="w-full rounded-lg border border-brand-border px-2 py-1.5 text-sm focus:border-brand-accent focus:outline-none disabled:opacity-50"
                        />
                        <input
                          value={glossaryTarget}
                          onChange={(e) => setGlossaryTarget(e.target.value)}
                          placeholder={`Target (${targetLanguage})`}
                          disabled={glossarySaving}
                          className="w-full rounded-lg border border-brand-border px-2 py-1.5 text-sm focus:border-brand-accent focus:outline-none disabled:opacity-50"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={glossarySaving || !glossarySource.trim() || !glossaryTarget.trim()}
                            onClick={() => { void handleSaveGlossary(); }}
                            className="rounded-full bg-brand-accent px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                          >
                            {glossarySaving ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowGlossaryForm(false)}
                            disabled={glossarySaving}
                            className="text-xs text-brand-subtle hover:text-brand-muted disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Unresolved: edit toggle */}
            {!currentBlockResolved && !isEditing && !isReadOnly && (
              <button
                type="button"
                onClick={onToggleEdit}
                disabled={actionLoading}
                className="w-full rounded-full border border-brand-border bg-brand-surface px-3 py-1.5 text-xs font-medium text-brand-muted hover:bg-brand-bg disabled:opacity-50"
              >
                Edit translation
              </button>
            )}

            {isReadOnly && (
              <p className="rounded-lg border border-brand-border bg-brand-bg p-3 text-xs text-brand-subtle">
                This document is exported and read-only.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Health panel — pinned bottom */}
      <div className="shrink-0 rounded-lg border border-brand-border bg-brand-surface p-4">
        <p className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-widest text-brand-accent">
          Session Health
        </p>
        <div className="flex items-baseline justify-between">
          <span className="font-display text-2xl font-bold text-brand-text">{healthPercent}%</span>
          <span className="text-xs text-brand-muted">
            {completedBlocks}/{orderedBlocksLength} blocks
          </span>
        </div>
        <div className="mt-2 h-1 w-full rounded-full bg-brand-bg">
          <div
            className="h-1 rounded-full bg-brand-accent transition-all"
            style={{ width: `${healthPercent}%` }}
          />
        </div>
      </div>
    </aside>
  );
}
