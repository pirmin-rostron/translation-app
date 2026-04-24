"use client";

/**
 * DocumentDiffPane — renders review blocks as cards matching the prototype.
 * Each block: header with index + status pill + TM badge, two-column source/target,
 * inline insight cards, ambiguity picker with Rumi reasoning, approve/edit footer.
 */

import type { MutableRefObject, ReactNode, Ref } from "react";
import { Icons } from "../../../components/Icons";

type ReviewFilter = "all" | "ambiguities" | "glossary" | "memory";

type SegmentRef = {
  id: number;
  review_status?: string;
  exact_memory_used?: boolean;
  semantic_memory_used?: boolean;
  similarity_score?: number | null;
  ambiguity_detected?: boolean;
  glossary_applied?: boolean;
  glossary_matches?: { matches: Array<{ source_term: string; target_term: string }> } | null;
  ambiguity_details?: {
    source_span: string;
    explanation: string;
    alternatives: Array<{ meaning: string; translation: string }>;
  } | null;
  ambiguity_options?: Array<{ meaning: string; translation: string }>;
};

type DiffBlock = { block_index: number; segments: SegmentRef[] };
type DocumentNode = {
  key: string;
  type: "block" | "bullet_list";
  block?: DiffBlock;
  blocks?: DiffBlock[];
};

type FilterChip = { key: ReviewFilter; label: string; count: number };

type BlockMemoryState = {
  hasExact: boolean;
  hasSemantic: boolean;
  similarityScore: number | null;
};

type DocumentDiffPaneProps = {
  activeFilter: ReviewFilter;
  onFilterChange: (filter: ReviewFilter) => void;
  filterChips: FilterChip[];
  displayedNodes: DocumentNode[];
  displayedBlocksCount: number;
  totalBlocksCount: number;
  selectedSegmentId: number | null;
  segmentColorStates: Map<number, string>;
  renderNode: (node: DocumentNode, side: "source" | "target") => ReactNode;
  segmentRefs: MutableRefObject<Record<number, HTMLDivElement | null>>;
  blockMemoryStates: Map<string, BlockMemoryState>;
  sourceLanguageLabel: string;
  targetLanguageLabel: string;
  canvasRef?: Ref<HTMLElement>;
  density?: "cozy" | "balanced" | "compact";
  ambiguityChoiceIndex: number | null;
  onAmbiguityChoiceChange: (idx: number) => void;
  onBlockActivateAndChoose: (segmentId: number, choiceIdx: number) => void;
  onApproveCurrentBlock: () => void;
  onToggleEdit: () => void;
  isReadOnly: boolean;
  actionLoading: boolean;
  primaryActionDisabled: boolean;
};

function deriveBlockState(segments: SegmentRef[]): "approved" | "edited" | "ambiguity" | "pending" {
  if (segments.length === 0) return "pending";
  const statuses = segments.map((s) => s.review_status ?? "unreviewed");
  if (statuses.every((s) => s === "approved")) return "approved";
  if (statuses.some((s) => s === "edited")) return "edited";
  if (segments.some((s) => s.ambiguity_detected && s.review_status !== "approved" && s.review_status !== "edited")) return "ambiguity";
  return "pending";
}

function BlockStatusPill({ effective }: { effective: string }) {
  if (effective === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[0.6875rem] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
        <Icons.Check className="h-2.5 w-2.5" /> Approved
      </span>
    );
  }
  if (effective === "ambiguity") {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[0.6875rem] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
        Needs your call
      </span>
    );
  }
  if (effective === "edited") {
    return (
      <span className="inline-flex items-center rounded-full bg-status-warningBg px-2.5 py-0.5 text-[0.6875rem] font-medium text-status-warning ring-1 ring-inset ring-status-warning/20">
        Edited
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-brand-sunken px-2.5 py-0.5 text-[0.6875rem] font-medium text-brand-muted">
      Pending
    </span>
  );
}

function InsightBadge({ segment }: { segment: SegmentRef }) {
  const badges: React.ReactNode[] = [];

  if (segment.glossary_applied && segment.glossary_matches?.matches?.length) {
    segment.glossary_matches.matches.forEach((m, i) => {
      badges.push(
        <span key={`g-${i}`} className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[0.625rem] font-medium text-violet-700 ring-1 ring-inset ring-violet-200">
          Glossary · {m.source_term}
        </span>
      );
    });
  }

  if (segment.exact_memory_used || segment.semantic_memory_used) {
    const pct = segment.similarity_score != null ? Math.round(segment.similarity_score * 100) : null;
    badges.push(
      <span key="mem" className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[0.625rem] font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
        <span className="font-mono">{pct != null ? `${pct}%` : "TM"}</span> memory
      </span>
    );
  }

  if (segment.ambiguity_detected && segment.review_status !== "approved" && segment.review_status !== "edited") {
    badges.push(
      <span key="amb" className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[0.625rem] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
        Ambiguity
      </span>
    );
  }

  if (badges.length === 0) return null;
  return <div className="mt-3 flex flex-wrap items-center gap-1.5">{badges}</div>;
}

