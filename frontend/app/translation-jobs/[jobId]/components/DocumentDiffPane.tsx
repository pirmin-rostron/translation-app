"use client";

import type { MutableRefObject, ReactNode } from "react";

type ReviewFilter = "all" | "ambiguities" | "glossary" | "memory";

type SegmentRef = { id: number };
type DiffBlock = { block_index: number; segments: SegmentRef[] };
type DocumentNode = {
  key: string;
  type: "block" | "bullet_list";
  block?: DiffBlock;
  blocks?: DiffBlock[];
};

type FilterChip = {
  key: ReviewFilter;
  label: string;
  count: number;
};

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
};

const COLOR_PRIORITY = ["unresolved-ambiguity", "approved-ambiguity", "approved", "memory-match"];

function getBlockColorState(segments: SegmentRef[], segmentColorStates: Map<number, string>): string {
  let best = "pending";
  let bestPriority = -1;
  for (const s of segments) {
    const state = segmentColorStates.get(s.id) ?? "pending";
    const priority = COLOR_PRIORITY.indexOf(state);
    if (priority !== -1 && (bestPriority === -1 || priority < bestPriority)) {
      best = state;
      bestPriority = priority;
    }
  }
  return best;
}

export function DocumentDiffPane({
  activeFilter,
  onFilterChange,
  filterChips,
  displayedNodes,
  displayedBlocksCount,
  totalBlocksCount,
  selectedSegmentId,
  segmentColorStates,
  renderNode,
  segmentRefs,
  blockMemoryStates,
}: DocumentDiffPaneProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="rounded-t-2xl border-b border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          {filterChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => onFilterChange(chip.key)}
              className={`rounded-full px-3 py-1.5 text-sm ${
                activeFilter === chip.key
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {chip.label} ({chip.count})
            </button>
          ))}
        </div>

      </div>

      {!displayedNodes.length ? (
        <div className="p-8 text-slate-600">
          No blocks match this filter. Switch to All Blocks for full document context.
        </div>
      ) : (
        <div className="h-[74vh] overflow-y-auto bg-slate-50/30">
          <div className="sticky top-0 z-20 grid border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-600 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="bg-slate-100/90 px-6 py-3">SOURCE</div>
            <div className="border-l border-slate-200 bg-blue-50/90 px-6 py-3">TRANSLATED</div>
          </div>
          <div className="space-y-4 px-6 py-6">
          {displayedNodes.map((node) => {
            const nodeSegments = node.block?.segments ?? [];
            const isActive = selectedSegmentId != null && nodeSegments.some((segment) => segment.id === selectedSegmentId);
            const blockLabel = node.block ? `Block ${node.block.block_index + 1}` : "Block";
            const blockColorState = getBlockColorState(nodeSegments, segmentColorStates);
            const rowClass =
              blockColorState === "unresolved-ambiguity"
                ? "border-amber-200 bg-amber-50"
                : blockColorState === "approved-ambiguity"
                  ? "border-purple-200 bg-purple-50"
                  : blockColorState === "approved"
                    ? "border-emerald-200 bg-emerald-50"
                    : blockColorState === "memory-match"
                      ? "border-blue-200 bg-blue-50"
                      : isActive
                        ? "border-slate-300 bg-slate-100"
                        : "border-slate-200 bg-white";
            const memoryState = blockMemoryStates.get(node.key);
            const memoryBadge = memoryState?.hasExact ? (
              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                Exact Match
              </span>
            ) : memoryState?.hasSemantic ? (
              <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                Semantic{typeof memoryState.similarityScore === "number" ? ` ~${Math.round(memoryState.similarityScore * 100)}%` : " Match"}
              </span>
            ) : null;
            return (
              <div
                key={node.key}
                className={`overflow-hidden rounded-xl border ${rowClass}`}
                ref={(el) => {
                  nodeSegments.forEach((s) => {
                    segmentRefs.current[s.id] = el;
                  });
                }}
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 bg-white px-4 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{blockLabel}</p>
                  {memoryBadge}
                </div>
                <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="min-w-0 bg-slate-100/45 px-4 py-4">{renderNode(node, "source")}</div>
                  <div className="min-w-0 border-l border-slate-200 bg-blue-50/45 px-4 py-4">
                    {renderNode(node, "target")}
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}
      <div className="border-t border-slate-200 px-6 py-3 text-sm text-slate-500">
        Showing {displayedBlocksCount} of {totalBlocksCount} blocks
      </div>
    </section>
  );
}
