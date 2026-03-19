"use client";

type ReviewMode = "document" | "issues";
type IssueType = "ambiguity" | "glossary" | "exact_memory" | "semantic_memory";
type SegmentStatus = "approved" | "edited" | "memory_match" | "unreviewed";
type SemanticChoiceOption = "current" | "suggested";

type ReviewIssue = {
  key: string;
  type: IssueType;
  title: string;
};

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
  reviewMode: ReviewMode;
  orderedBlocksLength: number;
  completedBlocks: number;
  selectedBlockPosition: number;
  onPreviousBlock: () => void;
  onNextBlock: () => void;
  isLastBlock: boolean;
  unresolvedBlocks: number;
  visibleIssuesLength: number;
  currentIssueIndex: number;
  onPreviousIssue: () => void;
  onNextIssue: () => void;
  selectedIssue: ReviewIssue | null;
  issueTypeLabel: (issueType: IssueType) => string;
  selectedSegmentIsSafe: boolean;
  isSafeDecisionOnlyMode: boolean;
  issueBadgeClass: (issueType: IssueType) => string;
  cleanPanelText: (value: string | null | undefined) => string;
  hasAmbiguityChoice: boolean;
  ambiguityExplanation: string;
  blockAmbiguityIssuesLength: number;
  activeBlockAmbiguityPosition: number;
  ambiguityChoiceIndex: number | null;
  ambiguityOptions: AmbiguityOption[];
  currentSuggestionIndex: number | null;
  onAmbiguityChoiceChange: (idx: number) => void;
  isReadOnly: boolean;
  selectedSegmentStatus: SegmentStatus;
  isEditing: boolean;
  canEditSelectedSegment: boolean;
  draftTranslation: string;
  onDraftTranslationChange: (value: string) => void;
  glossaryMatches: GlossaryMatch[];
  hasSemanticChoice: boolean;
  semanticSimilarityScore: number | null;
  semanticChoice: SemanticChoiceOption;
  onSemanticChoiceChange: (value: SemanticChoiceOption) => void;
  isDocumentMode: boolean;
  currentBlockResolved: boolean;
  onApprove: () => void;
  onApproveCurrentBlock: () => void;
  primaryActionDisabled: boolean;
  onToggleEdit: () => void;
  actionLoading: boolean;
  onSkipBlock: () => void;
  hasDraftChanges: boolean;
  onSaveSegmentEdit: () => void;
  selectedFlaggedIndex: number;
  flaggedLength: number;
};