export function DocumentDiffPane({
  displayedNodes,
  selectedSegmentId,
  renderNode,
  segmentRefs,
  blockMemoryStates,
  sourceLanguageLabel,
  targetLanguageLabel,
  canvasRef,
  density = "balanced",
  ambiguityChoiceIndex,
  onAmbiguityChoiceChange,
  onBlockActivateAndChoose,
  onApproveCurrentBlock,
  onToggleEdit,
  isReadOnly,
  actionLoading,
  primaryActionDisabled,
}: DocumentDiffPaneProps) {
  const activeIndex = displayedNodes.findIndex((node) => {
    const segments = node.block?.segments ?? [];
    return selectedSegmentId != null && segments.some((s) => s.id === selectedSegmentId);
  });

  const spacingCls = density === "cozy" ? "space-y-6" : density === "compact" ? "space-y-2" : "space-y-4";
  const padCls = density === "compact" ? "p-3" : density === "cozy" ? "p-6" : "p-5";

  if (!displayedNodes.length) {
    return (
      <main ref={canvasRef} tabIndex={-1} className="flex-1 overflow-y-auto outline-none">
        <div className="flex h-full items-center justify-center text-brand-subtle">
          No blocks to display.
        </div>
      </main>
    );
  }

  return (
    <main ref={canvasRef} tabIndex={-1} className="flex-1 overflow-y-auto outline-none">
      <div className="mx-auto max-w-[1180px] px-10 py-8">
        <div className={spacingCls}>
          {displayedNodes.map((node, nodeIndex) => {
            const segments = node.block?.segments ?? [];
            const isActive = activeIndex === nodeIndex;
            const blockState = deriveBlockState(segments);
            const blockKey = node.block ? String(node.block.block_index) : node.key;
            const memState = blockMemoryStates.get(blockKey);

            const borderCls = isActive
              ? "border-brand-accent/50 shadow-[0_0_0_3px_rgba(13,123,110,0.06)]"
              : blockState === "approved"
                ? "border-emerald-200/60"
                : blockState === "ambiguity"
                  ? "border-amber-200/60"
                  : "border-brand-border";

            // Collect all insight badges from segments
            const allInsightBadges = segments.flatMap((s) => {
              const b: React.ReactNode[] = [];
              if (s.glossary_applied && s.glossary_matches?.matches?.length) {
                s.glossary_matches.matches.forEach((m, i) => {
                  b.push(
                    <span key={`g-${s.id}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[0.625rem] font-medium text-violet-700 ring-1 ring-inset ring-violet-200">
                      Glossary · {m.source_term}
                    </span>
                  );
                });
              }
              if (s.exact_memory_used || s.semantic_memory_used) {
                const pct = s.similarity_score != null ? Math.round(s.similarity_score * 100) : null;
                b.push(
                  <span key={`m-${s.id}`} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[0.625rem] font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
                    <span className="font-mono">{pct != null ? `${pct}%` : "TM"}</span> memory
                  </span>
                );
              }
              return b;
            });

            // Ambiguity data from first segment that has it
            const ambSegment = segments.find((s) =>
              s.ambiguity_detected && s.review_status !== "approved" && s.review_status !== "edited"
            );
            const ambDetails = ambSegment?.ambiguity_details;
            const ambOptions = ambSegment?.ambiguity_options ?? ambDetails?.alternatives ?? [];

            return (
              <div
                key={node.key}
                ref={(el) => {
                  segments.forEach((s) => {
                    segmentRefs.current[s.id] = el;
                  });
                }}
              >
                <article className={`cursor-pointer rounded-2xl border bg-brand-surface transition-all ${borderCls} ${padCls}`}>
                  {/* Header row */}
                  <header className="mb-3 flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 font-mono text-[0.625rem] font-medium uppercase tracking-[0.14em] text-brand-subtle">
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        blockState === "approved" ? "bg-emerald-500"
                        : blockState === "ambiguity" ? "bg-amber-500"
                        : "bg-brand-hint"
                      }`} />
                      B{String((node.block?.block_index ?? nodeIndex) + 1).padStart(2, "0")}
                    </span>
                    <div className="flex-1" />
                    <BlockStatusPill effective={blockState} />
                    {memState && (memState.hasExact || memState.hasSemantic) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[0.625rem] font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
                        <span className="font-mono">{memState.similarityScore != null ? `${Math.round(memState.similarityScore * 100)}%` : "TM"}</span> memory
                      </span>
                    )}
                  </header>

                  {/* Body — two columns */}
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <p className="m-0 mb-1 flex items-center gap-1.5 font-mono text-[0.625rem] font-medium uppercase tracking-[0.14em] text-brand-subtle">
                        Source · {sourceLanguageLabel}
                      </p>
                      <div className={`leading-relaxed text-brand-text ${density === "compact" ? "text-[0.8125rem]" : "text-[0.9375rem]"}`}>
                        {renderNode(node, "source")}
                      </div>
                    </div>
                    <div>
                      <p className="m-0 mb-1 flex items-center gap-1.5 font-mono text-[0.625rem] font-medium uppercase tracking-[0.14em] text-brand-accent">
                        Target · {targetLanguageLabel}
                      </p>
                      <div className={`leading-relaxed text-brand-text ${density === "compact" ? "text-[0.8125rem]" : "text-[0.9375rem]"}`}>
                        {renderNode(node, "target")}
                      </div>
                      {/* Linguistic Insights — inline on active block only */}
                      {isActive && density !== "compact" && (
                        <div className="mt-3 flex items-center gap-2">
                          <span className="inline-flex items-center gap-0">
                            <span className="rounded-l-full bg-brand-sunken px-2 py-0.5 text-[0.625rem] font-medium text-brand-muted">Tone</span>
                            <span className="rounded-r-full bg-brand-sunken/60 px-2 py-0.5 text-[0.625rem] font-medium text-brand-muted">Formal — legal register</span>
                          </span>
                          <span className="inline-flex items-center gap-0">
                            <span className="rounded-l-full bg-brand-sunken px-2 py-0.5 text-[0.625rem] font-medium text-brand-muted">Register</span>
                            <span className="rounded-r-full bg-brand-sunken/60 px-2 py-0.5 text-[0.625rem] font-medium text-brand-muted">Technical — domain specific</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Insight badges — below text, not in compact mode */}
                  {density !== "compact" && allInsightBadges.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center gap-1.5">
                      {allInsightBadges}
                    </div>
                  )}

                  {/* Ambiguity picker */}
                  {ambSegment && ambOptions.length > 1 && (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                      <div className="mb-3 flex items-start gap-3">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800">
                          <Icons.Sparkle className="h-2.5 w-2.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="m-0 flex items-center gap-2 font-display text-[0.875rem] font-semibold tracking-display text-brand-text">
                            Rumi flagged this one
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.625rem] font-medium uppercase tracking-[0.12em] text-amber-800">Ambiguity</span>
                          </p>
                          {ambDetails?.explanation && (
                            <p className="m-0 mt-1 text-[0.8125rem] leading-relaxed text-brand-muted">{ambDetails.explanation}</p>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        {ambOptions.map((alt, i) => {
                          const isSelected = isActive && ambiguityChoiceIndex === i;
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isReadOnly) return;
                                if (!isActive && ambSegment) {
                                  onBlockActivateAndChoose(ambSegment.id, i);
                                } else {
                                  onAmbiguityChoiceChange(i);
                                }
                              }}
                              disabled={isReadOnly}
                              className={`w-full rounded-xl border p-3 text-left transition-colors ${
                                isSelected
                                  ? "border-brand-accent bg-brand-accentSoft"
                                  : "border-brand-border bg-white hover:border-brand-hint"
                              } disabled:cursor-default`}
                            >
                              <div className="flex items-start gap-3">
                                {isSelected ? (
                                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-accent text-white">
                                    <Icons.Check className="h-2.5 w-2.5" />
                                  </span>
                                ) : (
                                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-sunken text-brand-muted">
                                    <span className="font-mono text-[0.625rem]">{i + 1}</span>
                                  </span>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="m-0 text-[0.875rem] leading-relaxed text-brand-text">{alt.translation}</p>
                                  <p className="m-0 mt-1 text-[0.6875rem] italic text-brand-muted">{alt.meaning}</p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Footer actions — only for non-approved blocks */}
                  {blockState !== "approved" && isActive && !isReadOnly && (
                    <div className="mt-4 flex items-center justify-between">
                      <p className={`m-0 text-[0.75rem] ${ambOptions.length > 1 && ambiguityChoiceIndex === null ? "text-brand-muted" : "text-brand-text"}`}>
                        {ambOptions.length > 1
                          ? ambiguityChoiceIndex !== null
                            ? `Option ${ambiguityChoiceIndex + 1} selected`
                            : "Select an option above to approve"
                          : <><span className="rounded bg-brand-sunken px-1.5 py-0.5 font-mono text-brand-muted">↵</span> approve</>
                        }
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onToggleEdit(); }}
                          disabled={actionLoading}
                          className="rounded-full border border-brand-border bg-brand-surface px-3 py-1 text-[0.75rem] font-medium text-brand-muted transition-colors hover:bg-brand-sunken hover:text-brand-text disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onApproveCurrentBlock(); }}
                          disabled={primaryActionDisabled || (ambOptions.length > 1 && ambiguityChoiceIndex === null)}
                          className="flex items-center gap-1 rounded-full bg-brand-text px-3.5 py-1 text-[0.75rem] font-medium text-white transition-colors hover:bg-brand-accent disabled:opacity-40"
                        >
                          <Icons.Check className="h-3 w-3" /> Approve
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
