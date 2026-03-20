"use client";

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
  onApproveCurrentBlock: () => void;
  primaryActionDisabled: boolean;
  onToggleEdit: () => void;
  actionLoading: boolean;
  onSkipBlock: () => void;
  hasDraftChanges: boolean;
  onSaveSegmentEdit: () => void;
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
  onApproveCurrentBlock,
  primaryActionDisabled,
  onToggleEdit,
  actionLoading,
  onSkipBlock,
  hasDraftChanges,
  onSaveSegmentEdit,
}: ReviewDetailsPaneProps) {
  const primaryDecisionLabel = selectedSegmentIsSafe
    ? "Approve"
    : hasAmbiguityChoice
      ? "Use selected translation"
      : hasSemanticChoice
        ? "Confirm selection"
        : "Approve";

  if (reviewComplete) {
    return (
      <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Review details</h2>
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
          <p className="text-sm font-semibold text-emerald-900">Review complete</p>
          <p className="mt-1 text-sm text-slate-700">
            {completedBlocks} of {orderedBlocksLength} blocks reviewed. Block-level decisions are now locked.
          </p>
        </div>
        <p className="mt-4 text-sm text-slate-600">Continue in Review Guidance to preview your document, then export.</p>
        <button
          type="button"
          onClick={onFocusReviewGuidance}
          className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Go to Review Guidance
        </button>
      </aside>
    );
  }

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {!selectedSegment || !selectedBlock ? (
        <div className="text-sm text-slate-600">Select highlighted text to review details.</div>
      ) : (
        <>
          <h2 className="text-lg font-semibold text-slate-900">Review details</h2>
          <p className="mt-1 text-sm text-slate-500">
            Reviewing Block {selectedBlock.block_index + 1} of {orderedBlocksLength}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={onPreviousBlock}
              disabled={selectedBlockPosition <= 0}
              className="rounded border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-40"
            >
              Previous block
            </button>
            <button
              type="button"
              onClick={onNextBlock}
              disabled={selectedBlockPosition === -1 || selectedBlockPosition >= orderedBlocksLength - 1}
              className="rounded border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-40"
            >
              Next block
            </button>
          </div>
          {isLastBlock && (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {unresolvedBlocks === 0 ? (
                <span>Review complete. Continue in Review Guidance.</span>
              ) : (
                <span>{unresolvedBlocks} blocks still unresolved.</span>
              )}
            </div>
          )}
          {selectedSegmentIsSafe && (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
              <p className="text-sm text-slate-700">No issues detected.</p>
            </div>
          )}
          {hasAmbiguityChoice && !isSafeDecisionOnlyMode && ambiguityChoiceIndex === null && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm">
              <p className="font-medium text-amber-900">Choose a Translation</p>
              {ambiguityExplanation && (
                <p className="mt-2 text-xs text-slate-700">{cleanPanelText(ambiguityExplanation)}</p>
              )}
              <div className="mt-3 space-y-2">
                {ambiguityOptions.map((option, idx) => (
                  <label
                    key={`${option.meaning}-${idx}`}
                    className="block cursor-pointer rounded-lg border border-amber-200 bg-white px-3 py-2"
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="ambiguity-choice"
                        value={`option-${idx}`}
                        checked={ambiguityChoiceIndex === idx}
                        onChange={() => onAmbiguityChoiceChange(idx)}
                        disabled={isReadOnly}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                          {cleanPanelText(option.meaning)}
                          {idx === currentSuggestionIndex ? " - Current suggestion" : ""}
                        </p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {hasAmbiguityChoice && !isSafeDecisionOnlyMode && ambiguityChoiceIndex !== null && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm">
              <p className="font-medium text-amber-900">Accepted Translation</p>
              <p className="mt-2 text-slate-800">{ambiguityOptions[ambiguityChoiceIndex]?.translation ?? ""}</p>
            </div>
          )}

          {isEditing && canEditSelectedSegment && !isSafeDecisionOnlyMode && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Edit selected translation</p>
              <textarea
                value={draftTranslation}
                onChange={(e) => onDraftTranslationChange(e.target.value)}
                rows={6}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>
          )}

          {glossaryMatches.length > 0 && !isSafeDecisionOnlyMode && (
            <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50/60 p-3 text-sm">
              <p className="font-medium text-violet-900">Glossary matches</p>
              <ul className="mt-2 space-y-1 text-slate-700">
                {glossaryMatches.map((m, i) => (
                  <li key={`${m.source_term}-${m.target_term}-${i}`}>
                    {m.source_term} → {m.target_term}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasSemanticChoice && !hasAmbiguityChoice && !isSafeDecisionOnlyMode && (
            <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50/60 p-3 text-sm">
              <p className="font-medium text-sky-900">Semantic translation choice available</p>
              <p className="mt-1 text-xs text-sky-700">
                Suggested from similar previous translation
                {typeof semanticSimilarityScore === "number" ? ` (${Math.round(semanticSimilarityScore * 100)}%)` : ""}
              </p>
              <div className="mt-3 space-y-2">
                <label className="block cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2">
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
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Use current translation decision
                      </p>
                    </div>
                  </div>
                </label>
                <label className="block cursor-pointer rounded-lg border border-sky-200 bg-white px-3 py-2">
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
                      <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                        Use previous similar approved translation
                      </p>
                    </div>
                  </div>
                </label>
              </div>
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
                    className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-400"
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
                      className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-400"
                    >
                      {primaryDecisionLabel}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={hasAmbiguityChoice && ambiguityChoiceIndex !== null ? onClearAmbiguityChoice : onToggleEdit}
                    disabled={actionLoading || (!hasAmbiguityChoice && !canEditSelectedSegment)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
                  >
                    {hasAmbiguityChoice && ambiguityChoiceIndex !== null ? "Change choice" : isEditing ? "Cancel edit" : "Edit"}
                  </button>
                  <button
                    type="button"
                    onClick={onSkipBlock}
                    disabled={actionLoading}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Skip
                  </button>
                </div>
              </>
            )}
            {!isReadOnly && currentBlockResolved && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Approved. Continue to the next unresolved block or edit again if needed.
              </div>
            )}
            {!isReadOnly && isEditing && hasDraftChanges && (
              <>
                <button
                  type="button"
                  onClick={onSaveSegmentEdit}
                  disabled={actionLoading || !draftTranslation.trim()}
                  className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-400"
                >
                  Save edited result
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={onToggleEdit}
                    disabled={actionLoading}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
                  >
                    Cancel edit
                  </button>
                  <button
                    type="button"
                    onClick={onSkipBlock}
                    disabled={actionLoading}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Skip
                  </button>
                </div>
              </>
            )}
            {isReadOnly && (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                This document is exported and read-only. Re-open review from the workflow banner to edit.
              </p>
            )}
            <p className="text-xs text-slate-500">Decide this block to continue to the next unresolved block.</p>
          </div>
        </>
      )}
    </aside>
  );
}