export function ReviewDetailsPane({
  selectedSegment,
  selectedBlock,
  reviewComplete,
  onFocusReviewGuidance,
  reviewMode,
  orderedBlocksLength,
  completedBlocks,
  selectedBlockPosition,
  onPreviousBlock,
  onNextBlock,
  isLastBlock,
  unresolvedBlocks,
  visibleIssuesLength,
  currentIssueIndex,
  onPreviousIssue,
  onNextIssue,
  selectedIssue,
  issueTypeLabel,
  selectedSegmentIsSafe,
  isSafeDecisionOnlyMode,
  issueBadgeClass,
  cleanPanelText,
  hasAmbiguityChoice,
  ambiguityExplanation,
  blockAmbiguityIssuesLength,
  activeBlockAmbiguityPosition,
  ambiguityChoiceIndex,
  ambiguityOptions,
  currentSuggestionIndex,
  onAmbiguityChoiceChange,
  isReadOnly,
  selectedSegmentStatus,
  isEditing,
  canEditSelectedSegment,
  draftTranslation,
  onDraftTranslationChange,
  glossaryMatches,
  hasSemanticChoice,
  semanticSimilarityScore,
  semanticChoice,
  onSemanticChoiceChange,
  isDocumentMode,
  currentBlockResolved,
  onApprove,
  onApproveCurrentBlock,
  primaryActionDisabled,
  onToggleEdit,
  actionLoading,
  onSkipBlock,
  hasDraftChanges,
  onSaveSegmentEdit,
  selectedFlaggedIndex,
  flaggedLength,
}: ReviewDetailsPaneProps) {
  const prioritizeSaveAction = isEditing && hasDraftChanges;

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
        <p className="mt-4 text-sm text-slate-600">Continue in Review Guidance to export your final document.</p>
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
          {reviewMode === "document" ? (
            <>
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
                    <span>Review complete. You can mark this document ready for export.</span>
                  ) : (
                    <span>{unresolvedBlocks} blocks still unresolved. Continue reviewing to complete this document.</span>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="mt-1">
              <p className="text-sm text-slate-500">
                {visibleIssuesLength
                  ? `Reviewing Issue ${currentIssueIndex + 1} of ${visibleIssuesLength}${
                      selectedIssue ? ` (${issueTypeLabel(selectedIssue.type)} • Block ${selectedBlock.block_index + 1})` : ""
                    }`
                  : "No issue selected"}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onPreviousIssue}
                  disabled={!visibleIssuesLength}
                  className="rounded border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                >
                  Previous issue
                </button>
                <button
                  type="button"
                  onClick={onNextIssue}
                  disabled={!visibleIssuesLength}
                  className="rounded border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                >
                  Next issue
                </button>
              </div>
            </div>
          )}
          {selectedSegmentIsSafe && (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
              <p className="text-sm text-slate-700">No issues detected.</p>
            </div>
          )}
          {selectedIssue && !isSafeDecisionOnlyMode && (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${issueBadgeClass(selectedIssue.type)}`}
                >
                  {issueTypeLabel(selectedIssue.type)}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-700">{cleanPanelText(selectedIssue.title)}</p>
            </div>
          )}
          {hasAmbiguityChoice && !isSafeDecisionOnlyMode && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm">
              <p className="font-medium text-amber-900">Ambiguity detected</p>
              {ambiguityExplanation && (
                <p className="mt-2 text-xs text-slate-700">{cleanPanelText(ambiguityExplanation)}</p>
              )}
              {blockAmbiguityIssuesLength > 1 && (
                <p className="mt-2 text-xs font-medium text-amber-800">
                  Ambiguity {activeBlockAmbiguityPosition} of {blockAmbiguityIssuesLength} in this block
                </p>
              )}
              {ambiguityChoiceIndex == null && (
                <p className="mt-2 text-xs text-amber-800">Choose one meaning to continue.</p>
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

          {!isSafeDecisionOnlyMode && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                {selectedSegmentStatus === "approved" && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    Approved
                  </span>
                )}
                {selectedSegmentStatus === "edited" && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                    Edited and saved
                  </span>
                )}
                {selectedSegmentStatus === "memory_match" && (
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
                    Accepted from memory
                  </span>
                )}
                {selectedSegmentStatus === "unreviewed" && (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
                    Needs review
                  </span>
                )}
              </div>
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
            {!isReadOnly && isDocumentMode && !currentBlockResolved && (
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={selectedSegmentIsSafe ? onApprove : onApproveCurrentBlock}
                  disabled={primaryActionDisabled}
                  className={`rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-60 ${
                    prioritizeSaveAction
                      ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      : "bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-400"
                  }`}
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={onToggleEdit}
                  disabled={actionLoading || !canEditSelectedSegment}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
                >
                  {isEditing ? "Cancel edit" : "Edit"}
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
            )}
            {!isReadOnly && isDocumentMode && currentBlockResolved && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Approved. Continue to the next unresolved block or edit again if needed.
              </div>
            )}
            {!isReadOnly && !isDocumentMode && (selectedSegmentStatus === "unreviewed" || selectedSegmentStatus === "edited") && (
              <button
                type="button"
                onClick={onApprove}
                disabled={actionLoading || !draftTranslation.trim()}
                className={`w-full rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 ${
                  prioritizeSaveAction
                    ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    : "bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-400"
                }`}
              >
                Approve
              </button>
            )}
            {!isReadOnly && !isDocumentMode && (selectedSegmentStatus === "unreviewed" || (isEditing && hasDraftChanges)) && (
              <button
                type="button"
                onClick={onSaveSegmentEdit}
                disabled={actionLoading || !draftTranslation.trim()}
                className={`w-full rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 ${
                  prioritizeSaveAction
                    ? "bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-400"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                Save
              </button>
            )}
            {!isReadOnly && isDocumentMode && isEditing && hasDraftChanges && (
              <button
                type="button"
                onClick={onSaveSegmentEdit}
                disabled={actionLoading || !draftTranslation.trim()}
                className={`w-full rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 ${
                  prioritizeSaveAction
                    ? "bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-400"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                Save
              </button>
            )}
            {isReadOnly && (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                This document is exported and read-only. Re-open review from the workflow banner to edit.
              </p>
            )}
            <p className="text-xs text-slate-500">
              {isDocumentMode
                ? isLastBlock
                  ? unresolvedBlocks === 0
                    ? "End of document reached. Ready to finalize workflow."
                    : `${unresolvedBlocks} blocks still unresolved.`
                  : "Continue reviewing blocks in sequence."
                : visibleIssuesLength
                  ? "Continue resolving issues in sequence."
                  : selectedFlaggedIndex === -1
                    ? "No open issues in current filter."
                    : `Flagged queue position: ${selectedFlaggedIndex + 1} / ${flaggedLength}`}
            </p>
          </div>
        </>
      )}
    </aside>
  );
}
