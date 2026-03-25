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
  onFocusReviewGuidance,
  orderedBlocksLength,
  completedBlocks,
  selectedBlockPosition,
  onPreviousBlock,
  onNextBlock,
  isLastBlock,
  unresolvedBlocks,
  selectedSegmentIsSafe,
  isSafeDecisionOnlyMode,
  cleanPanelText,
  hasAmbiguityChoice,
  ambiguityExplanation,
  blockAmbiguityIssuesLength,
  activeBlockAmbiguityPosition,
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
  resolvedAmbiguity,
  onGoToNextUnresolved,
  onApproveCurrentBlock,
  primaryActionDisabled,
  onToggleEdit,
  actionLoading,
  onSkipBlock,
  hasDraftChanges,
  onSaveSegmentEdit,
  exactMemoryUsed,
  semanticMemoryUsed,
  memorySimilarityScore,
  memorySourceText,
  onAddToGlossary,
  sourceLanguage,
  targetLanguage,
}: ReviewDetailsPaneProps) {
  const primaryDecisionLabel = hasSemanticChoice && !hasAmbiguityChoice ? "Confirm selection" : "Approve";

  // Glossary form state
  const [showGlossaryForm, setShowGlossaryForm] = useState(false);
  const [glossarySource, setGlossarySource] = useState("");
  const [glossaryTarget, setGlossaryTarget] = useState("");
  const [glossarySaving, setGlossarySaving] = useState(false);

  // Reset glossary form when block becomes unresolved
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

  if (reviewComplete) {
    return (
      <aside className="border border-stone-200 bg-white p-6">
        <h2 className="text-lg font-semibold" style={{ color: "#1A110A" }}>Review details</h2>
        <div className="mt-3 border border-stone-200 bg-stone-50 p-4">
          <p className="text-sm font-semibold" style={{ color: "#1A110A" }}>Review complete</p>
          <p className="mt-1 text-sm text-stone-600">
            {completedBlocks} of {orderedBlocksLength} blocks reviewed. Block-level decisions are now locked.
          </p>
        </div>
        <p className="mt-4 text-sm text-stone-500">Continue in Review Guidance to preview your document, then export.</p>
        <button
          type="button"
          onClick={onFocusReviewGuidance}
          className="mt-3 border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50"
        >
          Go to Review Guidance
        </button>
      </aside>
    );
  }

  return (
    <aside className="border border-stone-200 bg-white p-6">
      {!selectedSegment || !selectedBlock ? (
        <div className="text-sm text-stone-500">Select highlighted text to review details.</div>
      ) : (
        <>
          <h2 className="text-lg font-semibold" style={{ color: "#1A110A" }}>Review details</h2>
          <p className="mt-1 text-sm text-stone-500">
            Reviewing Block {selectedBlockPosition + 1} of {orderedBlocksLength}
          </p>

          {isLastBlock && (unresolvedBlocks === 0 || !currentBlockResolved) && (
            <div className="mt-3 border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600">
              {unresolvedBlocks === 0 ? (
                <span>Review complete. Continue in Review Guidance.</span>
              ) : (
                <span>{unresolvedBlocks} blocks still unresolved.</span>
              )}
            </div>
          )}
          {selectedSegmentIsSafe && (
            <div className="mt-3 border border-stone-200 bg-stone-50 p-3">
              <p className="text-sm text-stone-600">No issues detected.</p>
            </div>
          )}

          {/* State 1: choose a translation */}
          {hasAmbiguityChoice && !isSafeDecisionOnlyMode && ambiguityChoiceIndex === null && (
            <div className="mt-4 border border-amber-200 bg-amber-50 p-3 text-sm">
              <p className="font-medium text-amber-900">Choose a Translation</p>
              {ambiguityExplanation && (
                <p className="mt-2 text-xs text-stone-600">{cleanPanelText(ambiguityExplanation)}</p>
              )}
              <div className="mt-3 space-y-2">
                {ambiguityOptions.map((option, idx) => {
                  const isPrevChoice = previousAmbiguityChoiceIndex === idx;
                  return (
                    <label
                      key={`${option.meaning}-${idx}`}
                      className={`block cursor-pointer border px-3 py-2 ${
                        isPrevChoice ? "border-amber-400 bg-amber-50" : "border-amber-200 bg-white"
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
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                            {cleanPanelText(option.meaning)}
                            {idx === currentSuggestionIndex ? " — Suggested" : ""}
                          </p>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
              {previousAmbiguityChoiceIndex !== null && (
                <p className="mt-2 text-xs text-stone-500">
                  You previously selected this option. Select a different option to change.
                </p>
              )}
            </div>
          )}

          {/* State 2: choice made, not yet approved */}
          {hasAmbiguityChoice && !isSafeDecisionOnlyMode && ambiguityChoiceIndex !== null && (
            <div className="mt-4 border border-amber-200 bg-amber-50 p-3 text-sm">
              <p className="font-medium text-amber-900">
                {isAmbiguityChoiceUserSelected ? "Accepted Translation" : "Suggested Translation"}
              </p>
              <p className="mt-2" style={{ color: "#1A110A" }}>{ambiguityOptions[ambiguityChoiceIndex]?.translation ?? ""}</p>
              {ambiguityExplanation && (
                <p className="mt-3 text-xs text-stone-600">{cleanPanelText(ambiguityExplanation)}</p>
              )}
              <div className="mt-3 space-y-2">
                {ambiguityOptions.map((option, idx) => {
                  const isSelected = ambiguityChoiceIndex === idx;
                  return (
                    <label
                      key={`${option.meaning}-${idx}`}
                      className={`block cursor-pointer border px-3 py-2 ${
                        isSelected ? "border-amber-400 bg-amber-50" : "border-amber-200 bg-white"
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
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                            {cleanPanelText(option.meaning)}
                            {idx === currentSuggestionIndex ? " — Suggested" : ""}
                          </p>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {isEditing && canEditSelectedSegment && (
            <div className="mt-4 border border-stone-200 bg-white p-3">
              <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "#0D7B6E" }}>Edit selected translation</p>
              <textarea
                value={draftTranslation}
                onChange={(e) => onDraftTranslationChange(e.target.value)}
                rows={6}
                className="mt-2 w-full border border-stone-300 px-3 py-2 text-sm focus:border-[#0D7B6E] focus:outline-none"
                style={{ color: "#1A110A" }}
              />
            </div>
          )}

          {glossaryMatches.length > 0 && !isSafeDecisionOnlyMode && (
            <div className="mt-4 border border-stone-200 bg-stone-50 p-3 text-sm">
              <p className="font-medium text-xs uppercase tracking-widest" style={{ color: "#0D7B6E" }}>Glossary matches</p>
              <ul className="mt-2 space-y-1 text-stone-600">
                {glossaryMatches.map((m, i) => (
                  <li key={`${m.source_term}-${m.target_term}-${i}`}>
                    {m.source_term} → {m.target_term}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasSemanticChoice && !hasAmbiguityChoice && !isSafeDecisionOnlyMode && (
            <div className="mt-4 border border-stone-200 bg-stone-50 p-3 text-sm">
              <p className="font-medium" style={{ color: "#1A110A" }}>Semantic translation choice available</p>
              <p className="mt-1 text-xs text-stone-500">
                Suggested from similar previous translation
                {typeof semanticSimilarityScore === "number" ? ` (${Math.round(semanticSimilarityScore * 100)}%)` : ""}
              </p>
              <div className="mt-3 space-y-2">
                <label className="block cursor-pointer border border-stone-200 bg-white px-3 py-2">
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
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                        Use current translation decision
                      </p>
                    </div>
                  </div>
                </label>
                <label className="block cursor-pointer border bg-white px-3 py-2" style={{ borderColor: "#0D7B6E" }}>
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
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "#0D7B6E" }}>
                        Use previous similar approved translation
                      </p>
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {exactMemoryUsed && (
            <div className="mt-4 border border-stone-200 bg-stone-50 p-3 text-sm">
              <p className="font-medium text-xs uppercase tracking-widest" style={{ color: "#0D7B6E" }}>Translation Memory: Exact Match</p>
              <p className="mt-1 text-xs text-stone-500">
                This translation was recalled from a previous approved decision.
              </p>
            </div>
          )}
          {!exactMemoryUsed && semanticMemoryUsed && (
            <div className="mt-4 border border-stone-200 bg-stone-50 p-3 text-sm">
              <p className="font-medium text-xs uppercase tracking-widest" style={{ color: "#0D7B6E" }}>
                Translation Memory: Semantic Match
                {typeof memorySimilarityScore === "number"
                  ? ` (~${Math.round(memorySimilarityScore * 100)}%)`
                  : ""}
              </p>
              {memorySourceText && (
                <p className="mt-1 text-xs text-stone-500">
                  Original source: <span className="italic">{memorySourceText}</span>
                </p>
              )}
            </div>
          )}

          <div className="mt-6 space-y-3">
            {!isReadOnly && !currentBlockResolved && !isEditing && (
              <>
                {hasAmbiguityChoice && ambiguityChoiceIndex !== null && (
                  <button
                    type="button"
                    onClick={onApproveCurrentBlock}
                    disabled={primaryActionDisabled}
                    className="w-full rounded-full px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: "#0D7B6E" }}
                  >
                    {primaryDecisionLabel}
                  </button>
                )}
                <div className={`grid gap-2 ${!hasAmbiguityChoice ? "grid-cols-3" : "grid-cols-2"}`}>
                  {!hasAmbiguityChoice && (
                    <button
                      type="button"
                      onClick={onApproveCurrentBlock}
                      disabled={primaryActionDisabled}
                      className="rounded-full px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: "#0D7B6E" }}
                    >
                      {primaryDecisionLabel}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={hasAmbiguityChoice && ambiguityChoiceIndex !== null ? onClearAmbiguityChoice : onToggleEdit}
                    disabled={actionLoading || (!hasAmbiguityChoice && !canEditSelectedSegment)}
                    className="rounded-full border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-60"
                  >
                    {hasAmbiguityChoice && ambiguityChoiceIndex !== null ? "Change choice" : "Edit"}
                  </button>
                  <button
                    type="button"
                    onClick={onSkipBlock}
                    disabled={actionLoading}
                    className="rounded-full border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-400 hover:bg-stone-50 disabled:opacity-60"
                  >
                    Skip
                  </button>
                </div>
              </>
            )}
            {!isReadOnly && currentBlockResolved && !isEditing && (
              <>
                <div className="border border-teal-200 bg-teal-50 px-3 py-2 text-sm" style={{ color: "#0D7B6E" }}>
                  Translation approved.
                </div>
                {unresolvedBlocks > 0 && (
                  <button
                    type="button"
                    onClick={onGoToNextUnresolved}
                    disabled={actionLoading}
                    className="w-full rounded-full px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: "#0D7B6E" }}
                  >
                    Go to next unresolved block
                  </button>
                )}
                <button
                  type="button"
                  onClick={onToggleEdit}
                  disabled={actionLoading}
                  className="w-full rounded-full border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-60"
                >
                  Edit
                </button>
                {/* Add to glossary */}
                {!showGlossaryForm ? (
                  <button
                    type="button"
                    onClick={() => {
                      setGlossarySource(glossaryMatches[0]?.source_term ?? "");
                      setGlossaryTarget(glossaryMatches[0]?.target_term ?? "");
                      setShowGlossaryForm(true);
                    }}
                    className="w-full text-sm font-medium"
                    style={{ color: "#0D7B6E" }}
                  >
                    + Add to glossary
                  </button>
                ) : (
                  <div className="space-y-2">
                    <input
                      value={glossarySource}
                      onChange={(e) => setGlossarySource(e.target.value)}
                      placeholder={`Source term (${sourceLanguage})`}
                      disabled={glossarySaving}
                      className="w-full border border-stone-300 px-2 py-1.5 text-sm focus:border-[#0D7B6E] focus:outline-none disabled:opacity-50"
                    />
                    <input
                      value={glossaryTarget}
                      onChange={(e) => setGlossaryTarget(e.target.value)}
                      placeholder={`Target term (${targetLanguage})`}
                      disabled={glossarySaving}
                      className="w-full border border-stone-300 px-2 py-1.5 text-sm focus:border-[#0D7B6E] focus:outline-none disabled:opacity-50"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={glossarySaving || !glossarySource.trim() || !glossaryTarget.trim()}
                        onClick={() => { void handleSaveGlossary(); }}
                        className="rounded-full px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                        style={{ backgroundColor: "#0D7B6E" }}
                      >
                        {glossarySaving ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowGlossaryForm(false)}
                        disabled={glossarySaving}
                        className="text-xs text-stone-400 hover:text-stone-600 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
            {!isReadOnly && isEditing && (
              <>
                <button
                  type="button"
                  onClick={onSaveSegmentEdit}
                  disabled={actionLoading || !hasDraftChanges || !draftTranslation.trim()}
                  className="w-full rounded-full px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: "#0D7B6E" }}
                >
                  Save translation
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={onToggleEdit}
                    disabled={actionLoading}
                    className="rounded-full border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={onSkipBlock}
                    disabled={actionLoading}
                    className="rounded-full border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-400 hover:bg-stone-50 disabled:opacity-60"
                  >
                    Skip
                  </button>
                </div>
              </>
            )}
            {isReadOnly && (
              <p className="border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-500">
                This document is exported and read-only. Re-open review from the workflow banner to edit.
              </p>
            )}
            {!currentBlockResolved && (
              <p className="text-xs text-stone-400">
                {unresolvedBlocks <= 1
                  ? "This is the last block. Approve to complete your review."
                  : "Review and approve this block to continue."}
              </p>
            )}
            {/* Navigation — bottom of panel */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onPreviousBlock}
                disabled={selectedBlockPosition <= 0}
                className="border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40"
              >
                Previous block
              </button>
              <button
                type="button"
                onClick={onNextBlock}
                disabled={selectedBlockPosition === -1 || selectedBlockPosition >= orderedBlocksLength - 1}
                className="border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40"
              >
                Next block
              </button>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
